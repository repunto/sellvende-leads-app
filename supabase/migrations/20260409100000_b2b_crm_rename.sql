-- ====================================================================================
-- FASE: CRM B2B ELITE REFACTORING (Drop Tourism Terminology)
-- ====================================================================================

-- 1. RENAME TABLES
ALTER TABLE IF EXISTS public.tours RENAME TO productos;
ALTER TABLE IF EXISTS public.opcionales RENAME TO extras;
ALTER TABLE IF EXISTS public.reservas RENAME TO ventas;
ALTER TABLE IF EXISTS public.reserva_tours RENAME TO venta_productos;
ALTER TABLE IF EXISTS public.reserva_opcionales RENAME TO venta_extras;
ALTER TABLE IF EXISTS public.operadores RENAME TO asesores;

-- 2. RENAME COLUMNS IN VENTAS (Reservas)
-- (Si existen referencias al antiguo operador)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventas' AND column_name = 'operador_id') THEN
        ALTER TABLE public.ventas RENAME COLUMN operador_id TO asesor_id;
    END IF;
END $$;

-- 3. RENAME COLUMNS IN VENTA_PRODUCTOS (Reserva_Tours)
ALTER TABLE public.venta_productos RENAME COLUMN reserva_id TO venta_id;
ALTER TABLE public.venta_productos RENAME COLUMN tour_id TO producto_id;
-- Si existe columna fecha_tour
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'venta_productos' AND column_name = 'fecha_tour') THEN
        ALTER TABLE public.venta_productos RENAME COLUMN fecha_tour TO fecha_servicio;
    END IF;
END $$;

-- 4. RENAME COLUMNS IN VENTA_EXTRAS (Reserva_Opcionales)
ALTER TABLE public.venta_extras RENAME COLUMN reserva_id TO venta_id;
ALTER TABLE public.venta_extras RENAME COLUMN opcional_id TO extra_id;

-- 5. RENAME COLUMNS IN LEADS
ALTER TABLE public.leads RENAME COLUMN tour_nombre TO producto_interes;

-- 6. RENAME COLUMNS IN SECUENCIAS_MARKETING
ALTER TABLE public.secuencias_marketing RENAME COLUMN tour_match TO producto_match;

-- 7. RE-CREATE ANY VIEWS OR FUNCTIONS IF NEEDED
-- If mass_enroll_sequence checks for tour_nombre, it's better to recreate or update it.
-- But since it's an RPC, we should recreate mass_enroll_sequence to use producto_interes and producto_match.

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
