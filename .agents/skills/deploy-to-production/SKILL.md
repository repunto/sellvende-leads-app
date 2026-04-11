---
name: deploy-to-production
description: "Full production deployment checklist for Sellvende Leads. Covers Edge Function deployment to Supabase and frontend deployment to Vercel. Owner: SENTINEL executes, ALPHA authorizes. Run this skill before any production push."
---

# Deploy to Production

**Executor:** SENTINEL (`/agent-sentinel`)
**Authorizer:** ALPHA — no deploy proceeds without ALPHA + AEGIS approval
**Pre-condition:** AEGIS has reviewed and approved the code. SENTINEL has run the security audit and returned CLEARED.

---

## Pre-Deploy Gate (ALPHA runs this)

Before deploying anything, verify:

- [ ] AEGIS verdict: **APPROVED** (not just "changes required")
- [ ] SENTINEL audit: **CLEARED** (no CRITICAL findings open)
- [ ] Working on a feature branch (never deploy directly from an untested local state)
- [ ] Supabase project is active (not paused — check dashboard)

If any item is unchecked → stop. Do not deploy.

---

## Track A — Edge Function Deployment

Run for each modified Edge Function:

```bash
# 1. Identify which functions changed
git diff --name-only origin/main HEAD | grep "supabase/functions"

# 2. Deploy each one
npx supabase functions deploy meta-webhook   --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy process-drips  --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy sync-leads     --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy resend-email   --project-ref dtloiqfkeasfcxiwlvzp
npx supabase functions deploy handle-bounce  --project-ref dtloiqfkeasfcxiwlvzp
# (deploy only the ones that changed — not all functions every time)

# 3. Verify deployment appears in function list
npx supabase functions list --project-ref dtloiqfkeasfcxiwlvzp
```

### Post-deploy smoke test (Edge Functions)

```bash
# Health check — replace with appropriate endpoint/payload
curl -X POST https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/resend-email \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Expected: 400 (missing fields) — NOT 500 (crash) and NOT connection refused
```

---

## Track B — Frontend Deployment (Vercel)

```bash
# 1. Build must exit 0 — this is the gate
npm run build
# If exit code != 0: STOP. Fix build errors before proceeding.

# 2. No console.log in source code
grep -rn "console\.log" src/ --include="*.jsx" --include="*.js" --include="*.ts" --include="*.tsx"
# Expected: zero results (console.error in Edge Functions is OK, not in src/)

# 3. No secrets in built assets
grep -rE "sk-ant|EAA[A-Za-z]|re_[A-Za-z]|AIzaSy" dist/ 2>/dev/null
# Expected: zero results

# 4. No debug files left
ls src/ | grep -E "^(tmp_|fix_|check_|debug_)"
# Expected: zero results

# 5. Push to main — Vercel auto-deploys
git push origin main
```

### Post-deploy smoke test (Frontend)

Wait 2–3 minutes for Vercel build to complete, then:

1. Open https://leads.sellvende.com in browser
2. Login with a test account
3. Verify leads table loads (Supabase connection works)
4. Check browser console for errors (F12 → Console)
5. Verify Realtime indicator shows connected

---

## Track C — Database Migration (if schema changed)

Run the `database-migration` skill first. After migration is applied:

```bash
# Verify migration appears in history
npx supabase migration list --project-ref dtloiqfkeasfcxiwlvzp

# Quick sanity check on affected table
# (run in Supabase SQL Editor)
SELECT COUNT(*) FROM new_table WHERE agencia_id IS NULL;
-- Expected: 0 (RLS working, no orphaned rows)
```

---

## Deployment Order (when all 3 tracks needed)

```
1. Database migration   (schema must exist before functions use it)
2. Edge Functions       (backend must be updated before frontend calls new APIs)
3. Frontend             (deploy last — users see new UI with working backend)
```

---

## Rollback Procedures

### Edge Function rollback
```bash
# Redeploy previous version from git
git checkout <previous-sha> -- supabase/functions/<name>/
npx supabase functions deploy <name> --project-ref dtloiqfkeasfcxiwlvzp
git checkout HEAD -- supabase/functions/<name>/
```

### Frontend rollback
```bash
# Vercel dashboard → Deployments → click previous deployment → "Promote to Production"
# Or: revert commit and push
git revert HEAD
git push origin main
```

### Database migration rollback
```bash
# Run the ROLLBACK SQL at the bottom of the migration file
# in Supabase SQL Editor — never auto-run destructive SQL
```
