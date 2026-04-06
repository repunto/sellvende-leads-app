-- ============================================================
-- SQL DEFINITIVO: ACTIVAR MOTOR DE SECUENCIAS (DRIPS)
-- Ejecuta este comando directamente en tu SQL Editor de Supabase
-- ============================================================

-- 1. Habilitar las extensiones necesarias en tu base de datos
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Limpiar versiones anteriores (comentado para evitar error en el primer uso)
-- SELECT cron.unschedule('motor-drips-quipureservas');

-- 3. Programar el Motor para que corra CADA 5 MINUTOS (*/5 * * * *)
-- ⚠️ IMPORTANTE: Debes reemplazar la palabra TU_SERVICE_ROLE_KEY_AQUI por la clave real de tu proyecto.
-- Dónde encontrarla: Supabase Dashboard -> Project Settings -> API -> service_role secret
SELECT cron.schedule(
    'motor-drips-quipureservas',
    '*/5 * * * *',
    $$
        SELECT net.http_post(
            url := 'https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bG9pcWZrZWFzZmN4aXdsdnpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkyNjU4NywiZXhwIjoyMDg4NTAyNTg3fQ.IIjXlYf1DvfHmOhftrewJAOGPEdk7vMSXv0el2z6PwY"}'::jsonb,
            body := '{}'::jsonb
        );
    $$
);

-- ============================================================
-- 4. CONSULTAS ÚTILES (Para revisar si está corriendo)
-- ============================================================
-- Puedes borrar lo de arriba y correr esto mañana para ver si funcionó:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
