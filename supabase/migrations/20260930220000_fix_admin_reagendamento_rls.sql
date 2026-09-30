-- Permite que administradores ativos insiram e atualizem registros de aulas
-- usados pelo reagendamento, sem depender de uma função intermediária na RLS.

drop policy if exists "registros_aulas_insert_admin" on public.registros_aulas;
create policy "registros_aulas_insert_admin"
on public.registros_aulas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
);

drop policy if exists "registros_aulas_update_admin" on public.registros_aulas;
create policy "registros_aulas_update_admin"
on public.registros_aulas
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
);
