-- ============================================
-- Fase 0: SaaS Readiness — Planes y Suscripciones
-- ============================================

-- 1. Tabla de planes (catálogo inmutable, se seedea una vez)
CREATE TABLE IF NOT EXISTS public.planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  precio_mensual NUMERIC(10,2) NOT NULL DEFAULT 49.00,
  max_leads_mes INTEGER DEFAULT NULL,  -- NULL = ilimitado
  max_usuarios INTEGER DEFAULT 5,
  features JSONB DEFAULT '{}'::jsonb,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de suscripciones (una por agencia)
CREATE TABLE IF NOT EXISTS public.suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id UUID NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.planes(id),
  estado TEXT NOT NULL DEFAULT 'trial'
    CHECK (estado IN ('trial','activa','cancelada','vencida','pendiente')),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  paypal_subscription_id TEXT,
  mp_subscription_id TEXT,
  metodo_pago TEXT CHECK (metodo_pago IN ('stripe','paypal','mercadopago', NULL)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agencia_id)
);

-- 3. Seed del plan único "Profesional"
INSERT INTO public.planes (nombre, precio_mensual, max_leads_mes, max_usuarios, features)
VALUES ('Profesional', 49.00, NULL, 5, '{"capi":true,"ai_scoring":false,"whatsapp":false}')
ON CONFLICT (nombre) DO NOTHING;

-- 4. RLS para suscripciones
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agency subscription" ON public.suscripciones;
CREATE POLICY "Users can view own agency subscription"
  ON public.suscripciones FOR SELECT
  USING (agencia_id IN (
    SELECT agencia_id FROM public.usuarios_agencia
    WHERE usuario_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own agency subscription" ON public.suscripciones;
CREATE POLICY "Users can update own agency subscription"
  ON public.suscripciones FOR UPDATE
  USING (agencia_id IN (
    SELECT agencia_id FROM public.usuarios_agencia
    WHERE usuario_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own agency subscription" ON public.suscripciones;
CREATE POLICY "Users can insert own agency subscription"
  ON public.suscripciones FOR INSERT
  WITH CHECK (agencia_id IN (
    SELECT agencia_id FROM public.usuarios_agencia
    WHERE usuario_id = auth.uid()
  ));

-- 5. RLS para planes (lectura pública)
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read plans" ON public.planes;
CREATE POLICY "Anyone can read plans" ON public.planes FOR SELECT USING (true);

-- 6. Index para performance
CREATE INDEX IF NOT EXISTS idx_suscripciones_agencia_id ON public.suscripciones(agencia_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado ON public.suscripciones(estado);
