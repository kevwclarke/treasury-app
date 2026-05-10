-- Minimum acceptable yield (%) for alerts; nullable until user sets in Preferences.

alter table public.company_profiles
  add column if not exists yield_alert_threshold_pct double precision null;

comment on column public.company_profiles.yield_alert_threshold_pct is
  'Alert when blended yield falls below this % (float8, nullable).';
