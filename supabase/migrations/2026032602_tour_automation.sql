-- Evolution: Tour-based Sequence Automation
-- Adds matching capabilities to link leads to specific sequences based on Meta tour names

ALTER TABLE public.secuencias_marketing 
ADD COLUMN IF NOT EXISTS tour_match TEXT;

COMMENT ON COLUMN public.secuencias_marketing.tour_match IS 'Keyword or partial match for tour_nombre to auto-assign leads (e.g., "inka jungle")';

-- Advisory lock helper functions (moved from previous turn as part of unified elite setup)
CREATE OR REPLACE FUNCTION public.try_advisory_lock(lock_key bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN pg_try_advisory_lock(lock_key); END; $$;

CREATE OR REPLACE FUNCTION public.release_advisory_lock(lock_key bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN pg_advisory_unlock(lock_key); END; $$;

GRANT EXECUTE ON FUNCTION public.try_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_advisory_lock(bigint) TO service_role;
