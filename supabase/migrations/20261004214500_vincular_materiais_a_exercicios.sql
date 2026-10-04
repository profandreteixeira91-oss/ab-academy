alter table public.atividade_exercicios
  add column if not exists material_id uuid
  references public.materiais(id)
  on delete set null;

create index if not exists atividade_exercicios_material_id_idx
  on public.atividade_exercicios(material_id)
  where material_id is not null;

comment on column public.atividade_exercicios.material_id is
  'Material publicado e atribuído ao aluno, vinculado ao exercício como apoio.';

create or replace function public.usuario_pode_editar_atividade(
  p_atividade_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.ativo = true
    )
    or exists (
      select 1
      from public.atividades a
      join public.professores p on p.id = a.professor_id
      where a.id = p_atividade_id
        and p.user_id = auth.uid()
        and p.ativo = true
        and p.acesso_portal = true
    );
$$;

revoke all on function public.usuario_pode_editar_atividade(uuid)
  from public;
grant execute on function public.usuario_pode_editar_atividade(uuid)
  to authenticated;

create or replace function public.exercicio_material_pode_ser_vinculado(
  p_atividade_id uuid,
  p_material_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.atividades a
    join public.materiais m
      on m.id = p_material_id
     and m.professor_id = a.professor_id
    join public.material_alunos ma
      on ma.material_id = m.id
     and ma.aluno_id = a.aluno_id
    where a.id = p_atividade_id
      and public.usuario_pode_editar_atividade(a.id)
      and m.status = 'publicado'
      and m.pdf_publicado_path is not null
  );
$$;

revoke all on function public.exercicio_material_pode_ser_vinculado(uuid, uuid)
  from public;
grant execute on function public.exercicio_material_pode_ser_vinculado(uuid, uuid)
  to authenticated;

drop policy if exists "atividade_exercicios_insert_professor"
  on public.atividade_exercicios;
create policy "atividade_exercicios_insert_professor"
on public.atividade_exercicios
for insert to authenticated
with check (
  public.usuario_pode_editar_atividade(atividade_id)
  and (
    material_id is null
    or public.exercicio_material_pode_ser_vinculado(
      atividade_id,
      material_id
    )
  )
);

drop policy if exists "atividade_exercicios_update_professor"
  on public.atividade_exercicios;
create policy "atividade_exercicios_update_professor"
on public.atividade_exercicios
for update to authenticated
using (public.usuario_pode_editar_atividade(atividade_id))
with check (
  public.usuario_pode_editar_atividade(atividade_id)
  and (
    material_id is null
    or public.exercicio_material_pode_ser_vinculado(
      atividade_id,
      material_id
    )
  )
);
