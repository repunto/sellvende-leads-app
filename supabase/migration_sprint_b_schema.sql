-- ==========================================
-- SCRIPT DE MIGRACIÓN: SPRINT B (Ventas Compuestas)
-- Múltiples Tours y Opcionales por Reserva
-- ==========================================

-- 1. Crear tabla hija para Tours del paquete
create table if not exists public.reserva_tours (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete restrict,
  fecha_tour date,
  precio_venta decimal(10,2) not null default 0,
  costo_operador decimal(10,2) not null default 0,
  operador_id uuid references public.operadores(id) on delete set null
);

-- 2. Crear tabla hija para Opcionales del paquete
create table if not exists public.reserva_opcionales (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  opcional_id uuid references public.opcionales(id) on delete restrict,
  fecha_opcional date,
  precio_venta decimal(10,2) not null default 0,
  costo_operador decimal(10,2) not null default 0
);

-- 3. Habilitar RLS en las nuevas tablas
alter table public.reserva_tours enable row level security;
alter table public.reserva_opcionales enable row level security;

-- 4. Políticas de Seguridad estricta por Agencia
create policy "Aislamiento Reserva Tours" on public.reserva_tours for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Reserva Opcionales" on public.reserva_opcionales for all using (agencia_id = public.get_user_agencia_id());

-- 5. Triggers para Auto-inyección de agencia_id (Igual que en Leads/Reservas)
create trigger tr_set_agencia_id_reserva_tours
  before insert on public.reserva_tours
  for each row execute procedure public.set_agencia_id_on_insert();

create trigger tr_set_agencia_id_reserva_opcionales
  before insert on public.reserva_opcionales
  for each row execute procedure public.set_agencia_id_on_insert();

-- NOTA: La migración de datos de la tabla 'reservas' (las columnas viejas de tour_id) a estas tablas 
-- la haremos en un script de 'seed' / 'data_migration' separado para evitar romper la app en caliente.
