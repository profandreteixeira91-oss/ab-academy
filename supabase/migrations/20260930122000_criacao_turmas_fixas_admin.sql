create or replace function public.criar_turma_fixa_admin(
  p_idioma text,p_modalidade text,p_aulas_semana integer,p_dias integer[],p_horas_inicio text[],p_horas_fim text[],p_professor_id uuid,p_quantidade_maxima integer default null
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_turma_id uuid; v_capacity integer; v_index integer; v_horario_id uuid; v_existing record;
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid() and ativo=true) then raise exception 'Acesso restrito ao administrador.'; end if;
  if p_modalidade not in('dupla','grupo') then raise exception 'Modalidade coletiva inválida.'; end if;
  if p_idioma not in('ingles','alemao') then raise exception 'Idioma inválido.'; end if;
  if p_aulas_semana<1 or p_aulas_semana>3 then raise exception 'A frequência deve estar entre 1 e 3 aulas por semana.'; end if;
  if coalesce(array_length(p_dias,1),0)<>p_aulas_semana or coalesce(array_length(p_horas_inicio,1),0)<>p_aulas_semana or coalesce(array_length(p_horas_fim,1),0)<>p_aulas_semana then raise exception 'Informe um encontro para cada aula semanal.'; end if;
  v_capacity=case when p_modalidade='dupla' then 2 else least(greatest(coalesce(p_quantidade_maxima,6),3),6) end;
  if exists(select 1 from unnest(p_dias) with ordinality as d(day,ord) where d.day<0 or d.day>6) then raise exception 'Dia da semana inválido.'; end if;
  if (select count(distinct x) from unnest(p_dias) x)<>p_aulas_semana then raise exception 'Os dias dos encontros devem ser diferentes.'; end if;
  for v_index in 1..p_aulas_semana loop
    if p_horas_inicio[v_index]>=p_horas_fim[v_index] then raise exception 'O horário final deve ser maior que o inicial.'; end if;
    select h.id into v_existing from public.horarios h where h.idioma=p_idioma and h.dia_semana=p_dias[v_index] and h.hora_inicio<p_horas_fim[v_index]::time and h.hora_fim>p_horas_inicio[v_index]::time and (p_professor_id is null or h.professor_id=p_professor_id) limit 1;
    if found then raise exception 'Já existe um horário conflitante para este professor em %.',p_horas_inicio[v_index]; end if;
  end loop;
  insert into public.turmas(modalidade,idioma,aulas_semana,quantidade_minima,quantidade_maxima,horario_preferido,status,professor_id,fixa)
  values(p_modalidade,p_idioma,p_aulas_semana,case when p_modalidade='dupla' then 2 else 3 end,v_capacity,null,'em_formacao',p_professor_id,true) returning id into v_turma_id;
  for v_index in 1..p_aulas_semana loop
    insert into public.horarios(tipo_horario,idioma,dia_semana,hora_inicio,hora_fim,disponivel,aluno_id,professor_id)
    values(p_modalidade,p_idioma,p_dias[v_index],p_horas_inicio[v_index]::time,p_horas_fim[v_index]::time,true,null,p_professor_id) returning id into v_horario_id;
    insert into public.turma_horarios(turma_id,horario_id,ordem) values(v_turma_id,v_horario_id,v_index);
    if v_index=1 then update public.turmas set horario_id=v_horario_id where id=v_turma_id; end if;
  end loop;
  return v_turma_id;
end; $$;
grant execute on function public.criar_turma_fixa_admin(text,text,integer,integer[],text[],text[],uuid,integer) to authenticated;
