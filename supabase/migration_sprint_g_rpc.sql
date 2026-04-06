-- ==============================================================================
-- MIGRATION SPRINT G: RPC Optimization for Mass Operations
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

    -- 3. Actualizar la fecha de ultimo_contacto para evadir anti-spam inicial
    --    y mover estado "nuevo" a "contactado"
    UPDATE leads 
    SET ultimo_contacto = NOW(),
        estado = CASE WHEN estado = 'nuevo' THEN 'contactado' ELSE estado END
    WHERE id = ANY(p_lead_ids);
END;
$$;


-- 2. RPC: get_email_counts
-- Returns email sent counts for all leads in the agency in a single call.
-- Heavily optimizes initial page load.
CREATE OR REPLACE FUNCTION get_email_counts(p_agencia_id UUID)
RETURNS TABLE (lead_id UUID, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT el.lead_id, COUNT(*) AS count
    FROM email_log el
    WHERE el.agencia_id = p_agencia_id
    GROUP BY el.lead_id;
END;
$$;


-- Grant permissions
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_email_counts(UUID) TO anon, authenticated, service_role;
