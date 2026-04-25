-- Audit trail for in-app confirmations (e.g. yield_apply_confirmed). Safe to run if not already present.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_type text not null,
  category text,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "Users read own audit_log" on public.audit_log;
create policy "Users read own audit_log"
  on public.audit_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own audit_log" on public.audit_log;
create policy "Users insert own audit_log"
  on public.audit_log for insert
  with check (auth.uid() = user_id);
