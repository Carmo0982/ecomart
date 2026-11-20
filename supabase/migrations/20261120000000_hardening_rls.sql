-- =====================================================================
-- EcoMart · Migración 0002: hardening de RLS ("DESPUÉS")
-- ---------------------------------------------------------------------
-- Corrige los hallazgos de docs/INFORME_AUDITORIA.md:
--   C2  Escalada de privilegios: el rol se leía de user_metadata (editable
--       por el propio usuario) y la columna profiles.role era editable.
--   C3  Políticas permisivas: profiles legible por todos (PII), cualquier
--       autenticado podía cambiar precios, ver pedidos ajenos y crear
--       pedidos a nombre de otro; order_items no tenía RLS.
--   A2  Manipulación de precio: el total lo enviaba el navegador.
--
-- Principios aplicados:
--   * Mínimo privilegio en DOS capas: GRANT/REVOKE (qué columnas y
--     operaciones existen para cada rol) + RLS (qué filas).
--   * Toda política de UPDATE lleva USING (fila visible) y WITH CHECK
--     (fila resultante válida).
--   * La autorización se basa en datos que el usuario NO controla
--     (tabla profiles con columna role protegida), nunca en user_metadata.
--   * Funciones SECURITY DEFINER con search_path = '' y EXECUTE revocado
--     a PUBLIC/anon.
--   * auth.uid() envuelto en (select …) para que Postgres lo evalúe una
--     vez por consulta (initPlan) y no por fila.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Restricciones de integridad que antes faltaban
-- ---------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_role_valido check (role in ('cliente', 'mayorista', 'admin')),
  add constraint profiles_bio_largo check (char_length(bio) <= 500);

alter table public.products
  add constraint products_precio_positivo check (precio > 0),
  add constraint products_stock_no_negativo check (stock >= 0);

alter table public.orders
  alter column user_id set not null,
  add constraint orders_total_no_negativo check (total >= 0),
  add constraint orders_estado_valido
    check (estado in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'));

alter table public.order_items
  add constraint order_items_cantidad_valida check (cantidad between 1 and 99);

-- ---------------------------------------------------------------------
-- 1. ¿Es admin? Fuente de verdad: profiles.role (no el JWT del usuario)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER: se ejecuta con los privilegios del dueño, así que lee
-- profiles sin pasar por su RLS (evita la recursión infinita que ocurriría
-- si una política de profiles consultara profiles).
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- En Supabase las funciones nuevas reciben EXECUTE para anon y authenticated
-- por "default privileges", así que hay que revocarlo explícitamente.
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2. PROFILES: datos personales visibles solo para su dueño (o un admin)
-- ---------------------------------------------------------------------
drop policy if exists "Perfiles visibles para todos" on public.profiles;
drop policy if exists "Cada usuario crea su perfil" on public.profiles;
drop policy if exists "Cada usuario edita su perfil" on public.profiles;

create policy "profiles: el dueño o un admin leen"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or (select public.es_admin()));

create policy "profiles: el dueño edita sus datos"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Capa de privilegios por columna: el cliente puede editar sus datos de
-- contacto, pero NUNCA role, id ni created_at. Tampoco insertar ni borrar:
-- el perfil lo crea el trigger de abajo.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, address, bio) on public.profiles to authenticated;

-- El perfil se crea en el servidor al registrarse, SIEMPRE como 'cliente'.
-- Se ignora cualquier "role" que venga en raw_user_meta_data.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'cliente'
  );
  return new;
end;
$$;

revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ---------------------------------------------------------------------
-- 3. PRODUCTS: lectura pública de activos; escritura solo admin
-- ---------------------------------------------------------------------
drop policy if exists "Catálogo público" on public.products;
drop policy if exists "Admins gestionan productos" on public.products;
drop policy if exists "El checkout descuenta stock" on public.products;

create policy "products: catálogo público (solo activos)"
  on public.products for select
  to anon, authenticated
  using (activo);

create policy "products: admin ve también los inactivos"
  on public.products for select
  to authenticated
  using ((select public.es_admin()));

create policy "products: admin inserta"
  on public.products for insert
  to authenticated
  with check ((select public.es_admin()));

create policy "products: admin actualiza"
  on public.products for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

create policy "products: admin elimina"
  on public.products for delete
  to authenticated
  using ((select public.es_admin()));

revoke insert, update, delete, truncate on public.products from anon;

-- ---------------------------------------------------------------------
-- 4. ORDERS: cada cliente ve lo suyo; solo se crean mediante la RPC
-- ---------------------------------------------------------------------
drop policy if exists "Usuarios autenticados ven pedidos" on public.orders;
drop policy if exists "Usuarios autenticados crean pedidos" on public.orders;

create policy "orders: el dueño o un admin leen"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.es_admin()));

create policy "orders: admin cambia el estado"
  on public.orders for update
  to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

revoke all on public.orders from anon;
revoke insert, update, delete, truncate on public.orders from authenticated;
grant update (estado) on public.orders to authenticated; -- y RLS lo limita a admins

-- ---------------------------------------------------------------------
-- 5. ORDER_ITEMS: se activa RLS (antes estaba DESACTIVADO)
-- ---------------------------------------------------------------------
alter table public.order_items enable row level security;

create policy "order_items: visibles junto con su pedido"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = (select auth.uid()) or (select public.es_admin()))
    )
  );

revoke all on public.order_items from anon;
revoke insert, update, delete, truncate on public.order_items from authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC crear_pedido: precio, total y stock se calculan en el servidor
-- ---------------------------------------------------------------------
-- El navegador solo envía [{ product_id, cantidad }] y la dirección.
-- Todo ocurre en una transacción: si un producto no tiene stock, no se
-- crea nada. El UPDATE ... WHERE stock >= cantidad bloquea la fila y evita
-- sobreventa con compras concurrentes.
create or replace function public.crear_pedido(p_items jsonb, p_direccion text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_pedido  uuid;
  v_total   numeric(12, 2) := 0;
  v_precio  numeric(12, 2);
  v_item    record;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para comprar' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Carrito inválido' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_direccion, ''))) not between 5 and 300 then
    raise exception 'Dirección de envío inválida' using errcode = '22023';
  end if;

  insert into public.orders (user_id, total, direccion_envio)
  values (v_uid, 0, trim(p_direccion))
  returning id into v_pedido;

  for v_item in
    select x.product_id, sum(x.cantidad)::int as cantidad
    from jsonb_to_recordset(p_items) as x(product_id text, cantidad int)
    group by x.product_id
    order by x.product_id -- orden fijo de bloqueo: evita interbloqueos
  loop
    if v_item.cantidad is null or v_item.cantidad not between 1 and 99 then
      raise exception 'Cantidad inválida para %', v_item.product_id using errcode = '22023';
    end if;

    update public.products
       set stock = stock - v_item.cantidad
     where id = v_item.product_id
       and activo
       and stock >= v_item.cantidad
    returning precio into v_precio;

    if not found then
      raise exception 'Sin stock suficiente para %', v_item.product_id using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, product_id, cantidad, precio_unitario)
    values (v_pedido, v_item.product_id, v_item.cantidad, v_precio);

    v_total := v_total + v_precio * v_item.cantidad;
  end loop;

  update public.orders set total = v_total where id = v_pedido;
  return v_pedido;
end;
$$;

revoke execute on function public.crear_pedido(jsonb, text) from public, anon;
grant execute on function public.crear_pedido(jsonb, text) to authenticated;
