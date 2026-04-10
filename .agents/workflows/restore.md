---
description: Recuperar el contexto y las reglas del proyecto al iniciar sesión
---

# Workflow: /restore

Este comando permite al agente ponerse al día rápidamente con el estado del proyecto.

## Pasos ejecutados por el agente:
1. Lee `CONTEXTO_QUIPURESERVAS.md` para entender los hitos recientes.
2. Carga las reglas de la carpeta `.agent/rules/`.
3. Verifica el estado del servidor local (`localhost:3002`).
4. Verifica si el proyecto Supabase está activo (usando `/supabase-pause-check`).
5. Presenta un resumen del estado actual al usuario.
