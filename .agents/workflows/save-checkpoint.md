---
description: Guardar el estado actual del proyecto en el diario de contexto
---

# Workflow: /save-checkpoint

Este comando registra los avances criticos de la sesion actual en el archivo `CONTEXTO_SELLVENDE.md`.

## Pasos ejecutados por el agente:
1. Lee el archivo `CONTEXTO_SELLVENDE.md`.
2. Ejecuta `git diff --stat` para identificar archivos modificados en la sesion.
3. Identifica los cambios realizados (Nuevas Edge Functions, migraciones, correccion de bugs, features).
4. Anade una nueva entrada en la seccion de "Historial de Recuperacion" con fecha y descripcion.
5. Incluye el ID de la conversacion actual para referencia futura.
6. Si se crearon migraciones SQL, documenta el nombre del archivo y su proposito.

> [!TIP]
> Usalo al final de una sesion productiva o antes de un cambio arquitectonico complejo.
