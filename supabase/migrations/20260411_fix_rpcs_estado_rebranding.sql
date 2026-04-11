-- ====================================================================================
-- FIX: get_leads_kpis and get_leads_page still reference estado='reservado'
-- The correct B2B state is 'ventado'. Fixed to match frontend terminology.
-- ====================================================================================

-- 1. FIX get_leads_kpis
CREATE OR REPLACE FUNCTION get_leads_kpis(p_agencia_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total',        COUNT(*),
        'nuevo',        COUNT(*) FILTER (WHERE estado = 'nuevo'),
        'contactado',   COUNT(*) FILTER (WHERE estado = 'contactado'),
        'cotizado',     COUNT(*) FILTER (WHERE estado = 'cotizado'),
        'ventado',      COUNT(*) FILTER (WHERE estado = 'ventado'),
        'frios',        COUNT(*) FILTER (
                            WHERE ultimo_contacto IS NOT NULL
                            AND ultimo_contacto < NOW() - INTERVAL '7 days'
                            AND estado NOT IN ('ventado', 'dado_de_baja')
                        ),
        'dado_de_baja', COUNT(*) FILTER (WHERE unsubscribed = TRUE)
    )
    INTO result
    FROM leads
    WHERE agencia_id = p_agencia_id;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leads_kpis TO authenticated, service_role;


-- 2. FIX get_leads_page
CREATE OR REPLACE FUNCTION get_leads_page(
    p_agencia_id UUID,
    p_page       INT DEFAULT 1,
    p_per_page   INT DEFAULT 50,
    p_search     TEXT DEFAULT NULL,
    p_estado     TEXT DEFAULT NULL,
    p_form_name  TEXT DEFAULT NULL,
    p_date_from  DATE DEFAULT NULL,
    p_date_to    DATE DEFAULT NULL,
    p_kanban     BOOLEAN DEFAULT FALSE,
    p_kanban_limit INT DEFAULT 1000
)
RETURNS TABLE(
    id               UUID,
    nombre           TEXT,
    email            TEXT,
    telefono         TEXT,
    estado           TEXT,
    origen           TEXT,
    producto_interes TEXT,
    form_name        TEXT,
    personas         TEXT,
    temporada        TEXT,
    notas            TEXT,
    idioma           TEXT,
    agencia_id       UUID,
    ultimo_contacto  TIMESTAMPTZ,
    unsubscribed     BOOLEAN,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ,
    total_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset        INT;
    v_limit         INT;
BEGIN
    IF p_kanban THEN
        v_offset := 0;
        v_limit  := p_kanban_limit;
    ELSE
        v_offset := (p_page - 1) * p_per_page;
        v_limit  := p_per_page;
    END IF;

    RETURN QUERY
    WITH filtered AS (
        SELECT l.*
        FROM leads l
        WHERE l.agencia_id = p_agencia_id
          AND (p_date_from IS NULL OR l.created_at::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR l.created_at::DATE <= p_date_to)
          AND (
              p_search IS NULL OR p_search = '' OR
              l.nombre::TEXT      ILIKE '%' || p_search || '%' OR
              l.email::TEXT       ILIKE '%' || p_search || '%' OR
              l.telefono::TEXT    ILIKE '%' || p_search || '%' OR
              l.producto_interes::TEXT ILIKE '%' || p_search || '%'
          )
          AND (
              p_estado IS NULL OR p_estado = '' OR
              CASE p_estado
                  WHEN 'frios' THEN (
                      l.ultimo_contacto IS NOT NULL AND
                      l.ultimo_contacto < NOW() - INTERVAL '7 days' AND
                      l.estado NOT IN ('ventado', 'dado_de_baja')
                  )
                  WHEN 'dado_de_baja' THEN l.unsubscribed = TRUE
                  ELSE l.estado = p_estado
              END
          )
          AND (
              p_form_name IS NULL OR p_form_name = '' OR
              SPLIT_PART(COALESCE(l.form_name, l.producto_interes, ''), ' - ', 1) = p_form_name OR
              l.producto_interes = p_form_name OR
              l.form_name   = p_form_name
          )
        ORDER BY l.created_at DESC
    ),
    total AS (
        SELECT COUNT(*) AS cnt FROM filtered
    )
    SELECT
        f.id, f.nombre, f.email, f.telefono, f.estado, f.origen,
        f.producto_interes, f.form_name, f.personas, f.temporada, f.notas,
        f.idioma, f.agencia_id, f.ultimo_contacto, f.unsubscribed,
        f.created_at, f.updated_at,
        t.cnt AS total_count
    FROM filtered f, total t
    LIMIT  v_limit
    OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leads_page TO authenticated, service_role;
