-- MIGRATION: ADD updated_at TO leads_secuencias TO FIX QUEUE DEADLOCK

-- 1. Añadimos la columna updated_at. Usamos NULL por defecto si se añade a existentes, pero el trigger lo corregirá.
ALTER TABLE public.leads_secuencias
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Asegurarnos que todos los existentes tengan una fecha, para que el ordenamiento no falle
UPDATE public.leads_secuencias 
SET updated_at = created_at 
WHERE updated_at IS NULL;
