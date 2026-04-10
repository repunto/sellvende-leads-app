---
description: Mejores prácticas para interactuar con la lógica de negocio en Postgres
---

# 🧠 Skill: Patrones de Funciones RPC

Este skill define cuándo y cómo usar Remote Procedure Calls (RPC) en lugar de consultas directas a tablas.

## Cuándo usar RPC
- **Operaciones Masivas:** Actualizaciones que afecten a más de 10 filas (ej. enrolamiento masivo).
- **Consultas Complejas:** Filtros que requieren lógica compleja en el lado del servidor (ej. dashboard de KPIs).
- **Paginación Avanzada:** Obtención de leads con conteos y filtros dinámicos.

## Implementación
En el frontend, usar siempre el método `.rpc()` de Supabase:
```javascript
const { data, error } = await supabase.rpc('nombre_funcion', { 
  param_1: valor1,
  agencia_id: id 
});
```

## Seguridad
Las funciones RPC deben estar definidas en el esquema `public` con `SECURITY DEFINER` y verificar internamente el acceso del usuario mediante `auth.uid()` o políticas de RLS explícitas.
