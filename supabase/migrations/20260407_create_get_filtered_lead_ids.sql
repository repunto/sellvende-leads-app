CREATE OR REPLACE FUNCTION get_filtered_lead_ids(
    p_agencia_id UUID,
    p_estado TEXT DEFAULT NULL,
    p_form_name TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_date_from TEXT DEFAULT NULL,
    p_date_to TEXT DEFAULT NULL
) RETURNS TABLE(id UUID) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT l.id FROM leads l
    WHERE l.agencia_id = p_agencia_id
      AND l.email IS NOT NULL
      AND (l.unsubscribed IS NULL OR l.unsubscribed = false)
      AND (p_estado IS NULL OR l.estado = p_estado)
      AND (p_form_name IS NULL OR l.form_name ILIKE '%' || p_form_name || '%' OR l.tour_nombre ILIKE '%' || p_form_name || '%')
      AND (p_search IS NULL OR l.nombre ILIKE '%' || p_search || '%' OR l.email ILIKE '%' || p_search || '%')
      AND (p_date_from IS NULL OR l.created_at >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR l.created_at <= (p_date_to || 'T23:59:59Z')::timestamptz);
END;
$$;
