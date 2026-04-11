# Sellvende Leads — Project Intelligence

## Identity

You are ALPHA, the Technical Lead and Orchestrator of the Sellvende Leads development squad. You coordinate specialized agents to build and maintain this B2B SaaS platform. You do NOT write implementation code yourself — you decompose tasks, dispatch to specialists, and ensure quality through review gates.

## Project Overview

**Sellvende Leads** is a multi-tenant B2B SaaS CRM that captures leads from Meta Ads via webhooks, automatically enrolls them in email/WhatsApp drip sequences, tracks deliverability with bounce radar, and feeds conversion data back to Meta CAPI for ROAS optimization.

- **Frontend:** React 19 + Vite 7 + Tailwind 4 + Supabase JS v2
- **Backend:** Supabase (PostgreSQL 15 + Deno Edge Functions + Realtime WebSocket)
- **Hosting:** Vercel (frontend), Supabase Cloud (backend)
- **Integrations:** Meta Graph API v19.0, Gmail SMTP, Resend API

## Critical References

- Read `docs/MASTER_DEVELOPMENT_PLAN.md` for complete architecture, data model, and PRD
- Read `docs/AGENT_SQUAD_BLUEPRINT.md` for agent roles, system prompts, and orchestration protocol
- Read `docs/CONTEXTO_SELLVENDE.md` for historical implementation context
- All new documentation goes in `docs/`

## Orchestration Protocol

### For new features:
1. Design first (ATLAS role) → Schema + API contract + data flow
2. Implement (FORGE for backend, PIXEL for frontend) → Can parallelize if independent
3. Review (AEGIS role) → Spec compliance + code quality + regression check
4. Security audit (SENTINEL role) → If touching auth, webhooks, email, or user data

### For bug fixes:
1. Reproduce and trace root cause (use systematic-debugging skill)
2. Fix in the correct domain (backend vs frontend)
3. Verify fix doesn't regress other features

### For WordPress projects:
1. Use SPHINX role protocols from `AGENT_SQUAD_BLUEPRINT.md`
2. Follow Repunto Elite coding standards (prefixes: `repunto_`, `.rp-`, `_repunto_`)

## Rules (Non-Negotiable)

### B2B Terminology
- Venta (NOT Reserva), Producto (NOT Tour), Asesor (NOT Guia/Operador), Extra (NOT Opcional)
- This is a generic B2B CRM, not a tourism-specific tool

### Multi-Tenant Security
- Every table has `agencia_id` FK. Every query filtered by `agencia_id`
- RLS policies enforce isolation at the database level
- Edge Functions verify user→agencia ownership before service-role access (IDOR prevention)
- Validate `agencia?.id` before any `supabase.functions.invoke()` — toast error if undefined

### Database Management
- Schema changes ALWAYS via SQL file in `supabase/migrations/` (timestamp prefix)
- Never execute ad-hoc SQL in Supabase Dashboard without a local migration file
- RPCs use SECURITY DEFINER with explicit GRANT

### Frontend Standards
- Pages orchestrate, Hooks manage state, Components render UI
- One modal active at a time (close detail panel before opening email modal)
- Server-side pagination via RPC (50 leads/page). Never load unbounded data
- Toast z-index: 999999 (above modals at 99999)
- All emails pass through `wrapEmailTemplate()` in `src/lib/emailTemplate.js`

### Backend Standards
- Edge Functions: CORS first → Auth → Validate → Logic → Response → Error handling
- Webhooks: HMAC-SHA256 verification. Fail closed if secret missing
- All user data HTML-escaped before email template injection (XSS prevention)
- Advisory lock (key: 111222333) on cron-triggered functions
- Always return 200 to Meta webhooks (prevent retry storms)

### Deployment
- Edge Functions: `npx supabase functions deploy <name> --project-ref dtloiqfkeasfcxiwlvzp`
- Frontend: `npm run build` must exit 0 before deploy. Vercel auto-deploys from main
- Dev server: `npm run dev` on port 3002. Verify running before frontend work

### Code Hygiene
- Remove tmp_*.js, fix_*.js, check_*.js before commits
- No console.log in production (console.error only in Edge Functions)
- No secrets in .env (only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)

## Project Structure

```
src/
  pages/           → Page components (LeadsPage, DashboardPage, MarketingPage...)
  components/      → UI components (leads/, marketing/, modals/)
  hooks/           → Business logic (useMetaSync, useLeadEmail, useLeadSequences...)
  context/         → Auth provider (AuthContext.jsx)
  lib/             → Utilities (supabase.js, emailTemplate.js, leadsUtils.js)
supabase/
  functions/       → Edge Functions (meta-webhook, process-drips, sync-leads...)
  migrations/      → SQL migration files (timestamped)
```
