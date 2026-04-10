-- ==============================================================================
-- FIX: Actualizar Funciones RPC y Triggers con B2B Terminología
-- Objetivo: Remplazar "tour_nombre" con "producto_interes" y "tour_match" con "producto_match"
-- ==============================================================================

-- ¡NUEVO! Primero eliminamos las versiones previas para que la Base de Datos no genere conflictos con la estructura anterior:
DROP FUNCTION IF EXISTS get_leads_page(UUID, INT, INT, TEXT, TEXT, TEXT, DATE, DATE, BOOLEAN, INT);
DROP FUNCTION IF EXISTS get_filtered_lead_ids(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS auto_enroll_new_lead() CASCADE;

-- 1. Actualizar RPC Paginated Leads
CREATE OR REPLACE FUNCTION get_leads_page(
    p_agencia_id     UUID,
    p_page           INT      DEFAULT 1,
    p_per_page       INT      DEFAULT 50,
    p_search         TEXT     DEFAULT NULL,
    p_estado         TEXT     DEFAULT NULL,
    p_form_name      TEXT     DEFAULT NULL,
    p_date_from      DATE     DEFAULT NULL,
    p_date_to        DATE     DEFAULT NULL,
    p_kanban         BOOLEAN  DEFAULT FALSE,
    p_kanban_limit   INT      DEFAULT 1000
)
RETURNS TABLE (
    id              UUID,
    nombre          TEXT,
    email           TEXT,
    telefono        TEXT,
    estado          TEXT,
    origen          TEXT,
    producto_interes TEXT,
    form_name       TEXT,
    personas        TEXT,
    temporada       TEXT,
    notas           TEXT,
    idioma          TEXT,
    agencia_id      UUID,
    ultimo_contacto TIMESTAMPTZ,
    unsubscribed    BOOLEAN,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    total_count     BIGINT
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
                      l.estado NOT IN ('reservado', 'dado_de_baja')
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


-- 2. Actualizar RPC Filtro de IDs Automáticos
CREATE OR REPLACE FUNCTION get_filtered_lead_ids(
    p_agencia_id UUID,
    p_estado TEXT DEFAULT NULL,
    p_form_name TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_date_from TEXT DEFAULT NULL,
    p_date_to TEXT DEFAULT NULL
) RETURNS TABLE(id UUID) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT l.id FROM leads l
    WHERE l.agencia_id = p_agencia_id
      AND l.email IS NOT NULL
      AND (l.unsubscribed IS NULL OR l.unsubscribed = false)
      AND (p_estado IS NULL OR l.estado = p_estado)
      AND (p_form_name IS NULL OR l.form_name ILIKE '%' || p_form_name || '%' OR l.producto_interes ILIKE '%' || p_form_name || '%')
      AND (p_search IS NULL OR l.nombre ILIKE '%' || p_search || '%' OR l.email ILIKE '%' || p_search || '%')
      AND (p_date_from IS NULL OR l.created_at >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR l.created_at <= (p_date_to || 'T23:59:59Z')::timestamptz);
END;
$$;


-- 3. Actualizar Trigger de Auto Enrolamiento Drip
CREATE OR REPLACE FUNCTION auto_enroll_new_lead()
RETURNS TRIGGER AS $$
DECLARE
    v_secuencia_id UUID;
    v_master_switch TEXT;
    v_producto TEXT;
    v_keyword TEXT;
    v_keywords TEXT[];
    v_found BOOLEAN := FALSE;
BEGIN
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    SELECT valor INTO v_master_switch
    FROM configuracion
    WHERE agencia_id = NEW.agencia_id AND clave = 'master_sequence_switch'
    LIMIT 1;

    IF v_master_switch IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1 FROM leads_secuencias
        WHERE lead_id = NEW.id AND estado IN ('en_progreso', 'pausado')
    ) THEN
        RETURN NEW;
    END IF;

    v_producto := LOWER(COALESCE(NEW.form_name, NEW.producto_interes, ''));

    FOR v_secuencia_id IN
        SELECT id FROM secuencias_marketing
        WHERE agencia_id = NEW.agencia_id
          AND activa = TRUE
          AND producto_match IS NOT NULL
          AND TRIM(producto_match) != ''
        ORDER BY created_at ASC
    LOOP
        SELECT string_to_array(LOWER(producto_match), ',')
        INTO v_keywords
        FROM secuencias_marketing
        WHERE id = v_secuencia_id;

        FOREACH v_keyword IN ARRAY v_keywords
        LOOP
            IF v_producto LIKE '%' || TRIM(v_keyword) || '%' THEN
                v_found := TRUE;
                EXIT;
            END IF;
        END LOOP;

        IF v_found THEN EXIT; END IF;
    END LOOP;

    IF NOT v_found THEN
        SELECT id INTO v_secuencia_id
        FROM secuencias_marketing
        WHERE agencia_id = NEW.agencia_id
          AND activa = TRUE
          AND (producto_match IS NULL OR TRIM(producto_match) = '')
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_secuencia_id IS NOT NULL THEN
            v_found := TRUE;
        END IF;
    END IF;

    IF v_found AND v_secuencia_id IS NOT NULL THEN
        INSERT INTO leads_secuencias (lead_id, secuencia_id, estado, ultimo_paso_ejecutado)
        VALUES (NEW.id, v_secuencia_id, 'en_progreso', 0)
        ON CONFLICT (lead_id, secuencia_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el Trigger
DROP TRIGGER IF EXISTS trigger_auto_enroll_lead ON leads;
CREATE TRIGGER trigger_auto_enroll_lead
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_new_lead();
