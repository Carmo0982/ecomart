# Fragmentos de código mejorados

Dos refactorizaciones representativas: una **política RLS** (capa de datos) y el **componente de registro** (capa de interfaz). El código completo está en `supabase/migrations/20261120000000_hardening_rls.sql` y `src/pages/Registro.tsx`.

## 1. Política RLS de `profiles` y `products`

### Antes

```sql
create policy "Perfiles visibles para todos"
  on public.profiles for select
  using (true);                                   -- ① cualquiera, incluso anónimo

create policy "Cada usuario edita su perfil"
  on public.profiles for update
  using (auth.uid() = id);                        -- ② incluye la columna role

create policy "Admins gestionan productos"
  on public.products for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');  -- ③ dato que escribe el usuario

create policy "El checkout descuenta stock"
  on public.products for update to authenticated
  using (true);                                   -- ④ cualquier cliente cambia precios
```

### Después

```sql
-- Fuente de verdad del rol: una tabla que el usuario no puede escribir.
create or replace function public.es_admin()
returns boolean
language sql stable
security definer              -- lee profiles sin pasar por su RLS (sin recursión)
set search_path = ''          -- evita que se secuestre con objetos de otro esquema
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke execute on function public.es_admin() from public, anon;   -- ① Supabase da EXECUTE a anon por defecto

-- ① Lectura: solo el dueño o un admin. Sin política para anon → 0 filas, y además sin GRANT → error 42501.
create policy "profiles: el dueño o un admin leen"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.es_admin()));

-- ② Escritura: USING (qué fila puedo tocar) + WITH CHECK (cómo debe quedar)…
create policy "profiles: el dueño edita sus datos"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- …y privilegios por COLUMNA, porque RLS filtra filas pero no columnas.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, address, bio) on public.profiles to authenticated;

-- ③ ④ Productos: lectura pública de activos, escritura solo para admins reales.
create policy "products: catálogo público (solo activos)"
  on public.products for select to anon, authenticated
  using (activo);

create policy "products: admin actualiza"
  on public.products for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));
-- (también insert y delete con es_admin(); el stock lo descuenta la RPC crear_pedido)
```

### Por qué es mejor

| Problema | Mecanismo de la corrección |
|---|---|
| ① PII pública | Política `to authenticated` + `REVOKE` a `anon` |
| ② `role` editable | `GRANT UPDATE (columnas)`: el intento de cambiar `role` falla con `42501` |
| ③ Confianza en `user_metadata` | `es_admin()` lee `profiles.role`, protegido por ② |
| ④ Escritura abierta | `USING` + `WITH CHECK` con `es_admin()`; el stock solo cambia dentro de la RPC transaccional |
| Rendimiento | `(select auth.uid())` y `(select es_admin())` se evalúan una vez por consulta, no por fila |

Cada fila de esta tabla tiene una prueba en `supabase/tests/rls.test.ts` que falla sin la migración.

## 2. Componente de registro

```tsx
// ANTES (docs/antes/src/pages/Registro.tsx)
const promo = params.get('promo');
const rol = params.get('rol') ?? 'cliente';                       // el usuario elige su rol
...
if (datos.password.length < 4) { ... }                           // política débil
await registrarUsuario(datos, rol);
localStorage.setItem('ecomart_credenciales',
  JSON.stringify({ email: datos.email, password: datos.password })); // contraseña en claro
...
<div dangerouslySetInnerHTML={{ __html: `🎁 Código aplicado: <b>${promo}</b>` }} />   // XSS reflejado
<div dangerouslySetInnerHTML={{ __html: `<h3>${datos.nombre}</h3>${datos.bio}` }} />  // XSS
```

```tsx
// DESPUÉS (src/pages/Registro.tsx, extracto)
const promo = codigoPromoValido(params.get('promo'));   // lista blanca o null; el rol ya no existe aquí

async function enviar(e: FormEvent) {
  e.preventDefault();
  const encontrados = validarRegistro(datos);           // ≥10 caracteres, letras + números, sin el correo
  setErrores(encontrados);
  if (Object.keys(encontrados).length > 0) return;
  setEnviando(true);
  try {
    const { requiereConfirmacion } = await registrarUsuario(datos);  // sin rol: lo fija el trigger
    setDatos(VACIO);                                    // no se guarda la contraseña en ningún lado
    if (requiereConfirmacion) setPendienteConfirmar(true);
    else navigate('/catalogo');
  } catch (err) {
    setErrorGeneral(err instanceof ErrorApp ? err.message : 'Ocurrió un error inesperado.'); // mensaje genérico
  } finally {
    setEnviando(false);
  }
}
...
{promo && <p className="promo">🎁 Código aplicado: <b>{promo}</b></p>}
<h3>{datos.nombre}</h3>
<p className="descripcion">{datos.bio}</p>              {/* React escapa: se ve literal */}
```

Además, la validación está en funciones puras (`src/lib/seguridad.ts`) que se pueden probar sin React, y los campos tienen `aria-invalid` y `aria-describedby` para que los errores sean accesibles.
