-- ==========================================
-- SCRIPT DE INICIALIZACION DE DATOS (DESARROLLO)
-- Inserta Productos y Asesores de ejemplo para testing.
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ==========================================

DO $$
DECLARE
  v_agencia_id UUID;
BEGIN
  -- 1. Obtener el ID de la agencia principal (la primera que se creo)
  SELECT id INTO v_agencia_id FROM public.agencias ORDER BY created_at ASC LIMIT 1;

  -- Dependiendo del entorno, asegurar que tengamos un ID valido
  IF v_agencia_id IS NULL THEN
    INSERT INTO public.agencias (nombre, plan) VALUES ('Mi Agencia (Demo)', 'free') RETURNING id INTO v_agencia_id;
  END IF;

  -- ==========================================
  -- 2. INSERTAR PRODUCTOS BASE
  -- ==========================================

  INSERT INTO public.productos (agencia_id, nombre, duracion_dias, precio_usd, costo_operador, descripcion, activo)
  VALUES
    (v_agencia_id, 'Producto Demo A', 4, 430.00, 290.00, 'Producto de ejemplo', true),
    (v_agencia_id, 'Producto Demo B', 4, 450.00, 300.00, 'Producto de ejemplo', true),
    (v_agencia_id, 'Producto Demo C', 1, 50.00, 40.00, 'Producto de ejemplo', true)
  ON CONFLICT DO NOTHING;

  -- ==========================================
  -- 3. INSERTAR ASESORES BASE
  -- ==========================================

  INSERT INTO public.asesores (agencia_id, nombre, telefono, email, activo)
  VALUES (v_agencia_id, 'Asesor Demo', '+51987654321', 'asesor@demo.com', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.asesores (agencia_id, nombre, telefono, email, activo)
  VALUES (v_agencia_id, 'Asesor Demo 2', '+51999888777', 'asesor2@demo.com', true)
  ON CONFLICT DO NOTHING;

END $$;
