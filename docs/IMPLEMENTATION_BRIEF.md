# IMPLEMENTATION BRIEF — Sellvende Leads Security Fixes
## Guía Paso-a-Paso para IA Implementadora

**Generado:** 2026-04-13  
**Origen:** Auditoría de seguridad completa (ver `AUDIT_REPORT.md`)  
**Propósito:** Este documento está diseñado para ser consumido por una IA implementadora. Cada tarea contiene el cambio EXACTO de código que debe hacerse, sin ambigüedad.  
**Regla de oro:** NO inventar soluciones. NO modificar archivos que no estén especificados. Aplicar SOLO los cambios descritos aquí.

---

# ORDEN DE EJECUCIÓN

| Fase | Tareas | Tiempo estimado |
|------|--------|----------------|
| **Fase 0** | Tareas manuales (no requieren código) | 15 min |
| **Fase 1** | Fixes CRÍTICOS #3, #6, #7, #10, #15 (auth + secrets) | 2 hr |
| **Fase 2** | Fixes CRÍTICOS #4, #5, #13 (XSS) | 2 hr |
| **Fase 3** | Fixes CRÍTICOS #8, #12 (spoofing + tokens) | 1.5 hr |
| **Fase 4** | Fixes CRÍTICOS #9, #11, #14 (DB + RLS + atomicidad) | 2 hr |

**Total: ~8 horas de trabajo**

---

# FASE 0: Tareas Manuales (No Código)

## TAREA 0.1: Revocar GitHub PAT [CRÍTICO #1]
**Acción manual — NO requiere código**

1. Ir a https://github.com/settings/tokens
2. Buscar el token que comienza con `ghp_[REDACTED — token revocado]`
3. Revocarlo (Delete)
4. Si se necesita un nuevo token, crearlo con permisos mínimos (solo repo)
5. Guardarlo SOLO en Windows Credential Manager — NUNCA en archivos de texto

---

## TAREA 0.2: Rotar Supabase Anon Key [CRÍTICO #2]
**Acción manual — NO requiere código**

1. Ir a Supabase Dashboard → Project Settings → API
2. Generar nueva anon key (Rotate keys)
3. Actualizar `.env.local` con la nueva key
4. Opcional: usar BFG Repo-Cleaner para purgar la key vieja del historial:
   ```bash
   bfg --replace-text anon-keys.txt
   ```

---

## TAREA 0.3: Agregar supabase/.temp/ al .gitignore [CRÍTICO relacionado]
**Acción: 1 línea**

**Archivo:** `.gitignore`

Agregar al final del archivo:
```
# Supabase CLI temp files
supabase/.temp/
```

Luego ejecutar en terminal:
```bash
git rm -r --cached supabase/.temp/
git commit -m "chore: remove supabase/.temp from tracking"
```

---

# FASE 1: Auth + Secrets

## TAREA 1.1: Eliminar `fallback-secret` — unsubscribe/index.ts [CRÍTICO #3a]

**Archivo:** `supabase/functions/unsubscribe/index.ts`

**Buscar** (línea ~12):
```typescript
async function generateToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret'
```

**Reemplazar por:**
```typescript
async function generateToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secret) throw new Error('[Unsubscribe] SUPABASE_SERVICE_ROLE_KEY not configured')
```

**Verificación:** El archivo debe contener `throw new Error` en lugar de `'fallback-secret'`.

---

## TAREA 1.2: Eliminar `fallback-secret` — process-drips/index.ts [CRÍTICO #3b]

**Archivo:** `supabase/functions/process-drips/index.ts`

**Buscar** (línea ~101-105):
```typescript
async function generateUnsubToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret';
```

**Reemplazar por:**
```typescript
async function generateUnsubToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret) throw new Error('[Drips] SUPABASE_SERVICE_ROLE_KEY not configured');
```

**Verificación:** Buscar `'fallback-secret'` en todo el archivo — debe aparecer 0 veces.

---

## TAREA 1.3: Eliminar `fallback-secret` — handle-bounce/index.ts [CRÍTICO #3c / #15]

**Archivo:** `supabase/functions/handle-bounce/index.ts`

**Buscar** (línea ~30-36):
```typescript
async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!WEBHOOK_SECRET) {
        // No secret configured — warn but allow in dev mode
        console.warn('[Bounce] RESEND_WEBHOOK_SECRET not set. Skipping signature check.')
        return true
    }
```

**Reemplazar por:**
```typescript
async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!WEBHOOK_SECRET) {
        // Fail closed — reject all requests if secret is not configured
        console.error('[Bounce] RESEND_WEBHOOK_SECRET not configured. Rejecting request.')
        return false
    }
```

**Verificación:** La función debe retornar `false` (no `true`) cuando no hay secret.

---

## TAREA 1.4: Agregar autenticación a send-meta-event [CRÍTICO #6]

**Archivo:** `supabase/functions/send-meta-event/index.ts`

**Paso 1 — Agregar constante de autenticación.** Buscar (línea ~15):
```typescript
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
const corsHeaders = {
```

**Reemplazar por:**
```typescript
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://leads.sellvende.com'
const WEBHOOK_SECRET = Deno.env.get('CAPI_WEBHOOK_SECRET') || ''
const corsHeaders = {
```

**Paso 2 — Agregar verificación de autenticación.** Buscar (línea ~31-36):
```typescript
    try {
        const payload = await req.json()
```

**Reemplazar por:**
```typescript
    // ── Autenticación: webhook secreto compartido ──────────────
    const authHeader = req.headers.get('X-Webhook-Secret') || ''
    if (!WEBHOOK_SECRET || authHeader !== WEBHOOK_SECRET) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized. Requiere header X-Webhook-Secret.' }),
            { headers: corsHeaders, status: 401 }
        )
    }

    try {
        const payload = await req.json()
```

**Paso 3 — Agregar `Access-Control-Allow-Headers` para el nuevo header.** Modificar `corsHeaders`:
```typescript
const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
    'Content-Type': 'application/json',
}
```

**Verificación:** El endpoint debe retornar 401 si no se envía `X-Webhook-Secret`.

**Nota de infraestructura:** Después de deployar, configurar el Supabase Database Webhook para incluir el header `X-Webhook-Secret` con el valor de `CAPI_WEBHOOK_SECRET`.

---

## TAREA 1.5: Agregar autenticación a meta-oauth [CRÍTICO #7]

**Archivo:** `supabase/functions/meta-oauth/index.ts`

**Paso 1 — Agregar función de verificación de auth.** Insertar ANTES de `serve(async (req) => {`:
```typescript
async function verifyAuth(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return false

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return false

    // Accept service role key
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (token === serviceKey) return true

    // Verify user JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: { user }, error } = await authClient.auth.getUser()
    return !!user && !error
}
```

**Paso 2 — Agregar verificación en el handler.** Buscar (después del bloque OPTIONS):
```typescript
    try {
        const { short_lived_token, page_id } = await req.json()
```

**Reemplazar por:**
```typescript
    // ── Autenticación: requiere JWT válido o service role ──────
    const isAuthenticated = await verifyAuth(req)
    if (!isAuthenticated) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized. Requiere autenticación.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
    }

    try {
        const { short_lived_token, page_id } = await req.json()
```

**Verificación:** El endpoint debe retornar 401 sin header Authorization válido.

---

## TAREA 1.6: Quitar `anon` de mass_enroll_sequence [CRÍTICO #10]

**Archivo:** `supabase/migrations/20260413000000_fix_mass_enroll_sequence.sql`

**Buscar** (última línea del archivo):
```sql
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO anon, authenticated, service_role;
```

**Reemplazar por:**
```sql
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO authenticated, service_role;
```

**Crear nueva migración** en `supabase/migrations/20260413020000_revoke_anon_mass_enroll.sql`:
```sql
-- Revoke anon access to mass_enroll_sequence (security fix)
REVOKE EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO authenticated, service_role;
```

**Verificación:** Solo usuarios autenticados y service_role pueden ejecutar esta función.

---

# FASE 2: XSS Fixes

## TAREA 2.1: Instalar DOMPurify

**Ejecutar en terminal:**
```bash
npm install dompurify
```

---

## TAREA 2.2: Crear helper de escape HTML reutilizable

**Crear nuevo archivo:** `src/lib/sanitizeHtml.js`

**Contenido completo del archivo:**
```javascript
/**
 * escapeHtml — Escapa caracteres peligrosos para prevenir XSS
 * en interpolación de strings.
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * sanitizeForHtmlAttr — Escapa valores para atributos HTML
 */
export function sanitizeForHtmlAttr(str) {
    return escapeHtml(str)
        .replace(/=/g, '&#61;')
        .replace(/`/g, '&#96;');
}
```

---

## TAREA 2.3: Fix XSS en IndividualEmailModal.jsx [CRÍTICO #4]

**Archivo:** `src/components/leads/modals/IndividualEmailModal.jsx`

**Paso 1 — Agregar import.** Al inicio del archivo, donde están los imports:
```javascript
import { escapeHtml } from '../../lib/sanitizeHtml'
```

**Paso 2 — Reemplazar la construcción de previewHtml.** Buscar (líneas ~22-30):
```javascript
    const previewHtml = (emailBody || '')
        .replace(/\{Nombre\}/gi, lead.nombre || 'Cliente')
        .replace(/\{nombre\}/gi, lead.nombre || 'Cliente')
        .replace(/\{Producto\}/gi, lead.producto_interes || 'el producto')
        .replace(/\{producto\}/gi, lead.producto_interes || 'el producto')
        .replace(/\{Agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{(FechaViaje|fecha_entrega)\}/gi, lead.temporada || '')
        .replace(/\{telefono\}/gi, configs?.telefono_agencia || configs?.whatsapp || '')
        .replace(/\{social_proof\}/gi, '')
```

**Reemplazar por:**
```javascript
    const safeNombre = escapeHtml(lead.nombre || 'Cliente')
    const safeProducto = escapeHtml(lead.producto_interes || 'el producto')
    const safeAgencia = escapeHtml(agencia?.nombre || 'Nuestra Agencia')
    const safeTemporada = escapeHtml(lead.temporada || '')
    const safeTelefono = escapeHtml(configs?.telefono_agencia || configs?.whatsapp || '')

    const previewHtml = (emailBody || '')
        .replace(/\{Nombre\}/gi, safeNombre)
        .replace(/\{nombre\}/gi, safeNombre)
        .replace(/\{Producto\}/gi, safeProducto)
        .replace(/\{producto\}/gi, safeProducto)
        .replace(/\{Agencia\}/gi, safeAgencia)
        .replace(/\{agencia\}/gi, safeAgencia)
        .replace(/\{(FechaViaje|fecha_entrega)\}/gi, safeTemporada)
        .replace(/\{telefono\}/gi, safeTelefono)
        .replace(/\{social_proof\}/gi, '')
```

**Paso 3 — Sanitizar el dangerouslySetInnerHTML.** Buscar donde está el div con `dangerouslySetInnerHTML`:
```jsx
<div ... dangerouslySetInnerHTML={{ __html: previewHtml }} />
```

**Reemplazar por:**
```jsx
import DOMPurify from 'dompurify'
// ...
<div ... dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
```

**Verificación:** Todos los valores del lead pasan por `escapeHtml()` ANTES de interpolación, y el resultado final pasa por `DOMPurify.sanitize()`.

---

## TAREA 2.4: Fix XSS en useLeadEmail.js — buildEmailContent [CRÍTICO #5]

**Archivo:** `src/hooks/useLeadEmail.js`

**Paso 1 — Agregar import.** Al inicio del archivo:
```javascript
import { escapeHtml } from '../lib/sanitizeHtml'
```

**Paso 2 — Modificar buildEmailContent.** Buscar la función (líneas ~20-42):
```javascript
function buildEmailContent({ rawHtml, rawSubject, lead, config, agencyName, senderName, tplOrigen }) {
    const isEN = (lead.idioma || '').toUpperCase() === 'EN'
    const socialProof = isEN ? SOCIAL_PROOF_EMAIL.EN : SOCIAL_PROOF_EMAIL.ES
    const fromEmail = config['email_remitente'] || ''
    const activeProductoName = tplOrigen || lead.producto_interes || lead.form_name || 'nuestro producto'

    const body = rawHtml
        .replace(/{nombre}/gi, lead.nombre || '')
        .replace(/{producto}/gi, activeProductoName)
        .replace(/{email}/gi, fromEmail)
        .replace(/{telefono}/gi, config['telefono_agencia'] || config['whatsapp'] || '')
        .replace(/{agencia}/gi, agencyName)
        .replace(/{remitente}/gi, senderName || agencyName)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, formatTemporada(lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{social_proof}/gi, socialProof)

    const subject = rawSubject
        .replace(/{nombre}/gi, lead.nombre || '')
        .replace(/{producto}/gi, activeProductoName)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, formatTemporada(lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{agencia}/gi, agencyName)
        .replace(/{remitente}/gi, senderName || agencyName)

    return { body, subject }
}
```

**Reemplazar por:**
```javascript
function buildEmailContent({ rawHtml, rawSubject, lead, config, agencyName, senderName, tplOrigen }) {
    const isEN = (lead.idioma || '').toUpperCase() === 'EN'
    const socialProof = isEN ? SOCIAL_PROOF_EMAIL.EN : SOCIAL_PROOF_EMAIL.ES
    const fromEmail = config['email_remitente'] || ''
    // Escapar datos del lead para prevenir XSS en email body
    const safeNombre = escapeHtml(lead.nombre || '')
    const safeProducto = escapeHtml(tplOrigen || lead.producto_interes || lead.form_name || 'nuestro producto')
    const safeTelefono = escapeHtml(config['telefono_agencia'] || config['whatsapp'] || '')
    const safeAgencia = escapeHtml(agencyName)
    const safeSender = escapeHtml(senderName || agencyName)
    const safeTemporada = formatTemporada(lead.temporada)

    const body = rawHtml
        .replace(/{nombre}/gi, safeNombre)
        .replace(/{producto}/gi, safeProducto)
        .replace(/{email}/gi, escapeHtml(fromEmail))
        .replace(/{telefono}/gi, safeTelefono)
        .replace(/{agencia}/gi, safeAgencia)
        .replace(/{remitente}/gi, safeSender)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, safeTemporada)
        .replace(/{fecha}/gi, safeTemporada)
        .replace(/{mesagotado}/gi, escapeHtml(mesAgotado))
        .replace(/{social_proof}/gi, socialProof)

    const subject = rawSubject
        .replace(/{nombre}/gi, safeNombre)
        .replace(/{producto}/gi, safeProducto)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, safeTemporada)
        .replace(/{fecha}/gi, safeTemporada)
        .replace(/{mesagotado}/gi, escapeHtml(mesAgotado))
        .replace(/{agencia}/gi, safeAgencia)
        .replace(/{remitente}/gi, safeSender)

    return { body, subject }
}
```

**Verificación:** Cada variable de lead que se interpola en HTML pasa por `escapeHtml()`.

---

## TAREA 2.5: Fix XSS en meta-webhook — sendNewLeadAlert [CRÍTICO #13]

**Archivo:** `supabase/functions/meta-webhook/index.ts`

**Paso 1 — Buscar la función `sendNewLeadAlert`.** Dentro de ella, encontrar donde se construye el HTML del email de notificación. Buscar algo como:
```typescript
const emailBody = `
    <h2>Nuevo Lead Capturado</h2>
    <table>
```

**Paso 2 — Escapar TODOS los valores interpolados.** Dondequiera que haya `${lead.algo}`, `${lead.campaign_name}`, `${lead.adset_name}`, `${lead.utm_source}`, `${lead.utm_medium}`, `${lead.utm_campaign}`, `${lead.origen}`, envolver con `escapeHtml()`:

```typescript
// ANTES (vulnerable):
<tr><td>Campaña:</td><td>${lead.campaign_name}</td></tr>
<tr><td>Adset:</td><td>${lead.adset_name}</td></tr>
<tr><td>UTM Source:</td><td>${lead.utm_source}</td></tr>

// DESPUÉS (seguro):
<tr><td>Campaña:</td><td>${escapeHtml(lead.campaign_name || '')}</td></tr>
<tr><td>Adset:</td><td>${escapeHtml(lead.adset_name || '')}</td></tr>
<tr><td>UTM Source:</td><td>${escapeHtml(lead.utm_source || '')}</td></tr>
```

Aplicar el mismo patrón a TODAS las interpolaciones en el email body de `sendNewLeadAlert`:
- `${lead.nombre}` → `${escapeHtml(lead.nombre)}`
- `${lead.email}` → `${escapeHtml(lead.email)}`
- `${lead.telefono}` → `${escapeHtml(lead.telefono)}`
- `${lead.origen}` → `${escapeHtml(lead.origen)}`
- `${lead.campaign_name}` → `${escapeHtml(lead.campaign_name || '')}`
- `${lead.adset_name}` → `${escapeHtml(lead.adset_name || '')}`
- `${lead.ad_name}` → `${escapeHtml(lead.ad_name || '')}`
- `${lead.utm_source}` → `${escapeHtml(lead.utm_source || '')}`
- `${lead.utm_medium}` → `${escapeHtml(lead.utm_medium || '')}`
- `${lead.utm_campaign}` → `${escapeHtml(lead.utm_campaign || '')}`
- `${lead.form_name}` → `${escapeHtml(lead.form_name || '')}`
- `${lead.producto_interes}` → `${escapeHtml(lead.producto_interes || '')}`

**Nota:** La función `escapeHtml()` ya está definida en este archivo (~línea 40).

**Verificación:** NO debe haber ninguna interpolación `${lead.xxx}` sin `escapeHtml()` en el HTML del email.

---

## TAREA 2.6: Fix XSS en wrapEmailTemplate — agencyUrl validation [CRÍTICO #5 relacionado]

**Archivo:** `src/lib/emailTemplate.js`

**Paso 1 — Buscar donde se sanitiza `logoUrl`** (ya existe lógica de sanitización del logo):
```javascript
    // Sanitize Logo URL
    let safeLogoUrl = '';
    if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 4) {
```

**Paso 2 — Agregar sanitización de agencyUrl.** Justo DESPUÉS del bloque de safeLogoUrl, agregar:
```javascript
    // Sanitize Agency URL — prevent javascript: URLs
    let safeAgencyUrl = '';
    if (agencyUrl && typeof agencyUrl === 'string') {
        const trimmed = agencyUrl.trim();
        // Only allow http/https protocols
        if (trimmed.match(/^https?:\/\//i)) {
            safeAgencyUrl = trimmed;
        } else if (trimmed && !trimmed.match(/^(javascript|data|vbscript):/i)) {
            safeAgencyUrl = 'https://' + trimmed.replace(/^\/+/, '');
        }
    }
```

**Paso 3 — Reemplazar uso de agencyUrl.** Buscar donde se usa `agencyUrl` en el template:
```javascript
${agencyUrl ? `<a href="${agencyUrl}" ...>` : ''}
```

**Reemplazar por:**
```javascript
${safeAgencyUrl ? `<a href="${escapeHtml(safeAgencyUrl)}" ...>` : ''}
```

**Nota:** La función `sanitizeQuillHtml`/`cleanHtmlForEmail` ya se aplica al body. `agencyName` y `agencyUrl` son parámetros que vienen de la tabla `configuracion` (controlados por el admin), pero deben sanitizarse igualmente como defensa en profundidad.

**Verificación:** agencyUrl nunca puede ser `javascript:` o `data:`.

---

# FASE 3: Spoofing + Tokens en URLs

## TAREA 3.1: Validar dirección "From" en resend-email [CRÍTICO #8]

**Archivo:** `supabase/functions/resend-email/index.ts`

**Paso 1 — Leer la configuración de email de la agencia.** Buscar donde ya se lee la configuración (ya existe un bloque que lee de `configuracion`). Identificar donde se obtiene `email_remitente`.

**Paso 2 — Agregar validación del `from`.** Buscar donde se valida:
```typescript
if (!from || !to || !subject || !html) {
```

**Agregar DESPUÉS de esa validación:**
```typescript
        // ── Validar que "from" coincida con la configuración de la agencia ──
        const { data: configData } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia_id)
            .in('clave', ['email_remitente'])

        const configMap = Object.fromEntries(configData?.map(c => [c.clave, c.valor]) || [])
        const configuredEmail = (configMap['email_remitente'] || '').toLowerCase().trim()

        if (configuredEmail) {
            // Extraer email del campo "from" (puede ser "Nombre <email@dominio.com>")
            const fromMatch = from.match(/<([^>]+)>/) || from.match(/^(\S+@\S+)/)
            const fromEmail = (fromMatch?.[1] || from).toLowerCase().trim()

            if (fromEmail !== configuredEmail) {
                return jsonResponse(
                    { error: `Dirección 'from' no permitida. Debe ser: ${configuredEmail}` },
                    403, corsHeaders
                )
            }
        }
```

**Paso 3 — Sanitizar CRLF en campos de header.** Agregar función helper al inicio del archivo:
```typescript
function stripCRLF(str: string): string {
    return str ? str.replace(/[\r\n]/g, ' ') : ''
}
```

**Aplicar a from, to, subject** antes de enviar:
```typescript
const sanitizedFrom = stripCRLF(from)
const sanitizedTo = Array.isArray(to) ? to.map(stripCRLF) : stripCRLF(to)
const sanitizedSubject = stripCRLF(subject)
```

Usar las variables sanitizadas en lugar de las originales.

**Verificación:** No se puede enviar email con un "from" diferente al configurado para la agencia.

---

## TAREA 3.2: Mover tokens de Meta a Authorization headers [CRÍTICO #12]

### 3.2a: meta-webhook/index.ts

**Archivo:** `supabase/functions/meta-webhook/index.ts`

**Buscar** donde se hace la llamada a Meta Graph API con token en URL:
```typescript
const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?fields=...&access_token=${accessToken}`
const graphRes = await fetch(graphUrl)
```

**Reemplazar por:**
```typescript
const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,field_data,created_time,platform,campaign_name,adset_name,ad_name`
const graphRes = await fetch(graphUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
})
```

Hacer lo mismo para la llamada de form name (buscar otra URL con `access_token=`).

### 3.2b: sync-leads/index.ts

**Archivo:** `supabase/functions/sync-leads/index.ts`

**Buscar** TODAS las llamadas a `graph.facebook.com` que tengan `access_token=` en la URL. Para cada una:

```typescript
// ANTES:
`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&access_token=${metaToken}`

// DESPUÉS:
`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name`
// con headers: { 'Authorization': `Bearer ${metaToken}` }
```

Aplicar el mismo patrón a TODAS las llamadas a Meta Graph API en este archivo.

### 3.2c: meta-oauth/index.ts

**Archivo:** `supabase/functions/meta-oauth/index.ts`

**Buscar:**
```typescript
const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
```

**Nota importante:** La API de Meta para exchange de tokens REQUIERE `client_secret` como query parameter — esto no se puede cambiar a header. PERO se puede minimizar el impacto loggeando el URL completo. Agregar:

```typescript
// Nota: Meta API requiere client_secret como query param para token exchange.
// No loguear el exchangeUrl en producción.
const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
```

Para las demás llamadas (me/accounts, me/businesses, etc.), mover el token a header:

```typescript
// ANTES:
`https://graph.facebook.com/v19.0/me/accounts?fields=...&access_token=${userToken}`

// DESPUÉS:
`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category&limit=50`
// con headers: { 'Authorization': `Bearer ${userToken}` }
```

**Verificación:** Buscar `access_token=` en todos los archivos de Edge Functions — solo debe quedar en el token exchange de meta-oauth (inevitable por la API de Meta).

---

# FASE 4: Base de Datos + RLS + Atomicidad

## TAREA 4.1: Fix SECURITY DEFINER RPCs — Resolver agencia real del usuario [CRÍTICO #9]

**Archivo:** `supabase/migrations/20260411120000_fix_rpcs_estado_rebranding.sql`

**IMPORTANTE:** Crear una NUEVA migración en lugar de modificar la existente:

**Crear archivo:** `supabase/migrations/20260413030000_fix_rpc_tenant_isolation.sql`

**Contenido completo:**
```sql
-- ==============================================================================
-- FIX: SECURITY DEFINER RPCs — Tenant Isolation
-- Problem: RPCs trust caller-supplied p_agencia_id, allowing cross-tenant access
-- Solution: Resolve caller's real agency from auth.uid() inside the function
-- ==============================================================================

-- Fix get_leads_kpis
CREATE OR REPLACE FUNCTION get_leads_kpis(p_agencia_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    v_real_agencia_id UUID;
BEGIN
    -- Resolve caller's REAL agency from auth.uid()
    SELECT ua.agencia_id INTO v_real_agencia_id
    FROM usuarios_agencia ua
    WHERE ua.usuario_id = auth.uid()
    LIMIT 1;

    -- Fallback to p_agencia_id only if caller is service_role (no auth.uid())
    IF v_real_agencia_id IS NULL THEN
        v_real_agencia_id := p_agencia_id;
    END IF;

    SELECT json_build_object(
        'total',        COUNT(*),
        'nuevo',        COUNT(*) FILTER (WHERE estado = 'nuevo'),
        'contactado',   COUNT(*) FILTER (WHERE estado = 'contactado'),
        'cotizado',     COUNT(*) FILTER (WHERE estado = 'cotizado'),
        'cliente',      COUNT(*) FILTER (WHERE estado = 'cliente'),
        'frios',        COUNT(*) FILTER (
                            WHERE ultimo_contacto IS NOT NULL
                            AND ultimo_contacto < NOW() - INTERVAL '7 days'
                            AND estado NOT IN ('cliente', 'dado_de_baja')
                        ),
        'dado_de_baja', COUNT(*) FILTER (WHERE unsubscribed = TRUE)
    )
    INTO result
    FROM leads
    WHERE agencia_id = v_real_agencia_id;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leads_kpis TO authenticated, service_role;


-- Fix get_leads_page
CREATE OR REPLACE FUNCTION get_leads_page(
    p_agencia_id UUID,
    p_page       INT DEFAULT 1,
    p_per_page   INT DEFAULT 50,
    p_search     TEXT DEFAULT NULL,
    p_estado     TEXT DEFAULT NULL,
    p_form_name  TEXT DEFAULT NULL,
    p_date_from  DATE DEFAULT NULL,
    p_date_to    DATE DEFAULT NULL,
    p_kanban     BOOLEAN DEFAULT FALSE,
    p_kanban_limit INT DEFAULT 1000
)
RETURNS TABLE(
    id               UUID,
    nombre           TEXT,
    email           TEXT,
    telefono        TEXT,
    estado          TEXT,
    origen          TEXT,
    producto_interes TEXT,
    form_name       TEXT,
    personas        TEXT,
    temporada       TEXT,
    notas           TEXT,
    idioma          TEXT,
    agencia_id      UUID,
    ultimo_contacto TIMESTAMPTZ,
    unsubscribed    BOOLEAN,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    total_count     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset        INT;
    v_limit         INT;
    v_real_agencia_id UUID;
BEGIN
    -- Resolve caller's REAL agency from auth.uid()
    SELECT ua.agencia_id INTO v_real_agencia_id
    FROM usuarios_agencia ua
    WHERE ua.usuario_id = auth.uid()
    LIMIT 1;

    -- Fallback to p_agencia_id only if caller is service_role
    IF v_real_agencia_id IS NULL THEN
        v_real_agencia_id := p_agencia_id;
    END IF;

    IF p_kanban THEN
        v_offset := 0;
        v_limit  := p_kanban_limit;
    ELSE
        v_offset := (p_page - 1) * p_per_page;
        v_limit  := p_per_page;
    END IF;

    RETURN QUERY
    WITH filtered AS (
        SELECT l.*
        FROM leads l
        WHERE l.agencia_id = v_real_agencia_id   -- ← Usar v_real_agencia_id, NO p_agencia_id
          AND (p_date_from IS NULL OR l.created_at::DATE >= p_date_from)
          AND (p_date_to   IS NULL OR l.created_at::DATE <= p_date_to)
          AND (
              p_search IS NULL OR p_search = '' OR
              l.nombre::TEXT      ILIKE '%' || p_search || '%' OR
              l.email::TEXT       ILIKE '%' || p_search || '%' OR
              l.telefono::TEXT    ILIKE '%' || p_search || '%' OR
              l.producto_interes::TEXT ILIKE '%' || p_search || '%'
          )
          AND (
              p_estado IS NULL OR p_estado = '' OR
              CASE p_estado
                  WHEN 'frios' THEN (
                      l.ultimo_contacto IS NOT NULL AND
                      l.ultimo_contacto < NOW() - INTERVAL '7 days' AND
                      l.estado NOT IN ('cliente', 'dado_de_baja')
                  )
                  WHEN 'dado_de_baja' THEN l.unsubscribed = TRUE
                  ELSE l.estado = p_estado
              END
          )
          AND (
              p_form_name IS NULL OR p_form_name = '' OR
              SPLIT_PART(COALESCE(l.form_name, l.producto_interes, ''), ' - ', 1) = p_form_name OR
              l.producto_interes = p_form_name OR
              l.form_name   = p_form_name
          )
        ORDER BY l.created_at DESC
    ),
    total AS (
        SELECT COUNT(*) AS cnt FROM filtered
    )
    SELECT
        f.id, f.nombre, f.email, f.telefono, f.estado, f.origen,
        f.producto_interes, f.form_name, f.personas, f.temporada, f.notas,
        f.idioma, f.agencia_id, f.ultimo_contacto, f.unsubscribed,
        f.created_at, f.updated_at,
        t.cnt AS total_count
    FROM filtered f, total t
    LIMIT  v_limit
    OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leads_page TO authenticated, service_role;
```

**Verificación:** Ambas funciones ahora resuelven `v_real_agencia_id` desde `usuarios_agencia WHERE usuario_id = auth.uid()` y usan ESE valor para filtrar, NO el `p_agencia_id` del llamador.

---

## TAREA 4.2: Fix RLS policies de email_queue [CRÍTICO #11]

**Archivo:** `supabase/migrations/20260413010000_email_queue_arch.sql`

**IMPORTANTE:** Crear una NUEVA migración:

**Crear archivo:** `supabase/migrations/20260413040000_fix_email_queue_rls.sql`

**Contenido completo:**
```sql
-- ==============================================================================
-- FIX: email_queue RLS policies — agencia_id != auth.uid()
-- Problem: policies compare agencia_id (agency UUID) with auth.uid() (user UUID)
-- Solution: Resolve agency from usuarios_agencia
-- ==============================================================================

-- Drop old broken policies
DROP POLICY IF EXISTS "Agencias pueden ver su propia cola" ON public.email_queue;
DROP POLICY IF EXISTS "Agencias pueden agregar a su cola" ON public.email_queue;
DROP POLICY IF EXISTS "Agencias pueden limpiar su cola" ON public.email_queue;

-- Create fixed policies using subquery to resolve user's agency
CREATE POLICY "email_queue_select_own_agency"
    ON public.email_queue FOR SELECT
    USING (
        agencia_id IN (
            SELECT agencia_id FROM usuarios_agencia
            WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "email_queue_insert_own_agency"
    ON public.email_queue FOR INSERT
    WITH CHECK (
        agencia_id IN (
            SELECT agencia_id FROM usuarios_agencia
            WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "email_queue_delete_own_agency"
    ON public.email_queue FOR DELETE
    USING (
        agencia_id IN (
            SELECT agencia_id FROM usuarios_agencia
            WHERE usuario_id = auth.uid()
        )
    );

-- Add UPDATE policy (was missing)
CREATE POLICY "email_queue_update_own_agency"
    ON public.email_queue FOR UPDATE
    USING (
        agencia_id IN (
            SELECT agencia_id FROM usuarios_agencia
            WHERE usuario_id = auth.uid()
        )
    );
```

**Verificación:** Las políticas ahora usan un subquery que resuelve la agencia del usuario a través de `usuarios_agencia`.

---

## TAREA 4.3: Queue processing atómico — evitar emails duplicados [CRÍTICO #14]

**Archivo:** `supabase/functions/process-queue/index.ts`

**Paso 1 — Agregar retry mechanism.** Buscar (línea ~33-50):
```typescript
        // 1. Fetch TOP 50 pending emails across all agencies to process in this 60s execution window
        const { data: queueItems, error: fetchErr } = await supabaseClient
            .from('email_queue')
            .select('*')
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true })
            .limit(50)

        if (fetchErr) throw fetchErr
        if (!queueItems || queueItems.length === 0) {
            console.log('[QueueWorker] No pending emails.')
            return new Response(JSON.stringify({ status: 'idle', message: 'No pending emails' }), { status: 200 })
        }

        console.log(`[QueueWorker] Found ${queueItems.length} emails to process.`)

        // Mark them as "procesando" to prevent other concurrent workers from grabbing them
        const queueIds = queueItems.map(q => q.id)
        await supabaseClient.from('email_queue').update({ estado: 'procesando' }).in('id', queueIds)
```

**Reemplazar por:**
```typescript
        // 1. Atomic claim: UPDATE pending items to "procesando" and RETURN them
        // This prevents race conditions where two workers grab the same items
        const { data: queueItems, error: fetchErr } = await supabaseClient
            .from('email_queue')
            .update({ estado: 'procesando' })
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true })
            .limit(50)
            .select()

        if (fetchErr) throw fetchErr
        if (!queueItems || queueItems.length === 0) {
            console.log('[QueueWorker] No pending emails.')
            return new Response(JSON.stringify({ status: 'idle', message: 'No pending emails' }), { status: 200 })
        }

        console.log(`[QueueWorker] Claimed ${queueItems.length} emails to process.`)
```

**Explicación del cambio:** En lugar de hacer SELECT primero y luego UPDATE separado (que crea una race condition), se hace un solo UPDATE que cambia el estado Y devuelve las filas actualizadas. Si dos workers intentan al mismo tiempo, Supabase procesa uno primero y el segundo no obtiene las mismas filas.

**Nota:** Si Supabase JS no soporta `.update().select()` en el cliente, crear un RPC:

**Crear migración:** `supabase/migrations/20260413050000_atomic_queue_claim.sql`
```sql
CREATE OR REPLACE FUNCTION claim_queue_items(p_limit INT DEFAULT 50)
RETURNS SETOF email_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE email_queue
    SET estado = 'procesando', updated_at = NOW()
    WHERE id IN (
        SELECT id FROM email_queue
        WHERE estado = 'pendiente'
        ORDER BY created_at ASC
        LIMIT p_limit
    )
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_queue_items(INT) TO service_role;
```

Y en el Edge Function:
```typescript
const { data: queueItems, error: fetchErr } = await supabaseClient
    .rpc('claim_queue_items', { p_limit: 50 })
```

**Verificación:** Dos workers ejecutando simultáneamente NO pueden obtener los mismos items.

---

## TAREA 4.4: Crear nueva migración SQL que agrupe fixes de grants

**Crear archivo:** `supabase/migrations/20260413060000_security_hardening_grants.sql`

**Contenido:**
```sql
-- ==============================================================================
-- Security Hardening — Consolidate grants after fixes
-- ==============================================================================

-- 1. Revoke anon from check_cron_job_exists (WARNING #15 del audit)
REVOKE EXECUTE ON FUNCTION check_cron_job_exists(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO authenticated, service_role;

-- 2. Ensure get_filtered_lead_ids also uses tenant isolation
-- (get_filtered_lead_ids should already use the same pattern as get_leads_page)
-- If it doesn't, apply the same v_real_agencia_id pattern from migration 20260413030000
```

---

# VERIFICACIÓN FINAL

Después de completar TODAS las tareas, ejecutar estas verificaciones:

## 1. Buscar `fallback-secret` en todo el código
```bash
grep -r "fallback-secret" supabase/
```
**Resultado esperado:** 0 coincidencias.

## 2. Buscar tokens de Meta en query strings
```bash
grep -r "access_token=" supabase/functions/
```
**Resultado esperado:** Solo 1 coincidencia en `meta-oauth/index.ts` (token exchange — inevitable).

## 3. Verificar que anon no tiene acceso a mass_enroll_sequence
```bash
grep "mass_enroll_sequence" supabase/migrations/
```
**Resultado esperado:** NO debe aparecer `TO anon`.

## 4. Verificar DOMPurify instalado
```bash
npm list dompurify
```
**Resultado esperado:** dompurify aparece en dependencias.

## 5. Verificar que no hay interpolación sin escapeHtml en emails
```bash
grep -n 'lead\.\(nombre\|producto_interes\|form_name\|campaign_name\|adset_name\|utm_source\)' supabase/functions/meta-webhook/index.ts
```
**Resultado esperado:** TODAS las ocurrencias envueltas en `escapeHtml()`.

## 6. Build del frontend
```bash
npm run build
```
**Resultado esperado:** Exit code 0.

## 7. Lint
```bash
npm run lint
```
**Resultado esperado:** 0 errores.

---

# DEPLOY

Después de verificar todo:

## Edge Functions (en orden):
```bash
npx supabase functions deploy handle-bounce --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy unsubscribe --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy process-drips --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy send-meta-event --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy meta-oauth --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy resend-email --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy meta-webhook --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy sync-leads --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy process-queue --project-ref dtloiqfkeasfcxiwlvzp
```

## SQL Migrations (en orden):
```bash
npx supabase db push --project-ref dtloiqfkeasfcxiwlvzp
```

## Frontend:
```bash
git add . && git commit -m "fix: critical security hardening (15 critical fixes)"
git push origin main
```
(Vercel auto-deploy)

## Variables de entorno a configurar en Supabase Dashboard:
| Variable | Valor requerido |
|----------|----------------|
| `CAPI_WEBHOOK_SECRET` | Generar con `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya configurada (verificar) |
| `RESEND_WEBHOOK_SECRET` | Ya configurada (verificar) |
| `META_APP_SECRET` | Ya configurada (verificar) |
| `ALLOWED_ORIGIN` | `https://leads.sellvende.com` |

---

**FIN DEL DOCUMENTO DE IMPLEMENTACIÓN**
