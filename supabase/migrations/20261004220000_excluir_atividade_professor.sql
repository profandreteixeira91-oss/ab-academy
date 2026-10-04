create or replace function public.excluir_atividade_professor(
  p_atividade_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professor_id uuid;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária para excluir atividades.';
  end if;

  select exists (
    select 1
    from public.admin_users au
    where au.user_id = v_user_id
      and au.ativo = true
  )
  into v_is_admin;

  select a.professor_id
  into v_professor_id
  from public.atividades a
  where a.id = p_atividade_id
  for update;

  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  if not v_is_admin and not exists (
    select 1
    from public.professores p
    where p.id = v_professor_id
      and p.user_id = v_user_id
      and p.ativo = true
      and p.acesso_portal = true
  ) then
    raise exception 'Você não tem permissão para excluir esta atividade.';
  end if;

  delete from public.respostas_aluno
  where atividade_id = p_atividade_id;

  delete from public.exercicio_alternativas ea
  using public.atividade_exercicios e
  where ea.exercicio_id = e.id
    and e.atividade_id = p_atividade_id;

  delete from public.exercicio_conteudos ec
  using public.atividade_exercicios e
  where ec.exercicio_id = e.id
    and e.atividade_id = p_atividade_id;

  delete from public.atividade_exercicios
  where atividade_id = p_atividade_id;

  delete from public.atividades
  where id = p_atividade_id;
end;
$$;

revoke all on function public.excluir_atividade_professor(uuid)
  from public;
grant execute on function public.excluir_atividade_professor(uuid)
  to authenticated;
