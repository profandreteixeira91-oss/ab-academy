create or replace function public.reservar_turma_matricula_publico(
  p_turma_id uuid,p_horario_ids uuid[],p_idioma text,p_modalidade text,p_aulas_semana integer,
  p_nivel_conversacao text,p_nivel_escrita text,p_nivel_compreensao text,p_reserva_token text,p_nome text,p_email text
)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_turma public.turmas%rowtype;
  v_count integer;
  v_participant public.turma_participantes%rowtype;
  v_price numeric;
  v_capacity integer;
  v_existing_level text;
  v_ids uuid[];
  v_student_level text;
begin
  if coalesce(array_length(p_horario_ids,1),0)<>p_aulas_semana then raise exception 'A turma selecionada não possui todos os encontros semanais necessários.'; end if;
  v_student_level=coalesce(nullif(trim(p_nivel_conversacao),''),nullif(trim(p_nivel_escrita),''),nullif(trim(p_nivel_compreensao),''));
  if v_student_level is null then raise exception 'O resultado de proficiência é obrigatório.'; end if;
  select * into v_turma from public.turmas where id=p_turma_id and fixa=true and idioma=p_idioma and modalidade=p_modalidade and aulas_semana=p_aulas_semana and status not in ('cancelada','encerrada') for update;
  if not found then raise exception 'Turma fixa não encontrada ou indisponível.'; end if;
  v_capacity=v_turma.quantidade_maxima;
  select array_agg(th.horario_id order by th.ordem) into v_ids from public.turma_horarios th where th.turma_id=v_turma.id;
  if v_ids is null or v_ids <@ p_horario_ids is false or p_horario_ids <@ v_ids is false then raise exception 'Os encontros selecionados não correspondem à turma fixa.'; end if;
  select count(*) into v_count from public.turma_participantes tp where tp.turma_id=v_turma.id and tp.status in ('confirmado','convidado') and (tp.reserva_expira_em is null or tp.reserva_expira_em>now()) and tp.reserva_token is distinct from p_reserva_token;
  if v_count>=v_capacity then raise exception 'Esta turma já está completa.'; end if;
  v_existing_level=v_turma.nivel_referencia;
  if v_existing_level is not null and lower(trim(v_existing_level))<>lower(trim(v_student_level)) then raise exception 'O nível desta turma é % e não corresponde ao resultado da sua proficiência.',v_existing_level; end if;
  if v_existing_level is null then update public.turmas set nivel_referencia=v_student_level,nivel_minimo=v_student_level,nivel_maximo=v_student_level,updated_at=now() where id=v_turma.id; end if;
  select * into v_participant from public.turma_participantes where reserva_token=p_reserva_token limit 1;
  if found then
    update public.turma_participantes set turma_id=v_turma.id,nome=trim(p_nome),email=lower(trim(p_email)),nivel_conversacao=p_nivel_conversacao,nivel_escrita=p_nivel_escrita,nivel_compreensao=p_nivel_compreensao,reserva_expira_em=now()+interval '30 minutes',status='convidado',updated_at=now() where id=v_participant.id returning * into v_participant;
  else
    insert into public.turma_participantes(turma_id,nome,email,papel,status,forma_inicio,reserva_expira_em,reserva_token,nivel_conversacao,nivel_escrita,nivel_compreensao)
    values(v_turma.id,trim(p_nome),lower(trim(p_email)),'participante','convidado',case when v_count=0 then 'individual_aguardando' else 'coletivo' end,now()+interval '30 minutes',p_reserva_token,p_nivel_conversacao,p_nivel_escrita,p_nivel_compreensao)
    returning * into v_participant;
  end if;
  if v_count=0 then
    v_price=public.preco_formacao_coletiva(p_idioma,p_modalidade,p_aulas_semana);
  else
    v_price=public.preco_coletivo(p_idioma,p_modalidade,p_aulas_semana,least(v_count+1,v_capacity));
  end if;
  return jsonb_build_object('turma_id',v_turma.id,'participante_id',v_participant.id,'participantes',v_count+1,'capacidade',v_capacity,'valor_mensal',v_price,'tipo_valor',case when v_count=0 then 'coletiva_em_formacao' else 'coletiva_formada' end,'status_formacao',case when v_count+1>=v_capacity then case when p_modalidade='dupla' then 'dupla_formada' else 'grupo_formado' end else case when p_modalidade='dupla' then 'dupla_em_formacao' else 'grupo_em_formacao' end end,'horario_ids',to_jsonb(v_ids));
end; $$;

grant execute on function public.reservar_turma_matricula_publico(uuid,uuid[],text,text,integer,text,text,text,text,text,text) to anon,authenticated;
