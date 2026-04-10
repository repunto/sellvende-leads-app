---
description: Check if Supabase Project is Paused
---

# Supabase Status Check Rule

Whenever a user requests changes that involve Supabase backend operations, Edge Functions, or Postgres Database actions, you **MUST ALWAYS** verify the project status.

Supabase free tier projects are automatically paused after 1 week of inactivity. If a project is paused, **all API requests (Auth, DB, Functions) will hang, timeout, or return 500/503 errors**. 

## Mandatory Steps
1. Before debugging "infinite loading" issues on the frontend, ask the user to check their Supabase Dashboard to confirm the project is active.
2. If you notice operations failing silently or receiving connection refused errors after a period of user inactivity, explicitly remind the user to unpause the project.
3. If an edge function deployment fails with "Project not found" or "Docker is not running" accompanied by a timeout, check the paused status.
