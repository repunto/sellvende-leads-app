-- =======================================================================
-- MIGRACIÓN: DEDUPLICACIÓN DEFINITIVA DE LEADS
-- Aplica restricción única por meta_lead_id por agencia (dedup a nivel BD)
-- =======================================================================

-- PASO 1: Eliminar duplicados existentes en la tabla leads
-- Conserva solo el registro más antiguo (created_at más temprano) de cada grupo de duplicados

-- 1a. Eliminar duplicados con mismo meta_lead_id (la estrategia primaria)
DELETE FROM public.leads
WHERE id NOT IN (
  SELECT DISTINCT ON (agencia_id, meta_lead_id) id
  FROM public.leads
  WHERE meta_lead_id IS NOT NULL AND meta_lead_id != ''
  ORDER BY agencia_id, meta_lead_id, created_at ASC
)
AND meta_lead_id IS NOT NULL AND meta_lead_id != '';

-- 1b. Eliminar duplicados con mismo email (los que no tienen meta_lead_id nos llegan por la fallback ruta)
DELETE FROM public.leads
WHERE id NOT IN (
  SELECT DISTINCT ON (agencia_id, lower(email)) id
  FROM public.leads
  WHERE email IS NOT NULL AND email != '' AND email != 'sin_correo@fb.com'
  ORDER BY agencia_id, lower(email), created_at ASC
)
AND email IS NOT NULL AND email != '' AND email != 'sin_correo@fb.com';

-- PASO 2: Agregar columnas si aún no existen
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leads' AND column_name='meta_lead_id'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN meta_lead_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leads' AND column_name='ultimo_contacto'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN ultimo_contacto timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leads' AND column_name='plataforma'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN plataforma text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leads' AND column_name='form_name'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN form_name text;
  END IF;
END $$;

-- PASO 3: Crear índice único en (agencia_id, meta_lead_id) para dedup a nivel BD
-- Permite NULL (no lo hace único) — solo aplica cuando meta_lead_id tiene valor
DROP INDEX IF EXISTS idx_leads_unique_meta_id;
CREATE UNIQUE INDEX idx_leads_unique_meta_id
  ON public.leads(agencia_id, meta_lead_id)
  WHERE meta_lead_id IS NOT NULL AND meta_lead_id != '';

-- PASO 4: Crear índice único en (agencia_id, lower(email)) para dedup por email
-- Solo aplica cuando email tiene valor y no es el email de relleno
DROP INDEX IF EXISTS idx_leads_unique_email;
CREATE UNIQUE INDEX idx_leads_unique_email
  ON public.leads(agencia_id, lower(email))
  WHERE email IS NOT NULL AND email != '' AND email != 'sin_correo@fb.com';

-- PASO 5: Índice de rendimiento adicional para buscar por meta_lead_id
DROP INDEX IF EXISTS idx_leads_meta_lead_id;
CREATE INDEX idx_leads_meta_lead_id ON public.leads(meta_lead_id) WHERE meta_lead_id IS NOT NULL;
