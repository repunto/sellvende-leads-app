-- Sprint F Webhook RPC

-- Esta función permite inyectar leads desde Zapier, Make, Chatbots usando un API KEY.
CREATE OR REPLACE FUNCTION public.ingresar_lead_webhook(
    p_agencia_id UUID,
    p_api_secret TEXT,
    p_nombre VARCHAR,
    p_email VARCHAR,
    p_telefono VARCHAR,
    p_tour_nombre VARCHAR DEFAULT NULL,
    p_origen VARCHAR DEFAULT 'Webhook',
    p_idioma VARCHAR DEFAULT 'ES',
    p_personas INTEGER DEFAULT 1,
    p_temporada VARCHAR DEFAULT NULL,
    p_notas TEXT DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agencia_id UUID;
    v_lead_id UUID;
    v_existente UUID;
BEGIN
    -- 1. Validar api_secret en la tabla de configuración para esa agencia específica
    SELECT agencia_id INTO v_agencia_id
    FROM public.configuracion
    WHERE agencia_id = p_agencia_id AND clave = 'webhook_api_key' AND valor = p_api_secret
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid Webhook API Key');
    END IF;

    -- 2. Evitar duplicados por email
    IF p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
        SELECT id INTO v_existente
        FROM public.leads
        WHERE email = TRIM(p_email) AND agencia_id = v_agencia_id
        LIMIT 1;

        IF FOUND THEN
            -- Solo agregamos una nota indicando que intentó entrar nuevamente
            UPDATE public.leads
            SET notas = COALESCE(notas, '') || CHR(10) || 'Drip/Webhook Update: Nuevo intento (' || p_origen || '), fecha: ' || NOW() || CHR(10) || COALESCE(p_notas, '')
            WHERE id = v_existente;

            RETURN json_build_object('success', true, 'lead_id', v_existente, 'status', 'updated_duplicate');
        END IF;
    END IF;

    -- 3. Insertar nuevo Lead
    INSERT INTO public.leads (
        agencia_id, nombre, email, telefono, tour_nombre,
        origen, idioma, personas, temporada, notas, estado
    ) VALUES (
        v_agencia_id, p_nombre, p_email, p_telefono, p_tour_nombre,
        p_origen, p_idioma, p_personas, p_temporada, p_notas, 'nuevo'
    ) RETURNING id INTO v_lead_id;

    RETURN json_build_object('success', true, 'lead_id', v_lead_id, 'status', 'inserted');
END;
$$;
