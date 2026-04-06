# Reglas del Workspace — QuipuReservas

## 🚀 REGLA 1: Servidor de Desarrollo Siempre Activo

**Antes de cualquier cambio de código, verificar que el servidor de desarrollo esté corriendo.**

- El servidor corre en `http://localhost:3002/` con `npm run dev` desde `C:\QuipuReservas`
- Si al hacer cambios el servidor no está activo (ERR_CONNECTION_REFUSED), ejecutar `npm run dev` automáticamente antes de continuar
- Siempre confirmar que Vite reporta `ready in Xms` antes de dar por activado

---

## 🔐 REGLA 2: Nunca Exponer Credenciales en el Frontend

- Las API keys (Gmail App Password, Resend API Key) **NUNCA** se pasan en el `body` de las llamadas desde el frontend
- Las credenciales **siempre** se leen desde la tabla `configuracion` en el servidor (Edge Function), usando el `SERVICE_ROLE_KEY`
- El frontend solo envía `agencia_id` para que el servidor haga el lookup

---

## 🛡️ REGLA 3: Validar `agencia?.id` Antes de Cualquier Llamada a Edge Functions

- Antes de invocar `supabase.functions.invoke(...)`, siempre verificar que `agencia?.id` exista
- Si es `undefined`, mostrar un toast de error descriptivo: `"Recarga la página, sesión no inicializada"`
- **Nunca** pasar `undefined` como `agencia_id` a las Edge Functions

---

## 📧 REGLA 4: HTML de Emails Siempre Pasa por `wrapEmailTemplate()`

- Todo correo enviado (individual, masivo, secuencia) debe pasar por `src/lib/emailTemplate.js`
- Esta función sanitiza el HTML de ReactQuill (emojis aislados, `<p>` vacíos, saltos de línea falsos, clases de Quill)
- **Nunca** enviar HTML crudo de Quill directamente a la Edge Function

---

## 🧹 REGLA 5: Limpiar Archivos Temporales

- Los archivos como `tmp_*.js`, `fix_*.js`, `check_*.js`, `test_*.js` en la raíz del proyecto son scripts de depuración y deben eliminarse antes de cada release
- Nunca commitear archivos `tmp_*` al repositorio

---

## 🎨 REGLA 6: UX — Un Solo Modal Activo a la Vez

- Cuando se abre el `IndividualEmailModal`, se debe cerrar el `LeadDetailPanel` (`setDetailLead(null)`)
- Nunca mantener dos paneles/modales de acción simultáneos sobre el mismo lead
- El `LeadDetailPanel` es el hub de acciones; el modal es exclusivamente para redactar/enviar

---

## 🔒 REGLA 7: RLS Siempre Activo en Supabase

- **Todas** las tablas tienen Row Level Security habilitado
- Al crear nuevas tablas, siempre ejecutar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` y crear la policy correspondiente con `agencia_id = public.get_user_agencia_id()`
- Las Edge Functions usan `SERVICE_ROLE_KEY` + query por `agencia_id` explícito — nunca confiar en el JWT del usuario desde el servidor

---

## ⚡ REGLA 8: Deploy de Edge Functions Siempre Via CLI

- Para desplegar Edge Functions: `npx supabase functions deploy <nombre> --project-ref dtloiqfkeasfcxiwlvzp --no-verify-jwt`
- El MCP de Supabase no tiene permisos de deploy en este proyecto
- Verificar siempre el output `Deployed Functions on project...` antes de probar

---

## 🧪 REGLA 9: Build de Producción Antes de Declarar Completado

- Después de cualquier cambio significativo, ejecutar `npm run build`
- El build debe terminar con `✓ built in Xs` y `Exit code: 0`
- Solo se permite el warning de chunk size (>500kB) — cualquier otro error es un bloqueador

---

## 📊 REGLA 10: Toast Siempre Visible Sobre Cualquier Modal

- El `z-index` del `.toast` en `src/index.css` debe ser `999999` (mayor que cualquier modal)
- Los modales tienen `z-index: 99999`; el toast debe estar **siempre** por encima
- Si se añaden nuevos modales con z-index alto, verificar que el toast siga siendo el más alto

---

## 🗂️ REGLA 11: Estructura de Archivos del Proyecto

```
src/
  pages/         → LeadsPage.jsx, ReservasPage.jsx, etc.
  components/
    leads/
      modals/    → LeadDetailPanel.jsx, IndividualEmailModal.jsx
  lib/           → emailTemplate.js, supabase.js
supabase/
  functions/     → resend-email/, autopilot-drip/
  migrations/    → *.sql (no modificar producción directamente)
```

---

## 🔄 REGLA 12: Variables de Entorno

- `.env` solo contiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- **Nunca** agregar en `.env` keys secretas (service role, API keys de terceros)
- Las keys secretas van en los **Secrets de Supabase** (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, etc.) y la Edge Function las lee con `Deno.env.get()`
