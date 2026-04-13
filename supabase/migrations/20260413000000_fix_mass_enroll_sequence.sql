-- Fix Cross Product Violation guard in mass_enroll_sequence
-- It should bidirectionally match the strings to prevent false positives when 
-- the lead's product_interes is shorter than the sequence's producto_match (e.g., 'Inka Jungle' vs 'Inka Jungle Tour - Form')

CREATE OR REPLACE FUNCTION mass_enroll_sequence(p_lead_ids UUID[], p_sequence_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $bd$
DECLARE
    v_producto_match      TEXT;
    v_collision_products  TEXT;
    v_match_terms         TEXT[];
BEGIN
    -- 1. Obtener el producto_match de la secuencia objetivo
    SELECT LOWER(TRIM(producto_match))
    INTO v_producto_match
    FROM secuencias_marketing
    WHERE id = p_sequence_id;

    -- 2. Guardrail: Si la secuencia es de un producto específico (no general/null)
    --    verificar que todos los leads seleccionados pertenezcan a esa categoría.
    IF v_producto_match IS NOT NULL AND v_producto_match <> '' AND v_producto_match NOT ILIKE '%general%' THEN
        -- Extraer términos de match (separados por coma)
        v_match_terms := STRING_TO_ARRAY(v_producto_match, ',');

        -- Buscar leads que NO coincidan con ningún término del producto_match
        SELECT STRING_AGG(DISTINCT LOWER(TRIM(COALESCE(producto_interes, form_name, 'Desconocido'))), ', ')
        INTO v_collision_products
        FROM leads
        WHERE id = ANY(p_lead_ids)
          AND LOWER(TRIM(COALESCE(producto_interes, form_name, ''))) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM UNNEST(v_match_terms) AS term
              WHERE LOWER(TRIM(COALESCE(leads.producto_interes, leads.form_name, ''))) ILIKE '%' || TRIM(term) || '%'
                 OR LOWER(TRIM(term)) ILIKE '%' || LOWER(TRIM(COALESCE(leads.producto_interes, leads.form_name, ''))) || '%'
                 -- Adding splitting of term to check just the base name, mirroring the webhook logic
                 OR LOWER(TRIM(SPLIT_PART(term, '-', 1))) ILIKE '%' || LOWER(TRIM(COALESCE(leads.producto_interes, leads.form_name, ''))) || '%'
                 OR LOWER(TRIM(COALESCE(leads.producto_interes, leads.form_name, ''))) ILIKE '%' || LOWER(TRIM(SPLIT_PART(term, '-', 1))) || '%'
          );

        IF v_collision_products IS NOT NULL THEN
            RAISE EXCEPTION 'CROSS_PRODUCT_VIOLATION: Los siguientes productos no coinciden con la secuencia (target: "%"): "%"',
                v_producto_match, v_collision_products
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 3. Detener/eliminar cualquier secuencia anterior
    DELETE FROM leads_secuencias WHERE lead_id = ANY(p_lead_ids);

    -- 4. Insertar nueva secuencia en estado "en_progreso"
    INSERT INTO leads_secuencias (lead_id, secuencia_id, estado, ultimo_paso_ejecutado, created_at, updated_at)
    SELECT id, p_sequence_id, 'en_progreso', 0, NOW(), NOW()
    FROM unnest(p_lead_ids) AS id;
END;
$bd$;
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO anon, authenticated, service_role;
