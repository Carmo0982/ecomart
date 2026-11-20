-- Réplica mínima del entorno de Supabase para probar las migraciones en
-- PGlite (Postgres compilado a WebAssembly). Imita lo que Supabase trae de
-- fábrica y que importa para RLS:
--   * roles anon / authenticated / service_role;
--   * auth.users y las funciones auth.jwt(), auth.uid(), auth.role(), que
--     leen el JWT desde la variable de sesión request.jwt.claims (igual que
--     PostgREST);
--   * los "default privileges" de Supabase: todo lo que se crea en public
--     queda con GRANT ALL para anon y authenticated. Por eso RLS (y los
--     REVOKE) son la única barrera real.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id                  uuid primary key,
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select auth.jwt() ->> 'role'
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
