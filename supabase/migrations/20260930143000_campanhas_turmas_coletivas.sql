begin;

alter table public.turmas
  add column if not exists data_inicio date;

alter table public.leads
  add column if not exists turma_id uuid references public.turmas(id);

create index if not exists leads_turma_id_idx on public.leads(turma_id);

alter table public.leads
  drop constraint if exists leads_formacao_turma_check;

alter table public.leads
  add constraint leads_formacao_turma_check
  check (
    formacao_turma is null
    or formacao_turma = any (
      array[
        'ja_tenho_participantes'::text,
        'preciso_formar_turma'::text,
        'iniciar_individual'::text,
        'reservar_vaga'::text
      ]
    )
  );

drop policy if exists "lead_publico_reserva_turma" on public.leads;
create policy "lead_publico_reserva_turma"
on public.leads
for insert
to anon, authenticated
with check (
  modalidade in ('dupla','grupo')
  and formacao_turma = 'reservar_vaga'
  and origem = 'matricula'
  and turma_id is not null
  and exists (
    select 1
    from public.turmas t
    where t.id = turma_id
      and t.fixa = true
      and t.status not in ('cancelada','encerrada')
      and t.data_inicio is not null
      and t.data_inicio >= current_date
      and t.modalidade = public.leads.modalidade
      and t.idioma = public.leads.idioma_interesse
  )
);

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

create or replace function public.criar_turma_fixa_admin_v2(
  p_idioma text,
  p_modalidade text,
  p_aulas_semana integer,
  p_dias integer[],
  p_horas_inicio text[],
  p_horas_fim text[],
  p_professor_id uuid,
  p_quantidade_maxima integer,
  p_nivel_referencia text,
  p_data_inicio date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_turma_id uuid;
  v_capacity integer;
  v_index integer;
  v_horario_id uuid;
begin
  if not exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and ativo = true
  ) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  if p_modalidade not in ('dupla','grupo') then
    raise exception 'Modalidade coletiva inválida.';
  end if;

  if p_idioma not in ('ingles','alemao') then
    raise exception 'Idioma inválido.';
  end if;

  if p_nivel_referencia not in ('A1','A2','B1','B2','C1','C2') then
    raise exception 'Nível de referência inválido.';
  end if;

  if p_data_inicio is null or p_data_inicio < current_date then
    raise exception 'A data de início deve ser hoje ou uma data futura.';
  end if;

  if p_aulas_semana < 1 or p_aulas_semana > 3 then
    raise exception 'A frequência deve estar entre 1 e 3 aulas por semana.';
  end if;

  if coalesce(array_length(p_dias,1),0) <> p_aulas_semana
     or coalesce(array_length(p_horas_inicio,1),0) <> p_aulas_semana
     or coalesce(array_length(p_horas_fim,1),0) <> p_aulas_semana then
    raise exception 'Informe um encontro para cada aula semanal.';
  end if;

  v_capacity := case
    when p_modalidade = 'dupla' then 2
    else least(greatest(coalesce(p_quantidade_maxima,6),3),6)
  end;

  if exists (
    select 1
    from unnest(p_dias) as d(day)
    where d.day < 0 or d.day > 6
  ) then
    raise exception 'Dia da semana inválido.';
  end if;

  if (
    select count(distinct x)
    from unnest(p_dias) as x
  ) <> p_aulas_semana then
    raise exception 'Os dias dos encontros devem ser diferentes.';
  end if;

  for v_index in 1..p_aulas_semana loop
    if p_horas_inicio[v_index] >= p_horas_fim[v_index] then
      raise exception 'O horário final deve ser maior que o inicial.';
    end if;
  end loop;

  insert into public.turmas (
    modalidade,
    idioma,
    aulas_semana,
    quantidade_minima,
    quantidade_maxima,
    horario_preferido,
    status,
    professor_id,
    nivel_referencia,
    nivel_minimo,
    nivel_maximo,
    fixa,
    data_inicio
  ) values (
    p_modalidade,
    p_idioma,
    p_aulas_semana,
    case when p_modalidade = 'dupla' then 2 else 3 end,
    v_capacity,
    null,
    'em_formacao',
    p_professor_id,
    p_nivel_referencia,
    p_nivel_referencia,
    p_nivel_referencia,
    true,
    p_data_inicio
  )
  returning id into v_turma_id;

  for v_index in 1..p_aulas_semana loop
    insert into public.horarios (
      tipo_horario,
      idioma,
      dia_semana,
      hora_inicio,
      hora_fim,
      disponivel,
      aluno_id,
      professor_id
    ) values (
      p_modalidade,
      p_idioma,
      p_dias[v_index],
      p_horas_inicio[v_index]::time,
      p_horas_fim[v_index]::time,
      true,
      null,
      p_professor_id
    )
    returning id into v_horario_id;

    insert into public.turma_horarios (turma_id, horario_id, ordem)
    values (v_turma_id, v_horario_id, v_index);

    if v_index = 1 then
      update public.turmas
      set horario_id = v_horario_id
      where id = v_turma_id;
    end if;
  end loop;

  return v_turma_id;
end;
$function$;

revoke all on function public.criar_turma_fixa_admin_v2(text,text,integer,integer[],text[],text[],uuid,integer,text,date) from public, anon;
grant execute on function public.criar_turma_fixa_admin_v2(text,text,integer,integer[],text[],text[],uuid,integer,text,date) to authenticated;

create or replace function public.listar_turmas_coletivas_matricula(
  p_idioma text,
  p_modalidade text,
  p_aulas_semana integer
)
returns table(
  turma_id uuid,
  idioma text,
  modalidade text,
  aulas_semana integer,
  data_inicio date,
  professor_id uuid,
  professor_nome text,
  participantes integer,
  capacidade integer,
  vagas_restantes integer,
  nivel_referencia text,
  status_formacao text,
  horarios jsonb
)
language sql
security definer
set search_path = ''
as $function$
with base as (
  select
    t.id,
    t.idioma,
    t.modalidade,
    t.aulas_semana,
    t.data_inicio,
    t.professor_id,
    p.nome_completo as professor_nome,
    t.quantidade_maxima,
    t.nivel_referencia,
    t.status
  from public.turmas t
  left join public.professores p on p.id = t.professor_id
  where t.fixa = true
    and t.idioma = p_idioma
    and t.modalidade = p_modalidade
    and t.aulas_semana = p_aulas_semana
    and t.data_inicio is not null
    and t.data_inicio >= current_date
    and t.status not in ('cancelada','encerrada')
),
counts as (
  select
    tp.turma_id,
    count(*) filter (
      where tp.status in ('confirmado','convidado')
        and (tp.reserva_expira_em is null or tp.reserva_expira_em > now())
    )::integer as total
  from public.turma_participantes tp
  group by tp.turma_id
),
encounters as (
  select
    th.turma_id,
    th.ordem,
    h.id as horario_id,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fim
  from public.turma_horarios th
  join public.horarios h on h.id = th.horario_id
)
select
  b.id,
  b.idioma,
  b.modalidade,
  b.aulas_semana,
  b.data_inicio,
  b.professor_id,
  b.professor_nome,
  coalesce(c.total,0),
  b.quantidade_maxima,
  greatest(b.quantidade_maxima - coalesce(c.total,0),0),
  b.nivel_referencia,
  case
    when coalesce(c.total,0) = 0 then case when b.modalidade='dupla' then 'dupla_aberta' else 'grupo_aberto' end
    when coalesce(c.total,0) < b.quantidade_maxima then case when b.modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end
    else case when b.modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end
  end,
  jsonb_agg(
    jsonb_build_object(
      'horario_id', e.horario_id,
      'dia_semana', e.dia_semana,
      'hora_inicio', e.hora_inicio,
      'hora_fim', e.hora_fim,
      'ordem', e.ordem
    )
    order by e.ordem
  ) as horarios
from base b
join encounters e on e.turma_id = b.id
left join counts c on c.turma_id = b.id
where coalesce(c.total,0) < b.quantidade_maxima
  and not exists (
    select 1
    from encounters ce
    where ce.turma_id = b.id
      and private.professor_horario_ocupado(
        b.professor_id,
        ce.dia_semana,
        ce.hora_inicio,
        ce.hora_fim,
        b.id,
        ce.horario_id
      )
  )
group by
  b.id,b.idioma,b.modalidade,b.aulas_semana,b.data_inicio,
  b.professor_id,b.professor_nome,b.quantidade_maxima,
  b.nivel_referencia,b.status,c.total
having count(e.horario_id) = b.aulas_semana
order by b.nivel_referencia,b.data_inicio,e.dia_semana,min(e.hora_inicio);
$function$;

revoke all on function public.listar_turmas_coletivas_matricula(text,text,integer) from public;
grant execute on function public.listar_turmas_coletivas_matricula(text,text,integer) to anon, authenticated;

commit;