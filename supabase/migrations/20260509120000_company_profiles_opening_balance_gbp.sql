-- Opening balance from CSV metadata row (not stored as a transaction).

alter table public.company_profiles
  add column if not exists opening_balance_gbp double precision null;

comment on column public.company_profiles.opening_balance_gbp is
  'Opening balance extracted from CSV OPENING BALANCE row; float8, nullable.';
