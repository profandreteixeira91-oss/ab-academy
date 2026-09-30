-- AB Academy — regras definitivas de matrícula individual, dupla e grupo/trio.
-- Formação coletiva: preço do individual mensal de 1x/semana com 10% de desconto.
-- Dupla: capacidade 2. Grupo/trio: capacidade 3.

insert into public.planos (idioma,tipo,nome,descricao,preco,ativo,aulas_semana,modalidade,min_alunos,max_alunos)
select 'ingles','mensal','Plano Mensal • 1 aula por semana','Aulas individuais de inglês, 1 vez por semana.',397,true,1,'individual',null,null
where not exists (select 1 from public.planos where idioma='ingles' and modalidade='individual' and tipo='mensal' and aulas_semana=1 and ativo=true);

insert into public.planos (idioma,tipo,nome,descricao,preco,ativo,aulas_semana,modalidade,min_alunos,max_alunos)
select 'alemao','mensal','Plano Mensal • 1 aula por semana','Aulas individuais de alemão, 1 vez por semana.',427,true,1,'individual',null,null
where not exists (select 1 from public.planos where idioma='alemao' and modalidade='individual' and tipo='mensal' and aulas_semana=1 and ativo=true);

update public.planos set min_alunos=3,max_alunos=3,updated_at=now() where modalidade='grupo' and ativo=true;
update public.turmas set quantidade_minima=case when modalidade='grupo' then 3 else 2 end,quantidade_maxima=case when modalidade='grupo' then 3 else 2 end,updated_at=now() where modalidade in ('dupla','grupo') and status in ('em_formacao','aguardando_confirmacoes','pronta','ativa');

create or replace function public.preco_formacao_coletiva(p_idioma text,p_modalidade text,p_aulas_semana integer)
returns numeric language plpgsql security definer set search_path=''
as 'declare v_individual numeric;
begin
if p_idioma not in (''ingles'',''alemao'') or p_modalidade not in (''dupla'',''grupo'') or p_aulas_semana not in (1,2,3) then raise exception ''Combinação de formação coletiva inválida.''; end if;
select p.preco into v_individual from public.planos p where p.idioma=p_idioma and p.modalidade=''individual'' and p.tipo=''mensal'' and p.aulas_semana=1 and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1;
if v_individual is null then raise exception ''Plano individual mensal de 1 aula por semana não configurado para este idioma.''; end if;
return round(v_individual*0.90,2);
end';

create or replace function public.preco_coletivo(p_idioma text,p_modalidade text,p_aulas_semana integer,p_participantes integer)
returns numeric language plpgsql security definer set search_path=''
as 'declare v_preco numeric; v_participantes integer; v_min integer;
begin
if p_modalidade=''dupla'' then v_participantes:=greatest(1,least(coalesce(p_participantes,1),2)); v_min:=2;
elsif p_modalidade=''grupo'' then v_participantes:=greatest(1,least(coalesce(p_participantes,1),3)); v_min:=3;
else raise exception ''Modalidade coletiva inválida.''; end if;
if v_participantes < v_min then return public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana); end if;
select p.preco into v_preco from public.planos p where p.idioma=p_idioma and p.modalidade=p_modalidade and p.tipo=''mensal'' and p.aulas_semana=p_aulas_semana and p.ativo=true and coalesce(p.min_alunos,1)<=v_participantes and coalesce(p.max_alunos,v_participantes)>=v_participantes order by p.updated_at desc,p.created_at desc limit 1;
if v_preco is null then raise exception ''Preço coletivo não configurado para esta combinação.''; end if;
return v_preco;
end';

drop function if exists public.selecionar_horario_matricula_v2(uuid,text,text,integer,uuid,text,text,text);
drop function if exists private.selecionar_horario_matricula_v2(uuid,text,text,integer,uuid,text,text,text);

create or replace function private.selecionar_horario_matricula_v2(p_horario_id uuid,p_idioma text,p_modalidade text,p_aulas_semana integer,p_turma_id uuid default null,p_reserva_token text default null,p_nome text default null,p_email text default null)
returns jsonb language plpgsql security definer set search_path=''
as 'declare v_h public.horarios;v_t public.turmas;v_p public.turma_participantes;v_count integer;v_max integer;v_price numeric;v_ordem integer;v_token text:=nullif(trim(coalesce(p_reserva_token,'''')),'''');v_nome text:=nullif(trim(coalesce(p_nome,'''')),'''');v_email text:=lower(trim(coalesce(p_email,'''')));
begin
if p_idioma not in (''ingles'',''alemao'') or p_modalidade not in (''individual'',''dupla'',''grupo'') or p_aulas_semana not in (1,2,3) then raise exception ''Parâmetros de matrícula inválidos.''; end if;
if p_modalidade<>''individual'' and (v_token is null or v_nome is null or v_email is null) then raise exception ''Informe os dados básicos da matrícula antes de reservar o horário.''; end if;
select * into v_h from public.horarios where id=p_horario_id and idioma=p_idioma and disponivel=true for update;
if not found then raise exception ''Este horário não está mais disponível.''; end if;
if p_modalidade=''individual'' then
if p_turma_id is not null or v_h.aluno_id is not null or v_h.tipo_horario<>''individual'' then raise exception ''Este horário não está disponível para aula individual.''; end if;
return jsonb_build_object(''id'',v_h.id,''idioma'',v_h.idioma,''dia_semana'',v_h.dia_semana,''hora_inicio'',v_h.hora_inicio,''hora_fim'',v_h.hora_fim,''tipo_horario'',''individual'',''disponivel'',true,''turma_id'',null,''participante_id'',null,''participantes'',0,''capacidade'',1,''vagas_restantes'',1,''valor_mensal'',null);
end if;
if p_turma_id is null then
update public.turma_participantes set status=''cancelado'',updated_at=now() where reserva_token=v_token and status=''convidado'' and reserva_expira_em is not null and reserva_expira_em<now();
select * into v_t from public.turmas where idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana and status in (''em_formacao'',''aguardando_confirmacoes'',''pronta'',''ativa'') and (horario_id=p_horario_id or exists(select 1 from public.turma_horarios th where th.turma_id=turmas.id and th.horario_id=p_horario_id)) order by created_at asc limit 1 for update;
if not found then
v_max:=case when p_modalidade=''dupla'' then 2 else 3 end;
insert into public.turmas(modalidade,idioma,aulas_semana,quantidade_minima,quantidade_maxima,horario_preferido,status,horario_id,created_at,updated_at) values(p_modalidade,p_idioma,p_aulas_semana,v_max,v_max,to_char(v_h.hora_inicio,''HH24:MI''),''em_formacao'',p_horario_id,now(),now()) returning * into v_t;
end if;
else
select * into v_t from public.turmas where id=p_turma_id and idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana and status in (''em_formacao'',''aguardando_confirmacoes'',''pronta'',''ativa'') for update;
if not found then raise exception ''A turma selecionada não está mais disponível.''; end if;
end if;
if v_t.modalidade<>p_modalidade or v_t.idioma<>p_idioma or v_t.aulas_semana<>p_aulas_semana then raise exception ''A turma não é compatível com a modalidade selecionada.''; end if;
if v_t.quantidade_maxima <> (case when p_modalidade=''dupla'' then 2 else 3 end) then raise exception ''A capacidade da turma não corresponde à modalidade.''; end if;
if not exists(select 1 from public.turma_horarios where turma_id=v_t.id and horario_id=p_horario_id) then
if exists(select 1 from public.turma_horarios th where th.horario_id=p_horario_id and th.turma_id<>v_t.id) then raise exception ''Este horário já pertence a outra turma.''; end if;
select coalesce(max(ordem),0)+1 into v_ordem from public.turma_horarios where turma_id=v_t.id;
if v_ordem>p_aulas_semana then raise exception ''A turma já possui todos os horários desta modalidade.''; end if;
insert into public.turma_horarios(turma_id,horario_id,ordem) values(v_t.id,p_horario_id,v_ordem);
end if;
select count(*)::integer into v_count from public.turma_participantes where turma_id=v_t.id and status in (''convidado'',''confirmado'') and (status<>''convidado'' or reserva_expira_em is null or reserva_expira_em>=now());
if v_count>=v_t.quantidade_maxima then raise exception ''Esta turma está completa.''; end if;
select * into v_p from public.turma_participantes where turma_id=v_t.id and reserva_token=v_token and status in (''convidado'',''confirmado'') order by created_at desc limit 1 for update;
if not found then
insert into public.turma_participantes(turma_id,user_id,nome,email,papel,status,convidado_em,forma_inicio,reserva_expira_em,reserva_token,created_at,updated_at,valor_individual)
values(v_t.id,null,v_nome,v_email,case when v_count=0 then ''organizador'' else ''participante'' end,''convidado'',now(),''coletivo'',now()+interval ''30 minutes'',v_token,now(),now(),(select p.preco from public.planos p where p.idioma=p_idioma and p.modalidade=''individual'' and p.tipo=''mensal'' and p.aulas_semana=1 and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1))
returning * into v_p;
v_count:=v_count+1;
else
update public.turma_participantes set nome=v_nome,email=v_email,updated_at=now() where id=v_p.id;
select * into v_p from public.turma_participantes where id=v_p.id;
end if;
v_price:=case when v_count<v_t.quantidade_maxima then public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana) else public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,v_count) end;
update public.turma_participantes set valor_individual=coalesce(valor_individual,(select p.preco from public.planos p where p.idioma=p_idioma and p.modalidade=''individual'' and p.tipo=''mensal'' and p.aulas_semana=1 and p.ativo=true order by p.updated_at desc,p.created_at desc limit 1)),valor_coletivo=case when v_count>=v_t.quantidade_maxima then v_price else valor_coletivo end,updated_at=now() where id=v_p.id;
update public.horarios set tipo_horario=p_modalidade where id=p_horario_id;
return jsonb_build_object(''id'',v_h.id,''idioma'',v_h.idioma,''dia_semana'',v_h.dia_semana,''hora_inicio'',v_h.hora_inicio,''hora_fim'',v_h.hora_fim,''tipo_horario'',p_modalidade,''disponivel'',true,''turma_id'',v_t.id,''participante_id'',v_p.id,''participantes'',v_count,''capacidade'',v_t.quantidade_maxima,''vagas_restantes'',v_t.quantidade_maxima-v_count,''valor_mensal'',v_price);
end';

create or replace function public.selecionar_horario_matricula_v2(p_horario_id uuid,p_idioma text,p_modalidade text,p_aulas_semana integer,p_turma_id uuid default null,p_reserva_token text default null,p_nome text default null,p_email text default null)
returns jsonb language sql set search_path=''
as 'select private.selecionar_horario_matricula_v2(p_horario_id,p_idioma,p_modalidade,p_aulas_semana,p_turma_id,p_reserva_token,p_nome,p_email)';

grant execute on function public.selecionar_horario_matricula_v2(uuid,text,text,integer,uuid,text,text,text) to anon,authenticated;
grant execute on function public.listar_horarios_matricula(text,text,integer) to anon,authenticated;


-- Busca segura dos horários que cruzam a disponibilidade informada pelo aluno.
create or replace function public.buscar_horarios_disponiveis_matricula(
  p_idioma text,
  p_modalidade text,
  p_aulas_semana integer,
  p_dias integer[] default null,
  p_periodos text[] default null,
  p_disponibilidade jsonb default null
)
returns table(
  id uuid, tipo_horario text, idioma text, dia_semana integer, hora_inicio time, hora_fim time,
  disponivel boolean, aluno_id uuid, created_at timestamptz, meet_url text, meet_space_name text,
  turma_id uuid, participante_id uuid, participantes integer, capacidade integer, vagas_restantes integer, valor_mensal numeric
)
language plpgsql security definer set search_path=''
as $$
declare v_individual numeric;
begin
  if p_idioma not in ('ingles','alemao') or p_modalidade not in ('individual','dupla','grupo') or p_aulas_semana not between 1 and 3 then
    raise exception 'Parâmetros de busca de horários inválidos.';
  end if;
  if p_modalidade='individual' then
    return query
    select h.id,'individual'::text,h.idioma,h.dia_semana,h.hora_inicio,h.hora_fim,h.disponivel,h.aluno_id,h.created_at,h.meet_url,h.meet_space_name,
      null::uuid,null::uuid,0,1,1, p.preco
    from public.horarios h
    join lateral (select p2.preco from public.planos p2 where p2.idioma=p_idioma and p2.modalidade='individual' and p2.tipo='mensal' and p2.aulas_semana=1 and p2.ativo=true order by p2.updated_at desc,p2.created_at desc limit 1) p on true
    where h.idioma=p_idioma and h.disponivel=true and h.aluno_id is null and coalesce(h.tipo_horario,'individual')='individual'
      and (p_dias is null or cardinality(p_dias)=0 or h.dia_semana=any(p_dias))
      and (p_periodos is null or cardinality(p_periodos)=0 or ('manha'=any(p_periodos) and h.hora_inicio < time '12:00') or ('tarde'=any(p_periodos) and h.hora_inicio >= time '12:00' and h.hora_inicio < time '18:00') or ('noite'=any(p_periodos) and h.hora_inicio >= time '18:00'))
      and (p_disponibilidade is null or p_disponibilidade->h.dia_semana::text is null or (h.hora_inicio >= (p_disponibilidade->h.dia_semana::text->>'start')::time and h.hora_fim <= (p_disponibilidade->h.dia_semana::text->>'end')::time));
    return;
  end if;
  return query
  with candidates as (
    select h.id,h.idioma,h.dia_semana,h.hora_inicio,h.hora_fim,h.disponivel,h.aluno_id,h.created_at,h.meet_url,h.meet_space_name,
      t.id turma_id, count(tp.id) filter (where tp.status in ('convidado','confirmado') and (tp.status='confirmado' or tp.reserva_expira_em is null or tp.reserva_expira_em>=now()))::int participantes,
      case when p_modalidade='dupla' then 2 else 3 end capacidade
    from public.horarios h
    left join public.turma_horarios th on th.horario_id=h.id
    left join public.turmas t on t.id=th.turma_id and t.idioma=p_idioma and t.modalidade=p_modalidade and t.aulas_semana=p_aulas_semana and t.status in ('em_formacao','aguardando_confirmacoes','pronta','ativa')
    left join public.turma_participantes tp on tp.turma_id=t.id
    where h.idioma=p_idioma and h.disponivel=true and (t.id is not null or coalesce(h.tipo_horario,'individual')='individual')
      and (p_dias is null or cardinality(p_dias)=0 or h.dia_semana=any(p_dias))
      and (p_periodos is null or cardinality(p_periodos)=0 or ('manha'=any(p_periodos) and h.hora_inicio < time '12:00') or ('tarde'=any(p_periodos) and h.hora_inicio >= time '12:00' and h.hora_inicio < time '18:00') or ('noite'=any(p_periodos) and h.hora_inicio >= time '18:00'))
      and (p_disponibilidade is null or p_disponibilidade->h.dia_semana::text is null or (h.hora_inicio >= (p_disponibilidade->h.dia_semana::text->>'start')::time and h.hora_fim <= (p_disponibilidade->h.dia_semana::text->>'end')::time))
    group by h.id,t.id
  ), ranked as (
    select c.*, greatest(0,c.capacidade-c.participantes) vagas,
      case when c.participantes>0 and c.participantes<c.capacidade then 0 when c.participantes=c.capacidade then 1 else 2 end prioridade
    from candidates c where c.participantes<c.capacidade
  )
  select r.id,p_modalidade,r.idioma,r.dia_semana,r.hora_inicio,r.hora_fim,r.disponivel,r.aluno_id,r.created_at,r.meet_url,r.meet_space_name,r.turma_id,
    null::uuid,r.participantes,r.capacidade,r.vagas,
    case
      when r.participantes < r.capacidade then public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana)
      else public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,r.capacidade)
    end
  from ranked r order by r.prioridade, greatest(0,r.capacidade-r.participantes), r.dia_semana,r.hora_inicio;
end; $$;

grant execute on function public.buscar_horarios_disponiveis_matricula(text,text,integer,integer[],text[],jsonb) to anon,authenticated;
revoke execute on function public.preco_coletivo(text,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.preco_formacao_coletiva(text,text,integer) from public,anon,authenticated;
grant execute on function public.preco_coletivo(text,text,integer,integer) to service_role;
grant execute on function public.preco_formacao_coletiva(text,text,integer) to service_role;
revoke execute on function public.preco_coletivo(text,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.preco_formacao_coletiva(text,text,integer) from public,anon,authenticated;
grant execute on function public.preco_coletivo(text,text,integer,integer) to service_role;
grant execute on function public.preco_formacao_coletiva(text,text,integer) to service_role;
