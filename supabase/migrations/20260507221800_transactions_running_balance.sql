-- Add running balance per transaction row (cash position).
-- Used when CSV includes a Balance column; falls back to sum(amount) otherwise.

alter table public.transactions
  add column if not exists running_balance float8 null;

comment on column public.transactions.running_balance is 'Running balance from statement row (cash position).';

