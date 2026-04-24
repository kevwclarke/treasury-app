-- One company profile per user (onboarding after signup).

create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null,
  funding_stage text not null,
  created_at timestamptz not null default now(),
  constraint company_profiles_funding_stage_check check (
    funding_stage in ('Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+')
  )
);

comment on table public.company_profiles is 'User workspace: display name and funding stage for sidebar.';

alter table public.company_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_select_own'
  ) then
    create policy company_profiles_select_own
      on public.company_profiles for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_insert_own'
  ) then
    create policy company_profiles_insert_own
      on public.company_profiles for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_update_own'
  ) then
    create policy company_profiles_update_own
      on public.company_profiles for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
