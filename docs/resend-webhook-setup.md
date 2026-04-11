# 🔗 Guía: Configurar Webhook de Resend para Anti-Bounce

> **Solo necesitas hacer esto UNA VEZ.** Una vez configurado, todos los rebotes y quejas de spam
> se detectarán automáticamente y protegerán la reputación del dominio de correo.

---

## ¿Qué hace esto?

Cuando un email enviado por Resend rebota (dirección inválida) o el destinatario lo marca como
spam, Resend envía una notificación automática (webhook) a nuestra función `handle-bounce`.
Esta función:

1. Marca al lead como `email_rebotado = true`
2. Cancela **todas sus secuencias activas** automáticamente
3. Registra el evento en `email_log`
4. Aparece un badge **❌ Rebotado** en la interfaz de leads

---

## Paso 1: Obtener la URL del Webhook

La URL de tu webhook es:

```
https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/handle-bounce
```

---

## Paso 2: Configurar en Resend Dashboard

1. Ve a **[resend.com](https://resend.com)** e inicia sesión
2. En el menú lateral, haz clic en **Webhooks**
3. Haz clic en **Add Endpoint** (botón azul arriba a la derecha)
4. Llena los campos:
   - **Endpoint URL:** `https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/handle-bounce`
   - **Events to listen:** Selecciona **solamente** estos dos:
     - ✅ `email.bounced`
     - ✅ `email.complained`
5. Haz clic en **Create**

---

## Paso 3: Copiar el Signing Secret

Después de crear el endpoint:

1. Haz clic en el endpoint recién creado
2. Busca la sección **Signing Secret**
3. Haz clic en **Reveal** para ver el secreto
4. Copia el valor — tendrá formato: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Paso 4: Agregar el Secret en Supabase

1. Ve a **[supabase.com/dashboard](https://supabase.com/dashboard)**
2. Selecciona el proyecto **Sellvende Leads** (`dtloiqfkeasfcxiwlvzp`)
3. En el menú lateral ve a **Edge Functions**
4. Haz clic en **Secrets** (o **Manage secrets**)
5. Agrega el secreto:
   - **Name:** `RESEND_WEBHOOK_SECRET`
   - **Value:** `whsec_xxxxxxxxxxxxxxxxxxxxxxxxx` ← el valor copiado en el paso anterior
6. Haz clic en **Save**

---

## Paso 5: Verificar que funciona

Puedes probar el webhook desde Resend:

1. En el endpoint que creaste, ve a la pestaña **Testing**
2. Selecciona el evento `email.bounced`
3. Haz clic en **Send test**
4. Luego verifica en Supabase → **Edge Functions → Logs → handle-bounce** que apareció el log:
   ```
   [Bounce] Received event: email.bounced
   [Bounce] No lead found for email: test@example.com
   ```
   (Es normal que no encuentre un lead en el test, lo importante es que la función recibió el evento)

---

## Comportamiento sin este webhook (Gmail)

Si usas **Gmail** como proveedor de email (en lugar de Resend), los rebotes no llegan por webhook.
En ese caso, el agente debe marcar manualmente los rebotes:

1. Abre el panel de detalle del lead (`LeadDetailPanel`)
2. En el footer, haz clic en **⚠️ Marcar email como rebotado (Gmail / Manual)**
3. El lead queda excluido de todos los envíos futuros automáticamente

---

## Estado actual del sistema

| Componente | Estado |
|------------|--------|
| Columnas `email_rebotado` en DB | ✅ Listas |
| Edge Function `handle-bounce` | ✅ Desplegada (v1) |
| Guard en `process-drips` | ✅ Activo (v3) |
| Badge ❌ en `LeadsTableView` | ✅ Activo |
| Badge ❌ en `LeadsKanbanView` | ✅ Activo |
| Alertas en `LeadDetailPanel` | ✅ Activos |
| Webhook en Resend Dashboard | ⚠️ PENDIENTE — seguir esta guía |
| Secret `RESEND_WEBHOOK_SECRET` en Supabase | ⚠️ PENDIENTE — seguir esta guía |
