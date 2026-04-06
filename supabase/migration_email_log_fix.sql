-- Add missing columns to email_log for the Elite Radar Dashboard
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_enviado text;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS mensaje_error text;
