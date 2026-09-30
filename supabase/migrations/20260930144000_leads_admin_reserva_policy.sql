drop policy if exists "lead_admin_select" on public.leads;
create policy "lead_admin_select"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
);