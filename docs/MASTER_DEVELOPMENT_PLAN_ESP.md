# Sellvende Leads — Plan Maestro de Desarrollo y Documento de Requerimientos del Producto (PRD)

**Versión:** 2.0.0  
**Clasificación:** Confidencial — Ingeniería Interna  
**Última Actualización:** 11-04-2026  
**Propietario:** División de Ingeniería — Sellvende  
**Estado:** Producción (Ingeniería Inversa desde el Sistema en Ejecución)

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Visión del Producto y Objetivos](#2-visión-del-producto-y-objetivos)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Especificaciones Funcionales Core (Épicas e Historias de Usuario)](#4-especificaciones-funcionales-core)
5. [Modelo de Datos](#5-modelo- de-datos)
6. [Requerimientos No Funcionales](#6-requerimientos-no-funcionales)
7. [Hoja de Ruta de Implementación](#7-hoja-de-ruta-de-implementación)
8. [Apéndices](#8-apéndices)

---

## 1. Resumen Ejecutivo

**Sellvende Leads** es una plataforma SaaS B2B multi-inquilino diseñada específicamente para Media Buyers, agencias de marketing de resultados y empresas que adquieren leads a través de Meta Ads (Facebook e Instagram). La plataforma resuelve la brecha crítica entre la captura del lead y su conversión, proporcionando un pipeline integrado que ingiere leads en tiempo real vía webhooks, los inscribe automáticamente en secuencias de goteo inteligentes de email/WhatsApp, rastrea la entregabilidad con sistemas de radar de rebote y devuelve los datos de conversión a la API de Conversiones de Meta (CAPI) para la optimización del ROAS.

El sistema está diseñado con una arquitectura orientada a eventos y "serverless-first", ejecutándose en Supabase (PostgreSQL + Edge Functions + Realtime WebSocket) con un frontend SPA en React desplegado en Vercel. El multi-inquilinato se aplica a nivel de base de datos mediante políticas de Seguridad a Nivel de Fila (RLS), garantizando el aislamiento total de los datos entre agencias/espacios de trabajo.

### Métricas Clave (Objetivos de Diseño)

| Métrica | Objetivo |
|---------|----------|
| Latencia Webhook-a-DB | < 2 segundos |
| Speed-to-Lead (primer email) | < 5 minutos desde la ingesta |
| Capacidad del motor de goteo | 100 leads/agencia/ciclo |
| Inquilinos concurrentes | Ilimitados (aislados por RLS) |
| Entregabilidad de email | > 95% de colocación en bandeja de entrada |
| Disponibilidad del sistema | 99.9% uptime (SLA de Supabase) |

---

## 2. Visión del Producto y Objetivos

### 2.1 Declaración del Problema

Los Media Buyers que gastan entre $10K y $500K al mes en Meta Ads enfrentan un cuello de botella universal: **los leads capturados a través de formularios de Facebook desaparecen en hojas de cálculo, son contactados demasiado tarde o nunca reciben un seguimiento automatizado**. El resultado es una tasa de desperdicio de leads del 60–80% y una incapacidad para medir con precisión el ROAS real porque los eventos de conversión nunca llegan al algoritmo de optimización de Meta.

Puntos de dolor específicos:

1. **Decadencia del Speed-to-Lead:** Los estudios muestran que la probabilidad de conversión cae un 80% después de los primeros 5 minutos. Los procesos manuales tardan horas o días.
2. **Sin Seguimiento Automatizado:** Los Media Buyers carecen de la infraestructura técnica para construir secuencias de goteo que se activen basadas en eventos de ingesta.
3. **Ceguera de Rebotes (Bounces):** Enviar a correos inválidos destruye la reputación del remitente. La mayoría de las herramientas no detectan ni actúan sobre los rebotes automáticamente.
4. **Caja Negra del ROAS:** Sin eventos de conversión del lado del servidor fluyendo hacia Meta CAPI, el algoritmo de anuncios no puede optimizar para ventas reales, solo para envíos de formularios.
5. **Caos Multi-cliente:** Las agencias que gestionan de 5 a 50 cuentas de anunciantes necesitan aislamiento de espacios de trabajo, credenciales de email por cliente y paneles unificados.

### 2.2 Propuesta de Valor

> **Sellvende Leads convierte leads brutos de Meta Ads en ingresos a través de secuencias de seguimiento automatizadas e inteligentes, y devuelve los datos de conversión a Meta para que el algoritmo aprenda con cada venta.**

Diferenciadores principales:

- **Ingesta de Latencia Cero:** Procesamiento de webhooks en tiempo real con captura de leads en menos de 2 segundos.
- **Motor de Goteo en Piloto Automático:** Secuencias de email basadas en días que se activan automáticamente con personalización de plantillas, protecciones anti-spam y protocolos de cancelación automática por rebote.
- **ROAS de Bucle Cerrado:** Integración servidor-a-servidor con Meta CAPI que reporta leads calificados y compras a la plataforma de anuncios.
- **Multi-inquilinato Empresarial:** Aislamiento total de espacios de trabajo con proveedores de email, marca y niveles de suscripción por agencia.
- **Diseño Enfocado en Entregabilidad:** Detección de rebotes doble (webhook + radar IMAP), cumplimiento de RFC 2369 y cancelación automática de secuencias para direcciones erróneas.

### 2.3 Personas de Usuario

#### Persona 1: "Media Buyer Marco" (Primaria)
- **Rol:** Media Buyer independiente o dueño de una pequeña agencia (1–5 personas).
- **Gasto:** $5K–$50K/mes en Meta Ads.
- **Dolor:** Los leads se enfrían porque no hay un sistema de seguimiento automatizado. Usa Google Sheets + correos manuales. No puede demostrar el ROAS a sus clientes.
- **Necesidad:** Un pipeline plug-and-play de webhook → secuencia de goteo que funcione al instante. Panel que muestre CPL, tasa de conversión y ROAS por campaña.
- **Nivel Técnico:** Bajo-Medio. Puede configurar OAuth y tokens de API pero no programa.

#### Persona 2: "Directora de Agencia Diana" (Secundaria)
- **Rol:** Directora de una agencia de marketing de resultados que gestiona 10 a 50 cuentas de clientes.
- **Dolor:** Cada cliente necesita marca, credenciales de email e informes separados. Las herramientas actuales (HubSpot, ActiveCampaign) son caras a escala y carecen de integración nativa con Meta Ads.
- **Necesidad:** Espacios de trabajo multi-inquilino con configuración por cliente, facturación centralizada y envío de correos de marca blanca.
- **Nivel Técnico:** Medio. Tiene un desarrollador en su equipo para la configuración inicial.

#### Persona 3: "Asesora de Ventas Sofía" (Terciaria)
- **Rol:** Representante de ventas asignado a los leads por el sistema.
- **Dolor:** No sabe qué leads están calientes, fríos o ya están en seguimiento. No tiene una vista unificada del historial de emails + estado del lead.
- **Necesidad:** Tablero Kanban con indicadores de nivel de "frío", cronología unificada de todos los puntos de contacto, acciones de WhatsApp y email en un clic.
- **Nivel Técnico:** Bajo. Necesita una interfaz pulida e intuitiva.

### 2.4 Objetivos Estratégicos

| # | Objetivo | Métrica de Éxito | Cronograma |
|---|-----------|---------------|----------|
| O1 | Capturar el 100% de los leads de Meta Ads en tiempo real | Pérdida cero de leads (fiabilidad webhook > 99.9%) | Fase 1 |
| O2 | Automatizar el primer contacto en menos de 5 min | Speed-to-Lead < 5 min para leads inscritos | Fase 2 |
| O3 | Mantener la entregabilidad por encima del 95% | Tasa de rebote < 3%, tasa de apertura > 20% | Fase 3 |
| O4 | Cerrar el bucle de ROAS con Meta CAPI | Eventos de compra fluyendo hacia Meta | Fase 4 |
| O5 | Soportar inquilinos ilimitados con aislamiento total | Cero fugas de datos entre inquilinos | Fase 3 |
| O6 | Lograr ingresos SaaS mediante suscripciones | Tasa de activación de suscripción > 30% desde prueba | Fase 5 |

---

## 3. Arquitectura del Sistema

### 3.1 Diagrama de Arquitectura de Alto Nivel (Conceptual)

```
                                    SELLVENDE LEADS — ARQUITECTURA DEL SISTEMA
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                         │
 │   ┌──────────────┐     ┌───────────────────┐     ┌──────────────────────────────────┐  │
 │   │              │     │   SUPABASE EDGE    │     │        BASE DE DATOS SUPABASE    │  │
 │   │   META ADS   │────▶│   FUNCTIONS        │────▶│        (PostgreSQL 15)           │  │
 │   │   PLATFORM   │     │   (Entorno Deno)   │     │                                  │  │
 │   │              │     │                    │     │  ┌────────┐  ┌──────────────┐    │  │
 │   └──────────────┘     │  ┌──────────────┐  │     │  │ leads  │  │ secuencias   │    │  │
 │          │              │  │meta-webhook  │──┼────▶│  │        │  │ _marketing   │    │  │
 │          │              │  └──────────────┘  │     │  └───┬────┘  └──────┬───────┘    │  │
 │          │              │  ┌──────────────┐  │     │      │              │            │  │
 │          ├─── OAuth ───▶│  │meta-oauth    │  │     │  ┌───▼──────────────▼───────┐    │  │
 │          │              │  └──────────────┘  │     │  │   leads_secuencias       │    │  │
 │          │              │  ┌──────────────┐  │     │  │   (estado inscripción)   │    │  │
 │          ├─── Sinc ────▶│  │sync-leads    │──┼────▶│  └─────────────────────────┘    │  │
 │          │              │  └──────────────┘  │     │                                  │  │
 │          │              │  ┌──────────────┐  │     │  ┌──────────┐  ┌────────────┐   │  │
 │          │              │  │process-drips │──┼────▶│  │email_log │  │configuracion│   │  │
 │   ┌──────▼──────┐      │  │ (CRON+Manual)│  │     │  └──────────┘  └────────────┘   │  │
 │   │  Meta CAPI  │◀─────│  └──────────────┘  │     │                                  │  │
 │   │  (Eventos)  │      │  ┌──────────────┐  │     │  ┌──────────┐  ┌────────────┐   │  │
 │   └─────────────┘      │  │resend-email  │──┼────▶│  │ ventas   │  │suscripciones│   │  │
 │                         │  └──────────────┘  │     │  └──────────┘  └────────────┘   │  │
 │                         │  ┌──────────────┐  │     │                                  │  │
 │                         │  │handle-bounce │──┼────▶│      POLÍTICAS RLS               │  │
 │                         │  └──────────────┘  │     │      (Aislamiento Multi-Ten)     │  │
 │                         │  ┌──────────────┐  │     └──────────────────────────────────┘  │
 │                         │  │send-meta-    │  │                    │                      │
 │                         │  │event (CAPI)  │  │                    │ Realtime WebSocket   │
 │                         │  └──────────────┘  │                    │                      │
 │                         │  ┌──────────────┐  │                    ▼                      │
 │                         │  │track-open    │  │     ┌──────────────────────────────────┐  │
 │                         │  │unsubscribe   │  │     │        FRONTEND REACT SPA         │  │
 │                         │  │imap-bounce-  │  │     │        (Vite + React 19)         │  │
 │                         │  │radar         │  │     │                                  │  │
 │                         │  └──────────────┘  │     │  Dashboard │ Leads │ Marketing   │  │
 │                         └───────────────────┘     │  Ventas │ Finanzas │ Config      │  │
 │                                                    │                                  │  │
 │                                                    │  Despliegue: Vercel (CDN)        │  │
 │                                                    └──────────────────────────────────┘  │
 │                                                                                         │
 │   ┌──────────────┐     ┌───────────────────┐                                           │
 │   │  Gmail SMTP  │◀────│  Email Providers   │                                           │
 │   │  Resend API  │     │  (por inquilino)   │                                           │
 │   └──────────────┘     └───────────────────┘                                           │
 │                                                                                         │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de Datos: Ciclo de Vida del Lead (Fin a Fin)

```
1. CAPTURA        2. INGESTA          3. INSCRIPCIÓN      4. NUTRICIÓN        5. CONVERSIÓN
───────────       ──────────         ──────────          ──────────          ──────────
Usuario llena     meta-webhook       Matching auto       process-drips       send-meta-event
Meta Lead Form    valida HMAC        producto →          se activa por cron  reporta Compra
      │           firma              secuencia           (cada 15 min)       a Meta CAPI
      │                │                  │                    │                   │
      ▼                ▼                  ▼                    ▼                   ▼
[Meta Platform] → [Edge Function] → [leads_secuencias] → [Email/WhatsApp] → [Meta CAPI]
                       │                                      │
                       ▼                                      ▼
                  [tabla leads]                          [email_log]
                  [Realtime WS] ──────────────────▶ [Updates UI React]
```

---

## 4. Especificaciones Funcionales Core

### 4.1 Resumen de Épicas

| ID | Nombre de la Épica | Prioridad | Complejidad |
|---------|-----------|----------|------------|
| E1 | Motor de Ingesta de Webhooks | P0 | Alta |
| E2 | Enrutamiento e Inscripción Automática | P0 | Alta |
| E3 | Motor de Automatización Drip | P0 | Muy Alta |
| E4 | Gestión de Entregabilidad | P0 | Alta |
| E5 | Interfaz CRM de Leads | P1 | Media |
| E6 | Composición de Emails y Plantillas | P1 | Media |
| E7 | Dashboard de Analíticas | P1 | Media |
| E8 | Gestión Multi-inquilino | P1 | Alta |
| E9 | Bucle de Conversión Meta CAPI | P2 | Media |
| E10 | Suscripción SaaS y Facturación | P2 | Media |

### 4.2 Épica E1: Motor de Ingesta de Webhooks

**Módulo:** `supabase/functions/meta-webhook/index.ts`  
**Puntos Estimados:** 21

#### Descripción
Recibe envíos de leads en tiempo real desde formularios de Meta Ads. Valida la integridad, enriquece los datos vía Meta Graph API, sanitiza y desduplica antes de persistir.

#### Historias de Usuario
- **E1-S1:** Como Media Buyer, quiero que mis leads aparezcan en Sellvende en menos de 2s para actuar rápido.
- **E1-S2:** Como sistema, debo verificar la firma HMAC-SHA256 para evitar inyecciones falsas.
- **E1-S3:** Como sistema, debo desduplicar por `meta_lead_id` para evitar registros repetidos por reintentos de Meta.
- **E1-S4:** Como administrador, quiero una alerta instantánea por email cuando llegue un nuevo lead.

### 4.3 Épica E3: Motor de Automatización Drip

**Módulo:** `supabase/functions/process-drips/index.ts`  
**Puntos Estimados:** 34

#### Descripción
El núcleo del sistema. Ejecuta pasos de email pendientes para todos los leads inscritos. Maneja personalización, múltiples proveedores (Gmail/Resend), píxeles de seguimiento y cumplimiento RFC 2369.

#### Detalles Técnicos
- **Bloqueo Consultivo:** Usa `pg_advisory_lock` para evitar envíos duplicados en ejecuciones simultáneas.
- **Tubería de Plantillas:** Limpieza de HTML -> Sustitución de variables -> Envoltura XHTML compatible con Outlook -> Inyección de píxel.
- **Paralelismo:** Procesa agencias en paralelo pero leads dentro de cada agencia secuencialmente (especialmente para Gmail).

---

## 5. Modelo de Datos

### 5.1 Entidades Principales

#### 5.2.1 `agencias` (Inquilino)
Raíz del sistema multi-inquilino. Cada registro pertenece a una agencia.
- `id` (UUID): Identificador único.
- `nombre` (TEXT): Nombre comercial.

#### 5.2.2 `leads` (Prospecto)
- `id` (UUID): Identificador único.
- `estado` (TEXT): nuevo, contactado, cotizado, ventado, frio.
- `unsubscribed` (BOOLEAN): Si el usuario se ha dado de baja.
- `lead_score` (INTEGER): Puntuación 1-5 basada en engagement.

#### 5.2.3 `secuencias_marketing`
- `producto_match` (TEXT): Filtro para inscripción automática.
- `activa` (BOOLEAN): Switch de encendido/apagado.

---

## 6. Requerimientos No Funcionales

### 6.1 Seguridad e Isolation
- **RLS:** Todas las consultas incluyen `.eq('agencia_id', id)`.
- **Sanitización:** Uso de `escapeHtml()` para prevenir XSS.
- **Hasing:** PII enviada a Meta CAPI debe ir hasheada con SHA-256.

### 6.2 Rendimiento
- **Latencia Webhook:** < 2 segundos.
- **Carga de Tabla de Leads:** < 1.5 segundos (paginación servidor).
- **Propagación Realtime:** < 500ms mediante WebSockets.

---

## 7. Hoja de Ruta de Implementación

- **Fase 1 (Sprints 1-4):** Cimientos e ingesta de datos de Meta Ads.
- **Fase 2 (Sprints 5-8):** Motor de automatización y plantillas.
- **Fase 3 (Sprints 9-12):** Multi-inquilinato y gestión de rebotes.
- **Fase 4 (Sprints 13-16):** Inteligencia, Atribución CAPI y Pipeline de Ventas.
- **Fase 5 (Sprints 17-20):** Monetización SaaS y WhatsApp Business API.

---

## 8. Apéndices

### 8.1 Glosario Técnico
- **Inquilino (Tenant):** Un espacio de trabajo aislado (agencia).
- **Goteo (Drip):** Secuencia de mensajes automáticos programados.
- **CAPI:** Conversions API de Meta.
- **Píxel de seguimiento:** Imagen de 1x1 utilizada para detectar aperturas de email.

---
*Este documento es la versión oficial en español del Plan Maestro de Desarrollo.*
