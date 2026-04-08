-- ====================================================================================
-- PHASE 4: OMNICHANNEL ARCHITECTURE PREPARATION (WHATSAPP BUSINESS API)
-- ====================================================================================

-- 1. Add message type indicator to Sequence Steps
-- Defaults to 'email' to preserve backward compatibility for all existing sequences.
ALTER TABLE public.pasos_secuencia ADD COLUMN IF NOT EXISTS tipo_mensaje text DEFAULT 'email';
-- Values: 'email' | 'whatsapp'

-- 2. Whatsapp Specific fields per step
ALTER TABLE public.pasos_secuencia ADD COLUMN IF NOT EXISTS whatsapp_template_name text;

-- 3. Widen the email_log table to act as a unified message_log for omnichannel delivery
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS canal text DEFAULT 'email';
-- Values: 'email' | 'whatsapp'
