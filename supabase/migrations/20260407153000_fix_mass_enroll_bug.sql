-- ==============================================================================
-- FIX BUG: RPC Optimization for Mass Operations (Remove Fake 'contactado')
-- ==============================================================================

-- 1. RPC: mass_enroll_sequence
-- Enroll multiple leads atomically and delete their old sequences.
-- Replaces frontend loops to prevent URI length limits and network failures.
CREATE OR REPLACE FUNCTION mass_enroll_sequence(p_lead_ids UUID[], p_sequence_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Detener/eliminar cualquier secuencia anterior (evita emails cruzados)
    DELETE FROM leads_secuencias WHERE lead_id = ANY(p_lead_ids);

    -- 2. Insertar nueva secuencia en estado "en_progreso"
    INSERT INTO leads_secuencias (
        lead_id, secuencia_id, estado, ultimo_paso_ejecutado, created_at, updated_at
    )
    SELECT
        id,
        p_sequence_id,
        'en_progreso',
        0,
        NOW(),
        NOW()
    FROM unnest(p_lead_ids) AS id;

    -- REMOVED: No actualizamos ultimo_contacto a NOW() ni estado a 'contactado'.
    -- Eso lo debe hacer estrictamente la Edge Function 'process-drips' cuaando 
    -- recibe la confirmación exitosa del Email Provider.
    
END;
$$;

GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO anon, authenticated, service_role;
