-- Permite cadastrar individual, dupla e grupo no mesmo horário para o mesmo professor.
-- A ocupação passa a ser determinada pelo professor: quando qualquer modalidade
-- reserva um intervalo, os demais tipos deixam de aparecer como disponíveis nesse intervalo.

create or replace function private.professor_horario_ocupado(
  p_professor_id uuid,
  p_dia_semana integer,
  p_hora_inicio time,
  p_hora_fim time,
  p_excluir_turma_id uuid default null,
  p_excluir_horario_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.horarios h
    where h.professor_id = p_professor_id
      and h.dia_semana = p_dia_semana
      and h.hora_inicio < p_hora_fim and h.hora_fim > p_hora_inicio
      and h.id is distinct from p_excluir_horario_id
      and h.aluno_id is not null and h.disponivel = false
  )
  or exists (
    select 1
    from public.turma_horarios th
    join public.horarios h on h.id = th.horario_id
    join public.turmas t on t.id = th.turma_id
    where h.professor_id = p_professor_id
      and h.dia_semana = p_dia_semana
      and h.hora_inicio < p_hora_fim and h.hora_fim > p_hora_inicio
      and h.id is distinct from p_excluir_horario_id
      and t.id is distinct from p_excluir_turma_id
      and t.status not in ('cancelada','cancelado','encerrada','encerrado')
      and exists (
        select 1 from public.turma_participantes tp
        where tp.turma_id = t.id
          and tp.status in ('convidado','confirmado')
          and (tp.status = 'confirmado' or tp.reserva_expira_em is null or tp.reserva_expira_em > now())
      )
  );
$$;

revoke all on function private.professor_horario_ocupado(uuid,integer,time,time,uuid,uuid) from public;

create or replace function public.criar_turma_fixa_admin(
  p_idioma text,p_modalidade text,p_aulas_semana integer,p_dias integer[],
  p_horas_inicio text[],p_horas_fim text[],p_professor_id uuid,p_quantidade_maxima integer default null
)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_turma_id uuid; v_capacity integer; v_index integer; v_horario_id uuid;
begin
  if not exists (select 1 from public.admin_users where user_id=auth.uid() and ativo=true) then raise exception 'Acesso restrito ao administrador.'; end if;
  if p_modalidade not in ('dupla','grupo') then raise exception 'Modalidade coletiva inválida.'; end if;
  if p_idioma not in ('ingles','alemao') then raise exception 'Idioma inválido.'; end if;
  if p_aulas_semana < 1 or p_aulas_semana > 3 then raise exception 'A frequência deve estar entre 1 e 3 aulas por semana.'; end if;
  if coalesce(array_length(p_dias,1),0) <> p_aulas_semana or coalesce(array_length(p_horas_inicio,1),0) <> p_aulas_semana or coalesce(array_length(p_horas_fim,1),0) <> p_aulas_semana then raise exception 'Informe um encontro para cada aula semanal.'; end if;
  v_capacity := case when p_modalidade='dupla' then 2 else least(greatest(coalesce(p_quantidade_maxima,6),3),6) end;
  if exists (select 1 from unnest(p_dias) d where d < 0 or d > 6) then raise exception 'Dia da semana inválido.'; end if;
  if (select count(distinct x) from unnest(p_dias) x) <> p_aulas_semana then raise exception 'Os dias dos encontros devem ser diferentes.'; end if;
  for v_index in 1..p_aulas_semana loop
    if p_horas_inicio[v_index] >= p_horas_fim[v_index] then raise exception 'O horário final deve ser maior que o inicial.'; end if;
  end loop;
  insert into public.turmas (modalidade,idioma,aulas_semana,quantidade_minima,quantidade_maxima,horario_preferido,status,professor_id,fixa)
  values (p_modalidade,p_idioma,p_aulas_semana,case when p_modalidade='dupla' then 2 else 3 end,v_capacity,null,'em_formacao',p_professor_id,true)
  returning id into v_turma_id;
  for v_index in 1..p_aulas_semana loop
    insert into public.horarios (tipo_horario,idioma,dia_semana,hora_inicio,hora_fim,disponivel,aluno_id,professor_id)
    values (p_modalidade,p_idioma,p_dias[v_index],p_horas_inicio[v_index]::time,p_horas_fim[v_index]::time,true,null,p_professor_id)
    returning id into v_horario_id;
    insert into public.turma_horarios (turma_id,horario_id,ordem) values (v_turma_id,v_horario_id,v_index);
    if v_index=1 then update public.turmas set horario_id=v_horario_id where id=v_turma_id; end if;
  end loop;
  return v_turma_id;
end;
$$;

create or replace function private.listar_horarios_matricula_inteligente(
  p_idioma text,p_modalidade text,p_aulas_semana integer,p_dias integer[] default null,
  p_periodos text[] default null,p_disponibilidade jsonb default null
)
returns table(id uuid,tipo_horario text,idioma text,dia_semana integer,hora_inicio time,hora_fim time,
  disponivel boolean,aluno_id uuid,created_at timestamptz,meet_url text,meet_space_name text,professor_id uuid,
  turma_id uuid,participante_id uuid,participantes integer,capacidade integer,vagas_restantes integer,
  valor_final numeric,status_formacao text,tipo_valor text)
language sql security definer set search_path to ''
as $$
with candidates as (
  select h.id,h.idioma,h.dia_semana,h.hora_inicio,h.hora_fim,h.disponivel,h.aluno_id,h.created_at,h.meet_url,h.meet_space_name,h.professor_id,
    t.id turma_id,t.status turma_status,coalesce(t.quantidade_maxima,case when p_modalidade='dupla' then 2 else 3 end) capacidade,coalesce(pc.total,0)::integer participantes
  from public.horarios h
  left join lateral (
    select t0.* from public.turmas t0
    where p_modalidade in ('dupla','grupo') and t0.modalidade=p_modalidade and t0.idioma=p_idioma and t0.aulas_semana=p_aulas_semana
      and t0.status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
      and (t0.horario_id=h.id or exists(select 1 from public.turma_horarios th where th.turma_id=t0.id and th.horario_id=h.id))
    order by case when t0.status in ('em_formacao','aguardando_confirmacoes') then 0 else 1 end,t0.created_at asc limit 1
  ) t on true
  left join lateral (
    select count(*)::integer total from public.turma_participantes tp where tp.turma_id=t.id and tp.status in ('convidado','confirmado') and (tp.status<>'convidado' or tp.reserva_expira_em is null or tp.reserva_expira_em>=now())
  ) pc on true
  where h.idioma=p_idioma and h.disponivel=true
    and not private.professor_horario_ocupado(h.professor_id,h.dia_semana,h.hora_inicio,h.hora_fim,t.id,h.id)
    and ((p_modalidade='individual' and h.aluno_id is null and coalesce(h.tipo_horario,'individual')='individual' and t.id is null)
      or (p_modalidade in ('dupla','grupo') and h.aluno_id is null and (coalesce(h.tipo_horario,'individual')='individual' or t.id is not null) and coalesce(pc.total,0)<coalesce(t.quantidade_maxima,case when p_modalidade='dupla' then 2 else 3 end)))
    and (p_dias is null or cardinality(p_dias)=0 or h.dia_semana=any(p_dias))
    and (p_periodos is null or cardinality(p_periodos)=0 or (('manha'=any(p_periodos) and h.hora_inicio<time '12:00') or ('tarde'=any(p_periodos) and h.hora_inicio>=time '12:00' and h.hora_inicio<time '18:00') or ('noite'=any(p_periodos) and h.hora_inicio>=time '18:00')))
    and (p_disponibilidade is null or p_disponibilidade->h.dia_semana::text is null or (h.hora_inicio >= (p_disponibilidade->h.dia_semana::text->>'start')::time and h.hora_fim <= (p_disponibilidade->h.dia_semana::text->>'end')::time))
), ranked as (
  select c.*,case when p_modalidade='individual' then 0 when c.turma_id is not null and c.turma_status in ('em_formacao','aguardando_confirmacoes') and c.participantes>0 then 0 when c.turma_id is not null and c.turma_status in ('em_formacao','aguardando_confirmacoes') then 1 when c.turma_id is not null and c.turma_status in ('pronta','ativa') then 2 else 1 end prioridade from candidates c
)
select r.id,case when p_modalidade='individual' then 'individual' else p_modalidade end,r.idioma,r.dia_semana,r.hora_inicio,r.hora_fim,r.disponivel,r.aluno_id,r.created_at,r.meet_url,r.meet_space_name,r.professor_id,r.turma_id,null::uuid,r.participantes,
  case when p_modalidade='individual' then 1 else r.capacidade end,case when p_modalidade='individual' then 1 else greatest(0,r.capacidade-r.participantes) end,
  case when p_modalidade='individual' then (select p.preco from public.planos p where p.idioma=p_idioma and p.modalidade='individual' and p.tipo='mensal' and p.aulas_semana=p_aulas_semana and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1)
    when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes') then public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana) else public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,r.capacidade) end,
  case when p_modalidade='individual' then 'individual' when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes') then case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end,
  case when p_modalidade='individual' then 'individual' when r.turma_id is null or r.turma_status in ('em_formacao','aguardando_confirmacoes') then 'coletiva_em_formacao' else 'coletiva_formada' end
from ranked r order by r.prioridade,r.participantes desc,r.dia_semana,r.hora_inicio;
$$;

create or replace function public.listar_horarios_coletivos_matricula(
  p_idioma text,p_modalidade text,p_aulas_semana integer,p_dias integer[] default null,p_periodos text[] default null,p_disponibilidade jsonb default null
)
returns table(turma_id uuid,horario_id uuid,idioma text,modalidade text,aulas_semana integer,dia_semana integer,hora_inicio time,hora_fim time,professor_id uuid,participantes integer,capacidade integer,vagas_restantes integer,nivel_referencia text,status_formacao text)
language sql security definer set search_path to 'public'
as $$
with turma_base as (select t.id,t.idioma,t.modalidade,t.aulas_semana,t.professor_id,t.quantidade_maxima,t.nivel_referencia,t.status from public.turmas t where t.fixa=true and t.idioma=p_idioma and t.modalidade=p_modalidade and t.aulas_semana=p_aulas_semana and t.status not in ('cancelada','encerrada')),
participant_counts as (select tp.turma_id,count(*) filter(where tp.status in ('confirmado','convidado') and (tp.reserva_expira_em is null or tp.reserva_expira_em>now()))::integer total from public.turma_participantes tp group by tp.turma_id),
encounters as (select th.turma_id,th.ordem,h.id horario_id,h.dia_semana,h.hora_inicio,h.hora_fim from public.turma_horarios th join public.horarios h on h.id=th.horario_id),
complete as (select tb.*,coalesce(pc.total,0) total,count(e.horario_id)::integer encounter_count from turma_base tb left join participant_counts pc on pc.turma_id=tb.id left join encounters e on e.turma_id=tb.id group by tb.id,tb.idioma,tb.modalidade,tb.aulas_semana,tb.professor_id,tb.quantidade_maxima,tb.nivel_referencia,tb.status,pc.total having count(e.horario_id)=tb.aulas_semana)
select c.id,e.horario_id,c.idioma,c.modalidade,c.aulas_semana,e.dia_semana,e.hora_inicio,e.hora_fim,c.professor_id,c.total,c.quantidade_maxima,greatest(c.quantidade_maxima-c.total,0),c.nivel_referencia,
  case when c.total=0 then case when c.modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end when c.total<c.quantidade_maxima then case when c.modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end else case when c.modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end end
from complete c join encounters e on e.turma_id=c.id
where c.total<c.quantidade_maxima and not private.professor_horario_ocupado(c.professor_id,e.dia_semana,e.hora_inicio,e.hora_fim,c.id,e.horario_id)
  and (p_dias is null or e.dia_semana=any(p_dias))
  and (p_periodos is null or (('manha'=any(p_periodos) and e.hora_inicio<time '12:00') or ('tarde'=any(p_periodos) and e.hora_inicio>=time '12:00' and e.hora_inicio<time '18:00') or ('noite'=any(p_periodos) and e.hora_inicio>=time '18:00')))
  and (p_disponibilidade is null or (p_disponibilidade ? e.dia_semana::text and e.hora_inicio >= (p_disponibilidade->e.dia_semana::text->>'start')::time and e.hora_fim <= (p_disponibilidade->e.dia_semana::text->>'end')::time))
order by c.total desc,e.dia_semana,e.hora_inicio;
$$;

create or replace function private.analisar_horario_matricula(p_horario_id uuid,p_idioma text,p_modalidade text,p_aulas_semana integer)
returns table(horario_id uuid,modalidade text,idioma text,aulas_semana integer,dia_semana integer,hora_inicio time,hora_fim time,professor_id uuid,turma_id uuid,quantidade_atual_alunos integer,capacidade integer,status_formacao text,valor_final numeric,tipo_valor text)
language plpgsql security definer set search_path to ''
as $$
declare v_h public.horarios; v_t public.turmas; v_count integer:=0; v_cap integer; v_price numeric; v_status text; v_type text;
begin
  if p_idioma not in ('ingles','alemao') or p_modalidade not in ('individual','dupla','grupo') or p_aulas_semana not between 1 and 3 then raise exception 'Parâmetros de análise de horário inválidos.'; end if;
  select h.* into v_h from public.horarios h where h.id=p_horario_id and h.idioma=p_idioma and h.disponivel=true;
  if not found then raise exception 'Este horário não está mais disponível.'; end if;
  if p_modalidade='individual' then
    if v_h.aluno_id is not null or coalesce(v_h.tipo_horario,'individual')<>'individual' then raise exception 'Este horário não está disponível para aula individual.'; end if;
    if private.professor_horario_ocupado(v_h.professor_id,v_h.dia_semana,v_h.hora_inicio,v_h.hora_fim,null,v_h.id) then raise exception 'Este horário já está ocupado pelo professor.'; end if;
    select p.preco into v_price from public.planos p where p.idioma=p_idioma and p.modalidade='individual' and p.tipo='mensal' and p.aulas_semana=p_aulas_semana and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1;
    if v_price is null then raise exception 'Preço individual não configurado.'; end if;
    return query select v_h.id,p_modalidade,v_h.idioma,p_aulas_semana,v_h.dia_semana,v_h.hora_inicio,v_h.hora_fim,v_h.professor_id,null::uuid,0,1,'individual'::text,v_price,'individual'::text; return;
  end if;
  v_cap:=case when p_modalidade='dupla' then 2 else 3 end;
  select t.* into v_t from public.turmas t where t.id in (select th.turma_id from public.turma_horarios th where th.horario_id=p_horario_id union select h2.id from public.turmas h2 where h2.horario_id=p_horario_id) and t.idioma=p_idioma and t.modalidade=p_modalidade and t.aulas_semana=p_aulas_semana and t.status in ('em_formacao','aguardando_confirmacoes','pronta','ativa') order by case when t.status in ('em_formacao','aguardando_confirmacoes') then 0 else 1 end,t.created_at asc limit 1;
  if found then select count(*)::integer into v_count from public.turma_participantes tp where tp.turma_id=v_t.id and tp.status in ('convidado','confirmado') and (tp.status<>'convidado' or tp.reserva_expira_em is null or tp.reserva_expira_em>=now()); if v_count>=coalesce(v_t.quantidade_maxima,v_cap) then raise exception 'Este horário acabou de ser preenchido.'; end if; else v_count:=0; end if;
  if private.professor_horario_ocupado(v_h.professor_id,v_h.dia_semana,v_h.hora_inicio,v_h.hora_fim,case when v_t.id is null then null else v_t.id end,v_h.id) then raise exception 'Este horário já está ocupado pelo professor.'; end if;
  if found and v_t.status in ('em_formacao','aguardando_confirmacoes') then v_status:=case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end; v_type:='coletiva_em_formacao'; v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana);
  elsif found then v_status:=case when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end; v_type:='coletiva_formada'; v_price:=public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,coalesce(v_t.quantidade_maxima,v_cap));
  else v_status:=case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end; v_type:='coletiva_em_formacao'; v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana); end if;
  return query select v_h.id,p_modalidade,v_h.idioma,p_aulas_semana,v_h.dia_semana,v_h.hora_inicio,v_h.hora_fim,v_h.professor_id,case when v_t.id is not null then v_t.id else null::uuid end,v_count,case when v_t.id is not null then v_t.quantidade_maxima else v_cap end,v_status,v_price,v_type;
end;
$$;

create or replace function public.reservar_turma_matricula_publico(p_turma_id uuid,p_horario_ids uuid[],p_idioma text,p_modalidade text,p_aulas_semana integer,p_nivel_conversacao text,p_nivel_escrita text,p_nivel_compreensao text,p_reserva_token text,p_nome text,p_email text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_turma public.turmas%rowtype; v_count integer; v_participant public.turma_participantes%rowtype; v_price numeric; v_capacity integer; v_existing_level text; v_ids uuid[]; v_student_level text;
begin
  if coalesce(array_length(p_horario_ids,1),0)<>p_aulas_semana then raise exception 'A turma selecionada não possui todos os encontros semanais necessários.'; end if;
  v_student_level:=coalesce(nullif(trim(p_nivel_conversacao),''),nullif(trim(p_nivel_escrita),''),nullif(trim(p_nivel_compreensao),''));
  if v_student_level is null then raise exception 'O resultado de proficiência é obrigatório.'; end if;
  select * into v_turma from public.turmas where id=p_turma_id and fixa=true and idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana and status not in ('cancelada','encerrada') for update;
  if not found then raise exception 'Turma fixa não encontrada ou indisponível.'; end if;
  v_capacity:=v_turma.quantidade_maxima;
  select array_agg(th.horario_id order by th.ordem) into v_ids from public.turma_horarios th where th.turma_id=v_turma.id;
  if v_ids is null or v_ids <@ p_horario_ids is false or p_horario_ids <@ v_ids is false then raise exception 'Os encontros selecionados não correspondem à turma fixa.'; end if;
  if exists (select 1 from public.turma_horarios th join public.horarios h on h.id=th.horario_id where th.turma_id=v_turma.id and private.professor_horario_ocupado(v_turma.professor_id,h.dia_semana,h.hora_inicio,h.hora_fim,v_turma.id,h.id)) then raise exception 'Um dos horários selecionados já está ocupado pelo professor.'; end if;
  select count(*) into v_count from public.turma_participantes tp where tp.turma_id=v_turma.id and tp.status in ('confirmado','convidado') and (tp.reserva_expira_em is null or tp.reserva_expira_em>now()) and tp.reserva_token is distinct from p_reserva_token;
  if v_count>=v_capacity then raise exception 'Esta turma já está completa.'; end if;
  v_existing_level:=v_turma.nivel_referencia;
  if v_existing_level is not null and lower(trim(v_existing_level))<>lower(trim(v_student_level)) then raise exception 'O nível desta turma é % e não corresponde ao resultado da sua proficiência.',v_existing_level; end if;
  if v_existing_level is null then update public.turmas set nivel_referencia=v_student_level,nivel_minimo=v_student_level,nivel_maximo=v_student_level,updated_at=now() where id=v_turma.id; end if;
  select * into v_participant from public.turma_participantes where reserva_token=p_reserva_token limit 1;
  if found then update public.turma_participantes set turma_id=v_turma.id,nome=trim(p_nome),email=lower(trim(p_email)),nivel_conversacao=p_nivel_conversacao,nivel_escrita=p_nivel_escrita,nivel_compreensao=p_nivel_compreensao,reserva_expira_em=now()+interval '30 minutes',status='convidado',updated_at=now() where id=v_participant.id returning * into v_participant;
  else insert into public.turma_participantes(turma_id,nome,email,papel,status,forma_inicio,reserva_expira_em,reserva_token,nivel_conversacao,nivel_escrita,nivel_compreensao) values(v_turma.id,trim(p_nome),lower(trim(p_email)),'participante','convidado',case when v_count=0 then 'individual_aguardando' else 'coletivo' end,now()+interval '30 minutes',p_reserva_token,p_nivel_conversacao,p_nivel_escrita,p_nivel_compreensao) returning * into v_participant; end if;
  if v_count=0 then v_price:=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana); else v_price:=public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,least(v_count+1,v_capacity)); end if;
  return jsonb_build_object('turma_id',v_turma.id,'participante_id',v_participant.id,'participantes',v_count+1,'capacidade',v_capacity,'valor_mensal',v_price,'tipo_valor',case when v_count=0 then 'coletiva_em_formacao' else 'coletiva_formada' end,'status_formacao',case when v_count+1>=v_capacity then case when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end else case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end end,'horario_ids',to_jsonb(v_ids));
end;
$$;

revoke all on function private.professor_horario_ocupado(uuid,integer,time,time,uuid,uuid) from public;
