-- =============================================
-- Sprint E: Elite Leads Module — DB Migration
-- =============================================
-- INSTRUCCIONES: Ejecutar este SQL en Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Agregar campo 'ultimo_contacto' a leads (para tracking de WhatsApp/email)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultimo_contacto timestamptz;

-- 2. Agregar campo 'plataforma' a leads (Facebook, Instagram, TikTok, Web, etc.)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS plataforma text DEFAULT '';

-- 3. Agregar campo 'form_name' a leads (nombre del formulario de Meta)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_name text DEFAULT '';

-- 4. Agregar campo 'lead_score' a leads (puntuación automática 1-5)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;

-- 5. Crear tabla email_log (registro de emails enviados + tracking)
CREATE TABLE IF NOT EXISTS email_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
    agencia_id uuid REFERENCES agencias(id),
    tipo text DEFAULT 'individual',         -- 'masivo', 'individual', 'secuencia'
    asunto text,
    cuerpo text,
    estado text DEFAULT 'enviado',          -- 'enviado', 'abierto', 'clicked', 'rebotado', 'fallido'
    resend_id text,                         -- ID de Resend para tracking
    abierto_at timestamptz,
    clicked_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 6. RLS para email_log
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_select" ON email_log FOR SELECT
    USING (agencia_id = (SELECT agencia_id FROM usuarios_agencia WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "email_log_insert" ON email_log FOR INSERT
    WITH CHECK (agencia_id = (SELECT agencia_id FROM usuarios_agencia WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "email_log_update" ON email_log FOR UPDATE
    USING (agencia_id = (SELECT agencia_id FROM usuarios_agencia WHERE user_id = auth.uid() LIMIT 1));

-- 7. Guardar Resend API Key en configuracion (el usuario la pone desde la app)
-- No se inserta aquí, se hace desde ConfiguracionPage
