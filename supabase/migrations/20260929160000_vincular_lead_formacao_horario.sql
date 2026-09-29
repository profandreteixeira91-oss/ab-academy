alter table public.turmas
  add column if not exists horario_id uuid references public.horarios(id);

create index if not exists turmas_horario_id_idx on public.turmas(horario_id);

create unique index if not exists turmas_formacao_horario_ativa_uidx
  on public.turmas(horario_id)
  where horario_id is not null
    and status in ('em_formacao','aguardando_confirmacoes','pronta','ativa');

create or replace function public.vincular_lead_formacao(
  p_lead_id uuid,
  p_horario_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  l public.leads;
  h public.horarios;
  t public.turmas;
  p_id uuid;
  min_count integer;
  max_count integer;
begin
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead não encontrado.'; end if;

  select * into h from public.horarios
  where id = p_horario_id and disponivel = true and aluno_id is null
  for update;
  if not found then raise exception 'Horário não disponível.'; end if;

  if l.modalidade not in ('dupla','grupo') then
    raise exception 'Somente duplas e grupos geram formação.';
  end if;

  if h.tipo_horario <> l.modalidade then
    update public.horarios set tipo_horario=l.modalidade where id=h.id returning * into h;
  end if;

  min_count := case when l.modalidade='dupla' then 2 else 3 end;
  max_count := case when l.modalidade='dupla' then 2 else 6 end;

  select * into t from public.turmas
  where horario_id=h.id
    and status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
  order by created_at
  limit 1
  for update;

  if not found then
    insert into public.turmas(
      modalidade, idioma, aulas_semana, quantidade_minima, quantidade_maxima,
      horario_preferido, origem_lead_id, status, horario_id
    ) values (
      l.modalidade, l.idioma_interesse, coalesce(l.aulas_semana,1),
      min_count, max_count,
      case when l.horario_preferido is null then
        to_char(h.hora_inicio,'HH24:MI') else l.horario_preferido end,
      l.id, 'em_formacao', h.id
    ) returning * into t;
  end if;

  select id into p_id from public.turma_participantes
  where turma_id=t.id and lower(email)=lower(l.email)
  limit 1;

  if p_id is null then
    insert into public.turma_participantes(
      turma_id, lead_id, nome, email, telefone, papel, status,
      forma_inicio
    ) values (
      t.id, l.id, l.nome, l.email, l.telefone,
      case when exists(select 1 from public.turma_participantes x where x.turma_id=t.id) then 'participante' else 'organizador' end,
      'convidado',
      case when l.formacao_turma='iniciar_individual' then 'individual_aguardando' else 'coletivo' end
    );
  end if;

  update public.leads
  set status=case when status='novo' then 'contatado' else status end,
      updated_at=now()
  where id=l.id;

  return t.id;
end;
$function$;

revoke all on function public.vincular_lead_formacao(uuid,uuid) from public;
grant execute on function public.vincular_lead_formacao(uuid,uuid) to authenticated;