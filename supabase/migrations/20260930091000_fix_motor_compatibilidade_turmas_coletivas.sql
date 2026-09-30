-- Etapa 3: correções do motor de compatibilidade coletivo.
-- Mantém o motor como fonte de verdade para turma, encontros, professor,
-- capacidade e compatibilidade pedagógica.

create or replace function public.nivel_ordem_compatibilidade(p_nivel text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case lower(trim(coalesce(p_nivel, '')))
    when 'a1' then 1
    when 'basico' then 1
    when 'básico' then 1
    when 'a2' then 2
    when 'pre-intermediario' then 2
    when 'pré-intermediário' then 2
    when 'b1' then 3
    when 'intermediario' then 3
    when 'intermediário' then 3
    when 'b2' then 4
    when 'intermediario superior' then 4
    when 'intermediário superior' then 4
    when 'c1' then 5
    when 'avancado' then 5
    when 'avançado' then 5
    when 'c2' then 6
    else null
  end
$$;

create or replace function public.buscar_turmas_compativeis_matricula(
  p_idioma text,
  p_modalidade text,
  p_aulas_semana integer,
  p_dias text[] default null,
  p_periodos text[] default null,
  p_professor_id uuid default null,
  p_nivel_conversacao text default null,
  p_nivel_escrita text default null,
  p_nivel_compreensao text default null
)
returns table (
  turma_id uuid,
  idioma text,
  modalidade text,
  aulas_semana integer,
  professor_id uuid,
  participantes integer,
  capacidade integer,
  vagas_restantes integer,
  nivel_compativel boolean,
  nivel_status text,
  encontros jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      t.id,
      t.idioma,
      t.modalidade,
      t.aulas_semana,
      t.professor_id,
      coalesce(
        t.quantidade_maxima,
        case
          when t.modalidade = 'dupla' then 2
          when t.modalidade = 'grupo' then 3
          else 1
        end
      )::integer as capacidade,
      count(tp.id) filter (where tp.status = 'confirmado')::integer as participantes,
      count(distinct th.id)::integer as encontros_count,
      count(distinct h0.dia_semana)::integer as dias_count,
      bool_or(
        tp.id is not null
        and (
          tp.nivel_conversacao is not null
          or tp.nivel_escrita is not null
          or tp.nivel_compreensao is not null
        )
      ) as possui_nivel,
      bool_and(
        public.nivel_ordem_compatibilidade(tp.nivel_conversacao) is null
        or public.nivel_ordem_compatibilidade(p_nivel_conversacao) is null
        or abs(
          public.nivel_ordem_compatibilidade(tp.nivel_conversacao)
          - public.nivel_ordem_compatibilidade(p_nivel_conversacao)
        ) <= 1
      ) filter (where tp.id is not null) as conv_ok,
      bool_and(
        public.nivel_ordem_compatibilidade(tp.nivel_escrita) is null
        or public.nivel_ordem_compatibilidade(p_nivel_escrita) is null
        or abs(
          public.nivel_ordem_compatibilidade(tp.nivel_escrita)
          - public.nivel_ordem_compatibilidade(p_nivel_escrita)
        ) <= 1
      ) filter (where tp.id is not null) as esc_ok,
      bool_and(
        public.nivel_ordem_compatibilidade(tp.nivel_compreensao) is null
        or public.nivel_ordem_compatibilidade(p_nivel_compreensao) is null
        or abs(
          public.nivel_ordem_compatibilidade(tp.nivel_compreensao)
          - public.nivel_ordem_compatibilidade(p_nivel_compreensao)
        ) <= 1
      ) filter (where tp.id is not null) as comp_ok,
      public.nivel_ordem_compatibilidade(t.nivel_referencia) as ref_nivel
    from public.turmas t
    left join public.turma_participantes tp on tp.turma_id = t.id
    left join public.turma_horarios th on th.turma_id = t.id
    left join public.horarios h0 on h0.id = th.horario_id
    where t.idioma = p_idioma
      and t.modalidade = p_modalidade
      and t.aulas_semana = p_aulas_semana
      and (p_professor_id is null or t.professor_id = p_professor_id)
      and coalesce(t.status, '') not in (
        'cancelada', 'cancelado', 'encerrada', 'encerrado'
      )
    group by
      t.id,
      t.idioma,
      t.modalidade,
      t.aulas_semana,
      t.professor_id,
      t.quantidade_maxima,
      t.nivel_referencia
  ),
  enc as (
    select
      t.id as turma_id,
      jsonb_agg(
        jsonb_build_object(
          'ordem', th.ordem,
          'horario_id', h.id,
          'dia_semana', h.dia_semana,
          'hora_inicio', h.hora_inicio,
          'hora_fim', h.hora_fim,
          'professor_id', h.professor_id
        )
        order by th.ordem
      ) as encontros,
      count(*) filter (
        where p_dias is not null
          and not exists (
            select 1
            from unnest(p_dias) d(v)
            where d.v::integer = h.dia_semana
          )
      ) as dias_bad,
      count(*) filter (
        where p_periodos is not null
          and not exists (
            select 1
            from unnest(p_periodos) p(v)
            where lower(p.v) = case
              when extract(hour from h.hora_inicio) < 12 then 'manha'
              when extract(hour from h.hora_inicio) < 18 then 'tarde'
              else 'noite'
            end
          )
      ) as periodos_bad,
      count(*) filter (
        where t.professor_id is not null
          and h.professor_id is not null
          and t.professor_id <> h.professor_id
      ) as prof_bad
    from public.turmas t
    join public.turma_horarios th on th.turma_id = t.id
    join public.horarios h on h.id = th.horario_id
    group by t.id
  )
  select
    b.id,
    b.idioma,
    b.modalidade,
    b.aulas_semana,
    b.professor_id,
    b.participantes,
    b.capacidade,
    greatest(b.capacidade - b.participantes, 0),
    case
      when p_nivel_conversacao is null
       and p_nivel_escrita is null
       and p_nivel_compreensao is null then true
      when b.possui_nivel then coalesce(b.conv_ok and b.esc_ok and b.comp_ok, false)
      when b.ref_nivel is not null then
        (p_nivel_conversacao is null or abs(b.ref_nivel - public.nivel_ordem_compatibilidade(p_nivel_conversacao)) <= 1)
        and (p_nivel_escrita is null or abs(b.ref_nivel - public.nivel_ordem_compatibilidade(p_nivel_escrita)) <= 1)
        and (p_nivel_compreensao is null or abs(b.ref_nivel - public.nivel_ordem_compatibilidade(p_nivel_compreensao)) <= 1)
      else false
    end,
    case
      when p_nivel_conversacao is null
       and p_nivel_escrita is null
       and p_nivel_compreensao is null then 'nao_informado'
      when b.possui_nivel then 'avaliado'
      when b.ref_nivel is not null then 'referencia'
      else 'pendente'
    end,
    e.encontros
  from base b
  join enc e on e.turma_id = b.id
  where b.participantes < b.capacidade
    and b.encontros_count = p_aulas_semana
    and b.dias_count = p_aulas_semana
    and e.dias_bad = 0
    and e.periodos_bad = 0
    and e.prof_bad = 0
    and (
      (
        p_nivel_conversacao is null
        and p_nivel_escrita is null
        and p_nivel_compreensao is null
      )
      or (
        b.possui_nivel
        and coalesce(b.conv_ok and b.esc_ok and b.comp_ok, false)
      )
      or (
        not b.possui_nivel
        and b.ref_nivel is not null
      )
    )
  order by
    case when b.participantes > 0 then 0 else 1 end,
    (b.capacidade - b.participantes),
    b.id
$$;

grant execute on function public.nivel_ordem_compatibilidade(text) to anon, authenticated;
grant execute on function public.buscar_turmas_compativeis_matricula(
  text,text,integer,text[],text[],uuid,text,text,text
) to anon, authenticated;
