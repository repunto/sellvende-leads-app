-- ============================================================
-- MIGRATION: Unsubscribe System — QuipuReservas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columnas a la tabla leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- 2. Índice para que process-drips filtre leads dados de baja de forma eficiente
CREATE INDEX IF NOT EXISTS idx_leads_unsubscribed
  ON leads(unsubscribed) WHERE unsubscribed = TRUE;

-- 3. Comentarios descriptivos
COMMENT ON COLUMN leads.unsubscribed IS
  'TRUE si el lead hizo clic en el enlace de cancelación en algún correo automático';
COMMENT ON COLUMN leads.unsubscribed_at IS
  'Timestamp de cuándo el lead canceló la suscripción';

-- Verificación: ver resultado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('unsubscribed', 'unsubscribed_at');
