-- ==============================================================================
-- AUTOPILOT DRIP ENGINE — Cron Job + UI Status RPC
-- Created: 2026-04-11
-- ==============================================================================
-- PREREQUISITE: Before running this migration, store your service role key
-- in Supabase Vault (run ONCE in the SQL Editor):
--
--   SELECT vault.create_secret(
--     'service_role_key',
--     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  -- replace with your real key
--   );
--
-- Find your service_role key at:
-- Supabase Dashboard → Project Settings → API → service_role (secret)
-- ==============================================================================

-- 1. Enable required extensions (already available on Supabase Cloud)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. RPC: check_cron_job_exists — used by MarketingPage to show autopilot status
CREATE OR REPLACE FUNCTION public.check_cron_job_exists(job_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = job_name
    );
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_cron_job_exists(TEXT) TO anon, authenticated, service_role;

-- 3. Remove existing job if re-running this migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot-drips-daily') THEN
        PERFORM cron.unschedule('autopilot-drips-daily');
    END IF;
END;
$$;

-- 4. Schedule process-drips every 15 minutes (autopilot engine)
-- Reads service_role_key from Vault so the key is never hardcoded in git.
SELECT cron.schedule(
    'autopilot-drips-daily',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url     := 'https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (
                SELECT decrypted_secret
                FROM   vault.decrypted_secrets
                WHERE  name = 'service_role_key'
                LIMIT  1
            )
        ),
        body    := '{}'::jsonb
    ) AS request_id;
    $$
);
