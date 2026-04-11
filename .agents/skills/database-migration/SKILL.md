---
name: database-migration
description: "Workflow for creating, applying, and rolling back Supabase PostgreSQL migrations safely. Use whenever a schema change is needed — new tables, columns, indexes, RLS policies, or RPC functions. Owner: ATLAS designs, FORGE implements."
---

# Database Migration

**Designer:** ATLAS — produces the SQL
**Implementer:** FORGE — creates the file and applies it
**Never:** run ad-hoc SQL in the Supabase Dashboard without a local migration file first

---

## Step 1 — Create the migration file

```bash
# Naming convention: YYYYMMDD_short_description.sql
# Example:
touch supabase/migrations/20260415_add_whatsapp_log.sql
```

File must live in `supabase/migrations/`. No exceptions. This is the source of truth for schema state.

---

## Step 2 — Write the SQL

Every migration file follows this structure:

```sql
-- supabase/migrations/YYYYMMDD_description.sql
-- Purpose: [one sentence explaining what this changes and why]

-- 1. Table creation (if new)
CREATE TABLE IF NOT EXISTS example (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id  UUID NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  -- columns...
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes (always on agencia_id + any WHERE column)
CREATE INDEX IF NOT EXISTS idx_example_agencia   ON example(agencia_id);
CREATE INDEX IF NOT EXISTS idx_example_estado    ON example(estado);

-- 3. RLS (mandatory on every table with user data)
ALTER TABLE example ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON example FOR SELECT
  USING (agencia_id IN (
    SELECT agencia_id FROM usuarios_agencia WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_insert" ON example FOR INSERT
  WITH CHECK (agencia_id IN (
    SELECT agencia_id FROM usuarios_agencia WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_update" ON example FOR UPDATE
  USING (agencia_id IN (
    SELECT agencia_id FROM usuarios_agencia WHERE usuario_id = auth.uid()
  ));

-- 4. Grants for service role (needed by Edge Functions)
GRANT ALL ON example TO service_role;

-- 5. RPCs (if needed — SECURITY DEFINER with explicit grants)
CREATE OR REPLACE FUNCTION public.example_rpc(p_agencia_id UUID)
RETURNS TABLE(id UUID, nombre TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT e.id, e.nombre
    FROM example e
    WHERE e.agencia_id = p_agencia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.example_rpc TO authenticated, service_role;
```

---

## Step 3 — Self-review checklist before applying

- [ ] Every new table has `agencia_id` FK and RLS policies (all 3: SELECT, INSERT, UPDATE)
- [ ] Every new table has index on `agencia_id`
- [ ] `IF NOT EXISTS` on CREATE TABLE and CREATE INDEX (idempotent)
- [ ] RPCs use `SECURITY DEFINER` with `GRANT EXECUTE`
- [ ] No destructive operations (DROP TABLE, DROP COLUMN) without explicit rollback plan
- [ ] Migration is additive — does not break existing code that's already deployed

---

## Step 4 — Apply the migration

```bash
# Apply via Supabase CLI (connects to remote project)
npx supabase db push --project-ref dtloiqfkeasfcxiwlvzp

# Verify it applied by checking migration history
npx supabase migration list --project-ref dtloiqfkeasfcxiwlvzp
```

---

## Step 5 — Verify post-application

```bash
# In Supabase SQL Editor or via CLI, verify:
# 1. Table exists with correct columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'example' ORDER BY ordinal_position;

# 2. RLS is active
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'example';

# 3. Policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'example';

# 4. Indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'example';
```

---

## Rollback Plan (always prepare this before applying)

For every migration, write the rollback SQL as a comment at the bottom of the file:

```sql
-- ROLLBACK (run if migration causes problems):
-- DROP TABLE IF EXISTS example;
-- DROP FUNCTION IF EXISTS public.example_rpc;
```

For ALTER TABLE (adding columns):
```sql
-- ROLLBACK:
-- ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
```

---

## Red Flags — Never Do These

- Run SQL directly in Supabase Dashboard without saving to a migration file
- Use `DROP TABLE` or `DROP COLUMN` in a migration without a documented rollback plan and ALPHA approval
- Create a table without RLS policies
- Forget `IF NOT EXISTS` — makes migrations non-idempotent and breaks re-runs
- Apply migrations to production before testing on a local/staging Supabase instance
