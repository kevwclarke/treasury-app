-- Allow users to delete their own rows (account / data cleanup from the app).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_delete_own'
  ) then
    create policy transactions_delete_own
      on public.transactions for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_delete_own'
  ) then
    create policy company_profiles_delete_own
      on public.company_profiles for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
