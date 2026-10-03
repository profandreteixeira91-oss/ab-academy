drop function if exists private.registrar_material_visualizacao(uuid);

create or replace function public.registrar_material_visualizacao(p_material_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.material_alunos
  set visualizado_em = now()
  where material_id = p_material_id
    and aluno_id in (
      select a.id from public.alunos a where a.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.materiais m
      where m.id = p_material_id and m.status = 'publicado'
    );
$$;

drop policy if exists "alunos podem registrar visualizacao" on public.material_alunos;
create policy "alunos podem registrar visualizacao"
  on public.material_alunos
  for update
  to authenticated
  using (
    exists (
      select 1 from public.alunos a
      where a.id = material_alunos.aluno_id
        and a.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.alunos a
      where a.id = material_alunos.aluno_id
        and a.user_id = (select auth.uid())
    )
  );

revoke execute on function public.registrar_material_visualizacao(uuid) from public;
revoke execute on function public.registrar_material_visualizacao(uuid) from anon;
grant execute on function public.registrar_material_visualizacao(uuid) to authenticated;
