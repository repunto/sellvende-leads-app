-- Migración Fase 1: Arquitectura de Cola de Mensajes Asíncrona (Background Queue)
-- Permite insertar miles de peticiones de correos instantáneamente y procesarlas de forma espaciada
-- evadiendo límites 429 Too Many Requests y Timeouts del Frontend.

CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agencia_id UUID NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    email_destinatario TEXT NOT NULL,
    asunto TEXT NOT NULL,
    cuerpo_html TEXT NOT NULL,
    template_id UUID,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, procesando, enviado, fallido
    intentos INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de alto rendimiento para el Edge Function Worker
CREATE INDEX IF NOT EXISTS idx_email_queue_estado ON public.email_queue(estado);
CREATE INDEX IF NOT EXISTS idx_email_queue_agencia ON public.email_queue(agencia_id);

-- Configurar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para las Agencias (Frontend)
CREATE POLICY "Agencias pueden ver su propia cola"
    ON public.email_queue FOR SELECT
    USING (agencia_id = auth.uid());

CREATE POLICY "Agencias pueden agregar a su cola"
    ON public.email_queue FOR INSERT
    WITH CHECK (agencia_id = auth.uid());
    
CREATE POLICY "Agencias pueden limpiar su cola"
    ON public.email_queue FOR DELETE
    USING (agencia_id = auth.uid());

-- Trigger para automatizar la fecha de modificación
CREATE OR REPLACE FUNCTION set_updated_at_email_queue()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_queue_updated_at ON public.email_queue;
CREATE TRIGGER trigger_email_queue_updated_at
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_email_queue();

-- ==========================================
-- TAREA PROGRAMADA (CRON JOB)
-- Despertar al trabajador Edge Function cada minuto para procesar la cola
-- ==========================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'process_email_queue_job'
    ) THEN
        PERFORM cron.unschedule('process_email_queue_job');
    END IF;
END $$;

SELECT cron.schedule(
  'process_email_queue_job',
  '* * * * *', -- Cada minuto
  $$
  select net.http_post(
      url:='https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-queue',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
  );
  $$
);
