# 🔍 Auditoría SaaS — ¿Está Sellvende Listo para Vender como Suscripción?

> **Objetivo:** Determinar qué tan preparada está la arquitectura actual para que un usuario NUEVO pueda registrarse, pagar, conectar SUS PROPIAS cuentas (Resend, Gmail, Meta, WhatsApp) y empezar a trabajar de forma totalmente aislada.

---

## ✅ LO QUE YA ESTÁ LISTO (Sorprendentemente Bien)

Después de auditar el código, la buena noticia es que **la arquitectura multi-tenant ya está bastante avanzada**. Aquí el detalle:

### 1. Aislamiento por `agencia_id` — ✅ FUNCIONAL
- Cada tabla importante (`leads`, `configuracion`, `secuencias_marketing`, `email_log`, etc.) ya tiene columna `agencia_id`
- Las políticas RLS de Supabase ya filtran por agencia
- Un usuario de la agencia A **no puede ver datos** de la agencia B

### 2. Credenciales de Email por Tenant — ✅ FUNCIONAL
Esto es **clave** y ya lo tienes resuelto:

```
Tabla: configuracion (por agencia_id)
┌──────────────────────┬───────────────────────────────────┐
│ clave                │ Qué guarda                        │
├──────────────────────┼───────────────────────────────────┤
│ proveedor_email      │ "gmail" o "resend"                │
│ gmail_app_password   │ Contraseña de App de Google       │
│ gmail_user           │ usuario@gmail.com                 │
│ resend_api_key       │ re_XXXXX (API key del cliente)    │
│ email_remitente      │ El "from" del email               │
│ nombre_remitente     │ Nombre visible del remitente      │
└──────────────────────┴───────────────────────────────────┘
```

**Hallazgo positivo:** En `resend-email/index.ts` (líneas 116-158), el sistema ya:
1. Lee las credenciales **de la tabla `configuracion`** buscando por `agencia_id`
2. Auto-detecta si usar Gmail o Resend según las claves disponibles
3. **Las API Keys NUNCA están hardcodeadas** — cada agencia usa las suyas propias

**En `process-drips/index.ts` (líneas 299-338)**, el motor de drips también:
1. Agrupa leads por agencia
2. Lee credenciales por agencia
3. Crea un pool de conexión SMTP separado por cada agencia
4. Si una agencia falla (ej: contraseña inválida), no afecta a las demás

> [!TIP]
> **Esto significa que si mañana 10 agencias se registran, cada una con su propia cuenta de Gmail o Resend, el sistema YA FUNCIONA de forma aislada.** No hay que rehacer la lógica de envío.

### 3. Meta Ads por Tenant — ✅ FUNCIONAL
En `meta-webhook/index.ts` (líneas 140-178):
- El webhook identifica la agencia por `meta_page_id` en la tabla `configuracion`
- Cada agencia configura su propio Page ID y Page Access Token
- El sistema ya soporta múltiples agencias recibiendo webhooks por el mismo endpoint

### 4. UI de Configuración Self-Service — ✅ FUNCIONAL
En `AgenciaTab.jsx`:
- El usuario puede elegir Gmail o Resend visualmente
- Puede pegar su propia API key de Resend
- Puede pegar su App Password de Google
- Puede conectar su propia cuenta de Meta vía OAuth
- Todo se guarda en `configuracion` con `agencia_id`

---

## ❌ LO QUE FALTA PARA SER SaaS DE VERDAD

### 🔴 GAP #1 — No hay sistema de Planes/Suscripciones
**Problema:** Cualquiera que tenga acceso puede usar todo sin límites. No hay:
- Tabla de `planes` (Starter, Pro, Agency)
- Tabla de `suscripciones` con estado (activa, cancelada, trial)
- Límites por plan (ej: 500 leads/mes en Starter)
- Integración con Stripe/MercadoPago para cobrar

**Solución necesaria:**
```sql
-- Tabla de planes
CREATE TABLE planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,           -- "Starter", "Pro", "Agency"
  precio_mensual NUMERIC(10,2),   -- 29.00, 59.00, 99.00
  max_leads_mes INTEGER,          -- 500, 2000, NULL (ilimitado)
  max_usuarios INTEGER,           -- 1, 3, 10
  features JSONB                  -- {"capi": false, "ai_scoring": false, "whatsapp": false}
);

-- Suscripción de cada agencia
CREATE TABLE suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id UUID REFERENCES agencias(id),
  plan_id UUID REFERENCES planes(id),
  estado TEXT DEFAULT 'trial',   -- trial, activa, cancelada, vencida
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 🔴 GAP #2 — No hay Registro Público (Sign-Up)
**Problema:** Actualmente, crear una nueva agencia requiere inserción manual en la BD. Un SaaS necesita:
- Página de registro público (`/register`)
- Crear automáticamente: usuario auth + agencia + usuario_agencia + suscripción trial
- Flujo de onboarding que guíe al usuario a conectar sus cuentas

### 🔴 GAP #3 — No hay Gate/Middleware de Plan
**Problema:** Aun si tuvieras planes, nada impide que una agencia en plan Starter use features de plan Agency.

**Solución:** Un middleware/hook que verifique el plan antes de cada acción protegida:
```javascript
// useplan.js (ejemplo)
function usePlan() {
  // Devuelve { plan, canUse('capi'), canUse('ai_scoring'), leadsRestantes }
}
```

### 🔴 GAP #4 — No hay Landing Page / Sitio de Venta
**Problema:** No hay forma de que un cliente potencial descubra el producto, vea precios y se registre.

### 🟡 GAP #5 — Seguridad de Credenciales (Parcial)
**Lo que ya funciona:** Las credenciales se leen server-side en Edge Functions (nunca llegan al browser de otros usuarios).

**Lo que preocupa:**
- Las API keys (Resend, Gmail password) se guardan en **texto plano** en la tabla `configuracion`
- Cualquier administrador de Supabase puede verlas
- Idealmente: cifrar con una key de encriptación por tenant o usar Supabase Vault

> [!IMPORTANT]
> **Para un MVP/lanzamiento inicial, guardar en texto plano en `configuracion` es aceptable** (es lo que hacen GoHighLevel y la mayoría de CRMs SaaS). Las RLS ya impiden que un usuario vea credenciales de otra agencia. El cifrado se puede agregar en V2.

---

## 📊 Matriz de Viabilidad SaaS

| Componente | Estado | ¿Bloquea Venta? |
|:---|:---|:---|
| Multi-tenancy (agencia_id) | ✅ Listo | No |
| Credenciales Gmail por cliente | ✅ Listo | No |
| Credenciales Resend por cliente | ✅ Listo | No |
| Meta Ads OAuth por cliente | ✅ Listo | No |
| Motor de drips multi-tenant | ✅ Listo | No |
| RLS / Aislamiento de datos | ✅ Listo | No |
| UI de configuración self-service | ✅ Listo | No |
| **Registro público (sign-up)** | ❌ No existe | **SÍ** |
| **Planes y suscripciones** | ❌ No existe | **SÍ** |
| **Gate de features por plan** | ❌ No existe | **SÍ** |
| **Cobro (Stripe/MP)** | ❌ No existe | **SÍ** |
| **Landing page de venta** | ❌ No existe | **SÍ** |
| Cifrado de credenciales | 🟡 Texto plano | No (V2) |
| WhatsApp API por cliente | 🟡 Stub | No (Fase 3) |

---

## 🎯 Estrategia de Servicios Conectables por Cliente

Así es como cada usuario conecta **sus propias cuentas** al registrarse:

### Flujo de Onboarding Propuesto

```
PASO 1: Registro → Crear cuenta + agencia + trial de 14 días
         ↓
PASO 2: Wizard de Setup (5 minutos)
         ├── Nombre de tu empresa / Logo / Colores
         ├── ¿Cómo quieres enviar emails?
         │    ├── [Gmail] → Pegar App Password de Google
         │    └── [Resend] → Pegar API Key de resend.com
         └── ¿Conectar Meta Ads? → [Conectar con Facebook] (OAuth)
         ↓
PASO 3: Dashboard con checklist visual de lo que falta configurar
         ↓
PASO 4: Primer lead entra → Secuencia se dispara → ¡MAGIA! ✨
```

### Qué aporta cada servicio y por qué el CLIENTE lo conecta (no tú)

| Servicio | Qué Hace | Por Qué el Cliente lo Pone | Viabilidad |
|:---|:---|:---|:---|
| **Gmail SMTP** | Envía emails desde su cuenta | Es GRATIS, usa su propia reputación de dominio | ✅ Listo hoy |
| **Resend API** | Envía emails con dominio propio | Mejor deliverability, branding profesional | ✅ Listo hoy |
| **Meta Ads OAuth** | Captura leads de sus campañas | Solo funciona con SU token de página | ✅ Listo hoy |
| **WhatsApp Cloud API** | Envía mensajes automatizados | Requiere SU número de WhatsApp Business | 🟡 Fase 3 |
| **Stripe** | Paga la suscripción | Cobro estándar con tarjeta | ❌ Por construir |

> [!IMPORTANT]
> ### La ventaja competitiva de este modelo:
> **Sellvende NO cobra por email enviado ni por SMS.** El cliente usa SUS PROPIAS cuentas gratuitas (Gmail = gratis, Resend = gratis hasta 3K emails/mes). Esto hace que el precio de Sellvende sea *puramente por el software*, no por consumo. Esto es **extremadamente atractivo** vs. GoHighLevel que cobra por cada SMS y email adicional.

---

## 🏗️ Plan de Acción para Fase 0: SaaS Readiness

### Prioridad 1 — Registro Público + Creación de Agencia Automática
1. Crear página `/register` con formulario (nombre, email, password, nombre empresa)
2. Al registrarse: crear `auth.user` → crear `agencias` → crear `usuarios_agencia` → crear `suscripciones` con plan Trial
3. Redirigir a wizard de onboarding

### Prioridad 2 — Tablas de Planes y Suscripciones
1. Migración SQL para `planes` y `suscripciones`
2. Seed de planes: Starter ($29), Pro ($59), Agency ($99)
3. Hook `usePlan()` que exponga el plan actual y sus límites

### Prioridad 3 — Gate de Features
1. Componente `<PlanGate feature="capi">` que muestre "upgrade" si no tiene acceso
2. Verificación server-side en Edge Functions para features premium

### Prioridad 4 — Integración de Cobro
1. Stripe Checkout para crear suscripciones
2. Webhook de Stripe para actualizar estado de suscripción en BD
3. Página de billing con historial de facturas

### Prioridad 5 — Landing Page
1. Página pública en `/` con propuesta de valor
2. Comparativa de precios
3. CTA de registro

---

## 💡 Recomendación Final

> **Puedes empezar a vender HOY con un MVP mínimo:**
> 1. Registro público + trial de 14 días
> 2. Cobro manual (link de Stripe Payment Link, sin integración compleja)
> 3. Un solo plan a $49/mes
> 4. Las features que ya tienes (webhook Meta + drips + email + Kanban)
> 
> **E ir construyendo las Fases 1-3 mientras ya tienes usuarios pagando.**
> 
> El 80% de la infraestructura multi-tenant ya está construida. Lo que falta es el "envoltorio comercial" (registro, planes, cobro).
