-- ==========================================
-- SCRIPT DE MIGRACIÓN DE DATOS (SEED): SPRINT B
-- Mover los datos históricos de Reservas hacia la nueva tabla reserva_tours
-- ==========================================

-- 1. Insertar todos los tours de las reservas existentes en la nueva tabla reserva_tours
INSERT INTO public.reserva_tours (
  agencia_id,
  reserva_id,
  tour_id,
  fecha_tour,
  precio_venta,
  costo_operador,
  operador_id
)
SELECT 
  agencia_id,
  id as reserva_id,
  tour_id,
  fecha_tour,
  precio_venta, 
  costo_operador, 
  operador_id
FROM public.reservas
WHERE tour_id IS NOT NULL;

-- 2. Limpiar un poco los campos de texto estáticos (opcional, preparando para el UI nuevo)
-- Por ahora no borraremos las columnas originales (tour_id, fecha_tour) de la tabla 'reservas' 
-- para evitar romper la UI accidentalmente. Las borraremos al final del Sprint B.
