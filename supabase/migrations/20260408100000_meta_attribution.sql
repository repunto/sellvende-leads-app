-- ==============================================================================
-- FASE 1: Meta Attribution
-- Adds columns for campaign, adset, and ad names matching Meta Leadgen webhook.
-- ==============================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS adset_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_name text;
