-- Agregar la configuración de 'master_sequence_switch' para pausar todas las automatizaciones de secuencias
-- Creado por Repunto Automations - Fase 2 Elite

INSERT INTO public.configuracion (agencia_id, clave, valor)
SELECT id, 'master_sequence_switch', 'false'
FROM public.agencias a
WHERE NOT EXISTS (
    SELECT 1 FROM public.configuracion c 
    WHERE c.agencia_id = a.id AND c.clave = 'master_sequence_switch'
);
