# 🎯 Sellvende — Análisis Estratégico de Producto

> **Perspectiva:** Media Buyer / Dueño de agencia que invierte $5K–$50K+ USD/mes en Meta Ads
> **Fecha:** Abril 2026

---

## 1. Diagnóstico del Estado Actual de Sellvende

Antes de proponer, hay que ser honesto sobre dónde estás parado:

| Lo que YA tienes (fortalezas reales) | Lo que FALTA (gaps críticos) |
|:---|:---|
| ✅ Webhook de Meta en tiempo real (`meta-webhook`) | ❌ No hay Meta Conversions API (CAPI) de vuelta |
| ✅ Motor de secuencias de email automático (`process-drips`) | ❌ No hay lead scoring ni cualificación |
| ✅ Envío de email vía Resend (`resend-email`) | ❌ No hay SMS nativo |
| ✅ Sincronización de leads (`sync-leads`) | ❌ WhatsApp API no está integrado (solo links) |
| ✅ UI con Kanban, tabla, KPIs, dashboard financiero | ❌ No hay atribución de ROI por campaña/adset |
| ✅ Multi-tenant con `agencia_id` y RLS | ❌ No hay sub-cuentas para clientes de agencia |
| ✅ Calculadora Meta en Finanzas | ❌ No hay analítica de velocidad de respuesta |

**Veredicto brutal:** Tienes un CRM funcional con automatización de email. Pero hoy compites contra GoHighLevel ($97-$497/mes) y la alternativa gratuita de Zapier + Mailchimp + Google Sheets. Para que un anunciante pague, necesitas resolver problemas que esas alternativas NO resuelven bien.

---

## 2. Análisis de Pain Points del Anunciante en Meta Ads

Basado en investigación actualizada del mercado 2026:

### 🔴 DOLOR #1 — "Leads basura y bots" (El Gap de Intención)

El algoritmo de Meta optimiza por **volumen**, no por calidad. Los anunciantes reciben:
- Leads de "dedo gordo" (accidentales en móvil)
- Tráfico de bots que llenan formularios
- Personas que "solo estaban mirando"

**Lo que necesitan:** Un sistema que filtre automáticamente la basura y les muestre solo leads con potencial real de compra.

### 🔴 DOLOR #2 — "Mi lead se enfrió en 30 minutos" (La Regla de los 5 Minutos)

Los datos son contundentes: un lead contactado en los primeros **5 minutos** tiene **21x más probabilidad** de convertir que uno contactado después de 30 minutos. La realidad:
- El 78% de los anunciantes tardan más de 1 hora en responder leads de Meta
- Muchos aún descargan CSVs manualmente
- Los que usan Zapier pierden leads cuando falla la conexión

**Lo que necesitan:** Contacto automatizado INSTANTÁNEO (email + WhatsApp + notificación al vendedor) en menos de 60 segundos.

### 🔴 DOLOR #3 — "No sé cuáles de mis campañas generan ventas reales" (Atribución rota)

El iOS 14.5+ y la muerte de las cookies destruyeron la atribución nativa de Meta. Los anunciantes ven:
- 50 leads del formulario de Meta
- 3 ventas en su CRM
- CERO conexión entre ambos datos

**Lo que necesitan:** Un loop cerrado que conecte `Lead capturado → Lead cualificado → Venta cerrada` y envíe esa señal de vuelta a Meta para que el algoritmo optimice por **ventas reales**, no por formularios llenados.

### 🔴 DOLOR #4 — "Pago $300/mes en herramientas que no se hablan entre sí" (El Impuesto Zapier)

El stack típico de un media buyer LATAM:
- Meta Business Suite (gratis)
- Zapier ($29-$89/mes) para conectar leads
- Mailchimp ($20-$50/mes) para emails
- WhatsApp Web (manual)
- Google Sheets (manual)
- Tal vez un CRM como Pipedrive ($15-$50/mes/usuario)

**Costo total: $100-$400/mes** y nada funciona de forma integrada.

---

## 3. Funcionalidades "Must-Have" — Lo Obligatorio para Competir

Sin estas, ningún anunciante serio considerará pagar:

### 3.1 ⚡ Speed-to-Lead Dashboard
Un indicador en tiempo real que muestre:
- **Tiempo promedio de primera respuesta** por asesor
- **Alerta roja** cuando un lead lleva más de 5 minutos sin contactar
- **Ranking de velocidad** entre asesores

> **Impacto comercial:** Este dato solo ya vale el precio del software. Ningún anunciante tiene visibilidad sobre cuánto tardan en responder sus propios leads.

### 3.2 📊 Atribución por Campaña / Ad Set / Anuncio
Cada lead que entra debe estar etiquetado con:
- `utm_campaign` → Campaña de Meta
- `utm_medium` → Fuente (facebook, instagram)
- `utm_content` → ID del anuncio específico
- `form_id` → Formulario de Lead Ad usado

Y el dashboard debe mostrar: **"La campaña X generó 50 leads, 12 calificados, 4 ventas = ROAS de 8.2x"**

### 3.3 🏷️ Lead Scoring Básico (Reglas)
Sistema de puntuación configurable:
- +10 puntos si abrió los 3 emails de la secuencia
- +20 si respondió un email
- +30 si hizo clic en WhatsApp
- -15 si el email rebotó
- -50 si se desuscribió

Con etiquetas visuales: 🟢 Caliente / 🟡 Tibio / 🔴 Frío

### 3.4 📱 Notificaciones Push al Vendedor
Cuando entra un lead nuevo:
1. Email automático al asesor asignado (ya existe)
2. **Notificación por WhatsApp al asesor** (nuevo)
3. **Sonido/alerta en el dashboard** si está abierto (nuevo)

### 3.5 📈 Reportes de Pipeline Automatizados
Email semanal automático al dueño de la agencia:
- Leads nuevos esta semana
- Tasa de conversión por etapa del Kanban
- Leads sin actividad en 48+ horas
- ROAS estimado por campaña

---

## 4. Funcionalidades "Killer" — La Innovación Diferenciadora

Estas son las que hacen que un anunciante diga *"no puedo vivir sin esto"*:

### 🏆 KILLER #1 — Meta Conversions API (CAPI) Nativa

**Qué es:** Enviar eventos del CRM de vuelta al servidor de Meta para cerrar el loop de atribución.

**Cómo funciona en Sellvende:**
```
Lead entra por webhook → Sellvende registra "Lead" ✅
Asesor califica el lead → Sellvende envía "QualifiedLead" a Meta ✅
Se cierra la venta → Sellvende envía "Purchase" con valor a Meta ✅
```

**Por qué es KILLER:**
- Meta usa estos eventos para encontrar **más personas como las que SÍ compraron**
- El ROAS del anunciante mejora 20-40% según datos de Meta
- **Nadie en LATAM ofrece esto integrado en un CRM asequible**
- GoHighLevel lo tiene pero cuesta $297-$497/mes

> [!IMPORTANT]
> **Esta sola funcionalidad justifica un precio de $49-$99/mes.** Es el Santo Grial para cualquier media buyer que quiera que su presupuesto de ads trabaje más duro.

**Implementación técnica:**
- Nueva Edge Function `send-meta-event`
- Usa la API de Conversiones de Meta (Server-Side)
- Hashear email, teléfono, nombre (SHA256)
- Pasar `fbp` y `fbc` cookies del navegador (sin hashear)
- Deduplicar con `event_id` único
- Objetivo: EMQ Score ≥ 8.0

---

### 🏆 KILLER #2 — Lead Scoring con IA (Nutrición Comunitaria)

**El Principio:** En el marketing digital **no existen los leads basura**. Todo lead es una persona que, si no compra hoy, puede comprar mañana, o convertirse en un embajador, promotor o fanático de tu marca si es bien cuidado.

**Qué hace:** La IA analiza en tiempo real el comportamiento del lead NO para descartarlo, sino para indicarle al asesor **quién está listo para comprar hoy** y quién necesita más tiempo.

**Señales que analiza:**
| Señal | Peso |
|:---|:---|
| Hace clic para activar el chat de WhatsApp | Muy Alto |
| Velocidad de apertura del primer email | Alto |
| Número de interacciones con emails | Medio |
| Tiempo desde la captura | Medio |

**Output:**
- Score 0-100 con badge visual.
- Etiqueta predictiva: "🔥 Foco de Cierre (Listo para comprar)" / "🌱 Nurturing (Cultivar a largo plazo)".
- **Asignación:** Los asesores invierten su energía física (llamadas, cierres) en los "🔥 Foco de Cierre", mientras que el motor de Marketing de Sellvende mima automáticamente a los "🌱 Nurturing" con emails de valor, invitándolos a la comunidad hasta que estén maduros. Ningún lead se desecha.

---

### 🏆 KILLER #3 — Analítica "Omni-Channel" (La Verdad Absoluta)

**El Problema:** Meta y Google pierden hasta el 40% de la atribución por culpa de los bloqueos de rastreo (iOS 14, AdBlockers). Además, muchas ventas ocurren "fuera del radar" (Transferencias bancarias locales, Efectivo en destino como en Turismo, Zelle, o pasarelas ajenas). Confiar en el panel de Meta para medir el ROAS es vivir en la fantasía.

**La Solución (CRM como Banco de Verdad):** Desconectamos la dependencia de Meta para medir ingresos. Sellvende se convierte en el "Último Tribunal de la Verdad".
1. **El Gasto (Costo):** Lo extraemos por API desde Meta/Google (ej. "Gastaste $2,450").
2. **El Ingreso (Revenue):** Lo registramos de dos formas inmunes a fallos:
   - *Integraciones Nativas:* Webhooks directos con Stripe/PayPal. Pagó en la web = Se marca como pagado en Sellvende.
   - *Declaración Manual (Offline):* El asesor arrastra la tarjeta a "Cerrado/Pagado" e ingresa el monto cobrado (Transferencia, Efectivo).
3. **El Resultado:** Un cálculo de ROAS 100% real de "Plata en el Banco vs Plata Gastada" que bloqueadores de Apple no pueden borrar.

**Dashboard dedicado que muestre:**

```
┌──────────────────────────────────────────────────────┐
│  REPORTE FINANCIERO CRÍTICO: "Promo Verano 2026"     │
│  ──────────────────────────────────────────────────── │
│  Inversión Publicitaria Verificada (Meta API): $2,450│
│  Leads Adquiridos (sin duplicados):            127   │
│  ──────────────────────────────────────────────────── │
│  VENTAS CERRADAS EN EL CRM:                    11    │
│   ├─ Vía Website (Stripe/PayPal):               6    │
│   └─ Vía Offline/Manual (Tranferencias/Cash):   5    │
│  ──────────────────────────────────────────────────── │
│  Ingreso Real y Verificado (La Verdad):     $18,700  │
│  ROAS Neto (Efectivo en Banco):             7.63x 🟢 │
│  ──────────────────────────────────────────────────── │
│  [🔄 Enviar Ventas de vuelta a Meta CAPI]            │
└──────────────────────────────────────────────────────┘
```

**Por qué es KILLER:** Elimina el pánico de los "Anuncios que no reportan". Protege al dueño del negocio mostrándole que, aunque Facebook Manager diga que vendió $0, el CRM demuestra con exactitud que entraron $18,700 USD por distintas vías, garantizando su tranquilidad y justificando la existencia de nuestra plataforma.

---

### 🏆 KILLER #4 — WhatsApp "Inbound Engine" (Aprovechando la Ventana Gratuita)

**El Problema:** Mandar plantillas proactivas por WhatsApp Business API cuesta dinero por cada mensaje iniciado por la empresa. A escala, esto destruye los márgenes operativos.
**La Solución (Sellvende Inbound Strategy):** 
Invertir el proceso. Usar las secuencias de Email (que son extremadamente baratas/gratuitas) para **provocar que el lead haga el primer contacto por WhatsApp**.

**Flujo Operativo Elite:**
1. Lead entra por Meta → Sellvende desencadena el "Drip Engine" (Email).
2. El Asunto y el CTA del Email están hiper-optimizados con psicología de curiosidad: *"Te guardé tu cupo, háblame por WhatsApp aquí para activarlo [Link wa.me/X]"*.
3. **El Lead hace el primer contacto**. Al hacerlo, abre automáticamente la **Ventana de Servicio de 24 horas** de WhatsApp (gratuita/subsidiada por Meta).
4. El CRM lee la entrada entrante y el bot de Sellvende **ahora sí** le auto-responde estructuradamente, pre-califica si está listo, o notifica al humano para intervenir en la venta.
5. Toda la conversación se enruta al panel de Leads, sin haber gastado presupuesto de marketing en tocarle la puerta por API.

### 🏆 KILLER #5 — "Ghost Lead" Detector (Anti-Bot)

**Problema real:** Hasta el 30% de los leads en algunas campañas son bots o clics accidentales.

**Cómo funciona:**
- Analiza patrones: ¿El lead abrió algún email? ¿Interactuó en algún canal?
- ¿El teléfono es válido? ¿El email rebotó?
- ¿Cuánto tiempo tardó en llenar el formulario? (bots: <2 segundos)
- Machine learning detecta leads con comportamiento de bot

**Output:**
- Badge "⚠️ Sospechoso" o "🤖 Probable Bot"
- Filtro para excluir del pipeline y de las métricas
- **Reporte mensual:** "Este mes detectamos 23 ghost leads (18%). Tu CPL real fue $24.50, no $19.29"

---

## 5. Estrategia de Diferenciación vs. el Stack Manual

### ¿Por qué Sellvende y no Zapier + Mailchimp + WhatsApp Web?

| Factor | Stack Manual (Zapier+) | Sellvende |
|:---|:---|:---|
| **Tiempo de setup** | 4-8 horas | 15 minutos |
| **Costo mensual** | $100-$400 (fragmentado) | $29-$79 (todo en uno) |
| **Velocidad de respuesta** | 5-30 seg (si Zapier no falla) | <2 seg (webhook directo) |
| **Loop de atribución CAPI** | Requiere desarrollador | 1 clic |
| **Lead Scoring** | No existe | Automático con IA |
| **Vista unificada del lead** | Datos en 5 herramientas | Todo en una pantalla |
| **Reportes de ROAS** | Excel manual | Dashboard en tiempo real |
| **Cuando falla** | Cada herramienta culpa a la otra | Un solo punto de soporte |
| **Escalabilidad** | Cada lead adicional cuesta más en Zapier | Pricing fijo |

### Posicionamiento recomendado:

> **"Sellvende no es un CRM genérico. Es el operating system del Media Buyer.**
> **Captura el lead, lo califica con IA, lo contacta en segundos, y le dice a Meta cuáles son los que realmente compran para que tu algoritmo se vuelva más inteligente cada día."**

---

## 6. Roadmap de Implementación Priorizado

### 🔵 Fase 1 — "Lo que vende ya" ✅ COMPLETADA
- [x] Speed-to-Lead Dashboard con alertas de tiempo de respuesta
- [x] Atribución por campaña (UTM tracking + dashboard)
- [x] Lead Scoring básico por reglas (ScoreBadge ⭐ en Kanban)
- [x] Notificación al asesor por email con datos del lead al instante

### 🟢 Fase 2 — "El diferenciador técnico" (en progreso)
- [x] Meta Conversions API (CAPI) — enviar eventos `Lead`, `QualifiedLead`, `Purchase`
- [x] Dashboard de ROI por campaña en tiempo real
- [x] Ghost Lead Detector (reglas básicas + validación de email/teléfono)
- [x] Drip Engine — Validación E2E del motor `process-drips` e implementación del `Bounce Radar` asíncrono.

### 🟣 Fase 3 — "La ventaja competitiva imbatible" (6-10 semanas)
- [ ] WhatsApp Business API integrado (envío + recepción)
- [ ] Lead Scoring con IA (Gemini)
- [ ] Reportes semanales automatizados al dueño
- [ ] Sub-cuentas para agencias con white-label

---

## 7. Modelo de Pricing Sugerido

| Plan | Precio/mes | Incluye |
|:---|:---|:---|
| **Starter** | $29 USD | 1 usuario, 500 leads/mes, secuencias email, Kanban |
| **Pro** | $59 USD | 3 usuarios, 2000 leads/mes, + CAPI + Lead Scoring + ROI Dashboard |
| **Agency** | $99 USD | 10 usuarios, leads ilimitados, + WhatsApp API + Sub-cuentas + White-label |

**Comparación:** GoHighLevel cobra $297/mes por features similares. Sellvende sería **5x más barato** y más enfocado en el dolor real del media buyer.

---

## 8. Conclusión Estratégica

> [!CAUTION]
> **El mercado NO necesita otro CRM que prometa fórmulas mágicas.** 
> Lo que el mercado LATAM necesita es una herramienta ultra-realista que:
> 1. Capture leads de Meta y los nurture (nutra) gratis por Email.
> 2. Inspire al lead a dar el primer paso por WhatsApp para activar el chat bidireccional a Costo Cero / Subsidiado.
> 3. Ordene a los leads protegiendo la energía del vendedor para los que están calientes ahora, y mimando a la comunidad restante a la larga.
> 4. Entregue un panel financiero de "Verdad Absoluta" sin métricas infladas.
> 5. Cueste muchísimo menos que sus contrapartes norteamericanas genéricas.

**Sellvende tiene la base técnica para ser el Operating System más ético y eficiente de LATAM.**
