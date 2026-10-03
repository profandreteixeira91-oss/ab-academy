alter table public.materiais
  drop constraint if exists materiais_titulo_nao_vazio_chk,
  drop constraint if exists materiais_imagens_array_chk,
  drop constraint if exists materiais_videos_array_chk;

alter table public.materiais
  add constraint materiais_titulo_nao_vazio_chk check (length(btrim(titulo)) > 0),
  add constraint materiais_imagens_array_chk check (jsonb_typeof(imagens) = 'array'),
  add constraint materiais_videos_array_chk check (jsonb_typeof(videos) = 'array');

create index if not exists material_alunos_material_aluno_idx
  on public.material_alunos(material_id, aluno_id);

create index if not exists materiais_professor_status_updated_idx
  on public.materiais(professor_id, status, updated_at desc);

revoke all on table public.materiais from anon;
revoke all on table public.material_alunos from anon;

grant select, insert, update, delete on table public.materiais to authenticated;
grant select, insert, update, delete on table public.material_alunos to authenticated;

create schema if not exists private;

create or replace function private.registrar_material_visualizacao(p_material_id uuid)
returns void
language sql
security definer
set search_path = ''
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

revoke execute on function private.registrar_material_visualizacao(uuid) from public;
revoke execute on function private.registrar_material_visualizacao(uuid) from anon;
grant usage on schema private to authenticated;
grant execute on function private.registrar_material_visualizacao(uuid) to authenticated;
