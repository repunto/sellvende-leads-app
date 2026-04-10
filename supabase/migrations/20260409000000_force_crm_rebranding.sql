-- ====================================================================================
-- FASE: CRM REBRANDING Y CORRECCIÓN DE COLUMNAS OVERRIDE
-- ====================================================================================

-- 1. Asegurar tajantemente que la columna tour_match exista, por si falló la migración anterior
ALTER TABLE public.secuencias_marketing 
ADD COLUMN IF NOT EXISTS tour_match TEXT;

-- 2. Renombrar la secuencia "Inka Jungle Premium" para adaptarla al CRM B2B
UPDATE public.secuencias_marketing 
SET nombre = 'Secuencia Principal (General)',
    descripcion = 'Secuencia de seguimiento B2B por defecto.'
WHERE nombre ILIKE '%Inka Jungle Premium%';

-- 3. Crear una secuencia de demostración para leads específicos (Opcional, para que el usuario la vea)
-- No queremos insertar sin agencia_id, así que no insertamos nada ciegamente.

-- 4. Modificar cualquier otro lugar donde aún diga Inka Jungle (como plantillas, aunque las plantillas están en el frontend).
