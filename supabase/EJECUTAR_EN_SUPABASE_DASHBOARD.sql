-- ============================================================
-- AUTOPILOT COMPLETO — QuipuReservas
-- Ejecutar en: supabase.com → Tu Proyecto → SQL Editor → New Query
-- Copiar todo este bloque y hacer clic en "Run"
--
-- Esto crea:
--   1. Trigger que auto-enrola leads nuevos a secuencias
--   2. Columna auto_enrolled en leads_secuencias
--   3. Función auxiliar para verificar estado del cron job
--   4. Cron job diario a las 8:00am UTC (3am Lima / 10am España)
-- ============================================================


-- PARTE 1: Función de auto-enrolamiento
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
    -- Solo actuar si el lead tiene email
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    -- Verificar si el motor global está encendido
    SELECT valor INTO v_master_switch
    FROM configuracion
    WHERE agencia_id = NEW.agencia_id AND clave = 'master_sequence_switch'
    LIMIT 1;

    IF v_master_switch IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    -- No enrolar si ya está enrolado en alguna secuencia activa
    IF EXISTS (
        SELECT 1 FROM leads_secuencias
        WHERE lead_id = NEW.id AND estado IN ('en_progreso', 'pausado')
    ) THEN
        RETURN NEW;
    END IF;

    v_tour := LOWER(COALESCE(NEW.tour_nombre, ''));

    -- FASE 1: Buscar secuencia por coincidencia de tour_match
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

    -- FASE 2: Si no hay coincidencia específica, usar secuencia general
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

    -- Enrolar si se encontró una secuencia
    IF v_found AND v_secuencia_id IS NOT NULL THEN
        INSERT INTO leads_secuencias (lead_id, secuencia_id, estado, ultimo_paso_ejecutado, auto_enrolled)
        VALUES (NEW.id, v_secuencia_id, 'en_progreso', 0, TRUE)
        ON CONFLICT (lead_id, secuencia_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (primero eliminar si existe)
DROP TRIGGER IF EXISTS trigger_auto_enroll_lead ON leads;

CREATE TRIGGER trigger_auto_enroll_lead
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_new_lead();


-- PARTE 2: Columna para rastrear auto-enrolamiento
-- ============================================================
ALTER TABLE leads_secuencias
    ADD COLUMN IF NOT EXISTS auto_enrolled BOOLEAN DEFAULT FALSE;


-- PARTE 3: Función auxiliar para verificar cron job (usada por la UI)
-- ============================================================
CREATE OR REPLACE FUNCTION check_cron_job_exists(job_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = job_name
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PARTE 4: Cron Job Diario — 8:00 UTC todos los días
-- ============================================================
-- IMPORTANTE: Reemplaza los siguientes valores antes de ejecutar:
--   TU_SERVICE_ROLE_KEY = la clave que encuentras en:
--   Dashboard → Settings → API → service_role key

DO $$
DECLARE
    v_url TEXT := 'https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips';
    v_key TEXT := 'dtloiqfkeasfcxiwlvzp';  -- <-- REEMPLAZA ESTO
BEGIN
    -- Eliminar job anterior si existe
    BEGIN
        PERFORM cron.unschedule('autopilot-drips-daily');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Programar el job diario
    PERFORM cron.schedule(
        'autopilot-drips-daily',
        '0 8 * * *',
        format(
            $sql$SELECT net.http_post(url:='%s', headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb, body:='{}'::jsonb) AS request_id;$sql$,
            v_url, v_key
        )
    );

    RAISE NOTICE 'Cron job autopilot-drips-daily programado: todos los días a las 08:00 UTC';
END $$;


-- VERIFICACIÓN FINAL
-- ============================================================
SELECT 'Trigger creado:' as info, trigger_name FROM information_schema.triggers WHERE trigger_name = 'trigger_auto_enroll_lead'
UNION ALL
SELECT 'Cron job:' as info, jobname FROM cron.job WHERE jobname = 'autopilot-drips-daily';
