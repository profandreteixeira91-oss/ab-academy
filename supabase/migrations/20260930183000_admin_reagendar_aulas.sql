drop policy if exists "registros_aulas_insert_admin" on public.registros_aulas;
create policy "registros_aulas_insert_admin"
on public.registros_aulas
for insert
to authenticated
with check (private.usuario_e_admin());

drop policy if exists "registros_aulas_update_admin" on public.registros_aulas;
create policy "registros_aulas_update_admin"
on public.registros_aulas
for update
to authenticated
using (private.usuario_e_admin())
with check (private.usuario_e_admin());
