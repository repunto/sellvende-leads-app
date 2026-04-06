-- ==============================================================================
-- MIGRATION SPRINT J: Anti-Bounce / SPAM Protection
-- Run this in your Supabase SQL Editor BEFORE deploying the frontend changes.
-- ==============================================================================

-- Add bounce tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_rebotado   BOOLEAN     DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_rebote     TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_rebote    TEXT;

-- Index: filter bounced leads efficiently (partial index — only TRUE rows)
CREATE INDEX IF NOT EXISTS idx_leads_email_rebotado
    ON leads(agencia_id, email_rebotado)
    WHERE email_rebotado = TRUE;

-- Confirm columns were added successfully
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND table_schema = 'public'
  AND column_name IN ('email_rebotado', 'fecha_rebote', 'motivo_rebote');
