create or replace function public.listar_horarios_coletivos_planos(
  p_idioma text,
  p_modalidade text
)
returns table(
  id uuid,
  idioma text,
  dia_semana integer,
  hora_inicio time,
  hora_fim time,
  professor_id uuid,
  professor_nome text,
  tipo_horario text,
  nivel_referencia text,
  participantes integer,
  capacidade integer,
  vagas_restantes integer
)
language sql
security definer
set search_path to ''
as $function$
  with candidatos as (
    select
      h.id,
      h.idioma,
      h.dia_semana,
      h.hora_inicio,
      h.hora_fim,
      h.professor_id,
      h.tipo_horario,
      h.nivel_referencia,
      t.id as turma_id,
      coalesce(t.quantidade_maxima, case when p_modalidade = 'dupla' then 2 else 3 end) as capacidade
    from public.horarios h
    left join lateral (
      select t0.*
      from public.turmas t0
      where t0.modalidade = p_modalidade
        and t0.idioma = p_idioma
        and t0.status not in ('cancelada', 'encerrada')
        and (
          t0.horario_id = h.id
          or exists (
            select 1
            from public.turma_horarios th
            where th.turma_id = t0.id
              and th.horario_id = h.id
          )
        )
      order by case when t0.fixa then 0 else 1 end, t0.created_at asc
      limit 1
    ) t on true
    where p_idioma in ('ingles', 'alemao')
      and p_modalidade in ('dupla', 'grupo')
      and h.idioma = p_idioma
      and h.tipo_horario = p_modalidade
      and h.disponivel = true
      and h.aluno_id is null
      and not private.professor_horario_ocupado(
        h.professor_id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fim,
        t.id,
        h.id
      )
  ),
  contagens as (
    select
      c.*,
      coalesce((
        select count(*)::integer
        from public.turma_participantes tp
        where tp.turma_id = c.turma_id
          and tp.status in ('convidado', 'confirmado')
          and (tp.status <> 'convidado' or tp.reserva_expira_em is null or tp.reserva_expira_em >= now())
      ), 0)::integer as participantes
    from candidatos c
  )
  select
    c.id,
    c.idioma,
    c.dia_semana,
    c.hora_inicio,
    c.hora_fim,
    c.professor_id,
    p.nome_completo,
    c.tipo_horario,
    c.nivel_referencia,
    c.participantes,
    c.capacidade,
    greatest(c.capacidade - c.participantes, 0)
  from contagens c
  left join public.professores p on p.id = c.professor_id
  where c.participantes < c.capacidade
  order by c.nivel_referencia nulls last, c.dia_semana, c.hora_inicio;
$function$;

revoke all on function public.listar_horarios_coletivos_planos(text, text) from public;
grant execute on function public.listar_horarios_coletivos_planos(text, text) to anon, authenticated;