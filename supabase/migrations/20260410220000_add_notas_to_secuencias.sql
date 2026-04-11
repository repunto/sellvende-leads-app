-- Agregar columna notas (JSONB) a leads_secuencias si no existe
ALTER TABLE leads_secuencias
ADD COLUMN IF NOT EXISTS notas JSONB DEFAULT '{}'::jsonb;
