-- ==============================================================================
-- FIX: Add missing 'cuerpo' column to email_log
-- This column is written by: process-drips (error msgs), handle-bounce (JSON),
-- and useLeadEmail.js (full email HTML body).
-- It is read by: LeadDetailPanel (email preview), LeadXRayModal (timeline).
-- Without this column, all those writes fail silently and previews are empty.
-- ==============================================================================

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS cuerpo TEXT;

COMMENT ON COLUMN public.email_log.cuerpo IS 'HTML body of sent email or error message for failed sends';
