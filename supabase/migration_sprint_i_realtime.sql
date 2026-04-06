-- ==============================================================================
-- MIGRATION SPRINT I: Enable Supabase Realtime on leads table
-- Run this in your Supabase SQL Editor BEFORE deploying the frontend changes.
-- ==============================================================================

-- Enable Realtime publication for the leads table
-- This allows Supabase to push live INSERT/UPDATE/DELETE events to the browser
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- Confirm it was added (this should return a row for 'leads')
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'leads';
