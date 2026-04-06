-- ==========================================
-- QUIPU RESERVAS — ESQUEMA SAAS MULTI-TENANT FINAL
-- Archivo Único y Definitivo
-- ==========================================

-- 0. Limpiar esquema actual (Drop tables)
drop table if exists public.configuracion cascade;
drop table if exists public.plantillas_email cascade;
drop table if exists public.reservas cascade;
drop table if exists public.leads cascade;
drop table if exists public.operadores cascade;
drop table if exists public.tours cascade;
drop table if exists public.usuarios_agencia cascade;
drop table if exists public.agencias cascade;

-- ==========================================
-- 1. TABLAS CORE SAAS (Tenants & Roles)
-- ==========================================

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'elite')),
  activa boolean not null default true
);

create table public.usuarios_agencia (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usuario_id uuid not null unique,
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  rol text not null default 'admin' check (rol in ('admin', 'vendedor')),
  activo boolean not null default true
);

-- ==========================================
-- 2. TABLAS DEL NEGOCIO
-- ==========================================

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  duracion_dias int not null default 4,
  precio_usd decimal(10,2) not null default 0,
  costo_operador decimal(10,2) not null default 0,
  descripcion text not null default '',
  incluye text not null default '',
  opcionales jsonb not null default '[]'::jsonb,
  activo boolean not null default true
);

create table public.operadores (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  email text not null default '',
  telefono text not null default '',
  activo boolean not null default true
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null default '',
  email text not null default '',
  telefono text not null default '',
  tour_id uuid references public.tours(id) on delete set null,
  tour_nombre text not null default '',
  origen text not null default 'Orgánico / Manual',
  idioma text not null default 'ES',
  personas text not null default '',
  temporada text not null default '',
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'cotizado', 'reservado')),
  notas text not null default '',
  email_enviado boolean not null default false,
  fecha_email timestamptz
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete set null,
  tour_id uuid references public.tours(id) on delete set null,
  fecha_tour date,
  cliente_nombre text not null default '',
  cliente_email text not null default '',
  cliente_telefono text not null default '',
  pax int not null default 1,
  tour_nombre text not null default '',
  opcionales text not null default '',
  descuentos text not null default '',
  precio_venta decimal(10,2) not null default 0,
  costo_operador decimal(10,2) not null default 0,
  adelanto decimal(10,2) not null default 0,
  saldo decimal(10,2) generated always as (precio_venta - adelanto) stored,
  pago_operador decimal(10,2) not null default 0,
  beneficio decimal(10,2) generated always as (precio_venta - costo_operador) stored,
  operador_id uuid references public.operadores(id) on delete set null,
  idioma text not null default 'ES',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'completada', 'cancelada')),
  confirmacion_enviada timestamptz,
  reserva_operador_enviada timestamptz,
  recordatorio_enviado timestamptz,
  resena_enviada timestamptz
);

create table public.plantillas_email (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  tour_id uuid references public.tours(id) on delete cascade,
  tipo text not null check (tipo in ('cotizacion', 'confirmacion', 'recordatorio', 'resena')),
  asunto text not null default '',
  contenido_html text not null default '',
  idioma text not null default 'ES'
);

create table public.configuracion (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  clave text not null,
  valor text not null default '',
  unique(agencia_id, clave)
);

-- ==========================================
-- 3. SEGURIDAD (Row Level Security - RLS)
-- ==========================================

alter table public.agencias enable row level security;
alter table public.usuarios_agencia enable row level security;
alter table public.tours enable row level security;
alter table public.operadores enable row level security;
alter table public.leads enable row level security;
alter table public.reservas enable row level security;
alter table public.plantillas_email enable row level security;
alter table public.configuracion enable row level security;

create or replace function public.get_user_agencia_id()
returns uuid as $$
  select agencia_id from public.usuarios_agencia where usuario_id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function public.get_user_rol()
returns text as $$
  select rol from public.usuarios_agencia where usuario_id = auth.uid() limit 1;
$$ language sql stable security definer;

-- Políticas de Seguridad (Filtrado estricto por Agencia)
create policy "Ver mi agencia" on public.agencias for select using (id = public.get_user_agencia_id());
create policy "Ver usuarios de mi agencia" on public.usuarios_agencia for select using (agencia_id = public.get_user_agencia_id());

create policy "Aislamiento Tours" on public.tours for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Operadores" on public.operadores for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Leads" on public.leads for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Reservas" on public.reservas for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Plantillas" on public.plantillas_email for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Config" on public.configuracion for all using (agencia_id = public.get_user_agencia_id());

-- ==========================================
-- 4. ÍNDICES DE RENDIMIENTO 
-- ==========================================

create index idx_leads_agencia on public.leads(agencia_id, estado, created_at desc);
create index idx_reservas_agencia on public.reservas(agencia_id, estado, fecha_tour);
create index idx_tours_agencia on public.tours(agencia_id);
create index idx_usuarios_agencia on public.usuarios_agencia(usuario_id);

-- ==========================================
-- 5. TRIGGERS (Auto-inyectar agencia_id al crear nuevos registros)
-- ==========================================

create or replace function set_agencia_id_on_insert()
returns trigger as $$
begin
  if new.agencia_id is null then
    new.agencia_id := public.get_user_agencia_id();
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger tr_tours_agencia before insert on public.tours for each row execute function set_agencia_id_on_insert();
create trigger tr_operadores_agencia before insert on public.operadores for each row execute function set_agencia_id_on_insert();
create trigger tr_leads_agencia before insert on public.leads for each row execute function set_agencia_id_on_insert();
create trigger tr_reservas_agencia before insert on public.reservas for each row execute function set_agencia_id_on_insert();
create trigger tr_plantillas_agencia before insert on public.plantillas_email for each row execute function set_agencia_id_on_insert();
create trigger tr_config_agencia before insert on public.configuracion for each row execute function set_agencia_id_on_insert();
