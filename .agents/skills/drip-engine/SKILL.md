---
name: drip-engine
description: "Technical reference for the Sellvende Leads email automation engine. Covers the full pipeline from Meta webhook ingestion to sequence execution and bounce handling. Owner: FORGE (backend). Reference before modifying process-drips, meta-webhook, or leads_secuencias."
---

# Drip Engine — Technical Reference

**Owner:** FORGE (`/agent-forge`)
**Relevant files:** `supabase/functions/process-drips/`, `supabase/functions/meta-webhook/`, `supabase/migrations/`

---

## Pipeline Architecture

```
1. meta-webhook receives lead from Meta Ads
        │  debounce in-memory (prevents duplicate triggers
        │  from simultaneous leads arriving in same second)
        ▼
2. INSERT into leads (agencia_id, meta_lead_id, email, ...)
        │  deduplication: skip if meta_lead_id already exists
        ▼
3. Smart sequence match
        │  producto_match ILIKE lead.producto_interes → specific sequence
        │  fallback: sequence where producto_match IS NULL → general sequence
        ▼
4. INSERT into leads_secuencias
        │  estado = 'en_progreso', ultimo_paso_ejecutado = 0
        ▼
5. Invoke process-drips Edge Function
        │  (also runs on 15-min cron)
        ▼
6. process-drips acquires advisory lock (key: 111222333)
        │  prevents concurrent execution
        ▼
7. For each enrolled lead:
        │  calculate days since enrollment
        │  find next step where dia_envio <= days_elapsed
        │  check anti-spam guard: ultimo_contacto >= 8h ago
        ▼
8. Send email via configured provider
        │  Gmail SMTP (Nodemailer) — 1.2s delay between sends
        │  Resend API — no delay needed
        ▼
9. On success:
        │  INSERT email_log (estado='enviado')
        │  UPDATE leads SET ultimo_contacto = NOW()
        │  UPDATE leads SET estado = 'contactado' (only if was 'nuevo')
        │  UPDATE leads_secuencias SET ultimo_paso_ejecutado = step_num
        ▼
10. On hard bounce (550 5.1.x):
        UPDATE leads SET email_rebotado = true, estado = 'correo_falso'
        UPDATE leads_secuencias SET estado = 'cancelada'
```

---

## Golden Rules

1. **State changes only on server confirmation.** Never update `estado` from the frontend on an optimistic guess — only when `process-drips` or `resend-email` gets a real success response from the email provider.

2. **No frontend trust for sequence state.** `leads_secuencias.estado` is the source of truth. Frontend reads it via Supabase Realtime, never writes directly.

3. **Tenant isolation is mandatory.** Every query in `process-drips` groups by `agencia_id`. One agency's failure (auth error, bad credentials) must NOT crash other agencies' processing — use `Promise.allSettled()`.

4. **Advisory lock prevents duplicate sends.** If `try_advisory_lock(111222333)` returns false, exit immediately. Another instance is running.

5. **Always sanitize HTML before injection.** Use `escapeHtml()` on all lead data before substituting variables into email templates. XSS via email templates is a real attack vector.

6. **Anti-spam guard.** Do not send to the same lead if `ultimo_contacto` was less than 8 hours ago, even if the step is technically due.

---

## Table Reference

| Table | Role in pipeline |
|---|---|
| `leads` | Source of lead data + bounce/unsubscribe flags |
| `leads_secuencias` | Enrollment state: en_progreso / pausada / cancelada / completada |
| `pasos_secuencia` | Steps: dia_envio, asunto, html_body, tipo_mensaje |
| `secuencias_marketing` | Sequence templates with producto_match |
| `email_log` | Audit trail: every send, open, bounce logged here |
| `configuracion` | Per-tenant email credentials (gmail_app_password, resend_api_key) |

---

## Deploy

```bash
npx supabase functions deploy process-drips --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy meta-webhook --project-ref dtloiqfkeasfcxiwlvzp
```
