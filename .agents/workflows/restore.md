---
description: Recuperar el contexto y las reglas del proyecto al iniciar sesion
---

# Workflow: /restore

Este comando permite al agente ponerse al dia rapidamente con el estado del proyecto Sellvende Leads.

## Pasos ejecutados por el agente:
1. Lee `CLAUDE.md` para cargar las reglas de orquestacion y estilo del proyecto.
2. Lee `MASTER_DEVELOPMENT_PLAN.md` para entender la arquitectura completa del sistema.
3. Lee `CONTEXTO_SELLVENDE.md` para entender los hitos recientes de implementacion.
4. Lee `AGENT_SQUAD_BLUEPRINT.md` para conocer los roles de agente disponibles.
5. Carga las reglas de la carpeta `.agents/rules/`.
6. Verifica el estado del servidor local (`localhost:3002` via `npm run dev`).
7. Verifica si el proyecto Supabase esta activo (usando `/supabase-pause-check`).
8. Presenta un resumen del estado actual al usuario con: rama git, archivos modificados, ultimo commit.
