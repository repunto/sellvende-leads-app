-- =============================================
-- PARCHE DE SEGURIDAD CRITICA: AISLAMIENTO MULTITENANT
-- =============================================

-- 1. DESTRUIR POLÍTICAS INSEGURAS DE SPRINT F (Marketing)
DROP POLICY IF EXISTS "Permitir todo a secuencias_marketing" ON public.secuencias_marketing;
DROP POLICY IF EXISTS "Permitir todo a pasos_secuencia" ON public.pasos_secuencia;
DROP POLICY IF EXISTS "Permitir todo a leads_secuencias" ON public.leads_secuencias;
DROP POLICY IF EXISTS "Permitir todo a inversion_marketing" ON public.inversion_marketing;

-- 2. DESTRUIR POLÍTICAS DEFECTUOSAS DE SPRINT E (Logs)
DROP POLICY IF EXISTS "email_log_select" ON public.email_log;
DROP POLICY IF EXISTS "email_log_insert" ON public.email_log;
DROP POLICY IF EXISTS "email_log_update" ON public.email_log;

-- 3. CREAR POLÍTICAS SEGURAS RESTRINGIDAS A LA AGENCIA DEL USUARIO
create policy "Aislamiento Secuencias Marketing" on public.secuencias_marketing for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Pasos Secuencia" on public.pasos_secuencia for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Leads Secuencias" on public.leads_secuencias for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Inversion Marketing" on public.inversion_marketing for all using (agencia_id = public.get_user_agencia_id());
create policy "Aislamiento Email Log" on public.email_log for all using (agencia_id = public.get_user_agencia_id());

-- 4. ASEGURAR QUE PREVIAMENTE ESTÁN ACTIVADOS
ALTER TABLE public.secuencias_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasos_secuencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversion_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
