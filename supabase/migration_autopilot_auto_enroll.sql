-- ============================================================
-- MIGRATION: Auto-enrolamiento + Cron Job Diario
-- QuipuReservas — Motor Autopilot 100% Automático
-- ============================================================

-- ============================================================
-- PARTE 1: Función de auto-enrolamiento
-- Se ejecuta automáticamente cuando llega un nuevo lead
-- ============================================================
CREATE OR REPLACE FUNCTION auto_enroll_new_lead()
RETURNS TRIGGER AS $$
DECLARE
    v_secuencia_id UUID;
    v_master_switch TEXT;
    v_tour TEXT;
    v_keyword TEXT;
    v_keywords TEXT[];
    v_found BOOLEAN := FALSE;
BEGIN
    -- Solo actuar si el lead tiene email (sin email no se puede enviar correo)
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    -- Leer master_sequence_switch para esta agencia
    SELECT valor INTO v_master_switch
    FROM configuracion
    WHERE agencia_id = NEW.agencia_id AND clave = 'master_sequence_switch'
    LIMIT 1;

    -- Si el motor global está apagado, no enrolar
    IF v_master_switch IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    -- No enrolar si ya existe un enrolamiento activo para este lead
    IF EXISTS (
        SELECT 1 FROM leads_secuencias
        WHERE lead_id = NEW.id AND estado IN ('en_progreso', 'pausado')
    ) THEN
        RETURN NEW;
    END IF;

    v_tour := LOWER(COALESCE(NEW.form_name, NEW.tour_nombre, ''));

    -- ---- FASE 1: Buscar por coincidencia de tour_match ----
    FOR v_secuencia_id IN
        SELECT id FROM secuencias_marketing
        WHERE agencia_id = NEW.agencia_id
          AND activa = TRUE
          AND tour_match IS NOT NULL
          AND TRIM(tour_match) != ''
        ORDER BY created_at ASC
    LOOP
        SELECT string_to_array(LOWER(tour_match), ',')
        INTO v_keywords
        FROM secuencias_marketing
        WHERE id = v_secuencia_id;

        FOREACH v_keyword IN ARRAY v_keywords
        LOOP
            IF v_tour LIKE '%' || TRIM(v_keyword) || '%' THEN
                v_found := TRUE;
                EXIT;
            END IF;
        END LOOP;

        IF v_found THEN EXIT; END IF;
    END LOOP;

    -- ---- FASE 2: Si no coincide por tour, usar secuencia general ----
    IF NOT v_found THEN
        SELECT id INTO v_secuencia_id
        FROM secuencias_marketing
        WHERE agencia_id = NEW.agencia_id
          AND activa = TRUE
          AND (tour_match IS NULL OR TRIM(tour_match) = '')
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_secuencia_id IS NOT NULL THEN
            v_found := TRUE;
        END IF;
    END IF;

    -- ---- ENROLAR si se encontró una secuencia ----
    IF v_found AND v_secuencia_id IS NOT NULL THEN
        INSERT INTO leads_secuencias (lead_id, secuencia_id, estado, ultimo_paso_ejecutado)
        VALUES (NEW.id, v_secuencia_id, 'en_progreso', 0)
        ON CONFLICT (lead_id, secuencia_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger (eliminar si ya existe)
DROP TRIGGER IF EXISTS trigger_auto_enroll_lead ON leads;

CREATE TRIGGER trigger_auto_enroll_lead
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_new_lead();


-- ============================================================
-- PARTE 2: Campo para rastrear auto-enrolamiento
-- Agrega una columna 'auto_enrolled' para distinguir en la UI
-- si el lead fue enrolado manualmente o de forma automática
-- ============================================================
ALTER TABLE leads_secuencias
    ADD COLUMN IF NOT EXISTS auto_enrolled BOOLEAN DEFAULT FALSE;


-- ============================================================
-- PARTE 3: Cron Job Diario — process-drips a las 8:00 UTC
-- Requiere las extensiones pg_cron y pg_net (ambas vienen
-- habilitadas por defecto en Supabase)
-- ============================================================

-- Configurar la URL del proyecto (reemplaza con tu Project ID)
-- Para QuipuReservas: nxpxlkqbzpnqoaqxkfql
DO $$
DECLARE
    v_project_url TEXT := 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
    v_service_key TEXT;
BEGIN
    -- Leer la service key desde la tabla de config (debe existir como setting)
    -- Si no tienes la key en config, pégala directamente aquí temporalmente
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Solo programar si tenemos la key
    IF v_service_key IS NOT NULL AND LENGTH(v_service_key) > 10 THEN
        -- Eliminar job anterior si existe
        PERFORM cron.unschedule('autopilot-drips-daily');

        -- Programar nuevo job: todos los días a las 8:00 UTC (3am Lima)
        PERFORM cron.schedule(
            'autopilot-drips-daily',
            '0 8 * * *',
            format($cron$
                SELECT net.http_post(
                    url := %L,
                    headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
                    body := '{}'::jsonb
                );
            $cron$, 'https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips', v_service_key)
        );

        RAISE NOTICE 'Cron job autopilot-drips-daily programado exitosamente';
    ELSE
        RAISE NOTICE 'Service key no encontrada — cron job requiere configuración manual en el Dashboard';
    END IF;
END $$;
