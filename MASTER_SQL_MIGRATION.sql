-- =================================================================================
-- OLA 2 - REMEDIACIÓN CRÍTICA (FASE FINAL)
-- Riesgos #11 y #14: RLS Rota en email_queue y Procesamiento de Cola NO Atómico
-- =================================================================================

-- 1. CORREGIR CONDICIÓN DE CARRERA (Race Condition) EN LA COLA DE CORREOS (RIESGO #14)
-- Esto crea una función atómica que "toma" los correos pendientes y los marca como
-- 'procesando' en una sola transacción. El 'FOR UPDATE SKIP LOCKED' asegura que si
-- dos instancias (ej. un cron job y un manual trigger) despiertan al mismo tiempo,
-- no enviarán el mismo correo dos veces.
CREATE OR REPLACE FUNCTION public.grab_queue_items(p_limit INT)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    UPDATE public.email_queue
    SET estado = 'procesando',
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM public.email_queue
        WHERE estado = 'pendiente'
        ORDER BY created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

-- 2. CORREGIR POLÍTICAS RLS AISLANDO LOS TENANTS CORRECTAMENTE (RIESGO #11)
-- La versión anterior comparaba `agencia_id` con `auth.uid()`, lo cual es incorrecto
-- porque `auth.uid()` es el ID del Usuario, no de la Agencia. 
-- El Frontend estaba bloqueado de encolar correos por esta misma razón.

DROP POLICY IF EXISTS "Agencias pueden ver su propia cola" ON public.email_queue;
DROP POLICY IF EXISTS "Agencias pueden agregar a su cola" ON public.email_queue;
DROP POLICY IF EXISTS "Agencias pueden limpiar su cola" ON public.email_queue;

CREATE POLICY "Agencias pueden ver su propia cola"
    ON public.email_queue FOR SELECT
    USING (agencia_id = public.get_auth_agencia());

CREATE POLICY "Agencias pueden agregar a su cola"
    ON public.email_queue FOR INSERT
    WITH CHECK (agencia_id = public.get_auth_agencia());
    
CREATE POLICY "Agencias pueden limpiar su cola"
    ON public.email_queue FOR DELETE
    USING (agencia_id = public.get_auth_agencia());

-- Nota: Recordar dar privilegios de uso al public/authenticated
REVOKE EXECUTE ON FUNCTION public.grab_queue_items(INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grab_queue_items(INT) TO service_role; -- Solo para Edge Functions
