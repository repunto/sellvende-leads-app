-- ============================================
-- Fase 1: Speed-to-Lead y Atribución Básica
-- ============================================

-- 1. Agregar las nuevas columnas a la tabla leads para rastrear velocidad y métricas
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_to_respond_mins INTEGER,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- 2. Asegurarse que el trigger actualice el 'updated_at' de la tabla leads
-- (Si ya existe, esto no falla. Si hay un trigger anterior, garantiza su ejecución)
-- (La tabla leads ya debería tener este trigger por migraciones anteriores de Sellvende,
--  pero es buena práctica incluirlo si es requerido para la Fase 1)

COMMENT ON COLUMN public.leads.responded_at IS 'Fecha en que el lead fue movido a Contactado';
COMMENT ON COLUMN public.leads.time_to_respond_mins IS 'Minutos pasados desde creacion hasta responded_at (Speed-to-lead)';
COMMENT ON COLUMN public.leads.utm_campaign IS 'Campaña de Meta de donde proviene el lead (Extraido via API o webhook)';
COMMENT ON COLUMN public.leads.lead_score IS 'Score predictivo de conversión (Fase 3) o por reglas básicas';
