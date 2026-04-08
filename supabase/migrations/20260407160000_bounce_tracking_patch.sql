-- ==============================================================================
-- FIX: Ensure email_log has all columns needed by the Bounce Tracking system
-- and that service_role can INSERT without RLS blocking it.
-- ==============================================================================

-- 1. Add email_enviado if missing (may already exist from migration_email_log_fix)
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_enviado text;

-- 2. Add fecha_rebote and motivo_rebote to leads if missing
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fecha_rebote timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_rebote text;

-- 3. Allow service_role to INSERT into email_log without RLS restriction
--    (Edge Functions run as service_role and need to log bounce events)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'email_log' AND policyname = 'email_log_service_role_insert'
    ) THEN
        CREATE POLICY "email_log_service_role_insert" ON email_log FOR INSERT
            TO service_role WITH CHECK (true);
    END IF;
END $$;

-- 4. Allow service_role SELECT on email_log (for debugging and admin queries)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'email_log' AND policyname = 'email_log_service_role_select'
    ) THEN
        CREATE POLICY "email_log_service_role_select" ON email_log FOR SELECT
            TO service_role USING (true);
    END IF;
END $$;
