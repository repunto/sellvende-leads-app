-- Sprint B: Cleanup and Verification Script
-- This script removes the legacy columns from the master `reservas` table 
-- that were replaced by the new many-to-many relationship tables (`reserva_tours` and `reserva_opcionales`).

-- 1. Remove deprecated columns from `reservas` table
ALTER TABLE public.reservas
    DROP COLUMN IF EXISTS tour_id,
    DROP COLUMN IF EXISTS tour_nombre,
    DROP COLUMN IF EXISTS fecha_tour,
    DROP COLUMN IF EXISTS opcionales;

-- Notice: `precio_venta`, `costo_operador`, `pax`, `adelanto`, `pago_operador`, `descuentos` 
-- are intentionally KEPT in the `reservas` table as they now serve as global aggregated totals or global settings for the entire Booking/Itinerary.
