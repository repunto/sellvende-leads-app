---
name: production-hotfix
description: "Emergency protocol for production incidents. Use when something is broken in production and users are affected RIGHT NOW. Different from systematic-debugging (dev env). ALPHA coordinates, SENTINEL deploys, AEGIS does expedited review."
---

# Production Hotfix

This skill is for **production incidents only** — something is broken for real users right now. Speed matters, but recklessness makes it worse.

**Coordinator:** ALPHA
**Fixer:** FORGE (backend) or PIXEL (frontend) depending on incident location
**Expedited reviewer:** AEGIS (security + regression only — no full 5-phase review in emergency)
**Deployer:** SENTINEL

---

## Step 1 — Triage (ALPHA, < 5 minutes)

Answer these before writing a single line of code:

| Question | Answer guides |
|---|---|
| What is broken? | Scope of the fix |
| Who is affected? | All users? One tenant? One feature? |
| Is data at risk? | If yes → stop the bleeding first (disable the feature/endpoint) |
| What changed recently? | Last deploy? Last migration? Check `git log --oneline -10` |
| Can it be rolled back? | Revert last deploy vs. writing a fix |

**If rollback is faster and safer than a fix → roll back first, fix properly later.**

```bash
# Check what was last deployed
git log --oneline -5
git diff HEAD~1 HEAD --name-only
```

---

## Step 2 — Stop the bleeding (if users are actively losing data)

```bash
# Option A: Disable a specific Edge Function temporarily
# In Supabase Dashboard → Edge Functions → Disable

# Option B: Toggle master switch if drip engine is the culprit
# UPDATE configuracion SET valor = 'false'
# WHERE clave = 'master_sequence_switch';

# Option C: Feature flag in frontend (if pure UI issue)
# Hard-code a conditional in src/ to hide the broken feature
```

---

## Step 3 — Create hotfix branch

```bash
# Always fix on a branch, never directly on main
git checkout main
git pull origin main
git checkout -b hotfix/YYYYMMDD-brief-description
# Example: hotfix/20260415-webhook-duplicate-leads
```

---

## Step 4 — Apply the minimal fix

**Minimum viable fix only.** This is not the time for refactoring, cleanup, or improvements. Fix the exact broken behavior, nothing else.

- FORGE: fix the Edge Function or SQL
- PIXEL: fix the React component or hook

Run `verification-before-completion` skill after the fix — evidence the fix works before claiming it's done.

---

## Step 5 — Expedited AEGIS review

AEGIS runs a **reduced review** in emergencies — 2 phases only:

1. **Security** — does the fix introduce a new vulnerability?
2. **Regression** — does the fix break anything else?

Skip Phase 1 (spec compliance) and Phase 2 (code quality) — those can be cleaned up in a follow-up PR.

AEGIS still has VETO power if the fix is dangerous. A bad hotfix that causes a data leak is worse than staying broken.

---

## Step 6 — Deploy (SENTINEL)

Run the `deploy-to-production` skill with **Track A** (Edge Functions) or **Track B** (Frontend) as appropriate. Track C (migrations) in hotfixes require extra care — always have a rollback SQL ready before applying.

```bash
# Merge hotfix to main
git checkout main
git merge hotfix/YYYYMMDD-brief-description
git push origin main

# Deploy immediately
# (follow deploy-to-production skill)
```

---

## Step 7 — Verify in production

Don't close the incident until you have confirmed with your own eyes that the fix works in production, not just locally.

1. Test the exact scenario that was broken
2. Check Supabase logs for errors post-deploy
3. Monitor for 15 minutes

---

## Step 8 — Post-mortem (within 24 hours)

After the incident is resolved, document in `docs/incidents/YYYY-MM-DD-incident-name.md`:

```markdown
## Incident: [title]
**Date:** YYYY-MM-DD
**Duration:** X minutes
**Impact:** [who was affected and how]

### Root Cause
[What actually caused it]

### Timeline
- HH:MM — incident detected
- HH:MM — triage started
- HH:MM — fix deployed
- HH:MM — incident resolved

### Fix Applied
[What was changed and why]

### Prevention
[What will we do so this doesn't happen again]
```

---

## Red Flags — Never Do in a Hotfix

- Deploy to production without AEGIS security review (even expedited)
- Run destructive SQL (DROP, DELETE, TRUNCATE) without a verified rollback
- Merge to main without at least one other set of eyes on the diff
- Close the incident before verifying in production
- Skip the post-mortem ("we were too busy")
