---
description: Aislamiento total de datos por agencia en Supabase
---

# 🔐 Seguridad RLS (Supabase)
Tablas con RLS habilitado. Políticas deben usar agencia_id = public.get_user_agencia_id(). 
Edge Functions filtran siempre por agencia_id.
