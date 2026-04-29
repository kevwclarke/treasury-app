-- First successful transaction import (set once from app upload flow).
-- Apply in Supabase SQL editor or via `supabase db push` when ready.

alter table public.company_profiles
  add column if not exists first_data_upload_at timestamptz null;

comment on column public.company_profiles.first_data_upload_at is
  'Timestamp of the first successful CSV import with at least one transaction row (written once, never overwritten).';
