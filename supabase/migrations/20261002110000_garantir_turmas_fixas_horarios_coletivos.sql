-- Garante que todo horário coletivo comercializável possua uma turma fixa.
create or replace function public.garantir_turma_fixa_horario_admin(p_horario_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_h public.horarios%rowtype;
  v_turma_id uuid;
  v_existing uuid;
  v_capacity integer;
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid() and ativo=true) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select * into v_h from public.horarios where id=p_horario_id for update;
  if not found then raise exception 'Horário não encontrado.'; end if;

  if v_h.tipo_horario not in ('dupla','grupo') then
    raise exception 'Somente horários de dupla ou grupo podem possuir turma fixa.';
  end if;

  select th.turma_id into v_existing
  from public.turma_horarios th
  join public.turmas t on t.id=th.turma_id
  where th.horario_id=v_h.id
    and t.fixa=true
    and t.status not in ('cancelada','encerrada')
  order by t.created_at
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_capacity := case when v_h.tipo_horario='dupla' then 2 else 3 end;

  insert into public.turmas(
    modalidade, idioma, aulas_semana, quantidade_minima, quantidade_maxima,
    horario_preferido, status, professor_id, nivel_referencia, nivel_minimo,
    nivel_maximo, fixa, horario_id
  )
  values(
    v_h.tipo_horario, v_h.idioma, 1, v_capacity, v_capacity,
    v_h.hora_inicio::text, 'em_formacao', v_h.professor_id,
    v_h.nivel_referencia, v_h.nivel_referencia, v_h.nivel_referencia,
    true, v_h.id
  )
  returning id into v_turma_id;

  insert into public.turma_horarios(turma_id, horario_id, ordem)
  values(v_turma_id, v_h.id, 1);

  return v_turma_id;
end;
$$;

revoke all on function public.garantir_turma_fixa_horario_admin(uuid) from public;
grant execute on function public.garantir_turma_fixa_horario_admin(uuid) to authenticated;

-- Repara horários coletivos existentes que foram cadastrados sem turma fixa.
do $$
declare
  r record;
  v_turma_id uuid;
  v_capacity integer;
begin
  for r in
    select h.*
    from public.horarios h
    where h.tipo_horario in ('dupla','grupo')
      and h.disponivel=true
      and h.aluno_id is null
      and not exists (
        select 1 from public.turma_horarios th
        where th.horario_id=h.id
      )
    order by h.id
  loop
    v_capacity := case when r.tipo_horario='dupla' then 2 else 3 end;

    insert into public.turmas(
      modalidade, idioma, aulas_semana, quantidade_minima, quantidade_maxima,
      horario_preferido, status, professor_id, nivel_referencia, nivel_minimo,
      nivel_maximo, fixa, horario_id
    )
    values(
      r.tipo_horario, r.idioma, 1, v_capacity, v_capacity,
      r.hora_inicio::text, 'em_formacao', r.professor_id,
      r.nivel_referencia, r.nivel_referencia, r.nivel_referencia,
      true, r.id
    )
    returning id into v_turma_id;

    insert into public.turma_horarios(turma_id, horario_id, ordem)
    values(v_turma_id, r.id, 1);
  end loop;
end;
$$;
