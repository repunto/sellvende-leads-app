-- ==========================================
-- SCRIPT DE INICIALIZACIÓN DE DATOS (MIGRACIÓN G-SHEETS)
-- Este script inserta los Tours y Operadores base.
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ==========================================

DO $$ 
DECLARE
  v_agencia_id UUID;
BEGIN
  -- 1. Obtener el ID de la agencia principal (la primera que se creó)
  SELECT id INTO v_agencia_id FROM public.agencias ORDER BY created_at ASC LIMIT 1;

  -- Dependiendo del entorno, asegurar que tengamos un ID válido
  IF v_agencia_id IS NULL THEN
    -- Crear una agencia dummy de emergencia solo si la DB está 100% vacía
    INSERT INTO public.agencias (nombre, plan) VALUES ('Mi Agencia (Demo)', 'free') RETURNING id INTO v_agencia_id;
  END IF;

  -- ==========================================
  -- 2. INSERTAR TOURS BASE (Desde Google Sheets)
  -- ==========================================
  
  INSERT INTO public.tours (agencia_id, nombre, duracion_dias, precio_usd, costo_operador, descripcion, activo)
  VALUES 
    (v_agencia_id, 'Inka Jungle Backpacker', 4, 430.00, 290.00, 'Trek clásico', true),
    (v_agencia_id, 'Inka Jungle Premium', 4, 450.00, 300.00, 'Trek clásico', true),
    (v_agencia_id, 'Inka Jungle Privado', 4, 600.00, 400.00, 'Trek rápido', true),
    (v_agencia_id, 'Inka Trail 4D/3N', 4, 680.00, 280.00, 'Camino Inca', true),
    (v_agencia_id, 'Valle Sagrado', 1, 50.00, 40.00, 'Valle Sagrado 1D', true),
    (v_agencia_id, 'Valle Sagrado Conexion', 1, 500.00, 210.00, 'Valle Conexion', true),
    (v_agencia_id, 'Valle Sagrado Conexion Premium', 1, 600.00, 257.00, 'Conexion Premium', true),
    (v_agencia_id, 'Lares Trek 3 dias', 3, 650.00, 600.00, 'Trek 3D', true),
    (v_agencia_id, 'Lares Trek 4 dias', 4, 350.00, 320.00, 'Trek 4D', true),
    (v_agencia_id, 'Uchuycusco 1 dia', 1, 350.00, 330.00, 'Trek 1D', true),
    (v_agencia_id, 'Uchuycusco 2 dias', 2, 480.00, 450.00, 'Trek 2D', true),
    (v_agencia_id, 'Uchuycusco 3 dias', 3, 720.00, 650.00, 'Trek 3D', true),
    (v_agencia_id, 'Maras Moray (Grupal)', 1, 20.00, 15.00, 'Maras grupal', true),
    (v_agencia_id, 'CHIMOMA', 1, 140.00, 120.00, 'Chimoma Trek', true),
    (v_agencia_id, 'CHIMOMA Conexion', 1, 450.00, 400.00, 'Chimoma Conexion', true),
    (v_agencia_id, 'Rainbow Mountain', 1, 50.00, 40.00, 'Montaña Colores', true),
    (v_agencia_id, 'Machupicchu 1 dia', 1, 290.00, 270.00, 'Mapi full day', true),
    (v_agencia_id, 'Machupicchu 2 dias', 2, 300.00, 275.00, 'Mapi 2D', true),
    (v_agencia_id, 'City Tour Cusco (Grupal)', 1, 15.00, 12.00, 'City Tour', true),
    (v_agencia_id, 'City Tour Cusco (Privado)', 1, 150.00, 120.00, 'City Tour Privado', true),
    (v_agencia_id, 'Ausangate Trek 1 dia', 1, 480.00, 450.00, 'Ausangate Trek', true),
    (v_agencia_id, 'Ausangate Trek 2 dias', 2, 580.00, 550.00, 'Ausangate Trek', true),
    (v_agencia_id, 'Ausangate Trek 5 dias', 5, 650.00, 600.00, 'Ausangate Trek 5D', true),
    (v_agencia_id, 'Salkantay Trek 4 dias', 4, 400.00, 250.00, 'Salkantay 4D', true),
    (v_agencia_id, 'Salkantay Trek 5 dias', 5, 450.00, 250.00, 'Salkantay 5D', true),
    (v_agencia_id, 'Choquequirao 4 dias', 4, 550.00, 500.00, 'Choquequirao Trek', true),
    (v_agencia_id, 'Choquequirao 5 dias', 5, 650.00, 600.00, 'Choquequirao Trek', true),
    (v_agencia_id, 'Choquequirao 8 dias', 8, 850.00, 800.00, 'Choquequirao Trek Extend', true),
    (v_agencia_id, 'Cusco 7x7', 7, 820.00, 750.00, 'Paquete Cusco', true)
  ON CONFLICT DO NOTHING;

  -- ==========================================
  -- 3. INSERTAR OPERADORES BASE
  -- ==========================================

  INSERT INTO public.operadores (agencia_id, nombre, telefono, email, activo)
  VALUES (v_agencia_id, 'Machu Picchu Reservations', '+51987654321', 'reservas@machupicchu.com', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.operadores (agencia_id, nombre, telefono, email, activo)
  VALUES (v_agencia_id, 'Inka Time Tours', '+51999888777', 'operaciones@inkatime.com', true)
  ON CONFLICT DO NOTHING;

END $$;
