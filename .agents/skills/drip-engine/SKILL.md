---
description: Arquitectura técnica y lógica del motor de automatización de correos
---

# 🧠 Skill: Motor de Goteo (Drip Engine)

Este skill define cómo opera el sistema de automatización para evitar duplicidad de envíos y optimizar costos.

## Arquitectura del Flujo
1. **Entrada:** `meta-webhook` recibe el lead de Meta Ads. Realiza un *debouncing* en memoria para evitar ejecuciones múltiples por leads simultáneos.
2. **Registro:** El lead se inscribe en la tabla `leads_secuencias` con estado `pendiente`.
3. **Procesamiento:** Una Edge Function `process-drips` (ejecutada vía cron o manual) selecciona leads pendientes.
4. **Envío:** Se invoca la función `resend-email` que interactúa con la API de Resend.
5. **Confirmación:** Solo cuando Resend confirma el éxito, el estado del lead cambia a `contactado` y se registra en `email_logs`.

## Reglas de Oro
- **No confiar en el Frontend:** Las actualizaciones de estado de envío deben ocurrir en el servidor.
- **Validación de HTML:** Siempre usar el helper de limpieza de HTML para evitar errores de renderizado en el cliente de correo.
- **Aislamiento por Agencia:** Cada operación debe validar el `agencia_id` contra el token de servicio.
