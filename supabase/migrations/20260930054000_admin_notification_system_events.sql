create or replace function private.criar_notificacao_evento_admin()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  row_data jsonb := to_jsonb(new);
  old_data jsonb := case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  record_id uuid := (row_data->>'id')::uuid;
  status text := coalesce(row_data->>'status','');
  old_status text := coalesce(old_data->>'status','');
  category text;
  kind text;
  title text;
  message text;
  module text;
  priority text := 'informativa';
  event_key text;
begin
  if TG_OP='UPDATE' and status=old_status then return new; end if;

  if TG_TABLE_NAME='alunos' and TG_OP='INSERT' then
    category:='alunos'; kind:='aluno'; title:='Novo aluno';
    message:=coalesce(row_data->>'nome_completo','Um novo aluno foi cadastrado.')||' teve o cadastro concluído.';
    module:='alunos';
  elsif TG_TABLE_NAME='matriculas' and (TG_OP='INSERT' or status<>old_status) then
    category:='matriculas'; kind:='matricula';
    title:=case status when 'cancelada' then 'Matrícula cancelada' when 'pendente' then 'Matrícula pendente' else 'Nova matrícula' end;
    message:=case status when 'cancelada' then 'Uma matrícula foi cancelada.' when 'pendente' then 'Uma matrícula entrou em análise.' else 'Uma nova matrícula foi registrada.' end;
    module:='matriculas'; priority:=case when status in ('cancelada','pendente') then 'importante' else 'informativa' end;
  elsif TG_TABLE_NAME='pagamentos' and (TG_OP='INSERT' or status<>old_status) then
    category:='financeiro'; kind:='pagamento';
    title:=case status when 'pago' then 'Pagamento confirmado' when 'recusado' then 'Pagamento recusado' when 'cancelado' then 'Pagamento cancelado' when 'processando' then 'Pagamento pendente' else 'Atualização de pagamento' end;
    message:=case status when 'pago' then 'Um pagamento foi confirmado.' when 'recusado' then 'Um pagamento foi recusado e requer atenção.' when 'processando' then 'Um pagamento está aguardando processamento.' else 'O status de um pagamento foi atualizado.' end;
    module:='financeiro'; priority:=case when status in ('recusado','cancelado') then 'critica' when status='processando' then 'importante' else 'informativa' end;
  elsif TG_TABLE_NAME='mensalidades' and (TG_OP='INSERT' or status<>old_status) then
    category:='financeiro'; kind:='mensalidade';
    title:=case status when 'pago' then 'Mensalidade paga' when 'vencido' then 'Mensalidade vencida' else 'Nova mensalidade' end;
    message:=case status when 'pago' then 'Uma mensalidade foi registrada como paga.' when 'vencido' then 'Uma mensalidade está vencida e requer atenção.' else 'Uma nova mensalidade foi registrada.' end;
    module:='financeiro'; priority:=case when status='vencido' then 'importante' else 'informativa' end;
  elsif TG_TABLE_NAME='atividades' and (TG_OP='INSERT' or status<>old_status) and status<>'rascunho' then
    category:='atividades'; kind:='atividade';
    title:=case status when 'em_correcao' then 'Atividade aguardando correção' when 'corrigida' then 'Atividade corrigida' when 'enviada' then 'Atividade enviada' else 'Atividade atualizada' end;
    message:=case status when 'em_correcao' then 'Uma atividade está aguardando correção.' when 'corrigida' then 'Uma atividade foi corrigida.' when 'enviada' then 'Uma atividade foi enviada.' else 'Uma atividade teve seu status atualizado.' end;
    module:='atividades'; priority:=case when status='em_correcao' then 'importante' else 'informativa' end;
  else return new;
  end if;

  event_key:=TG_TABLE_NAME||':'||lower(TG_OP)||':'||record_id::text||':'||coalesce(status,'');
  perform private.emitir_notificacao_admin(category,kind,title,message,module,record_id,priority,'database_trigger',event_key,'/admin');
  return new;
end;
$$;

revoke all on function private.criar_notificacao_evento_admin() from public,anon,authenticated;

drop trigger if exists admin_notificacao_aluno on public.alunos;
create trigger admin_notificacao_aluno after insert on public.alunos for each row execute function private.criar_notificacao_evento_admin();

drop trigger if exists admin_notificacao_matricula_evento on public.matriculas;
create trigger admin_notificacao_matricula_evento after insert or update of status on public.matriculas for each row execute function private.criar_notificacao_evento_admin();

drop trigger if exists admin_notificacao_pagamento_evento on public.pagamentos;
create trigger admin_notificacao_pagamento_evento after insert or update of status on public.pagamentos for each row execute function private.criar_notificacao_evento_admin();

drop trigger if exists admin_notificacao_mensalidade_evento on public.mensalidades;
create trigger admin_notificacao_mensalidade_evento after insert or update of status on public.mensalidades for each row execute function private.criar_notificacao_evento_admin();

drop trigger if exists admin_notificacao_atividade_evento on public.atividades;
create trigger admin_notificacao_atividade_evento after insert or update of status on public.atividades for each row execute function private.criar_notificacao_evento_admin();
