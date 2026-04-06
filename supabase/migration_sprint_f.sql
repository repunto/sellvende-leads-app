-- ==============================================================================
-- MIGRACIÓN SPRINT F: MÓDULO ÉLITE DE MARKETING Y FINANZAS
-- ==============================================================================

-- 1. Tabla: secuencias_marketing (Las Drip Campaigns)
CREATE TABLE public.secuencias_marketing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,       -- Ej: "Despertar Inca Trail"
    descripcion TEXT,
    agencia_id UUID REFERENCES public.agencias(id) ON DELETE CASCADE,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla: pasos_secuencia (Los días y plantillas de cada drip)
CREATE TABLE public.pasos_secuencia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    secuencia_id UUID REFERENCES public.secuencias_marketing(id) ON DELETE CASCADE,
    dia_envio INTEGER NOT NULL,         -- Día 1, Día 3, Día 5 tras asignación
    plantilla_email_id UUID REFERENCES public.plantillas_email(id) ON DELETE SET NULL,
    plantilla_whatsapp_id UUID REFERENCES public.plantillas_whatsapp(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla: leads_secuencias (Mapeo Lead <-> Secuencia para el Cron)
CREATE TABLE public.leads_secuencias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    secuencia_id UUID REFERENCES public.secuencias_marketing(id) ON DELETE CASCADE,
    fecha_inscripcion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado VARCHAR(50) DEFAULT 'en_progreso', -- 'en_progreso', 'completada', 'detenida'
    ultimo_paso_ejecutado INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lead_id, secuencia_id)
);

-- 4. Tabla: inversion_marketing (Control de ROAS)
CREATE TABLE public.inversion_marketing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agencia_id UUID REFERENCES public.agencias(id) ON DELETE CASCADE,
    campana_nombre VARCHAR(255) NOT NULL, -- Nombre exacto de la campaña (Ej: "Salkantay Meta Ads Abril")
    mes_anio VARCHAR(7) NOT NULL,         -- Formato 'YYYY-MM'
    gasto_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    plataforma VARCHAR(50) DEFAULT 'Meta Ads',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agencia_id, campana_nombre, mes_anio)
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.secuencias_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasos_secuencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversion_marketing ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Solo lectura/escritura autenticada genérica por ahora)
CREATE POLICY "Permitir todo a secuencias_marketing" ON public.secuencias_marketing FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir todo a pasos_secuencia" ON public.pasos_secuencia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir todo a leads_secuencias" ON public.leads_secuencias FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir todo a inversion_marketing" ON public.inversion_marketing FOR ALL USING (auth.role() = 'authenticated');
