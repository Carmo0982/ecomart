// @vitest-environment node
/**
 * Pruebas de RLS sobre Postgres real (PGlite) con un entorno que imita a
 * Supabase (ver supabase-stub.sql). Cada prueba corre dentro de una
 * transacción que se revierte al final, así no se contaminan entre sí.
 *
 *  - "ANTES": solo la migración inicial. Las pruebas DEMUESTRAN que los
 *    ataques funcionan (son la prueba de concepto de la auditoría).
 *  - "DESPUÉS": migración inicial + hardening. Los mismos ataques fallan.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const STUB = leer('./supabase-stub.sql');
const M_INICIAL = leer('../migrations/20261101000000_esquema_inicial.sql');
const M_HARDENING = leer('../migrations/20261120000000_hardening_rls.sql');

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';

const SEMILLA_PRODUCTOS = `
  insert into public.products (id, nombre, descripcion, precio, categoria, stock)
  values ('p-001', 'Cepillo de bambú', 'Pack x4', 18900, 'cuidado-personal', 10),
         ('p-002', 'Botella térmica', '750 ml', 74900, 'cocina', 2);
`;

type Fila = Record<string, unknown>;

/** Sesión dentro de una transacción: permite "hacerse pasar" por un usuario. */
class Sesion {
  constructor(private readonly db: PGlite) {}

  /** Cambia el rol de Postgres y el JWT como lo haría PostgREST. */
  async como(sub: string | null, userMetadata: Fila = {}) {
    const rol = sub ? 'authenticated' : 'anon';
    await this.db.exec('reset role');
    await this.db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub, role: rol, user_metadata: userMetadata }),
    ]);
    await this.db.exec(`set local role ${rol}`);
  }

  async comoSuperusuario() {
    await this.db.exec('reset role');
  }

  async filas<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, params)).rows;
  }

  async afectadas(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.db.query(sql, params)).affectedRows ?? 0;
  }

  /** Ejecuta y devuelve el código SQLSTATE del error (o null si no falló). */
  async codigoError(sql: string, params: unknown[] = []): Promise<string | null> {
    await this.db.exec('savepoint intento');
    try {
      await this.db.query(sql, params);
      await this.db.exec('release savepoint intento');
      return null;
    } catch (e) {
      await this.db.exec('rollback to savepoint intento');
      return (e as { code?: string }).code ?? 'desconocido';
    }
  }
}

async function crearBase(conHardening: boolean): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  await db.exec(M_INICIAL);
  if (conHardening) await db.exec(M_HARDENING);
  return db;
}

function enTransaccion(obtenerDb: () => PGlite, prueba: (s: Sesion) => Promise<void>) {
  return async () => {
    const db = obtenerDb();
    await db.exec('begin');
    try {
      await prueba(new Sesion(db));
    } finally {
      await db.exec('rollback');
    }
  };
}

// ---------------------------------------------------------------------------
describe('ANTES · migración inicial (prueba de concepto de los ataques)', () => {
  let db: PGlite;
  const t = (p: (s: Sesion) => Promise<void>) => enTransaccion(() => db, p);

  beforeAll(async () => {
    db = await crearBase(false);
    await db.exec(`
      insert into auth.users (id, email) values
        ('${ANA}', 'ana@ecomart.test'), ('${BETO}', 'beto@ecomart.test');
      insert into public.profiles (id, full_name, phone, address, role) values
        ('${ANA}', 'Ana', '+57 300 111 1111', 'Calle 1 # 2-3', 'cliente'),
        ('${BETO}', 'Beto', '+57 300 222 2222', 'Carrera 4 # 5-6', 'cliente');
      ${SEMILLA_PRODUCTOS}
    `);
  }, 30_000);
  afterAll(async () => db?.close());

  it('C3 · un visitante anónimo lee teléfonos y direcciones de todos', t(async (s) => {
    await s.como(null);
    const perfiles = await s.filas<{ phone: string }>('select phone, address from public.profiles');
    expect(perfiles.map((p) => p.phone)).toEqual(['+57 300 111 1111', '+57 300 222 2222']);
  }));

  it('C2 · Beto se asciende a admin editando su propio perfil', t(async (s) => {
    await s.como(BETO);
    expect(await s.afectadas(`update public.profiles set role = 'admin' where id = $1`, [BETO])).toBe(1);
  }));

  it('C2 · con user_metadata.role = "admin" en su JWT, Beto gestiona productos', t(async (s) => {
    await s.como(BETO, { role: 'admin' }); // user_metadata lo controla el propio usuario
    expect(await s.codigoError(`delete from public.products where id = 'p-002'`)).toBeNull();
    await s.comoSuperusuario();
    expect(await s.filas(`select 1 from public.products where id = 'p-002'`)).toHaveLength(0);
  }));

  it('C3 · cualquier usuario autenticado cambia el precio y la descripción (XSS almacenado)', t(async (s) => {
    await s.como(BETO);
    const n = await s.afectadas(
      `update public.products set precio = 1, descripcion = '<img src=x onerror=alert(1)>' where id = 'p-002'`,
    );
    expect(n).toBe(1);
  }));

  it('C3 · Beto crea un pedido a nombre de Ana con total de $1', t(async (s) => {
    await s.como(BETO);
    const err = await s.codigoError(
      `insert into public.orders (user_id, total, direccion_envio) values ($1, 1, 'x')`,
      [ANA],
    );
    expect(err).toBeNull();
  }));

  it('C3 · Beto ve los pedidos de Ana', t(async (s) => {
    await s.comoSuperusuario();
    await s.filas(`insert into public.orders (user_id, total, direccion_envio) values ($1, 74900, 'Calle 1')`, [ANA]);
    await s.como(BETO);
    expect(await s.filas('select * from public.orders')).toHaveLength(1);
  }));

  it('C3 · order_items sin RLS: un anónimo inserta y lee líneas de pedido', t(async (s) => {
    await s.comoSuperusuario();
    const [pedido] = await s.filas<{ id: string }>(
      `insert into public.orders (user_id, total, direccion_envio) values ($1, 0, 'x') returning id`,
      [ANA],
    );
    await s.como(null);
    const err = await s.codigoError(
      `insert into public.order_items (order_id, product_id, cantidad, precio_unitario) values ($1, 'p-002', 1, 0.01)`,
      [pedido!.id],
    );
    expect(err).toBeNull();
    expect(await s.filas('select * from public.order_items')).toHaveLength(1);
  }));
});

// ---------------------------------------------------------------------------
describe('DESPUÉS · migración inicial + hardening', () => {
  let db: PGlite;
  const t = (p: (s: Sesion) => Promise<void>) => enTransaccion(() => db, p);

  beforeAll(async () => {
    db = await crearBase(true);
    await db.exec(`
      -- El trigger crea los perfiles. Beto intenta registrarse como admin vía metadata.
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${ANA}', 'ana@ecomart.test', '{"full_name":"Ana"}'),
        ('${BETO}', 'beto@ecomart.test', '{"full_name":"Beto","role":"admin"}'),
        ('${ADMIN}', 'admin@ecomart.test', '{"full_name":"Admin"}');
      update public.profiles set phone = '+57 300 111 1111' where id = '${ANA}';
      update public.profiles set role = 'admin' where id = '${ADMIN}'; -- solo desde SQL/servidor
      ${SEMILLA_PRODUCTOS}
    `);
  }, 30_000);
  afterAll(async () => db?.close());

  it('el trigger crea el perfil como "cliente" aunque la metadata diga "admin"', t(async (s) => {
    await s.comoSuperusuario();
    const [beto] = await s.filas<{ role: string }>('select role from public.profiles where id = $1', [BETO]);
    expect(beto?.role).toBe('cliente');
  }));

  it('C3 · un anónimo no puede leer profiles (permiso denegado)', t(async (s) => {
    await s.como(null);
    expect(await s.codigoError('select * from public.profiles')).toBe('42501');
  }));

  it('C3 · Beto solo ve su propio perfil; el admin ve todos', t(async (s) => {
    await s.como(BETO);
    const propios = await s.filas<{ id: string }>('select id from public.profiles');
    expect(propios.map((p) => p.id)).toEqual([BETO]);
    await s.como(ADMIN);
    expect(await s.filas('select id from public.profiles')).toHaveLength(3);
  }));

  it('C2 · Beto NO puede cambiar su rol (privilegio por columna)', t(async (s) => {
    await s.como(BETO);
    expect(await s.codigoError(`update public.profiles set role = 'admin' where id = $1`, [BETO])).toBe('42501');
  }));

  it('C2 · Beto sí puede editar su teléfono, pero no el perfil de Ana', t(async (s) => {
    await s.como(BETO);
    expect(await s.afectadas(`update public.profiles set phone = '+57 1' where id = $1`, [BETO])).toBe(1);
    expect(await s.afectadas(`update public.profiles set phone = '+57 1' where id = $1`, [ANA])).toBe(0);
  }));

  it('C2 · user_metadata.role = "admin" ya no da permisos sobre productos', t(async (s) => {
    await s.como(BETO, { role: 'admin' });
    expect(await s.afectadas(`update public.products set precio = 1 where id = 'p-002'`)).toBe(0);
    expect(await s.afectadas(`delete from public.products where id = 'p-002'`)).toBe(0);
  }));

  it('C3 · un admin real (según profiles.role) sí gestiona productos', t(async (s) => {
    await s.como(ADMIN);
    expect(await s.afectadas(`update public.products set precio = 80000 where id = 'p-002'`)).toBe(1);
  }));

  it('C3 · un anónimo no puede modificar el catálogo', t(async (s) => {
    await s.como(null);
    expect(await s.codigoError(`update public.products set precio = 1`)).toBe('42501');
    expect(await s.filas('select id from public.products')).toHaveLength(2); // pero sí leerlo
  }));

  it('C3 · insertar pedidos directamente está prohibido (solo vía RPC)', t(async (s) => {
    await s.como(BETO);
    const err = await s.codigoError(
      `insert into public.orders (user_id, total, direccion_envio) values ($1, 1, 'Calle falsa 123')`,
      [ANA],
    );
    expect(err).toBe('42501');
  }));

  it('A2 · crear_pedido usa el precio del servidor y descuenta stock', t(async (s) => {
    await s.como(ANA);
    // El navegador solo envía ids y cantidades: no hay forma de mandar el precio.
    const [{ id }] = (await s.filas<{ id: string }>(
      `select public.crear_pedido($1::jsonb, 'Calle 1 # 2-3') as id`,
      [JSON.stringify([{ product_id: 'p-001', cantidad: 2 }, { product_id: 'p-002', cantidad: 1 }])],
    )) as [{ id: string }];
    const [pedido] = await s.filas<{ total: string; user_id: string }>(
      'select total, user_id from public.orders where id = $1',
      [id],
    );
    expect(Number(pedido?.total)).toBe(2 * 18900 + 74900);
    expect(pedido?.user_id).toBe(ANA);
    expect(await s.filas('select * from public.order_items where order_id = $1', [id])).toHaveLength(2);
    const stock = await s.filas<{ id: string; stock: number }>('select id, stock from public.products order by id');
    expect(stock).toEqual([{ id: 'p-001', stock: 8 }, { id: 'p-002', stock: 1 }]);
  }));

  it('A2 · sin stock suficiente no se crea NADA (transacción atómica)', t(async (s) => {
    await s.como(ANA);
    const err = await s.codigoError(`select public.crear_pedido($1::jsonb, 'Calle 1 # 2-3')`, [
      JSON.stringify([{ product_id: 'p-001', cantidad: 1 }, { product_id: 'p-002', cantidad: 5 }]),
    ]);
    expect(err).toBe('P0001');
    await s.comoSuperusuario();
    expect(await s.filas('select * from public.orders')).toHaveLength(0);
    const [p1] = await s.filas<{ stock: number }>(`select stock from public.products where id = 'p-001'`);
    expect(p1?.stock).toBe(10);
  }));

  it('A2 · crear_pedido rechaza cantidades negativas y a usuarios anónimos', t(async (s) => {
    await s.como(ANA);
    expect(
      await s.codigoError(`select public.crear_pedido($1::jsonb, 'Calle 1 # 2-3')`, [
        JSON.stringify([{ product_id: 'p-001', cantidad: -5 }]),
      ]),
    ).toBe('22023');
    await s.como(null);
    expect(await s.codigoError(`select public.crear_pedido('[]'::jsonb, 'x')`)).toBe('42501');
  }));

  it('C3 · Beto no ve el pedido de Ana ni sus líneas; el admin sí', t(async (s) => {
    await s.como(ANA);
    const [{ id }] = (await s.filas<{ id: string }>(
      `select public.crear_pedido('[{"product_id":"p-001","cantidad":1}]'::jsonb, 'Calle 1 # 2-3') as id`,
    )) as [{ id: string }];
    await s.como(BETO);
    expect(await s.filas('select * from public.orders')).toHaveLength(0);
    expect(await s.filas('select * from public.order_items')).toHaveLength(0);
    expect(await s.afectadas(`update public.orders set estado = 'cancelado' where id = $1`, [id])).toBe(0);
    await s.como(ADMIN);
    expect(await s.filas('select * from public.orders')).toHaveLength(1);
    expect(await s.filas('select * from public.order_items')).toHaveLength(1);
  }));

  it('C3 · un anónimo no lee ni escribe order_items', t(async (s) => {
    await s.como(null);
    expect(await s.codigoError('select * from public.order_items')).toBe('42501');
  }));
});
