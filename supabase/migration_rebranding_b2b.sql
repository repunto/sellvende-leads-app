-- ==========================================
-- SCRIPT DE MIGRACIÓN: Rebranding a Sellvende Leads B2B
-- Objetivo: Actualizar los nombres de las columnas para eliminar terminología legacy de turismo.
-- ==========================================

-- 1. Actualizar tabla PRODUCTOS (antes tours)
ALTER TABLE public.productos RENAME COLUMN costo_operador TO costo_asesor;

-- 2. Actualizar tabla EXTRAS (antes opcionales)
ALTER TABLE public.extras RENAME COLUMN costo_operador TO costo_asesor;

-- 3. Actualizar tabla VENTAS (antes reservas)
ALTER TABLE public.ventas RENAME COLUMN costo_operador TO costo_asesor;
ALTER TABLE public.ventas RENAME COLUMN pago_operador TO pago_asesor;

-- Nota: La columna producto_interes (antiguo tour_interes) ya existe correctamente en la tabla leads.
-- Si usas Edge Functions o Triggers que dependan de estos nombres, ya fueron actualizados en el código fuente.
