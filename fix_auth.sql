-- 1. Asegurarnos que haya al menos una agencia creada
INSERT INTO public.agencias (nombre, plan)
SELECT 'Inka Jungle Tour', 'pro'
WHERE NOT EXISTS (SELECT 1 FROM public.agencias);

-- 2. Vincular TODOS los usuarios huérfanos a esa agencia como administradores
INSERT INTO public.usuarios_agencia (usuario_id, agencia_id, rol)
SELECT u.id, (SELECT id FROM public.agencias LIMIT 1), 'admin'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios_agencia ua WHERE ua.usuario_id = u.id);
