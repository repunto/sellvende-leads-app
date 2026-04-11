# Sellvende Leads — Master Development Plan & Product Requirements Document

**Version:** 2.0.0  
**Classification:** Confidential — Internal Engineering  
**Last Updated:** 2026-04-11  
**Owner:** Engineering Division — Sellvende  
**Status:** Production (Reverse-Engineered from Running System)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Objectives](#2-product-vision--objectives)
3. [System Architecture](#3-system-architecture)
4. [Core Functional Specifications (Epics & User Stories)](#4-core-functional-specifications)
5. [Data Model](#5-data-model)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Appendices](#8-appendices)

---

## 1. Executive Summary

**Sellvende Leads** is a multi-tenant B2B SaaS platform purpose-built for Media Buyers, performance marketing agencies, and businesses that acquire leads through Meta Ads (Facebook & Instagram). The platform solves the critical gap between lead capture and lead conversion by providing an integrated pipeline that ingests leads in real-time via webhooks, automatically enrolls them into intelligent email/WhatsApp drip sequences, tracks deliverability with bounce radar systems, and feeds conversion data back to Meta's Conversions API (CAPI) for ROAS optimization.

The system is designed as a serverless-first, event-driven architecture running on Supabase (PostgreSQL + Edge Functions + Realtime WebSocket) with a React SPA frontend deployed on Vercel. Multi-tenancy is enforced at the database level through Row-Level Security (RLS) policies, ensuring complete data isolation between agencies/workspaces.

### Key Metrics (Design Targets)

| Metric | Target |
|--------|--------|
| Webhook-to-DB latency | < 2 seconds |
| Speed-to-Lead (first email) | < 5 minutes from ingestion |
| Drip engine throughput | 100 leads/agency/cycle |
| Concurrent tenants | Unlimited (RLS-isolated) |
| Email deliverability | > 95% inbox placement |
| System availability | 99.9% uptime (Supabase SLA) |

---

## 2. Product Vision & Objectives

### 2.1 Problem Statement

Media Buyers spending $10K–$500K/month on Meta Ads face a universal bottleneck: **leads captured through Facebook Lead Forms disappear into spreadsheets, get contacted too late, or never receive automated nurturing**. The result is a 60–80% lead wastage rate and an inability to accurately measure true ROAS because conversion events never flow back to Meta's optimization algorithm.

Specific pain points:

1. **Speed-to-Lead Decay:** Studies show lead conversion probability drops 80% after the first 5 minutes. Manual processes take hours or days.
2. **No Automated Nurturing:** Media Buyers lack the technical infrastructure to build drip sequences that fire based on lead ingestion events.
3. **Bounce Blindness:** Sending to invalid emails destroys sender reputation. Most tools don't detect or act on bounces automatically.
4. **ROAS Black Box:** Without server-side conversion events flowing back to Meta CAPI, the ad algorithm can't optimize for actual sales — only form fills.
5. **Multi-Client Chaos:** Agencies managing 5–50 advertiser accounts need workspace isolation, per-client email credentials, and unified dashboards.

### 2.2 Value Proposition

> **Sellvende Leads converts raw Meta Ads leads into revenue through automated, intelligent nurturing sequences — and feeds conversion data back to Meta so the algorithm gets smarter with every sale.**

Core differentiators:

- **Zero-Latency Ingestion:** Real-time webhook processing with sub-2-second lead capture.
- **Autopilot Drip Engine:** Day-based email sequences that fire automatically with template personalization, anti-spam guards, and bounce auto-kill.
- **Closed-Loop ROAS:** Server-to-server Meta CAPI integration that reports qualified leads and purchases back to the ad platform.
- **Enterprise Multi-Tenancy:** Full workspace isolation with per-agency email providers, branding, and subscription tiers.
- **Deliverability-First Design:** Dual bounce detection (webhook + IMAP radar), RFC 2369 compliance, and automatic sequence cancellation for bad addresses.

### 2.3 User Personas

#### Persona 1: "Media Buyer Marco" (Primary)
- **Role:** Independent Media Buyer or small agency owner (1–5 people)
- **Spends:** $5K–$50K/month on Meta Ads
- **Pain:** Leads go cold because there's no automated follow-up system. Uses Google Sheets + manual emails. Can't prove ROAS to clients.
- **Need:** Plug-and-play webhook → drip sequence pipeline that works the moment a lead fills a form. Dashboard showing CPL, conversion rate, and ROAS per campaign.
- **Technical Level:** Low-to-medium. Can configure OAuth and API tokens but not code.

#### Persona 2: "Agency Director Diana" (Secondary)
- **Role:** Director of a performance marketing agency managing 10–50 client accounts.
- **Pain:** Each client needs separate branding, email credentials, and reporting. Current tools (HubSpot, ActiveCampaign) are expensive at scale and lack native Meta Ads integration.
- **Need:** Multi-tenant workspaces with per-client configuration, centralized billing, and white-label email sending.
- **Technical Level:** Medium. Has a developer on staff for initial setup.

#### Persona 3: "Sales Advisor Sofia" (Tertiary)
- **Role:** Inbound sales rep assigned leads by the system.
- **Pain:** Doesn't know which leads are hot, cold, or already nurturing. No unified view of email history + lead status.
- **Need:** Kanban board with cold-level indicators, unified timeline of all touchpoints, one-click WhatsApp and email actions.
- **Technical Level:** Low. Needs a polished, intuitive UI.

### 2.4 Strategic Objectives

| # | Objective | Success Metric | Timeline |
|---|-----------|---------------|----------|
| O1 | Capture 100% of Meta Ads leads in real-time | Zero lead loss (webhook reliability > 99.9%) | Phase 1 |
| O2 | Automate first-touch within 5 minutes of lead creation | Speed-to-Lead < 5 min for enrolled leads | Phase 2 |
| O3 | Maintain inbox deliverability above 95% | Bounce rate < 3%, open rate > 20% | Phase 3 |
| O4 | Close the ROAS loop with Meta CAPI | Attributed purchase events flowing to Meta | Phase 4 |
| O5 | Support unlimited tenants with full isolation | Zero cross-tenant data leaks | Phase 3 |
| O6 | Achieve SaaS revenue through tiered subscriptions | Subscription activation rate > 30% from trial | Phase 5 |

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram (Conceptual)

```
                                    SELLVENDE LEADS — SYSTEM ARCHITECTURE
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                         │
 │   ┌──────────────┐     ┌───────────────────┐     ┌──────────────────────────────────┐  │
 │   │              │     │   SUPABASE EDGE    │     │        SUPABASE DATABASE         │  │
 │   │   META ADS   │────▶│   FUNCTIONS        │────▶│        (PostgreSQL 15)           │  │
 │   │   PLATFORM   │     │   (Deno Runtime)   │     │                                  │  │
 │   │              │     │                    │     │  ┌────────┐  ┌──────────────┐    │  │
 │   └──────────────┘     │  ┌──────────────┐  │     │  │ leads  │  │ secuencias   │    │  │
 │          │              │  │meta-webhook  │──┼────▶│  │        │  │ _marketing   │    │  │
 │          │              │  └──────────────┘  │     │  └───┬────┘  └──────┬───────┘    │  │
 │          │              │  ┌──────────────┐  │     │      │              │            │  │
 │          ├─── OAuth ───▶│  │meta-oauth    │  │     │  ┌───▼──────────────▼───────┐    │  │
 │          │              │  └──────────────┘  │     │  │   leads_secuencias       │    │  │
 │          │              │  ┌──────────────┐  │     │  │   (enrollment state)     │    │  │
 │          ├─── Sync ────▶│  │sync-leads    │──┼────▶│  └─────────────────────────┘    │  │
 │          │              │  └──────────────┘  │     │                                  │  │
 │          │              │  ┌──────────────┐  │     │  ┌──────────┐  ┌────────────┐   │  │
 │          │              │  │process-drips │──┼────▶│  │email_log │  │configuracion│   │  │
 │   ┌──────▼──────┐      │  │ (CRON+Manual)│  │     │  └──────────┘  └────────────┘   │  │
 │   │  Meta CAPI  │◀─────│  └──────────────┘  │     │                                  │  │
 │   │  (Events)   │      │  ┌──────────────┐  │     │  ┌──────────┐  ┌────────────┐   │  │
 │   └─────────────┘      │  │resend-email  │──┼────▶│  │ ventas   │  │suscripciones│   │  │
 │                         │  └──────────────┘  │     │  └──────────┘  └────────────┘   │  │
 │                         │  ┌──────────────┐  │     │                                  │  │
 │                         │  │handle-bounce │──┼────▶│      RLS POLICIES                │  │
 │                         │  └──────────────┘  │     │      (Multi-Tenant Isolation)     │  │
 │                         │  ┌──────────────┐  │     └──────────────────────────────────┘  │
 │                         │  │send-meta-    │  │                    │                      │
 │                         │  │event (CAPI)  │  │                    │ Realtime WebSocket   │
 │                         │  └──────────────┘  │                    │                      │
 │                         │  ┌──────────────┐  │                    ▼                      │
 │                         │  │track-open    │  │     ┌──────────────────────────────────┐  │
 │                         │  │unsubscribe   │  │     │        REACT SPA FRONTEND        │  │
 │                         │  │imap-bounce-  │  │     │        (Vite + React 19)         │  │
 │                         │  │radar         │  │     │                                  │  │
 │                         │  └──────────────┘  │     │  Dashboard │ Leads │ Marketing   │  │
 │                         └───────────────────┘     │  Ventas │ Finanzas │ Config      │  │
 │                                                    │                                  │  │
 │                                                    │  Deployed on: Vercel (CDN)       │  │
 │                                                    └──────────────────────────────────┘  │
 │                                                                                         │
 │   ┌──────────────┐     ┌───────────────────┐                                           │
 │   │  Gmail SMTP  │◀────│  Email Providers   │                                           │
 │   │  Resend API  │     │  (per-tenant)      │                                           │
 │   └──────────────┘     └───────────────────┘                                           │
 │                                                                                         │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow: Lead Lifecycle (End-to-End)

```
1. CAPTURE        2. INGEST          3. ENROLL           4. NURTURE          5. CONVERT
───────────       ──────────         ──────────          ──────────          ──────────
User fills        meta-webhook       Auto-match          process-drips       send-meta-event
Meta Lead Form    validates HMAC     product →           fires on cron       reports Purchase
      │           signature          sequence            (every 15 min)      to Meta CAPI
      │                │                  │                    │                   │
      ▼                ▼                  ▼                    ▼                   ▼
[Meta Platform] → [Edge Function] → [leads_secuencias] → [Email/WhatsApp] → [Meta CAPI]
                       │                                      │
                       ▼                                      ▼
                  [leads table]                          [email_log]
                  [Realtime WS] ──────────────────▶ [React UI updates]
```

**Detailed Flow:**

1. **Capture:** A prospect fills a Facebook/Instagram Lead Form attached to an ad campaign. Meta fires a webhook POST to the registered endpoint.

2. **Ingest (meta-webhook):**
   - Validates payload integrity via HMAC-SHA256 signature verification against `META_APP_SECRET`.
   - Fetches full lead data from Meta Graph API v19.0 (`/leadgen_id?fields=id,field_data,created_time,platform,campaign_name`).
   - Sanitizes all inputs (XSS prevention, CSV injection stripping).
   - Deduplicates by `meta_lead_id` against existing records.
   - Upserts lead into `leads` table with `agencia_id` tenant key.
   - Sends instant notification email to agency admin ("New Lead Alert").

3. **Enroll:**
   - Smart product matching: queries `secuencias_marketing.producto_match` for a sequence whose target product matches the lead's `producto_interes`.
   - Fallback: assigns to the "General" sequence (where `producto_match` is NULL).
   - Creates `leads_secuencias` enrollment record with `estado: 'en_progreso'`, `ultimo_paso_ejecutado: 0`.

4. **Nurture (process-drips):**
   - Acquires PostgreSQL advisory lock (prevents concurrent execution).
   - Groups enrolled leads by agency, loads per-agency email credentials.
   - For each lead: calculates elapsed days since enrollment, finds next pending step where `dia_envio <= daysElapsed`.
   - Personalizes email template (variables: `{nombre}`, `{producto}`, `{agencia}`, `{fechaviaje}`, etc.).
   - Wraps in Outlook-proof XHTML 1.0 Transitional template with tracking pixel and RFC 2369 headers.
   - Sends via configured provider (Gmail SMTP or Resend API).
   - Logs to `email_log`, updates `leads.ultimo_contacto`, advances `ultimo_paso_ejecutado`.
   - On hard bounce: marks `email_rebotado = true`, cancels all sequences for that lead.

5. **Convert (send-meta-event):**
   - Triggered by database webhook on `leads.estado` change to `contactado` or `venta_cerrada`.
   - Hashes PII (email, phone, name) with SHA-256 per Meta privacy requirements.
   - Posts `QualifiedLead` or `Purchase` event to Meta Conversions API.
   - Includes purchase value from `ventas` table for revenue attribution.

### 3.3 Key Architectural Decisions

#### Decision 1: Serverless Edge Functions over Dedicated Server

**Choice:** Supabase Deno Edge Functions (cold-start < 500ms, auto-scaling).

**Rationale:**
- Webhook traffic is bursty (peaks during ad campaign hours, near-zero at night). A dedicated server would be over-provisioned 90% of the time.
- Edge Functions scale to zero cost during inactivity and handle spikes without provisioning.
- Deno runtime provides built-in TypeScript, top-level await, and secure-by-default sandboxing.

**Trade-off:** Cold starts can add 200–500ms to first request. Mitigated by the 15-minute cron cycle for drips (function stays warm).

#### Decision 2: Multi-Tenant via Row-Level Security (RLS)

**Choice:** Single shared database with RLS policies filtering by `agencia_id`.

**Rationale:**
- Shared infrastructure minimizes operational cost (one database, one connection pool).
- RLS enforces isolation at the PostgreSQL level — even if application code has a bug, the database prevents cross-tenant data access.
- Supabase Auth integration means RLS policies can reference `auth.uid()` directly.

**Trade-off:** Complex queries may be slower due to RLS policy evaluation. Mitigated by indexes on `agencia_id` columns.

#### Decision 3: Dual Email Provider Support (Gmail SMTP + Resend API)

**Choice:** Per-tenant email provider configuration with automatic detection.

**Rationale:**
- Small agencies (Persona 1) already have Gmail and want zero additional cost. Gmail App Passwords provide SMTP access without third-party accounts.
- Larger agencies (Persona 2) need dedicated sending infrastructure (Resend) for higher volume and better deliverability.
- The system auto-detects the configured provider and routes accordingly.

**Trade-off:** Maintaining two provider paths increases code complexity. Centralized in `process-drips` and `resend-email` with shared interface.

#### Decision 4: Realtime WebSocket + Polling Fallback

**Choice:** Supabase Realtime as primary update channel with 30-minute polling safety net.

**Rationale:**
- WebSocket provides sub-second UI updates when new leads arrive (critical for Speed-to-Lead UX).
- Polling fallback handles edge cases: WebSocket disconnection, browser tab sleep, network interruptions.
- Smart buffering: if user has active filters, new leads are buffered (badge notification) rather than injecting into filtered view.

#### Decision 5: Advisory Lock for Drip Engine Concurrency

**Choice:** PostgreSQL `pg_advisory_lock` with a fixed lock key (111222333).

**Rationale:**
- The drip engine can be triggered by: cron schedule, manual button press, webhook auto-fire, and bulk enrollment.
- Without locking, two concurrent executions could send duplicate emails to the same lead.
- Advisory locks are lightweight (no table-level locking) and auto-release on connection close.

---

## 4. Core Functional Specifications

### 4.1 Epic Overview

| Epic ID | Epic Name | Priority | Complexity |
|---------|-----------|----------|------------|
| E1 | Webhook Ingestion Engine | P0 — Critical | High |
| E2 | Intelligent Lead Routing & Auto-Enrollment | P0 — Critical | High |
| E3 | Drip Sequence Automation Engine | P0 — Critical | Very High |
| E4 | Deliverability & Bounce Management | P0 — Critical | High |
| E5 | Lead CRM Interface (Table + Kanban) | P1 — High | Medium |
| E6 | Email Composition & Template System | P1 — High | Medium |
| E7 | Analytics Dashboard & KPIs | P1 — High | Medium |
| E8 | Multi-Tenant Workspace Management | P1 — High | High |
| E9 | Meta CAPI Conversion Loop | P2 — Medium | Medium |
| E10 | SaaS Subscription & Billing | P2 — Medium | Medium |
| E11 | Sales Pipeline & Voucher System | P3 — Low | Medium |
| E12 | WhatsApp Omnichannel Integration | P3 — Low | High |

---

### 4.2 Epic E1: Webhook Ingestion Engine

**Module:** `supabase/functions/meta-webhook/index.ts`  
**Owner:** Backend Team  
**Estimated Points:** 21

#### Description
Receives real-time lead submissions from Meta Ads Lead Forms via HTTP POST webhook. Validates payload integrity, fetches enriched lead data from Meta Graph API, sanitizes inputs, deduplicates against existing records, and persists to the database with full campaign attribution metadata.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E1-S1 | As a Media Buyer, I want my Meta Lead Form submissions to appear in Sellvende within 2 seconds so that I can act on leads before they go cold. | Lead visible in UI within 2s of form submission. Realtime WebSocket pushes INSERT event. |
| E1-S2 | As a system, I must verify webhook signature integrity to prevent spoofed lead injections. | HMAC-SHA256 verification against `META_APP_SECRET`. 403 returned on invalid signature. Fail-closed: rejects if secret is missing. |
| E1-S3 | As a system, I must deduplicate leads by `meta_lead_id` to prevent duplicate records from Meta retry attempts. | Existing `meta_lead_id` check before insert. Duplicate leads skipped silently (200 response to Meta). |
| E1-S4 | As an Agency Admin, I want an instant email notification when a new lead arrives so my team can respond immediately. | Notification email sent to agency admin within 5s. Includes lead name, product, WhatsApp link (if phone present). |
| E1-S5 | As a system, I must sanitize all lead data to prevent XSS and CSV injection attacks. | All text fields passed through `escapeHtml()`. Formula characters (`=`, `+`, `-`, `@`) stripped from field starts. |
| E1-S6 | As a system, I must extract campaign attribution data (campaign_name, adset_name, ad_name) for ROAS analysis. | Meta Graph API queried for campaign metadata. Fields stored in leads table. |

#### Technical Specification

- **Endpoint:** `POST /functions/v1/meta-webhook`
- **Verification Handshake:** `GET` with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`
- **Payload Limit:** 1MB maximum (DDoS protection)
- **Batch Limit:** Maximum 50 changes per webhook payload
- **External API:** Meta Graph API v19.0 (`/{leadgen_id}?fields=id,field_data,created_time,platform,campaign_name,adset_name,ad_name`)
- **Idempotency:** 200 response regardless of processing outcome (prevents Meta retry storms)

---

### 4.3 Epic E2: Intelligent Lead Routing & Auto-Enrollment

**Modules:** `meta-webhook` (auto-enroll), `sync-leads` (bulk enroll), `useLeadSequences` hook  
**Owner:** Backend + Frontend Team  
**Estimated Points:** 13

#### Description
Automatically assigns incoming leads to the appropriate drip sequence based on product interest matching. Supports smart matching (product name ILIKE comparison), general fallback sequences, manual assignment, and bulk enrollment operations.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E2-S1 | As a Media Buyer, I want leads from my "Machu Picchu" campaign to automatically enter the "Machu Picchu" drip sequence. | `secuencias_marketing.producto_match` ILIKE compared to lead's `producto_interes`. Match triggers auto-enrollment. |
| E2-S2 | As a system, leads without a product-specific sequence must fall back to a "General" sequence. | Query for sequence where `producto_match IS NULL` or empty. Fallback enrollment if no specific match. |
| E2-S3 | As a Sales Advisor, I want to manually assign a lead to a different sequence from the detail panel. | Dropdown in LeadDetailPanel showing available sequences. Upsert to `leads_secuencias` on selection. |
| E2-S4 | As a Media Buyer, I want to bulk-enroll 500 selected leads into a sequence with one click. | `mass_enroll_sequence` RPC executes atomically. Product mismatch warning shown before confirmation. |
| E2-S5 | As a system, re-enrolling a lead must reset their sequence progress. | Previous `leads_secuencias` record deleted. New record created with `ultimo_paso_ejecutado: 0`. |

#### Routing Algorithm

```
1. Normalize lead's producto_interes → lowercase, trim
2. Query: SELECT id FROM secuencias_marketing 
         WHERE agencia_id = :aid 
         AND activa = true 
         AND producto_match ILIKE '%' || :product || '%'
         LIMIT 1
3. If match found → enroll
4. Else → Query: SELECT id FROM secuencias_marketing 
                 WHERE agencia_id = :aid 
                 AND activa = true 
                 AND (producto_match IS NULL OR producto_match = '')
                 LIMIT 1
5. If fallback found → enroll
6. Else → Log warning (orphaned lead — no sequence available)
```

---

### 4.4 Epic E3: Drip Sequence Automation Engine

**Module:** `supabase/functions/process-drips/index.ts` (813 lines)  
**Owner:** Backend Team  
**Estimated Points:** 34 (largest epic)

#### Description
The core automation engine that executes pending email steps for all enrolled leads across all tenants. Runs on a 15-minute cron cycle and can be manually triggered. Handles template personalization, multi-provider email sending, tracking pixel injection, anti-spam guards, and bounce auto-kill protocols.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E3-S1 | As a Media Buyer, I want my drip sequence to automatically send emails on the correct days without any manual intervention. | Day-based step execution: step with `dia_envio = 3` fires on day 3 after enrollment. |
| E3-S2 | As a system, I must prevent duplicate emails if the engine runs multiple times within the same step window. | `ultimo_paso_ejecutado` tracks last sent step. Steps only fire if `dia_envio > ultimo_paso_ejecutado`. |
| E3-S3 | As a system, I must respect an 8-hour cooldown between emails to the same lead. | `ultimo_contacto` timestamp checked. Skip if < 8 hours elapsed. |
| E3-S4 | As a system, I must personalize email templates with lead-specific data. | Variables replaced: `{nombre}`, `{producto}`, `{agencia}`, `{remitente}`, `{fechaviaje}`, `{mesagotado}`, `{social_proof}`. All values HTML-escaped before injection. |
| E3-S5 | As a system, I must embed a tracking pixel in every email to measure open rates. | UUID-based `logId` generated. 1x1 transparent GIF pixel embedded. `track-open` endpoint updates `email_log.abierto_at`. |
| E3-S6 | As a system, I must include RFC 2369 headers for email compliance. | `List-Unsubscribe`, `List-Unsubscribe-Post`, `Precedence: bulk`, `X-Auto-Response-Suppress` headers present. |
| E3-S7 | As a Media Buyer, I want a master switch to pause/resume all automation globally. | `master_sequence_switch` in `configuracion` table. Engine skips all leads if switch is 'false'. |
| E3-S8 | As a system, I must handle hard bounces by immediately marking the lead and canceling all sequences. | 550 5.1.x errors → `email_rebotado = true`, `estado = 'correo_falso'`, all sequences cancelled. |
| E3-S9 | As a system, I must implement a poison pill guard to prevent infinite retry loops on soft errors. | Soft error counter stored in `leads_secuencias.notas` JSON. After 5 retries → pause sequence. |
| E3-S10 | As a system, agencies must process in parallel but leads within an agency must process sequentially. | `Promise.allSettled()` for inter-agency parallelism. Sequential loop within each agency with 1.2s delay (Gmail rate limit). |

#### Concurrency Model

```
┌──────────────────────────────────────────────────┐
│               process-drips invoked              │
│                                                  │
│  1. Acquire advisory lock (key: 111222333)       │
│     └─ If locked → return "already running"      │
│                                                  │
│  2. Load enrollments (estado='en_progreso')       │
│     └─ Limit: 100 per cycle                      │
│     └─ Order by: updated_at ASC (fairness)       │
│                                                  │
│  3. Group by agencia_id                          │
│     ┌────────────────────────────────────┐       │
│     │ Agency A          Agency B         │       │
│     │ (Gmail SMTP)      (Resend API)     │       │
│     │                                    │       │
│     │ Lead 1 → send     Lead 4 → send   │ ←── parallel
│     │ Lead 2 → send     Lead 5 → send   │
│     │ Lead 3 → send     Lead 6 → skip   │
│     │ (sequential,      (sequential,     │
│     │  1.2s delay)       no delay)       │
│     └────────────────────────────────────┘       │
│                                                  │
│  4. Release advisory lock                        │
│  5. Return summary: sent, skipped, errors        │
└──────────────────────────────────────────────────┘
```

#### Email Template Pipeline

```
Raw TipTap HTML
  │
  ▼
flattenHtml()          ── Fix nested <p> tags from rich text editor
  │
  ▼
Variable Substitution  ── Replace {nombre}, {producto}, etc.
  │                       All values HTML-escaped (XSS prevention)
  ▼
cleanHtmlForEmail()    ── Collapse excessive <br> tags
  │                       Merge orphaned emoji paragraphs
  ▼
wrapEmailTemplate()    ── Inject into XHTML 1.0 Transitional shell
  │                       Black header with agency logo
  │                       Responsive card layout (600px max)
  │                       Conditional MSO comments (Outlook Desktop)
  │                       Tracking pixel injection
  │                       Unsubscribe section (HMAC-signed URL)
  │                       Footer with agency contact info
  ▼
Final HTML (40–60KB)   ── Ready for SMTP/API delivery
```

---

### 4.5 Epic E4: Deliverability & Bounce Management

**Modules:** `handle-bounce`, `imap-bounce-radar`, `track-open`, `unsubscribe`  
**Owner:** Backend Team  
**Estimated Points:** 21

#### Description
Multi-layered bounce detection system ensuring sender reputation protection. Combines provider webhook callbacks (Resend), IMAP mailbox scanning (Gmail), email open tracking, and one-click unsubscribe compliance.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E4-S1 | As a system, hard bounces from Resend must mark leads as `correo_falso` and cancel all sequences within 60 seconds. | `handle-bounce` webhook processes `email.bounced` events. HMAC-SHA256 (Svix) signature verified. Lead updated, sequences cancelled. |
| E4-S2 | As a system, Gmail bounces detected via IMAP must trigger the same auto-kill protocol. | `imap-bounce-radar` connects to `imap.gmail.com:993`. Parses `mailer-daemon@googlemail.com` messages. Matches via Message-ID UUID. |
| E4-S3 | As a system, soft bounces (quota exceeded, temporary failure) must pause but not cancel sequences. | Soft bounce detection (4xx codes). `estado = 'pausado'` on `leads_secuencias`. No `correo_falso` marking. |
| E4-S4 | As a system, email opens must be tracked silently via 1x1 pixel. | `track-open` endpoint returns transparent GIF. Updates `email_log.abierto_at` and `estado = 'abierto'`. No-cache headers prevent false positives. |
| E4-S5 | As a lead recipient, I must be able to unsubscribe with one click from any email. | HMAC-signed unsubscribe URL in every email. `unsubscribe` endpoint validates token, sets `unsubscribed = true`. Returns confirmation HTML page. |

#### Bounce Detection Architecture

```
Layer 1: Provider Webhooks (Real-time)
  ├── Resend → handle-bounce endpoint
  │   └── Svix HMAC verification
  │   └── Hard/Soft bounce classification
  │   └── Tag-based lead matching (agencia_id + lead_id)
  │
Layer 2: IMAP Radar (Fallback, Cron-based)
  ├── imap-bounce-radar endpoint
  │   └── Connects to Gmail IMAP
  │   └── Scans mailer-daemon messages
  │   └── Message-ID UUID extraction
  │   └── Regex-based bounce classification
  │
Layer 3: Process-Drips Inline Detection
  └── SMTP error codes caught during send
      └── 550 5.1.x → immediate hard bounce handling
      └── 4xx → soft bounce counter increment
```

---

### 4.6 Epic E5: Lead CRM Interface

**Modules:** `LeadsPage.jsx`, `LeadsTableView.jsx`, `LeadsKanbanView.jsx`, `LeadDetailPanel.jsx`  
**Owner:** Frontend Team  
**Estimated Points:** 21

#### Description
Dual-view CRM interface providing both tabular data management and visual Kanban pipeline views. Includes server-side pagination (50 leads/page), real-time updates via WebSocket, multi-criteria filtering, bulk selection, and a unified lead detail panel with email timeline.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E5-S1 | As a Sales Advisor, I want to see all leads in a sortable, paginated table. | Server-side pagination via `get_leads_page` RPC. 50 leads/page. Sort by date, name, status. |
| E5-S2 | As a Sales Advisor, I want to drag leads between Kanban columns to update their status. | 4 columns: Nuevo → Contactado → Cotizado → Ventado. Drag-drop updates `leads.estado`. |
| E5-S3 | As a Sales Advisor, I want to see cold-level indicators on leads that haven't been contacted. | 🟡 24h+ / 🟠 48h+ / 🔴 72h+ visual badges based on `ultimo_contacto` or `created_at`. |
| E5-S4 | As a Sales Advisor, I want a detail panel showing the lead's full email timeline. | Side panel with reverse-chronological timeline. Email events (enviado/abierto/rebotado) + system events (created, status change). |
| E5-S5 | As a Media Buyer, I want to filter leads by status, form source, date range, and search text. | Combined filters on estado, form_name, date_from/to, search (nombre/email). Server-side filtering via RPC. |
| E5-S6 | As a Media Buyer, I want new leads from Meta to appear in real-time without refreshing. | Supabase Realtime WebSocket subscription on `leads` table. Smart injection on page 1 / badge notification on filtered views. |
| E5-S7 | As a Sales Advisor, I want to select multiple leads for bulk email or sequence enrollment. | Checkbox selection with select-all/partial. Selected IDs passed to MassEmailModal or MassSequenceModal. |

#### Lead Score Algorithm

```javascript
function getLeadScore(lead) {
  let score = 0;
  if (lead.email)                                      score += 0.5;
  if (lead.telefono)                                   score += 0.5;
  if (lead.producto_interes)                           score += 0.5;
  if (lead.pax && lead.pax > 0)                        score += 0.5;
  if (lead.estado === 'contactado')                    score += 1.0;
  if (lead.estado === 'cotizado')                      score += 1.5;
  if (lead.estado === 'ventado')                       score += 2.0;
  if (recentContact(lead, 7))                          score += 0.5;
  if (createdWithin(lead, 1))                          score += 1.0;
  else if (createdWithin(lead, 7))                     score += 0.5;
  return Math.min(Math.ceil(score), 5);  // 1–5 scale
}
```

#### Lead Lifecycle States

```
                    ┌──────────────────┐
                    │      nuevo       │  (Initial state)
                    │  Score: 0–2      │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │ contactado │  │    frio    │  │ dado_de_baja │
     │ Score: 2–3 │  │  (Dormant) │  │ (Unsubscribed│
     └─────┬──────┘  └────────────┘  │  /Churned)   │
           │                         └──────────────┘
           ▼
     ┌────────────┐
     │  cotizado   │
     │  Score: 3–4 │
     └─────┬──────┘
           │
           ▼
     ┌────────────┐
     │  ventado    │  (Conversion!)
     │  Score: 4–5 │
     └────────────┘
```

---

### 4.7 Epic E6: Email Composition & Template System

**Modules:** `PlantillasTab.jsx`, `PlantillasWhatsAppTab.jsx`, `EliteEmailEditor.jsx`, `emailTemplate.js`  
**Owner:** Frontend Team  
**Estimated Points:** 13

#### Description
Rich text email template editor powered by TipTap (ProseMirror), with live preview, variable insertion, and responsive HTML wrapping. Templates are categorized by type (marketing vs. operational) and support multi-language content.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E6-S1 | As a Media Buyer, I want a WYSIWYG editor to create email templates with rich formatting. | TipTap editor with bold, italic, links, images, lists, headings. Output as clean HTML. |
| E6-S2 | As a Media Buyer, I want to insert personalization variables (`{nombre}`, `{producto}`) into templates. | Variable picker UI. Variables rendered as styled tokens in editor. Replaced at send time. |
| E6-S3 | As a Media Buyer, I want my emails to render correctly in Gmail, Outlook, and Apple Mail. | XHTML 1.0 Transitional wrapper. Conditional MSO comments for Outlook. Table-based layout. 600px max width. |
| E6-S4 | As a system, WhatsApp message templates must be managed separately with character limits. | Dedicated `plantillas_whatsapp` table. Max 1024 characters. Variable support for personalization. |

#### Template Categories

| Type Slug | Display Name | Use Case |
|-----------|-------------|----------|
| `lead_primer_contacto` | Bienvenida | First touch after lead capture |
| `lead_seguimiento` | Seguimiento | Day 3–7 follow-up |
| `lead_reenganche` | Reenganche | Day 14+ re-engagement |
| `cotizacion` | Cotizacion | Quote delivery |
| `confirmacion` | Confirmacion | Booking/sale confirmation |
| `recordatorio` | Recordatorio | Pre-service reminder |
| `resena` | Resena | Post-service review request |

---

### 4.8 Epic E7: Analytics Dashboard & KPIs

**Modules:** `DashboardPage.jsx`, `RoiDashboard.jsx`, `FinanzasPage.jsx`  
**Owner:** Frontend Team  
**Estimated Points:** 13

#### Description
Real-time analytics dashboard providing actionable KPIs for lead management, sales performance, and financial forecasting. Includes trend charts, funnel visualization, and per-campaign ROAS breakdown.

#### Key Metrics

| Metric | Calculation | Source |
|--------|------------|--------|
| Leads Today | `COUNT(leads) WHERE created_at >= today` | leads table |
| Total Leads | `COUNT(leads)` | leads table |
| Win Rate | `ventado / (contactado + cotizado + ventado) * 100` | leads table |
| CPL (Cost Per Lead) | `monthly_ad_spend / leads_this_month` | inversion_marketing + leads |
| Speed-to-Lead | `AVG(time_to_respond_mins) WHERE responded_at IS NOT NULL AND time_to_respond_mins <= 300` | leads table |
| Sleeping Leads | `COUNT(leads) WHERE estado = 'nuevo' AND responded_at IS NULL` | leads table |
| Monthly Revenue | `SUM(ventas.precio_venta) WHERE month = current` | ventas table |
| ROAS | `revenue / ad_spend` | ventas + inversion_marketing |

#### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  KPI Cards Row                                       │
│  [Leads Hoy] [Total] [Ventas] [Ingresos] [Win Rate]│
├─────────────────────────────────────────────────────┤
│  6-Month Trend Chart (AreaChart)                     │
│  Lines: Ingresos, Costos, Utilidad                   │
├──────────────────────┬──────────────────────────────┤
│  Top Productos       │  Próximas Ventas             │
│  (Bar chart)         │  (Table: fecha, producto,    │
│                      │   cliente, pax)              │
├──────────────────────┴──────────────────────────────┤
│  Recent Leads (last 4)                               │
│  Speed-to-Lead metrics                               │
└─────────────────────────────────────────────────────┘
```

---

### 4.9 Epic E8: Multi-Tenant Workspace Management

**Modules:** `AuthContext.jsx`, `ConfiguracionPage.jsx`, `usePlan.js`  
**Owner:** Full-Stack Team  
**Estimated Points:** 21

#### Description
Complete workspace isolation with per-tenant configuration, email provider credentials, Meta integration tokens, branding, and subscription management. Auto-provisioning of new workspaces on user registration.

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E8-S1 | As a new user, I want a workspace automatically created when I sign up. | Auto-provisioning: new `agencias` record + `usuarios_agencia` link + trial subscription (14 days). Never reuses existing agencies. |
| E8-S2 | As an Agency Admin, I want to configure my agency's name, logo, and contact info. | `configuracion` key-value store: `nombre_visible`, `logo_url`, `color_marca`, `whatsapp`, `email_contacto`. |
| E8-S3 | As an Agency Admin, I want to connect my Meta Ads account via OAuth. | Meta OAuth flow: short-lived token → long-lived token exchange → page selection → store `meta_page_id` + `meta_page_access_token`. |
| E8-S4 | As an Agency Admin, I want to choose between Gmail and Resend as my email provider. | `proveedor_email` config key. Gmail: `gmail_app_password`. Resend: `resend_api_key`. Auto-detection fallback. |
| E8-S5 | As a system, all data queries must be scoped to the current user's agency. | Every Supabase query includes `.eq('agencia_id', agencia.id)`. RLS policies enforce at database level. |

#### Tenant Isolation Matrix

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Database | RLS policies on all tables | `agencia_id = auth.uid()'s agency` |
| API | JWT token carries user identity | Supabase Auth verifies per request |
| Edge Functions | IDOR check before service-role access | `usuarios_agencia` lookup validates ownership |
| Frontend | `useAuth()` provides `agencia.id` | All queries scoped by context |
| Email | Per-tenant SMTP/API credentials | Stored in `configuracion` table |
| Meta | Per-tenant page tokens | Stored in `configuracion` table |

---

### 4.10 Epic E9: Meta CAPI Conversion Loop

**Module:** `supabase/functions/send-meta-event/index.ts`  
**Owner:** Backend Team  
**Estimated Points:** 8

#### Description
Closes the ROAS measurement loop by sending server-side conversion events back to Meta's Conversions API when leads qualify or purchase. Enables Meta's algorithm to optimize ad delivery for actual business outcomes rather than just form fills.

#### Events

| Lead State Change | Meta Event | Custom Data |
|------------------|------------|-------------|
| `estado → contactado` | `QualifiedLead` | None |
| `estado → venta_cerrada` | `Purchase` | `{ value: SUM(ventas.precio_venta), currency: "USD" }` |

#### Privacy Compliance
- All PII (email, phone, name) hashed with SHA-256 before transmission.
- Token sent in `Authorization` header, never in URL query parameters.
- Only hashed identifiers sent — no raw PII leaves the system.

---

### 4.11 Epic E10: SaaS Subscription & Billing

**Modules:** `BillingPage.jsx`, `usePlan.js`, migration: `saas_plans_subscriptions`  
**Owner:** Full-Stack Team  
**Estimated Points:** 13

#### Description
Tiered subscription system with trial-to-paid conversion flow. Supports multiple payment providers (Stripe, PayPal, MercadoPago) and feature gating based on plan tier.

#### Plan Structure

| Feature | Trial (14 days) | Profesional | Enterprise |
|---------|-----------------|-------------|------------|
| Max Leads/month | 100 | Unlimited | Unlimited |
| Max Users | 1 | 5 | Unlimited |
| Meta CAPI | No | Yes | Yes |
| AI Lead Scoring | No | No | Yes |
| WhatsApp Integration | No | No | Yes |
| Price | Free | $49/month | Custom |

#### Subscription States

```
trial ──────▶ activa ──────▶ cancelada
  │              │
  │              ▼
  │           vencida
  │              │
  ▼              ▼
vencida      pendiente ──▶ activa (renewal)
```

#### Feature Gating
- `usePlan()` hook exposes `isActive`, `isTrial`, `isExpired`, `daysRemaining`.
- Expired subscriptions enter **read-only mode**: data visible but no create/update/delete operations.
- UI shows upgrade banner in sidebar when trial nears expiration.

---

### 4.12 Epic E11: Sales Pipeline & Voucher System

**Modules:** `VentasPage.jsx`, `useVentasData.js`, `PdfVoucher.jsx`  
**Owner:** Frontend Team  
**Estimated Points:** 13

#### Description
Sales management module for converting qualified leads into tracked sales. Includes itinerary builder (multi-product selection), inline table editing, PDF voucher generation, and a Communication Hub for direct WhatsApp/Email outreach.

#### Key Features
- Multi-product sale composition (from `productos` catalog)
- Optional extras/add-ons (from `extras` catalog)
- Advisor assignment (from `asesores` team)
- PDF voucher export via `html2pdf.js`
- Communication Hub: contextual WhatsApp and Email sending from sale context

---

### 4.13 Epic E12: WhatsApp Omnichannel Integration (Planned)

**Modules:** `pasos_secuencia.tipo_mensaje`, `plantillas_whatsapp`, `WaProductoSelectorModal`  
**Owner:** Backend Team  
**Estimated Points:** 21

#### Description
Extends the drip sequence engine to support WhatsApp message steps alongside email steps. Database schema is prepared (`tipo_mensaje` column, `whatsapp_template_name` field) but full WhatsApp Business API integration is pending.

#### Current State
- Schema: Ready (migration `whatsapp_omnichannel_prep`)
- Templates: CRUD UI complete (`PlantillasWhatsAppTab.jsx`)
- Sequence Steps: `tipo_mensaje` supports 'email' | 'whatsapp'
- Sending Engine: Not yet implemented (requires WhatsApp Business API or Cloud API integration)
- Workaround: `WaProductoSelectorModal` generates `wa.me` deep links for manual WhatsApp outreach

---

## 5. Data Model

### 5.1 Entity-Relationship Diagram (Conceptual)

```
┌──────────────┐         ┌──────────────────┐         ┌────────────────┐
│   agencias   │────────▶│ usuarios_agencia  │◀────────│  auth.users    │
│              │   1:N   │                  │   N:1   │  (Supabase)    │
│  id (PK)     │         │  usuario_id (FK) │         │                │
│  nombre      │         │  agencia_id (FK) │         │  id (PK)       │
│  plan        │         │  rol             │         │  email         │
└──────┬───────┘         └──────────────────┘         └────────────────┘
       │
       │ 1:N (agencia_id FK on all tables)
       │
       ├──────────────────────────────────────────────────────────┐
       │                                                          │
       ▼                                                          ▼
┌──────────────┐    N:M via leads_secuencias    ┌────────────────────────┐
│    leads     │◀──────────────────────────────▶│  secuencias_marketing  │
│              │                                │                        │
│  id (PK)     │         ┌──────────────────┐   │  id (PK)               │
│  agencia_id  │         │ leads_secuencias │   │  agencia_id            │
│  nombre      │         │                  │   │  nombre                │
│  email       │         │  lead_id (FK)    │   │  producto_match        │
│  telefono    │         │  secuencia_id(FK)│   │  activa                │
│  producto_   │         │  agencia_id (FK) │   └────────┬───────────────┘
│   interes    │         │  estado          │            │
│  estado      │         │  ultimo_paso_    │            │ 1:N
│  meta_lead_id│         │   ejecutado      │            ▼
│  campaign_   │         │  notas (JSONB)   │   ┌────────────────────────┐
│   name       │         └──────────────────┘   │   pasos_secuencia      │
│  lead_score  │                                │                        │
│  unsubscribed│                                │  id (PK)               │
│  email_      │                                │  secuencia_id (FK)     │
│   rebotado   │                                │  numero_paso           │
│  responded_at│                                │  dia_envio             │
│  time_to_    │                                │  asunto                │
│   respond_   │                                │  html_body             │
│   mins       │                                │  tipo_mensaje          │
└──────┬───────┘                                │  (email | whatsapp)    │
       │                                        └────────────────────────┘
       │ 1:N
       ▼
┌──────────────┐
│  email_log   │
│              │
│  id (PK)     │
│  lead_id (FK)│
│  paso_id(FK) │
│  secuencia_  │
│   id (FK)    │
│  estado      │
│  abierto_at  │
│  canal       │
│  (email|wa)  │
└──────────────┘

       ┌──────────────┐        ┌────────────────┐
       │configuracion │        │    productos    │
       │              │        │                 │
       │  agencia_id  │        │  id (PK)        │
       │  clave       │        │  agencia_id     │
       │  valor       │        │  nombre         │
       │              │        │  precio_usd     │
       │  (Key-Value  │        │  costo_operador │
       │   Store)     │        └────────┬────────┘
       └──────────────┘                 │
                                        │ N:M via venta_productos
       ┌──────────────┐                 │
       │   ventas     │◀────────────────┘
       │              │
       │  id (PK)     │        ┌────────────────┐
       │  agencia_id  │        │    extras       │
       │  lead_id     │        │                 │
       │  asesor_id   │        │  id (PK)        │
       │  precio_venta│        │  agencia_id     │
       └──────────────┘        │  nombre         │
                               └────────────────┘

       ┌──────────────┐        ┌────────────────┐
       │   planes     │        │  suscripciones │
       │              │        │                 │
       │  id (PK)     │───────▶│  id (PK)        │
       │  nombre      │  1:N   │  agencia_id(FK) │
       │  precio_     │        │  plan_id (FK)   │
       │   mensual    │        │  estado         │
       │  max_leads   │        │  trial_ends_at  │
       │  max_usuarios│        │  stripe_*       │
       │  features    │        │  paypal_*       │
       │   (JSONB)    │        │  mp_*           │
       └──────────────┘        └────────────────┘
```

### 5.2 Core Entities Specification

#### 5.2.1 `agencias` (Tenant)

The root entity for multi-tenancy. Every data record in the system belongs to exactly one agency.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique tenant identifier |
| `nombre` | TEXT | NOT NULL | Agency display name |
| `plan` | TEXT | — | Legacy plan field (superseded by `suscripciones`) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Registration timestamp |

#### 5.2.2 `leads` (Lead Record)

The central business entity. Represents a prospective customer captured from Meta Ads or manual entry.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Lead identifier |
| `agencia_id` | UUID | FK → agencias, NOT NULL | Tenant ownership |
| `nombre` | TEXT | — | Full name |
| `email` | TEXT | — | Email address (lowercase normalized) |
| `telefono` | TEXT | — | Phone number (digits only) |
| `producto_interes` | TEXT | — | Product the lead expressed interest in |
| `form_name` | TEXT | — | Name of the Meta Lead Form |
| `origen` | TEXT | — | Lead source (e.g., "Meta Ads", "Manual") |
| `plataforma` | TEXT | — | Capture platform ("facebook", "instagram") |
| `meta_lead_id` | TEXT | UNIQUE | Meta's lead identifier for deduplication |
| `idioma` | TEXT | — | Detected language ("es", "en") |
| `estado` | TEXT | — | Lifecycle state (nuevo/contactado/cotizado/ventado/frio/dado_de_baja) |
| `notas` | TEXT | — | Free-form notes |
| `unsubscribed` | BOOLEAN | — | Opted out of communications |
| `email_rebotado` | BOOLEAN | — | Email address confirmed invalid |
| `fecha_rebote` | TIMESTAMPTZ | — | Timestamp of bounce detection |
| `motivo_rebote` | TEXT | — | Bounce reason description |
| `campaign_name` | TEXT | — | Meta campaign attribution |
| `adset_name` | TEXT | — | Meta ad set attribution |
| `ad_name` | TEXT | — | Meta ad attribution |
| `responded_at` | TIMESTAMPTZ | — | First response timestamp |
| `time_to_respond_mins` | INTEGER | — | Minutes from creation to first response |
| `utm_campaign` | TEXT | — | UTM campaign parameter |
| `utm_source` | TEXT | — | UTM source parameter |
| `utm_medium` | TEXT | — | UTM medium parameter |
| `lead_score` | INTEGER | DEFAULT 0 | Computed engagement score (1–5) |
| `ultimo_contacto` | TIMESTAMPTZ | — | Last outbound contact timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Lead capture timestamp |
| `updated_at` | TIMESTAMPTZ | — | Last modification timestamp |

#### 5.2.3 `secuencias_marketing` (Drip Sequence Template)

Defines an automated email sequence. Each sequence targets a specific product (or is general-purpose) and contains ordered steps.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Sequence identifier |
| `agencia_id` | UUID | FK → agencias, NOT NULL | Tenant ownership |
| `nombre` | TEXT | — | Sequence display name |
| `descripcion` | TEXT | — | Description/purpose |
| `activa` | BOOLEAN | — | Enable/disable toggle |
| `producto_match` | TEXT | — | Product name filter for auto-enrollment (NULL = general) |
| `created_at` | TIMESTAMPTZ | — | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | — | Last modification |

#### 5.2.4 `pasos_secuencia` (Sequence Step)

An individual email/WhatsApp step within a drip sequence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Step identifier |
| `secuencia_id` | UUID | FK → secuencias_marketing, ON DELETE CASCADE | Parent sequence |
| `numero_paso` | INTEGER | — | Step order (1, 2, 3...) |
| `dia_envio` | INTEGER | — | Day to send (relative to enrollment date) |
| `asunto` | TEXT | — | Email subject line |
| `html_body` | TEXT | — | Email HTML content |
| `tipo_mensaje` | TEXT | DEFAULT 'email' | Channel: 'email' or 'whatsapp' |
| `whatsapp_template_name` | TEXT | — | WhatsApp template reference |
| `plantilla_email_id` | UUID | FK → plantillas_email | Linked email template |
| `created_at` | TIMESTAMPTZ | — | Creation timestamp |

#### 5.2.5 `leads_secuencias` (Enrollment Record)

Tracks the state of a lead's enrollment in a drip sequence. The junction table between leads and sequences with execution state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Enrollment identifier |
| `lead_id` | UUID | FK → leads, ON DELETE CASCADE | Enrolled lead |
| `secuencia_id` | UUID | FK → secuencias_marketing, ON DELETE CASCADE | Target sequence |
| `agencia_id` | UUID | FK → agencias, ON DELETE CASCADE | Tenant ownership |
| `estado` | TEXT | — | en_progreso / pausada / cancelada / completada |
| `ultimo_paso_ejecutado` | INTEGER | DEFAULT 0 | Last successfully sent step number |
| `notas` | JSONB | DEFAULT '{}' | Metadata (soft_retries counter, error logs) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Enrollment timestamp |
| `updated_at` | TIMESTAMPTZ | — | Last state change |

#### 5.2.6 `email_log` (Email Audit Trail)

Immutable log of every email sent, opened, or bounced. Powers deliverability analytics and the unified timeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Log entry (used as tracking pixel ID) |
| `lead_id` | UUID | FK → leads, ON DELETE CASCADE | Recipient lead |
| `paso_id` | UUID | FK → pasos_secuencia | Source step (NULL for manual sends) |
| `secuencia_id` | UUID | FK → secuencias_marketing | Source sequence (NULL for manual) |
| `email_enviado` | TEXT | — | Recipient email address |
| `estado` | TEXT | — | enviado / abierto / rebotado / fallido |
| `abierto_at` | TIMESTAMPTZ | — | First open timestamp (via tracking pixel) |
| `tipo` | TEXT | — | manual / secuencia / bounce |
| `asunto` | TEXT | — | Email subject |
| `cuerpo` | TEXT | — | Email body or bounce data |
| `canal` | TEXT | DEFAULT 'email' | Channel: 'email' or 'whatsapp' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Send timestamp |

#### 5.2.7 `configuracion` (Tenant Configuration Store)

Key-value store for per-agency configuration. Avoids schema changes for new settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `agencia_id` | UUID | FK → agencias | Tenant owner |
| `clave` | TEXT | — | Configuration key |
| `valor` | TEXT | — | Configuration value |

**Standard Keys:**

| Key | Purpose | Example Value |
|-----|---------|---------------|
| `nombre_visible` | Display name in emails | "Travel Adventures Peru" |
| `logo_url` | Agency logo URL | "https://..." |
| `color_marca` | Brand primary color | "#FF6B00" |
| `whatsapp` | Agency WhatsApp number | "+51999888777" |
| `email_contacto` | Contact email | "info@agency.com" |
| `nombre_remitente` | Email "From" name | "Maria Rodriguez" |
| `proveedor_email` | Email provider | "gmail" or "resend" |
| `gmail_app_password` | Gmail App Password | "xxxx xxxx xxxx xxxx" |
| `resend_api_key` | Resend API key | "re_..." |
| `email_remitente` | Sender email address | "maria@agency.com" |
| `meta_page_id` | Meta Page ID | "123456789" |
| `meta_page_access_token` | Meta Page Token | "EAA..." |
| `meta_verify_token` | Webhook verify token | "sellvende_..." |
| `meta_pixel_id` | Meta Pixel ID | "987654321" |
| `meta_capi_token` | CAPI System User Token | "EAA..." |
| `master_sequence_switch` | Global drip toggle | "true" or "false" |

#### 5.2.8 `suscripciones` (Subscription)

Tracks the SaaS subscription state for each agency. One-to-one relationship with `agencias`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Subscription identifier |
| `agencia_id` | UUID | FK → agencias, UNIQUE, ON DELETE CASCADE | One sub per agency |
| `plan_id` | UUID | FK → planes | Subscribed plan tier |
| `estado` | TEXT | CHECK (trial/activa/cancelada/vencida/pendiente) | Subscription state |
| `fecha_inicio` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Start date |
| `fecha_fin` | TIMESTAMPTZ | — | End date (NULL = ongoing) |
| `trial_ends_at` | TIMESTAMPTZ | — | Trial expiration |
| `stripe_customer_id` | TEXT | — | Stripe customer ref |
| `stripe_subscription_id` | TEXT | — | Stripe subscription ref |
| `paypal_subscription_id` | TEXT | — | PayPal subscription ref |
| `mp_subscription_id` | TEXT | — | MercadoPago subscription ref |
| `metodo_pago` | TEXT | CHECK (stripe/paypal/mercadopago/NULL) | Payment method |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Record creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Last update |

### 5.3 Database Functions (RPCs)

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `get_leads_page` | agencia_id, page, per_page, filters... | TABLE(rows, total_count) | Server-side paginated lead retrieval with multi-criteria filtering |
| `get_filtered_lead_ids` | agencia_id, estado, form_name, search, date_from, date_to | TABLE(id UUID) | Filtered lead ID set for bulk operations and export |
| `mass_enroll_sequence` | p_lead_ids UUID[], p_sequence_id UUID | void | Atomic bulk sequence enrollment with dedup |
| `try_advisory_lock` | lock_key BIGINT | BOOLEAN | Non-blocking PostgreSQL advisory lock acquisition |
| `release_advisory_lock` | lock_key BIGINT | BOOLEAN | Advisory lock release |
| `refreshKpis` | agencia_id | JSON | Aggregate KPI calculation for dashboard |
| `refreshEmailCounts` | lead_ids UUID[] | JSON | Email count aggregation per lead |

---

## 6. Non-Functional Requirements

### 6.1 Security Requirements

#### 6.1.1 Authentication & Authorization

| Requirement | Implementation | Priority |
|-------------|---------------|----------|
| User authentication | Supabase Auth (email/password + Google OAuth) | P0 |
| Session management | JWT tokens with automatic refresh | P0 |
| Multi-tenant isolation | RLS policies on all data tables filtering by `agencia_id` | P0 |
| IDOR prevention | Edge Functions verify user→agency ownership before service-role access | P0 |
| Role-based access | `usuarios_agencia.rol` field (admin, member) | P1 |
| Password policy | Supabase Auth defaults (8+ characters) | P1 |

#### 6.1.2 Input Validation & Sanitization

| Attack Vector | Mitigation | Location |
|--------------|-----------|----------|
| XSS (Cross-Site Scripting) | `escapeHtml()` on all lead data before template injection | process-drips, meta-webhook |
| CSV Injection | Strip formula characters (`=`, `+`, `-`, `@`) from field starts | meta-webhook |
| SQL Injection | Supabase client uses parameterized queries (never raw SQL) | All frontend + Edge Functions |
| HTML Injection in emails | `cleanHtmlForEmail()` sanitizes all template content | emailTemplate.js |
| Webhook Spoofing | HMAC-SHA256 signature verification on all webhook endpoints | meta-webhook, handle-bounce |
| Token Forgery | HMAC-SHA256 signed unsubscribe tokens | unsubscribe |
| Payload Bombing | 1MB payload limit + 50-change batch limit on webhook | meta-webhook |

#### 6.1.3 Data Protection

| Requirement | Implementation |
|-------------|---------------|
| PII hashing for Meta CAPI | SHA-256 hash of email, phone, name before transmission |
| Email credentials isolation | Stored in `configuracion` table, only accessed by Edge Functions with service role |
| Tenant data isolation | RLS policies + application-level `agencia_id` scoping |
| Unsubscribe compliance | RFC 2369 `List-Unsubscribe` header in every email + one-click unsubscribe endpoint |
| Bounce data handling | Bounce notifications processed server-side, never exposed to other tenants |

#### 6.1.4 Cryptographic Standards

| Purpose | Algorithm | Key Source |
|---------|----------|-----------|
| Webhook signature verification (Meta) | HMAC-SHA256 | `META_APP_SECRET` environment variable |
| Bounce webhook verification (Resend) | HMAC-SHA256 (Svix) | `RESEND_WEBHOOK_SECRET` environment variable |
| Unsubscribe token generation | HMAC-SHA256 | Supabase service role key (first 32 chars of base64) |
| Meta CAPI PII hashing | SHA-256 | N/A (one-way hash) |
| Drip concurrency lock | PostgreSQL pg_advisory_lock | Fixed key: 111222333 |

### 6.2 Performance Requirements

| Metric | Target | Current Architecture Support |
|--------|--------|------------------------------|
| Webhook processing latency | < 2 seconds | Edge Function cold start < 500ms + Meta API call |
| Page load time (leads table) | < 1.5 seconds | Server-side pagination (50 records/page) via RPC |
| Realtime update propagation | < 500ms | Supabase Realtime WebSocket |
| Drip engine cycle time | < 5 minutes for 100 leads | Parallel agency processing + sequential lead sends |
| Dashboard query time | < 3 seconds | Parallel Promise.all() for 10+ queries |
| Email send throughput (Gmail) | ~50 emails/min | 1.2s inter-email delay, connection pooling |
| Email send throughput (Resend) | ~500 emails/min | No rate limiting on API |
| Concurrent WebSocket connections | 10,000+ | Supabase Realtime infrastructure |

### 6.3 Scalability Considerations

#### Horizontal Scaling Points

| Component | Current Limit | Scaling Strategy |
|-----------|--------------|-----------------|
| Edge Functions | Auto-scaling (Supabase managed) | No action needed |
| Database connections | Supabase pooler (PgBouncer) | Connection pooling + prepared statements |
| Realtime channels | 1 channel per agency | Channel-per-tenant prevents cross-talk |
| Drip engine batch size | 100 leads/cycle | Increase limit + add pagination across cycles |
| Email sending | Provider rate limits (Gmail: 500/day, Resend: varies by plan) | Dedicated IP / higher-tier Resend plan |

#### Data Growth Projections

| Table | Growth Rate (per tenant/month) | Retention Strategy |
|-------|-------------------------------|-------------------|
| leads | 100–5,000 records | Archive leads older than 12 months |
| email_log | 500–25,000 records | Aggregate stats, archive raw logs > 6 months |
| leads_secuencias | 100–5,000 records | Clean up completed/cancelled enrollments |

### 6.4 Reliability Requirements

| Requirement | Implementation |
|-------------|---------------|
| Idempotent webhook processing | `meta_lead_id` deduplication prevents duplicate records from Meta retries |
| Fail-safe drip engine | Advisory lock prevents concurrent execution. Poison pill guard stops infinite retries after 5 soft failures. |
| Silent failure handling | Webhook always returns 200 to Meta (prevents retry storms). Errors logged internally. |
| Agency-level fault isolation | One agency's auth failure doesn't crash processing for other agencies (`Promise.allSettled`). |
| Graceful degradation | Frontend shows skeleton loaders during load. Error boundaries catch React crashes. Retry buttons on failed queries. |
| Data integrity | Foreign keys with ON DELETE CASCADE prevent orphaned records. RPC functions use SECURITY DEFINER for atomic operations. |

### 6.5 Observability Requirements

| Layer | Mechanism |
|-------|-----------|
| Email delivery tracking | `email_log` table with estado (enviado/abierto/rebotado/fallido) |
| Open rate tracking | 1x1 pixel endpoint (`track-open`) updates `abierto_at` |
| Bounce monitoring | Dual-layer: provider webhook + IMAP radar |
| Lead lifecycle audit | `ActivityPage.jsx` displays chronological event log |
| Drip engine health | Master switch status + cron status + auto-enrollment counts displayed in Marketing page |
| Speed-to-Lead | `responded_at` and `time_to_respond_mins` fields on leads table |

---

## 7. Implementation Roadmap

### 7.1 Phase Overview

```
Phase 1                Phase 2              Phase 3              Phase 4              Phase 5
Foundation &           Automation           Multi-Tenant &       Intelligence &       SaaS
Data Ingestion         Engine               Deliverability       Attribution          Monetization
━━━━━━━━━━━━━━━       ━━━━━━━━━━━━━━━      ━━━━━━━━━━━━━━━     ━━━━━━━━━━━━━━━     ━━━━━━━━━━━━━━━
Sprint 1-4             Sprint 5-8           Sprint 9-12          Sprint 13-16         Sprint 17-20
(8 weeks)              (8 weeks)            (8 weeks)            (8 weeks)            (8 weeks)
```

---

### 7.2 Phase 1: Foundation & Data Ingestion (Sprints 1–4)

**Objective:** Establish core infrastructure, authentication, and the lead ingestion pipeline from Meta Ads to database.

**Exit Criteria:** A Media Buyer can connect their Meta Ads account, receive leads in real-time via webhook, and view them in a paginated table.

#### Sprint 1: Infrastructure & Authentication (Week 1–2)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Supabase project setup (database, auth, Edge Functions) | DevOps | 3 | Running Supabase instance |
| Database schema: `agencias`, `usuarios_agencia`, `configuracion` | Backend | 5 | Migration files, RLS policies |
| React SPA scaffold (Vite + React Router + Tailwind) | Frontend | 3 | Running dev server with routing |
| `AuthContext.jsx`: login, signup, Google OAuth | Frontend | 8 | Complete auth flow with auto-provisioning |
| `Layout.jsx`: responsive sidebar, navigation, user profile | Frontend | 5 | App shell with all nav items |
| `LoginPage.jsx` + `ResetPasswordPage.jsx` | Frontend | 3 | Public auth pages |

#### Sprint 2: Lead Data Model & Meta Integration (Week 3–4)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Database schema: `leads` table with all columns | Backend | 5 | Migration with indexes |
| `meta-oauth` Edge Function | Backend | 5 | Token exchange flow |
| `meta-webhook` Edge Function (GET verification + POST ingestion) | Backend | 13 | Webhook receiving and processing leads |
| `ConfiguracionPage.jsx`: AgenciaTab + IntegracionesTab | Frontend | 8 | Meta connection UI |
| Webhook signature verification (HMAC-SHA256) | Backend | 3 | Security layer |
| Input sanitization (XSS + CSV injection) | Backend | 2 | Security layer |

#### Sprint 3: Lead CRM Interface (Week 5–6)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `get_leads_page` RPC (server-side pagination) | Backend | 5 | Paginated lead queries |
| `useMetaSync` hook (lead loading, pagination, filters) | Frontend | 8 | Data management layer |
| `LeadsTableView.jsx` with sorting, selection, badges | Frontend | 8 | Table UI |
| `LeadFormModal.jsx` (create/edit leads) | Frontend | 5 | CRUD modal |
| `LeadDetailPanel.jsx` (lead info + timeline) | Frontend | 8 | Detail side panel |
| Lead score algorithm + cold level indicators | Frontend | 3 | Visual indicators |

#### Sprint 4: Real-Time Sync & Bulk Import (Week 7–8)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Supabase Realtime WebSocket subscription | Frontend | 5 | Live lead updates |
| Smart buffering (inject vs. badge notification) | Frontend | 3 | UX for filtered views |
| `sync-leads` Edge Function (bulk Meta import) | Backend | 8 | Manual sync button |
| Deduplication logic (multi-layer: meta_lead_id, email, phone) | Backend | 5 | Zero duplicates |
| `LeadsKanbanView.jsx` with drag-drop status change | Frontend | 8 | Kanban board |
| 30-minute polling fallback safety net | Frontend | 2 | Reliability layer |

---

### 7.3 Phase 2: Automation Engine (Sprints 5–8)

**Objective:** Build the drip sequence engine, email template system, and composition tools.

**Exit Criteria:** A Media Buyer can create a drip sequence with 5 email steps, connect it to a product, and have emails automatically sent to enrolled leads on the correct days.

#### Sprint 5: Sequence & Template Data Model (Week 9–10)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Database schema: `secuencias_marketing`, `pasos_secuencia`, `plantillas_email` | Backend | 5 | Migration files |
| Database schema: `leads_secuencias`, `email_log` | Backend | 5 | Enrollment + audit tables |
| Sequence CRUD API (Supabase queries) | Backend | 3 | Data access layer |
| `MarketingPage.jsx`: SecuenciasTab (sequence builder UI) | Frontend | 13 | Sequence editor with step management |
| `PlantillasTab.jsx`: email template CRUD | Frontend | 8 | Template management UI |
| `EliteEmailEditor.jsx`: TipTap rich text editor | Frontend | 8 | WYSIWYG email editor |

#### Sprint 6: Drip Engine Core (Week 11–12)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `process-drips` Edge Function: core execution loop | Backend | 21 | Email automation engine |
| Advisory lock mechanism (`try_advisory_lock` / `release_advisory_lock`) | Backend | 3 | Concurrency protection |
| Template variable substitution engine | Backend | 5 | Personalization |
| `wrapEmailTemplate()`: Outlook-proof HTML wrapper | Backend | 8 | Email rendering pipeline |
| Gmail SMTP provider (Nodemailer) | Backend | 5 | Gmail sending |
| Resend API provider | Backend | 3 | Resend sending |
| Master switch (`master_sequence_switch`) | Backend | 2 | Global toggle |

#### Sprint 7: Email Sending & Tracking (Week 13–14)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `resend-email` Edge Function (individual email API) | Backend | 8 | Manual email sending |
| `track-open` Edge Function (pixel tracking) | Backend | 2 | Open rate tracking |
| `unsubscribe` Edge Function (HMAC-signed one-click) | Backend | 5 | Compliance |
| `useLeadEmail` hook (email composition + sending) | Frontend | 8 | Frontend email logic |
| `IndividualEmailModal.jsx` + `MassEmailModal.jsx` | Frontend | 8 | Email send modals |
| Email log timeline in `LeadDetailPanel.jsx` | Frontend | 5 | Unified timeline |

#### Sprint 8: Auto-Enrollment & Bulk Operations (Week 15–16)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Auto-enrollment in `meta-webhook` (product matching) | Backend | 5 | Smart routing |
| Auto-enrollment in `sync-leads` (bulk import routing) | Backend | 3 | Batch routing |
| `mass_enroll_sequence` RPC (atomic bulk enrollment) | Backend | 5 | Bulk operations |
| `useLeadSequences` hook (assignment, force-next, stop) | Frontend | 8 | Sequence management |
| `MassSequenceModal.jsx` with product mismatch warning | Frontend | 5 | Bulk enrollment UI |
| New lead notification email (instant admin alert) | Backend | 3 | Alert system |

---

### 7.4 Phase 3: Multi-Tenant & Deliverability (Sprints 9–12)

**Objective:** Harden multi-tenant isolation, implement bounce detection, and ensure email deliverability at scale.

**Exit Criteria:** Multiple agencies can operate in complete isolation. Bounced emails are detected within 60 seconds and trigger automatic sequence cancellation.

#### Sprint 9: Multi-Tenant Hardening (Week 17–18)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| RLS policies on all data tables | Backend | 8 | Database-level isolation |
| IDOR prevention in all Edge Functions | Backend | 5 | Application-level checks |
| Per-tenant email provider configuration | Backend | 5 | Gmail/Resend per agency |
| Per-tenant Meta credentials | Backend | 3 | Page tokens per agency |
| Multi-tenant parallel processing in `process-drips` | Backend | 5 | Agency-level parallelism |
| Tenant isolation integration tests | QA | 8 | Verification suite |

#### Sprint 10: Bounce Detection — Provider Webhooks (Week 19–20)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `handle-bounce` Edge Function (Resend webhook) | Backend | 8 | Webhook bounce processing |
| Svix HMAC-SHA256 signature verification | Backend | 3 | Webhook security |
| Hard bounce → `correo_falso` + cancel sequences | Backend | 5 | Auto-kill protocol |
| Soft bounce → pause sequences | Backend | 3 | Graceful degradation |
| Bounce logging in `email_log` | Backend | 2 | Audit trail |
| Bounce UI indicators in lead table | Frontend | 3 | Visual feedback |

#### Sprint 11: Bounce Detection — IMAP Radar (Week 21–22)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `imap-bounce-radar` Edge Function | Backend | 13 | IMAP bounce scanning |
| ImapFlow integration (Gmail IMAP) | Backend | 5 | IMAP client |
| Message-ID UUID extraction for lead matching | Backend | 3 | Correlation logic |
| Bounce regex classification (hard vs. soft) | Backend | 3 | Pattern matching |
| Cron scheduling for IMAP radar | DevOps | 2 | Automated scanning |
| Anti-spam guard (8h cooldown between emails) | Backend | 2 | Deliverability protection |

#### Sprint 12: Email Compliance & Poison Pill Guard (Week 23–24)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| RFC 2369 headers (List-Unsubscribe, Precedence) | Backend | 3 | Email compliance |
| Poison pill guard (5 soft retries → pause) | Backend | 3 | Infinite loop prevention |
| Agency-level fault isolation (`Promise.allSettled`) | Backend | 3 | Resilience |
| Gmail rate limiting (1.2s delay, connection pooling) | Backend | 2 | Rate control |
| Deliverability dashboard (open rates, bounce rates) | Frontend | 8 | Analytics |
| WhatsApp template management (`PlantillasWhatsAppTab.jsx`) | Frontend | 5 | Template UI |

---

### 7.5 Phase 4: Intelligence & Attribution (Sprints 13–16)

**Objective:** Close the ROAS measurement loop with Meta CAPI, build analytics dashboards, and implement lead scoring.

**Exit Criteria:** Purchase events flow back to Meta in real-time. Dashboard shows CPL, win rate, ROAS, and speed-to-lead metrics.

#### Sprint 13: Meta CAPI Integration (Week 25–26)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `send-meta-event` Edge Function | Backend | 8 | Conversion event API |
| SHA-256 PII hashing (email, phone, name) | Backend | 2 | Privacy compliance |
| Database webhook trigger on `leads.estado` change | Backend | 3 | Event source |
| Purchase value lookup from `ventas` table | Backend | 3 | Revenue attribution |
| Meta Pixel ID + CAPI token configuration | Frontend | 3 | Setup UI |

#### Sprint 14: Analytics Dashboard (Week 27–28)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `DashboardPage.jsx`: KPI cards + trend charts | Frontend | 13 | Main dashboard |
| Parallel query architecture (Promise.all) | Frontend | 3 | Performance optimization |
| Speed-to-Lead metrics (responded_at, time_to_respond_mins) | Backend + Frontend | 5 | Response time tracking |
| Sleeping leads detection | Frontend | 2 | Uncontacted lead alerts |
| `RoiDashboard.jsx`: per-campaign ROAS breakdown | Frontend | 8 | ROI analysis |
| ROAS investment tracking table | Frontend | 5 | Ad spend input |

#### Sprint 15: Sales Pipeline (Week 29–30)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Database schema: `ventas`, `venta_productos`, `venta_extras`, `asesores` | Backend | 5 | Sales data model |
| `VentasPage.jsx`: sale creation, inline editing | Frontend | 13 | Sales management UI |
| `useVentasData` hook | Frontend | 8 | Sales data layer |
| `PdfVoucher.jsx` + `html2pdf.js` integration | Frontend | 5 | PDF export |
| Communication Hub modal (WhatsApp + Email) | Frontend | 5 | Outreach tools |
| `FinanzasPage.jsx`: financial projections | Frontend | 8 | Forecasting |

#### Sprint 16: Extended Features (Week 31–32)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `CalendarioPage.jsx`: calendar view | Frontend | 5 | Date-based view |
| `ActivityPage.jsx`: audit trail | Frontend | 8 | Activity log |
| `ProductosPage.jsx` + `ExtrasPage.jsx` + `DescuentosPage.jsx` | Frontend | 8 | Catalog management |
| `AsesoresPage.jsx`: advisor management | Frontend | 3 | Team management |
| Command Palette (global search) | Frontend | 5 | Keyboard productivity |
| Lead score refinement + persistence | Backend + Frontend | 3 | Scoring improvements |

---

### 7.6 Phase 5: SaaS Monetization (Sprints 17–20)

**Objective:** Implement subscription tiers, billing integration, and feature gating to monetize the platform.

**Exit Criteria:** New users start a 14-day trial. Subscription management with Stripe/PayPal/MercadoPago. Expired accounts enter read-only mode.

#### Sprint 17: Plans & Subscriptions (Week 33–34)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Database schema: `planes`, `suscripciones` | Backend | 5 | Subscription data model |
| `usePlan` hook: trial/active/expired state machine | Frontend | 5 | Subscription state |
| Auto-trial provisioning (14 days on signup) | Backend | 3 | Onboarding flow |
| Feature gating based on `planes.features` JSONB | Frontend | 5 | Access control |
| Read-only mode for expired subscriptions | Frontend | 5 | Graceful degradation |
| Plan badge + trial countdown in sidebar | Frontend | 3 | UX indicators |

#### Sprint 18: Payment Integration (Week 35–36)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| Stripe integration (checkout, portal, webhooks) | Backend | 13 | Stripe billing |
| PayPal integration | Backend | 8 | PayPal billing |
| MercadoPago integration (LATAM payments) | Backend | 8 | LATAM billing |
| `BillingPage.jsx`: plan comparison, upgrade flow | Frontend | 8 | Billing UI |
| Subscription lifecycle webhooks (renewal, cancellation) | Backend | 5 | Automated state management |

#### Sprint 19: Data Management & Backup (Week 37–38)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| `BackupTab.jsx`: data export (CSV/JSON) | Frontend | 5 | Data portability |
| `SeedTab.jsx`: demo data generation | Frontend | 3 | Development tooling |
| Data retention policies (archive old leads/logs) | Backend | 5 | Storage optimization |
| Account deletion flow (GDPR compliance) | Backend | 5 | Privacy compliance |

#### Sprint 20: WhatsApp Omnichannel & Polish (Week 39–40)

| Task | Owner | Points | Deliverable |
|------|-------|--------|-------------|
| WhatsApp Business API / Cloud API integration | Backend | 21 | WhatsApp sending engine |
| WhatsApp steps in drip sequences (`tipo_mensaje = 'whatsapp'`) | Backend | 8 | Omnichannel automation |
| Performance optimization & load testing | DevOps | 5 | Performance validation |
| Security audit (OWASP Top 10 review) | Security | 8 | Security hardening |
| Documentation & API reference | Engineering | 5 | Knowledge base |
| End-to-end QA & regression testing | QA | 8 | Release readiness |

---

### 7.7 Total Effort Summary

| Phase | Sprints | Duration | Story Points | Key Deliverable |
|-------|---------|----------|-------------|-----------------|
| Phase 1: Foundation | 1–4 | 8 weeks | ~145 pts | Lead ingestion pipeline + CRM UI |
| Phase 2: Automation | 5–8 | 8 weeks | ~155 pts | Drip sequence engine + email system |
| Phase 3: Multi-Tenant | 9–12 | 8 weeks | ~110 pts | Tenant isolation + bounce management |
| Phase 4: Intelligence | 13–16 | 8 weeks | ~130 pts | CAPI loop + analytics + sales pipeline |
| Phase 5: SaaS | 17–20 | 8 weeks | ~135 pts | Subscriptions + billing + WhatsApp |
| **TOTAL** | **20 sprints** | **40 weeks** | **~675 pts** | **Production-ready SaaS platform** |

**Recommended Team Composition (10 Engineers):**

| Role | Count | Responsibility |
|------|-------|---------------|
| Tech Lead / Architect | 1 | Architecture decisions, code review, cross-team coordination |
| Senior Backend Engineer | 2 | Edge Functions, database design, security, integrations |
| Senior Frontend Engineer | 2 | React components, hooks, state management, UX |
| Mid-Level Full-Stack Engineer | 2 | Feature development across stack |
| DevOps / Infrastructure | 1 | Supabase configuration, CI/CD, monitoring, cron management |
| QA Engineer | 1 | Test strategy, integration tests, regression testing |
| Product Designer | 1 | UI/UX design, user research, design system |

---

## 8. Appendices

### 8.1 Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend Framework | React | 19.2.0 | UI components |
| Routing | React Router | 7.13.1 | Client-side routing |
| Build Tool | Vite | 7.3.1 | Development & bundling |
| Styling | Tailwind CSS | 4.1.4 | Utility-first CSS |
| Icons | Lucide React | 1.7.0 | Icon library |
| Charts | Recharts | 3.8.0 | Data visualization |
| Rich Text Editor | TipTap | 3.21.0 | Email template editor |
| PDF Generation | html2pdf.js | 0.14.0 | Voucher export |
| OCR | Tesseract.js | 7.0.0 | Document scanning |
| QR Codes | qrcode.react | 4.2.0 | QR generation |
| Code Editor | Monaco Editor | 4.7.0 | Template code view |
| Backend | Supabase | — | BaaS (auth, DB, storage, functions) |
| Database | PostgreSQL | 15 | Primary data store |
| Edge Functions | Deno | — | Serverless compute |
| Email (SMTP) | Nodemailer | — | Gmail SMTP sending |
| Email (API) | Resend | — | Transactional email API |
| Hosting | Vercel | — | CDN + SPA deployment |
| Meta Integration | Graph API | v19.0 | Lead forms, CAPI, OAuth |

### 8.2 Environment Variables

| Variable | Required | Scope | Description |
|----------|---------|-------|-------------|
| `VITE_SUPABASE_URL` | Yes | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Frontend | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Edge Functions | Service role key (admin access) |
| `META_APP_SECRET` | Yes | meta-webhook | HMAC verification secret |
| `META_APP_ID` | Yes | meta-oauth | Meta App ID |
| `META_APP_SECRET_OAUTH` | Yes | meta-oauth | Meta App Secret |
| `RESEND_WEBHOOK_SECRET` | Yes | handle-bounce | Svix webhook signing secret |
| `ALLOWED_ORIGIN` | No | Edge Functions | CORS origin whitelist |

### 8.3 API Endpoint Inventory

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/functions/v1/meta-webhook` | GET | Verify Token | Meta webhook subscription verification |
| `/functions/v1/meta-webhook` | POST | HMAC-SHA256 | Lead ingestion from Meta |
| `/functions/v1/meta-oauth` | POST | CORS | Meta OAuth token exchange |
| `/functions/v1/sync-leads` | POST | JWT + RLS | Bulk lead import from Meta |
| `/functions/v1/process-drips` | POST | JWT / Service Role | Execute pending drip sequence steps |
| `/functions/v1/resend-email` | POST | JWT + RLS | Send individual email |
| `/functions/v1/handle-bounce` | POST | Svix HMAC | Process bounce webhook from Resend |
| `/functions/v1/track-open` | GET | None (public) | Email open tracking pixel |
| `/functions/v1/unsubscribe` | GET | HMAC Token | One-click email unsubscribe |
| `/functions/v1/imap-bounce-radar` | POST/GET | None (cron) | IMAP bounce scanning |
| `/functions/v1/send-meta-event` | POST | DB Webhook | Meta CAPI conversion events |

### 8.4 Glossary

| Term | Definition |
|------|-----------|
| **Agencia** | A tenant/workspace in the multi-tenant system. Each agency has its own leads, sequences, and configuration. |
| **Lead** | A prospective customer captured from Meta Ads or manual entry. |
| **Secuencia** | A drip sequence — an ordered series of email/WhatsApp steps triggered by time delay after enrollment. |
| **Paso** | An individual step within a drip sequence (e.g., "Day 3: Send follow-up email"). |
| **Enrollment** | The act of assigning a lead to a drip sequence (`leads_secuencias` record). |
| **Producto** | A product or service offered by the agency. |
| **Venta** | A closed sale/booking associated with a lead. |
| **CAPI** | Meta Conversions API — server-to-server event reporting for ad optimization. |
| **RLS** | Row-Level Security — PostgreSQL mechanism enforcing data access at the database level. |
| **Advisory Lock** | PostgreSQL lightweight lock mechanism used to prevent concurrent drip engine execution. |
| **ROAS** | Return on Ad Spend — revenue generated per dollar spent on advertising. |
| **CPL** | Cost Per Lead — advertising cost divided by number of leads captured. |
| **Speed-to-Lead** | Time elapsed between lead capture and first outbound contact. |
| **Poison Pill Guard** | Safety mechanism that pauses a sequence after 5 consecutive soft delivery failures. |
| **Motor** | The drip sequence engine (colloquial term used in the UI: "Motor de Secuencias"). |

---

*This document was reverse-engineered from the production Sellvende Leads codebase (commit `b4c6673`) and represents the complete system as of April 2026. It serves as both a historical record and a forward-looking blueprint for team onboarding, investor due diligence, and architectural governance.*

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-04-11 | Engineering Division | Initial reverse-engineering from production codebase |
| 2.0.0 | 2026-04-11 | Engineering Division | Complete PRD with all epics, data model, and 20-sprint roadmap |
