---
description: Guardar el estado actual del proyecto en el diario de contexto
---

# Workflow: /save-checkpoint

Este comando registra los avances críticos de la sesión actual en el archivo `CONTEXTO_QUIPURESERVAS.md`.

## Pasos ejecutados por el agente:
1. Lee el archivo `CONTEXTO_QUIPURESERVAS.md`.
2. Identifica los cambios realizados en la sesión (Nuevas EFs, migraciones, corrección de bugs).
3. Añade una nueva entrada en la sección de "Historial de Recuperación".
4. Incluye el ID de la conversación actual para referencia futura.

> [!TIP]
> Úsalo al final de una sesión productiva o antes de un cambio arquitectónico complejo.
