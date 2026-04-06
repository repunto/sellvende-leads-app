-- ==========================================
-- SCRIPT DE MIGRACIÓN: Módulo Descuentos
-- ==========================================

create table if not exists public.descuentos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  nombre text not null,
  descuento_web numeric default 0,
  descuento_operador numeric default 0,
  tipo text default 'fijo' check (tipo in ('fijo', 'porcentaje')),
  aplicabilidad text default 'Por Pasajero' check (aplicabilidad in ('Por Pasajero', 'Manual')),
  activo boolean default true,
  created_at timestamptz default now()
);

alter table public.descuentos enable row level security;

create policy "Aislamiento Descuentos" on public.descuentos for all using (agencia_id = public.get_user_agencia_id());
