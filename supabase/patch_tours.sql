DO $$ 
DECLARE
  v_agencia_id UUID;
BEGIN
  SELECT id INTO v_agencia_id FROM public.agencias ORDER BY created_at ASC LIMIT 1;

  -- Eliminar tours dummy previos para limpiar y evitar duplicados
  DELETE FROM public.tours WHERE agencia_id = v_agencia_id;

  -- Insertar los tours oficiales extraidos de la hoja "Precios Tours"
  INSERT INTO public.tours (agencia_id, nombre, precio_usd, costo_operador) VALUES
  (v_agencia_id, 'Inka Jungle Backpacker', 430.00, 290.00),
  (v_agencia_id, 'Inka Jungle Premium', 450.00, 300.00),
  (v_agencia_id, 'Inka Jungle Privado', 600.00, 400.00),
  (v_agencia_id, 'Inka Trail 4D/3N', 680.00, 280.00),
  (v_agencia_id, 'Valle Sagrado', 50.00, 40.00),
  (v_agencia_id, 'Valle Sagrado Conexion', 500.00, 210.00),
  (v_agencia_id, 'Valle Sagrado Conexion Premium', 600.00, 257.00),
  (v_agencia_id, 'Lares Trek 3 dias', 650.00, 600.00),
  (v_agencia_id, 'Lares Trek 4 dias', 350.00, 320.00),
  (v_agencia_id, 'Uchuycusco 1 dia', 350.00, 330.00),
  (v_agencia_id, 'Uchuycusco 2 dias', 480.00, 450.00),
  (v_agencia_id, 'Uchuycusco 3 dias', 720.00, 650.00),
  (v_agencia_id, 'Maras Moray (Grupal)', 20.00, 15.00),
  (v_agencia_id, 'CHIMOMA', 140.00, 120.00),
  (v_agencia_id, 'CHIMOMA Conexion', 450.00, 400.00),
  (v_agencia_id, 'Rainbow Mountain', 50.00, 40.00),
  (v_agencia_id, 'Machupicchu 1 dia', 290.00, 270.00),
  (v_agencia_id, 'Machupicchu 2 dias', 300.00, 275.00),
  (v_agencia_id, 'City Tour Cusco (Grupal)', 15.00, 12.00),
  (v_agencia_id, 'City Tour Cusco (Privado)', 150.00, 120.00),
  (v_agencia_id, 'Ausangate Trek 1 dia', 480.00, 450.00),
  (v_agencia_id, 'Ausangate Trek 2 dias', 580.00, 550.00),
  (v_agencia_id, 'Ausangate Trek 5 dias', 650.00, 600.00),
  (v_agencia_id, 'Salkantay Trek 4 dias', 400.00, 250.00),
  (v_agencia_id, 'Salkantay Trek 5 dias', 450.00, 250.00),
  (v_agencia_id, 'Choquequirao 4 dias', 550.00, 500.00),
  (v_agencia_id, 'Choquequirao 5 dias', 650.00, 600.00),
  (v_agencia_id, 'Choquequirao 8 dias', 850.00, 800.00),
  (v_agencia_id, 'Cusco 7x7', 820.00, 750.00);

END $$;
