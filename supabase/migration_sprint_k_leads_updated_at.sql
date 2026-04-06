-- ==============================================================================
-- SPRINT K: Añadir missing 'updated_at' a la tabla 'leads'
-- ==============================================================================

-- 1. Añadimos la columna
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Actualizamos los valores existentes nulos por si acaso
UPDATE public.leads 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. Creamos la función del trigger (si no existía ya en la DB)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Enganchamos el trigger a la tabla leads
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
