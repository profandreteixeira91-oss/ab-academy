-- Reestrutura o backend do fluxo de matrícula para:
-- plano -> disponibilidade -> horário -> dados -> pagamento.
-- A aplicação da lógica já foi validada no projeto remoto antes deste registro de migração.

create index if not exists turma_horarios_horario_turma_idx
  on public.turma_horarios (horario_id, turma_id);

create index if not exists turma_participantes_turma_status_reserva_idx
  on public.turma_participantes (turma_id, status, reserva_expira_em);

create index if not exists turmas_match_matricula_idx
  on public.turmas (idioma, modalidade, aulas_semana, status, horario_id);

create or replace function private.listar_horarios_matricula_inteligente(
  p_idioma text, p_modalidade text, p_aulas_semana integer,
  p_dias integer[] default null, p_periodos text[] default null,
  p_disponibilidade jsonb default null
)
returns table(
  id uuid, tipo_horario text, idioma text, dia_semana integer,
  hora_inicio time, hora_fim time, disponivel boolean, aluno_id uuid,
  created_at timestamptz, meet_url text, meet_space_name text,
  professor_id uuid, turma_id uuid, participante_id uuid,
  participantes integer, capacidade integer, vagas_restantes integer,
  valor_final numeric, status_formacao text, tipo_valor text
)
language sql security definer set search_path=''
as $$
with candidates as (
  select h.id,h.idioma,h.dia_semana,h.hora_inicio,h.hora_fim,h.disponivel,
    h.aluno_id,h.created_at,h.meet_url,h.meet_space_name,h.professor_id,
    t.id as turma_id,t.status as turma_status,
    coalesce(t.quantidade_maxima,case when p_modalidade='dupla' then 2 else 3 end) as capacidade,
    coalesce(pc.total,0)::integer as participantes
  from public.horarios h
  left join lateral (
    select t0.* from public.turmas t0
    where p_modalidade in ('dupla','grupo')
      and t0.modalidade=p_modalidade and t0.idioma=p_idioma
      and t0.aulas_semana=p_aulas_semana
      and t0.status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
      and (t0.horario_id=h.id or exists(
        select 1 from public.turma_horarios th
        where th.turma_id=t0.id and th.horario_id=h.id))
      and (t0.horario_id=h.id or exists(
        select 1 from public.turma_horarios th
        join public.horarios hp on hp.id=th.horario_id
        where th.turma_id=t0.id and hp.professor_id=h.professor_id))
    order by case when t0.status in ('em_formacao','aguardando_confirmacoes') then 0 else 1 end,
      t0.created_at asc limit 1
  ) t on true
  left join lateral (
    select count(*)::integer total from public.turma_participantes tp
    where tp.turma_id=t.id and tp.status in ('convidado','confirmado')
      and (tp.status<>'convidado' or tp.reserva_expira_em is null or tp.reserva_expira_em>=now())
  ) pc on true
  where h.idioma=p_idioma and h.disponivel=true
    and (
      (p_modalidade='individual' and h.aluno_id is null
       and coalesce(h.tipo_horario,'individual')='individual' and t.id is null)
      or
      (p_modalidade in ('dupla','grupo') and h.aluno_id is null
       and (coalesce(h.tipo_horario,'individual')='individual' or t.id is not null)
       and coalesce(pc.total,0)<coalesce(t.quantidade_maxima,case when p_modalidade='dupla' then 2 else 3 end))
    )
    and (p_dias is null or cardinality(p_dias)=0 or h.dia_semana=any(p_dias))
    and (p_periodos is null or cardinality(p_periodos)=0 or
      (('manha'=any(p_periodos) and h.hora_inicio<time '12:00')
       or ('tarde'=any(p_periodos) and h.hora_inicio>=time '12:00' and h.hora_inicio<time '18:00')
       or ('noite'=any(p_periodos) and h.hora_inicio>=time '18:00')))
    and (p_disponibilidade is null
      or p_disponibilidade->h.dia_semana::text is null
      or (h.hora_inicio >= (p_disponibilidade->h.dia_semana::text->>'start')::time
          and h.hora_fim <= (p_disponibilidade->h.dia_semana::text->>'end')::time))
), ranked as (
  select c.*,case
    when p_modalidade='individual' then 0
    when c.turma_id is not null and c.turma_status in ('em_formacao','aguardando_confirmacoes') and c.participantes>0 then 0
    when c.turma_id is not null and c.turma_status in ('em_formacao','aguardando_confirmacoes') then 1
    when c.turma_id is not null and c.turma_status in ('pronta','ativa') then 2
    else 1 end as prioridade
  from candidates c
)
select r.id,case when p_modalidade='individual' then 'individual' else p_modalidade end,
  r.idioma,r.dia_semana,r.hora_inicio,r.hora_fim,r.disponivel,r.aluno_id,r.created_at,
  r.meet_url,r.meet_space_name,r.professor_id,r.turma_id,null::uuid,r.participantes,
  r.capacidade,greatest(0,r.capacidade-r.participantes),
  case when p_modalidade='individual' then (
    select p.preco from public.planos p where p.idioma=p_idioma
      and p.modalidade='individual' and p.tipo='mensal' and p.aulas_semana=p_aulas_semana
      and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1)
    when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes')
      then public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana)
    else public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,r.capacidade) end,
  case when p_modalidade='individual' then 'individual'
    when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes')
      then case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end
    when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end,
  case when p_modalidade='individual' then 'individual'
    when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes')
      then 'coletiva_em_formacao' else 'coletiva_formada' end
from ranked r
order by r.prioridade,r.participantes desc,r.dia_semana,r.hora_inicio;
$$;

create or replace function public.listar_horarios_matricula_inteligente(
  p_idioma text,p_modalidade text,p_aulas_semana integer,
  p_dias integer[] default null,p_periodos text[] default null,p_disponibilidade jsonb default null
)
returns table(
  id uuid,tipo_horario text,idioma text,dia_semana integer,hora_inicio time,hora_fim time,
  disponivel boolean,aluno_id uuid,created_at timestamptz,meet_url text,meet_space_name text,
  professor_id uuid,turma_id uuid,participante_id uuid,participantes integer,capacidade integer,
  vagas_restantes integer,valor_final numeric,status_formacao text,tipo_valor text
)
language sql security definer set search_path=''
as $$ select * from private.listar_horarios_matricula_inteligente($1,$2,$3,$4,$5,$6) $$;

revoke execute on function public.listar_horarios_matricula_inteligente(text,text,integer,integer[],text[],jsonb) from public;
grant execute on function public.listar_horarios_matricula_inteligente(text,text,integer,integer[],text[],jsonb) to anon,authenticated;

create or replace function private.analisar_horario_matricula(
  p_horario_id uuid,p_idioma text,p_modalidade text,p_aulas_semana integer
)
returns table(
  horario_id uuid,modalidade text,idioma text,aulas_semana integer,dia_semana integer,
  hora_inicio time,hora_fim time,professor_id uuid,turma_id uuid,
  quantidade_atual_alunos integer,capacidade integer,status_formacao text,
  valor_final numeric,tipo_valor text
)
language plpgsql security definer set search_path=''
as $$
declare v_h public.horarios;v_t public.turmas;v_count integer:=0;v_cap integer;
  v_price numeric;v_status text;v_type text;
begin
  if p_idioma not in ('ingles','alemao') or p_modalidade not in ('individual','dupla','grupo')
    or p_aulas_semana not between 1 and 3 then
    raise exception 'Parâmetros de análise de horário inválidos.';
  end if;
  select h.* into v_h from public.horarios h where h.id=p_horario_id and h.idioma=p_idioma and h.disponivel=true;
  if not found then raise exception 'Este horário não está mais disponível.'; end if;
  if p_modalidade='individual' then
    if v_h.aluno_id is not null or coalesce(v_h.tipo_horario,'individual')<>'individual' then
      raise exception 'Este horário não está disponível para aula individual.';
    end if;
    select p.preco into v_price from public.planos p where p.idioma=p_idioma
      and p.modalidade='individual' and p.tipo='mensal' and p.aulas_semana=p_aulas_semana and p.ativo=true
      order by p.updated_at desc,p.created_at desc limit 1;
    if v_price is null then raise exception 'Preço individual não configurado.'; end if;
    return query select v_h.id,p_modalidade,v_h.idioma,p_aulas_semana,v_h.dia_semana,v_h.hora_inicio,
      v_h.hora_fim,v_h.professor_id,null::uuid,0,1,'individual'::text,v_price,'individual'::text; return;
  end if;
  v_cap:=case when p_modalidade='dupla' then 2 else 3 end;
  select t.* into v_t from public.turmas t
    where t.id in (select th.turma_id from public.turma_horarios th where th.horario_id=p_horario_id
      union select h2.id from public.turmas h2 where h2.horario_id=p_horario_id)
      and t.idioma=p_idioma and t.modalidade=p_modalidade and t.aulas_semana=p_aulas_semana
      and t.status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
    order by case when t.status in ('em_formacao','aguardando_confirmacoes') then 0 else 1 end,t.created_at asc limit 1;
  if found then
    select count(*)::integer into v_count from public.turma_participantes tp where tp.turma_id=v_t.id
      and tp.status in ('convidado','confirmado')
      and (tp.status<>'convidado' or tp.reserva_expira_em is null or tp.reserva_expira_em>=now());
    if v_count>=v_cap then raise exception 'Este horário acabou de ser preenchido.'; end if;
    if v_t.status in ('em_formacao','aguardando_confirmacoes') then
      v_status:=case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end;
      v_type:='coletiva_em_formacao';v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana);
    else
      v_status:=case when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end;
      v_type:='coletiva_formada';v_price:=public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,v_cap);
    end if;
  else
    v_count:=0;v_status:=case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end;
    v_type:='coletiva_em_formacao';v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana);
  end if;
  return query select v_h.id,p_modalidade,v_h.idioma,p_aulas_semana,v_h.dia_semana,v_h.hora_inicio,v_h.hora_fim,
    v_h.professor_id,case when v_t.id is not null then v_t.id else null::uuid end,v_count,
    case when v_t.id is not null then v_t.quantidade_maxima else v_cap end,v_status,v_price,v_type;
end;
$$;

create or replace function private.selecionar_horario_matricula_v2(
  p_horario_id uuid,p_idioma text,p_modalidade text,p_aulas_semana integer,
  p_turma_id uuid default null,p_reserva_token text default null,p_nome text default null,p_email text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_h public.horarios; v_t public.turmas; v_p public.turma_participantes;
  v_count integer; v_max integer; v_price numeric; v_ordem integer;
  v_token text:=nullif(trim(coalesce(p_reserva_token,'')),'');
  v_nome text:=nullif(trim(coalesce(p_nome,'')),'');
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_status text; v_tipo_valor text;
begin
  if p_idioma not in ('ingles','alemao') or p_modalidade not in ('individual','dupla','grupo') or p_aulas_semana not in (1,2,3) then
    raise exception 'Parâmetros de matrícula inválidos.';
  end if;
  if p_modalidade<>'individual' and (v_token is null or v_nome is null or v_email is null) then
    raise exception 'Informe os dados básicos da matrícula antes de reservar o horário.';
  end if;
  select * into v_h from public.horarios where id=p_horario_id and idioma=p_idioma and disponivel=true for update;
  if not found then raise exception 'Este horário não está mais disponível.'; end if;

  if p_modalidade='individual' then
    if p_turma_id is not null or v_h.aluno_id is not null or coalesce(v_h.tipo_horario,'individual')<>'individual' then
      raise exception 'Este horário não está disponível para aula individual.';
    end if;
    select p.preco into v_price from public.planos p
    where p.idioma=p_idioma and p.modalidade='individual' and p.tipo='mensal'
      and p.aulas_semana=p_aulas_semana and p.ativo=true
    order by p.updated_at desc,p.created_at desc limit 1;
    if v_price is null then raise exception 'Preço individual não configurado.'; end if;
    return jsonb_build_object(
      'id',v_h.id,'idioma',v_h.idioma,'dia_semana',v_h.dia_semana,'hora_inicio',v_h.hora_inicio,'hora_fim',v_h.hora_fim,
      'tipo_horario','individual','disponivel',true,'turma_id',null,'participante_id',null,'participantes',0,
      'capacidade',1,'vagas_restantes',1,'valor_mensal',v_price,'status_formacao','individual',
      'tipo_valor','individual','professor_id',v_h.professor_id
    );
  end if;

  if p_turma_id is null then
    update public.turma_participantes set status='cancelado',updated_at=now()
    where reserva_token=v_token and status='convidado' and reserva_expira_em is not null and reserva_expira_em<now();

    select * into v_t from public.turmas
    where idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana
      and status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
      and (horario_id=p_horario_id or exists(
        select 1 from public.turma_horarios th where th.turma_id=turmas.id and th.horario_id=p_horario_id))
    order by case when status in ('em_formacao','aguardando_confirmacoes') then 0 else 1 end,created_at asc
    limit 1 for update;

    if not found then
      v_max:=case when p_modalidade='dupla' then 2 else 3 end;
      insert into public.turmas(
        modalidade,idioma,aulas_semana,quantidade_minima,quantidade_maxima,horario_preferido,status,horario_id,created_at,updated_at
      ) values(
        p_modalidade,p_idioma,p_aulas_semana,
        case when p_modalidade='dupla' then 2 else 3 end,v_max,
        to_char(v_h.hora_inicio,'HH24:MI'),'em_formacao',p_horario_id,now(),now()
      ) returning * into v_t;
    end if;
  else
    select * into v_t from public.turmas
    where id=p_turma_id and idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana
      and status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
    for update;
    if not found then raise exception 'A turma selecionada não está mais disponível.'; end if;
  end if;

  if v_t.modalidade<>p_modalidade or v_t.idioma<>p_idioma or v_t.aulas_semana<>p_aulas_semana then
    raise exception 'A turma não é compatível com a modalidade selecionada.';
  end if;
  if v_t.quantidade_maxima <> (case when p_modalidade='dupla' then 2 else 3 end) then
    raise exception 'A capacidade da turma não corresponde à modalidade.';
  end if;

  if not exists(select 1 from public.turma_horarios where turma_id=v_t.id and horario_id=p_horario_id) then
    if exists(select 1 from public.turma_horarios th where th.horario_id=p_horario_id and th.turma_id<>v_t.id) then
      raise exception 'Este horário já pertence a outra turma.';
    end if;
    select coalesce(max(ordem),0)+1 into v_ordem from public.turma_horarios where turma_id=v_t.id;
    if v_ordem>p_aulas_semana then raise exception 'A turma já possui todos os horários desta modalidade.'; end if;
    insert into public.turma_horarios(turma_id,horario_id,ordem) values(v_t.id,p_horario_id,v_ordem);
  end if;

  select count(*)::integer into v_count from public.turma_participantes
  where turma_id=v_t.id and status in ('convidado','confirmado')
    and (status<>'convidado' or reserva_expira_em is null or reserva_expira_em>=now());
  if v_count>=v_t.quantidade_maxima then raise exception 'Esta turma está completa.'; end if;

  select * into v_p from public.turma_participantes
  where turma_id=v_t.id and reserva_token=v_token and status in ('convidado','confirmado')
  order by created_at desc limit 1 for update;

  if not found then
    insert into public.turma_participantes(
      turma_id,user_id,nome,email,papel,status,convidado_em,forma_inicio,
      reserva_expira_em,reserva_token,created_at,updated_at,valor_individual
    ) values(
      v_t.id,null,v_nome,v_email,case when v_count=0 then 'organizador' else 'participante' end,
      'convidado',now(),'coletivo',now()+interval '30 minutes',v_token,now(),now(),
      (select p.preco from public.planos p where p.idioma=p_idioma and p.modalidade='individual'
        and p.tipo='mensal' and p.aulas_semana=1 and p.ativo=true
        order by p.updated_at desc,p.created_at desc limit 1)
    ) returning * into v_p;
    v_count:=v_count+1;
  else
    update public.turma_participantes set nome=v_nome,email=v_email,updated_at=now() where id=v_p.id;
    select * into v_p from public.turma_participantes where id=v_p.id;
  end if;

  if v_t.status in ('em_formacao','aguardando_confirmacoes') then
    v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana);
    v_status:=case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end;
    v_tipo_valor:='coletiva_em_formacao';
  else
    v_price:=public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,v_t.quantidade_maxima);
    v_status:=case when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end;
    v_tipo_valor:='coletiva_formada';
  end if;

  update public.turma_participantes set
    valor_individual=coalesce(valor_individual,(
      select p.preco from public.planos p where p.idioma=p_idioma and p.modalidade='individual'
        and p.tipo='mensal' and p.aulas_semana=1 and p.ativo=true
      order by p.updated_at desc,p.created_at desc limit 1)),
    valor_coletivo=v_price,
    valor_coletivo_normal=case
      when v_t.status in ('em_formacao','aguardando_confirmacoes')
        then public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,v_t.quantidade_maxima)
      else v_price end,
    updated_at=now()
  where id=v_p.id;

  update public.horarios set tipo_horario=p_modalidade where id=p_horario_id;

  return jsonb_build_object(
    'id',v_h.id,'idioma',v_h.idioma,'dia_semana',v_h.dia_semana,'hora_inicio',v_h.hora_inicio,'hora_fim',v_h.hora_fim,
    'tipo_horario',p_modalidade,'disponivel',true,'turma_id',v_t.id,'participante_id',v_p.id,
    'participantes',v_count,'capacidade',v_t.quantidade_maxima,'vagas_restantes',v_t.quantidade_maxima-v_count,
    'valor_mensal',v_price,'status_formacao',v_status,'tipo_valor',v_tipo_valor,'professor_id',v_h.professor_id
  );
end;
$function$;
