---
description: Validar inicialización de sesión antes de acciones críticas
---

# 🛡️ Validación de Agencia ID
Siempre verificar agencia?.id antes de supabase.functions.invoke. 
Si es undefined, mostrar toast: "Recarga la página, sesión no inicializada".
