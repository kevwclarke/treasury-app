-- Open Banking / connect-bank waitlist signups (email captured from in-app modal).

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  source text not null default 'open_banking_connect',
  created_at timestamptz not null default now(),
  constraint waitlist_user_source_key unique (user_id, source)
);

create index if not exists waitlist_created_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

drop policy if exists "Users read own waitlist" on public.waitlist;
create policy "Users read own waitlist"
  on public.waitlist for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own waitlist" on public.waitlist;
create policy "Users insert own waitlist"
  on public.waitlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own waitlist" on public.waitlist;
create policy "Users update own waitlist"
  on public.waitlist for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
