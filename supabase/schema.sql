-- Fase 1 — Modelo de datos base
-- Ejecutar en el SQL Editor de Supabase (o via `supabase db push` si usas la CLI).

create extension if not exists "pgcrypto";

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_metrica_principal text,
  activo boolean not null default true
);

-- usuarios.id referencia directamente a auth.users(id): cada usuario de Supabase Auth
-- tiene como máximo una fila aquí con su rol y, si es gerente, su empresa.
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  rol text not null check (rol in ('gerente', 'director', 'admin')),
  empresa_id uuid references empresas (id),
  constraint gerente_requiere_empresa check (
    (rol = 'gerente' and empresa_id is not null) or (rol <> 'gerente')
  )
);

create table if not exists cargas_semanales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  usuario_id uuid not null references usuarios (id),
  semana_inicio date not null,
  semana_fin date not null,
  archivo_original_url text,
  fecha_subida timestamptz not null default now(),
  unique (empresa_id, semana_inicio)
);

create table if not exists metricas (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references cargas_semanales (id) on delete cascade,
  nombre_metrica text not null,
  valor numeric not null,
  meta numeric,
  unidad text
);

create index if not exists idx_usuarios_empresa on usuarios (empresa_id);
create index if not exists idx_cargas_empresa on cargas_semanales (empresa_id);
create index if not exists idx_metricas_carga on metricas (carga_id);
