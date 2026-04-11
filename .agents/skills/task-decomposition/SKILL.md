---
name: task-decomposition
description: "ALPHA's protocol for breaking down a user feature request into precise briefs for ATLAS, FORGE, PIXEL, SENTINEL, and AEGIS. Use at the start of every non-trivial request before dispatching any specialist agent."
---

# Task Decomposition

**Owner:** ALPHA
**Use before:** dispatching any specialist agent (ATLAS, FORGE, PIXEL, SENTINEL, AEGIS, SPHINX)
**Output:** one brief per agent involved, ready to paste as their activation prompt

---

## When to Use This Skill

Any request that touches more than one file or requires more than 30 minutes of work needs decomposition before execution. "Just do it" without decomposition leads to:
- Specialists working on conflicting assumptions
- FORGE building an API that PIXEL doesn't know exists
- Missing acceptance criteria discovered after implementation

---

## Step 1 — Classify the request

| Type | Pipeline |
|---|---|
| New feature (needs DB changes) | ATLAS → FORGE + PIXEL (parallel) → AEGIS → SENTINEL |
| New feature (frontend only) | PIXEL → AEGIS |
| New feature (backend only) | ATLAS → FORGE → AEGIS → SENTINEL |
| Bug fix | FORGE or PIXEL → AEGIS |
| Security issue | SENTINEL → AEGIS |
| Refactor | ATLAS → FORGE + PIXEL → AEGIS |
| WordPress task | SPHINX → AEGIS → SENTINEL |
| Infrastructure / deploy | SENTINEL → AEGIS |

---

## Step 2 — Identify the blast radius

Before writing any brief, answer:

1. **Which tables change?** (New columns, new tables, schema modifications)
2. **Which Edge Functions change?** (New functions, modified functions)
3. **Which frontend files change?** (Pages, hooks, components)
4. **Are FORGE and PIXEL tasks independent?** (Can they work in parallel?)
5. **Is there a security surface?** (Auth, webhooks, email, user data → SENTINEL needed)

---

## Step 3 — Write the ATLAS brief (if schema changes needed)

```markdown
## Brief for ATLAS

**Objective:** Design the schema and API contract for [feature name].

**Context:** [2-3 sentences about the feature and why it's needed]

**Requirements:**
- [Requirement 1: e.g., "Store WhatsApp message logs per lead"]
- [Requirement 2]
- [Requirement 3]

**Constraints:**
- Must maintain agencia_id isolation (RLS)
- Must not break existing [table/function]
- [Other constraints]

**Deliver:**
1. Migration SQL (CREATE TABLE, indexes, RLS policies)
2. API contract for any new Edge Functions
3. Data flow diagram
4. Risk assessment
5. Rollback plan

Save design doc to: docs/specs/YYYY-MM-DD-[feature]-design.md
```

---

## Step 4 — Write the FORGE brief (after ATLAS delivers)

```markdown
## Brief for FORGE

**Objective:** Implement [specific backend task] per ATLAS design at docs/specs/[file].

**Context:** [What this function does and where it fits in the system]

**Files to create/modify:**
- CREATE: supabase/functions/[name]/index.ts
- CREATE: supabase/migrations/YYYYMMDD_[description].sql
- MODIFY: [other files if any]

**Acceptance Criteria:**
- [ ] [Criterion 1: e.g., "Webhook validates HMAC signature"]
- [ ] [Criterion 2: e.g., "Inserts to whatsapp_log with correct agencia_id"]
- [ ] [Criterion 3]

**Do NOT:**
- Modify React components or frontend hooks
- Deploy to production (hand off to SENTINEL)
- Approve your own code (hand off to AEGIS)

**Security checklist:** Run `.agents/agents/forge.md` security checklist before handoff.
```

---

## Step 5 — Write the PIXEL brief (if frontend work needed)

```markdown
## Brief for PIXEL

**Objective:** Implement [specific frontend task].

**Context:** [What the user sees/does with this feature]

**Files to create/modify:**
- MODIFY: src/pages/[Page].jsx
- CREATE: src/components/[Component].jsx
- MODIFY: src/hooks/use[Hook].js

**API available (from FORGE):**
- Endpoint: [method] /functions/v1/[name]
- Supabase table: [table] (columns: ...)
- RPC: supabase.rpc('[function]', { agencia_id, ... })

**Acceptance Criteria:**
- [ ] [Criterion 1: e.g., "WhatsApp log visible in LeadDetailPanel timeline"]
- [ ] [Criterion 2: e.g., "Works at 375px mobile breakpoint"]
- [ ] [Criterion 3]

**Do NOT:**
- Write Edge Functions or SQL
- Store credentials in frontend code
- Skip the mobile breakpoint test
```

---

## Step 6 — Write the AEGIS brief

```markdown
## Brief for AEGIS

**Objective:** Review [FORGE/PIXEL/both] implementation of [feature name].

**Original brief:** [paste ALPHA's original request in 2-3 sentences]
**Design doc:** docs/specs/YYYY-MM-DD-[feature]-design.md
**Files changed:** [list from git diff --name-only]

**Run full 5-phase review:**
1. Spec compliance — verify against acceptance criteria above
2. Code quality
3. Security — pay special attention to [specific concern if any]
4. Performance
5. Regression risk

**VETO if:** [specific risks to watch for, e.g., "tenant isolation in new table"]
```

---

## Step 7 — Identify parallel vs sequential tasks

```
Sequential (B depends on A):       Parallel (independent):

ATLAS ──► FORGE ──► AEGIS          ATLAS ──► FORGE ──► AEGIS
                                           └──► PIXEL ──┘
                                   (FORGE and PIXEL can work simultaneously
                                    if their files don't overlap)
```

**Rule for parallelism:** FORGE and PIXEL can run in parallel ONLY if:
- PIXEL does not call any new API that FORGE hasn't deployed yet
- They don't modify the same file
- Their changes don't have data model dependencies between them

---

## Step 8 — Document the decomposition

Before dispatching, summarize the plan for the user:

```
## Task Decomposition: [Feature Name]

**Pipeline:** ATLAS → FORGE + PIXEL (parallel) → AEGIS → SENTINEL

**Agent tasks:**
1. ATLAS — design schema + API contract (~15 min)
2. FORGE — Edge Function [name] + migration [name] (~30 min)
3. PIXEL — Component [name] + hook use[Name] (~30 min)
   (FORGE and PIXEL work in parallel after ATLAS delivers)
4. AEGIS — full code review (~15 min)
5. SENTINEL — security audit + deploy (~10 min)

**Total estimate:** ~60 min wall-clock time (parallel execution)

Shall I proceed?
```

Wait for user approval before dispatching agents.
