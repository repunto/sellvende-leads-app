-- Advisory lock helper functions for process-drips concurrency guard
-- Prevents concurrent cron executions from double-sending drip emails

CREATE OR REPLACE FUNCTION public.try_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pg_try_advisory_lock(lock_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pg_advisory_unlock(lock_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_advisory_lock(bigint) TO service_role;
