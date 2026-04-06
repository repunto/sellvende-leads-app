-- ==========================================
-- SCRIPT DE MIGRACIÓN: Módulo Opcionales
-- ==========================================

create table if not exists public.opcionales (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  precio_usd decimal(10,2) not null default 0,
  costo_operador decimal(10,2) not null default 0,
  activo boolean not null default true
);

alter table public.opcionales enable row level security;

create policy "Aislamiento Opcionales" on public.opcionales for all using (agencia_id = public.get_user_agencia_id());
