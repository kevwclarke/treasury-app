-- Ensure RLS policies exist for transactions.
-- This is intentionally explicit (SELECT + INSERT) to avoid surprises.

alter table public.transactions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions_select_own'
  ) then
    create policy transactions_select_own
      on public.transactions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'transactions_insert_own'
  ) then
    create policy transactions_insert_own
      on public.transactions
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

