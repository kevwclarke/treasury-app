-- Source bank for each CSV import (concentration / FSCS views).
alter table public.transactions
  add column if not exists institution text null;

comment on column public.transactions.institution is 'Bank the CSV export is from (set at upload).';
