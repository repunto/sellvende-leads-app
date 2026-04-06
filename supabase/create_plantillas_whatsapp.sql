-- ==========================================
-- SCRIPT DE MIGRACIÓN: PLANTILLAS DE WHATSAPP (SaaS)
-- ==========================================

create table public.plantillas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  tour_id uuid references public.tours(id) on delete cascade,
  tipo text not null check (tipo in ('cotizacion', 'confirmacion', 'recordatorio', 'resena')),
  contenido text not null default '',
  idioma text not null default 'ES'
);

-- Habilitar Row Level Security (RLS)
alter table public.plantillas_whatsapp enable row level security;

-- Política Estricta de Tenant (Sólo ver lo de mi agencia)
create policy "Aislamiento Plantillas WA" on public.plantillas_whatsapp for all using (agencia_id = public.get_user_agencia_id());

-- Disparador que auto-inyecta el agencia_id basándose en el Auth.uid() si el fronend no lo manda
create trigger tr_plantillas_wa_agencia before insert on public.plantillas_whatsapp for each row execute function public.set_agencia_id_on_insert();
