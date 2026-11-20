-- =====================================================================
-- EcoMart · Migración 0001: esquema inicial (ESTADO AUDITADO, "ANTES")
-- ---------------------------------------------------------------------
-- Esta migración reproduce el estado de la base de datos que se recibió
-- para la auditoría. Contiene políticas RLS permisivas A PROPÓSITO.
-- NO aplicarla sola en producción: la migración 20261120000000 la corrige.
-- =====================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  address     text,
  bio         text,
  role        text not null default 'cliente',
  created_at  timestamptz not null default now()
);

create table public.products (
  id             text primary key,
  nombre         text not null,
  descripcion    text not null default '',
  precio         numeric(12, 2) not null,
  categoria      text not null,
  stock          integer not null default 0,
  imagen         text not null default '',
  huella_co2_kg  numeric(6, 2) not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id),
  total            numeric(12, 2) not null,
  estado           text not null default 'pendiente',
  direccion_envio  text not null,
  creado_en        timestamptz not null default now()
);

create table public.order_items (
  id               bigint generated always as identity primary key,
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       text not null references public.products (id),
  cantidad         integer not null,
  precio_unitario  numeric(12, 2) not null
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;
-- (order_items quedó sin RLS: "solo se escribe desde el checkout")

-- PROFILES -------------------------------------------------------------
create policy "Perfiles visibles para todos"
  on public.profiles for select
  using (true);

create policy "Cada usuario crea su perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Cada usuario edita su perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- PRODUCTS -------------------------------------------------------------
create policy "Catálogo público"
  on public.products for select
  using (true);

create policy "Admins gestionan productos"
  on public.products for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "El checkout descuenta stock"
  on public.products for update
  to authenticated
  using (true);

-- ORDERS ---------------------------------------------------------------
create policy "Usuarios autenticados ven pedidos"
  on public.orders for select
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados crean pedidos"
  on public.orders for insert
  to authenticated
  with check (true);
