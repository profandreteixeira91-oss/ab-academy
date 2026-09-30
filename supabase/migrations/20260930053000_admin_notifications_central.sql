begin;

alter table public.admin_notificacoes
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists categoria text not null default 'sistema',
  add column if not exists prioridade text not null default 'informativa',
  add column if not exists status text not null default 'criada',
  add column if not exists origem text not null default 'sistema',
  add column if not exists evento_chave text,
  add column if not exists url text not null default '/admin',
  add column if not exists lida_em timestamptz;

alter table public.admin_notificacoes
  drop constraint if exists admin_notificacoes_prioridade_check;
alter table public.admin_notificacoes
  add constraint admin_notificacoes_prioridade_check check (prioridade in ('informativa','importante','critica'));

alter table public.admin_notificacoes
  drop constraint if exists admin_notificacoes_status_check;
alter table public.admin_notificacoes
  add constraint admin_notificacoes_status_check check (status in ('criada','processada','erro'));

alter table public.admin_notificacoes
  drop constraint if exists admin_notificacoes_categoria_check;
alter table public.admin_notificacoes
  add constraint admin_notificacoes_categoria_check check (categoria in ('matriculas','leads','financeiro','alunos','professores','aulas','atividades','sistema','enterprise'));

alter table public.admin_notificacoes_push_subscriptions
  add column if not exists plataforma text not null default 'web',
  add column if not exists navegador text,
  add column if not exists sistema_operacional text,
  add column if not exists dispositivo text,
  add column if not exists ultimo_uso_em timestamptz not null default now(),
  add column if not exists revogado_em timestamptz;

create unique index if not exists admin_notificacoes_evento_destinatario_uidx
  on public.admin_notificacoes(evento_chave, recipient_id)
  where evento_chave is not null and recipient_id is not null;
create unique index if not exists admin_push_endpoint_uidx
  on public.admin_notificacoes_push_subscriptions(endpoint);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null,
  push boolean not null default true,
  interna boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, categoria),
  constraint notification_preferences_categoria_check
    check (categoria in ('matriculas','leads','financeiro','alunos','professores','aulas','atividades','sistema','enterprise'))
);
alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select on public.notification_preferences;
create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id and private.usuario_e_admin());
drop policy if exists notification_preferences_insert on public.notification_preferences;
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id and private.usuario_e_admin());
drop policy if exists notification_preferences_update on public.notification_preferences;
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id and private.usuario_e_admin())
  with check ((select auth.uid()) = user_id and private.usuario_e_admin());
drop policy if exists notification_preferences_delete on public.notification_preferences;
create policy notification_preferences_delete on public.notification_preferences for delete to authenticated
  using ((select auth.uid()) = user_id and private.usuario_e_admin());

drop policy if exists admin_notificacoes_select on public.admin_notificacoes;
create policy admin_notificacoes_select on public.admin_notificacoes for select to authenticated
  using (private.usuario_e_admin() and recipient_id = (select auth.uid()));
drop policy if exists admin_notificacoes_update on public.admin_notificacoes;
create policy admin_notificacoes_update on public.admin_notificacoes for update to authenticated
  using (private.usuario_e_admin() and recipient_id = (select auth.uid()))
  with check (private.usuario_e_admin() and recipient_id = (select auth.uid()));
drop policy if exists admin_notificacoes_delete on public.admin_notificacoes;
create policy admin_notificacoes_delete on public.admin_notificacoes for delete to authenticated
  using (private.usuario_e_admin() and recipient_id = (select auth.uid()));

drop policy if exists admin_push_select on public.admin_notificacoes_push_subscriptions;
create policy admin_push_select on public.admin_notificacoes_push_subscriptions for select to authenticated
  using (private.usuario_e_admin() and user_id = (select auth.uid()));
drop policy if exists admin_push_insert on public.admin_notificacoes_push_subscriptions;
create policy admin_push_insert on public.admin_notificacoes_push_subscriptions for insert to authenticated
  with check (private.usuario_e_admin() and user_id = (select auth.uid()));
drop policy if exists admin_push_update on public.admin_notificacoes_push_subscriptions;
create policy admin_push_update on public.admin_notificacoes_push_subscriptions for update to authenticated
  using (private.usuario_e_admin() and user_id = (select auth.uid()))
  with check (private.usuario_e_admin() and user_id = (select auth.uid()));
drop policy if exists admin_push_delete on public.admin_notificacoes_push_subscriptions;
create policy admin_push_delete on public.admin_notificacoes_push_subscriptions for delete to authenticated
  using (private.usuario_e_admin() and user_id = (select auth.uid()));

grant select,insert,update,delete on public.notification_preferences to authenticated;
grant select,update,delete on public.admin_notificacoes to authenticated;
grant select,insert,update,delete on public.admin_notificacoes_push_subscriptions to authenticated;

do $$
declare r record;
begin
  for r in select au.user_id from public.admin_users au where au.ativo=true loop
    insert into public.notification_preferences(user_id,categoria,push,interna)
    select r.user_id,c.categoria,true,true
    from (values ('matriculas'),('leads'),('financeiro'),('alunos'),('professores'),('aulas'),('atividades'),('sistema'),('enterprise')) c(categoria)
    on conflict (user_id,categoria) do nothing;
  end loop;
end $$;

update public.admin_notificacoes n
set recipient_id=(select au.user_id from public.admin_users au where au.ativo=true order by au.created_at asc limit 1)
where n.recipient_id is null;

create or replace function private.emitir_notificacao_admin(
  p_categoria text,p_tipo text,p_titulo text,p_mensagem text,p_modulo text,
  p_referencia_id uuid default null,p_prioridade text default 'informativa',
  p_origem text default 'sistema',p_evento_chave text default null,p_url text default '/admin'
)
returns void language plpgsql security definer set search_path=''
as $$
declare admin_record record; internal_enabled boolean;
begin
  if p_categoria not in ('matriculas','leads','financeiro','alunos','professores','aulas','atividades','sistema','enterprise') then return; end if;
  for admin_record in select au.user_id from public.admin_users au where au.ativo=true loop
    select coalesce(np.interna,true) into internal_enabled
    from public.notification_preferences np
    where np.user_id=admin_record.user_id and np.categoria=p_categoria;
    if internal_enabled then
      insert into public.admin_notificacoes(tipo,titulo,mensagem,modulo,referencia_id,recipient_id,categoria,prioridade,status,origem,evento_chave,url)
      values(p_tipo,p_titulo,p_mensagem,p_modulo,p_referencia_id,admin_record.user_id,p_categoria,p_prioridade,'criada',p_origem,p_evento_chave,p_url)
      on conflict (evento_chave,recipient_id) where evento_chave is not null and recipient_id is not null do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function private.emitir_notificacao_admin(text,text,text,text,text,uuid,text,text,text,text) from public,anon,authenticated;

create or replace function private.criar_notificacao_admin()
returns trigger language plpgsql security definer set search_path=''
as $$
declare category text; kind text; title text; message text; module text; event_key text; target_url text := '/admin';
begin
  if TG_TABLE_NAME='leads' then
    category:='leads'; kind:='lead'; title:='Novo lead'; message:='Um novo interessado entrou pelo site.'; module:='leads'; event_key:='lead:new:'||new.id::text;
  elsif TG_TABLE_NAME='enterprise_leads' then
    category:='enterprise'; kind:='enterprise'; title:='Novo lead AB Enterprise'; message:='Uma nova oportunidade corporativa foi recebida.'; module:='enterprise'; event_key:='enterprise_lead:new:'||new.id::text;
  elsif TG_TABLE_NAME='candidaturas_professores' then
    category:='professores'; kind:='candidatura'; title:='Nova candidatura'; message:='Uma nova candidatura de professor foi recebida.'; module:='candidaturas'; event_key:='candidatura:new:'||new.id::text;
  elsif TG_TABLE_NAME='solicitacoes' then
    category:='alunos'; kind:='solicitacao'; title:='Nova solicitação'; message:='Um aluno enviou uma nova solicitação de atendimento.'; module:='comunicacao'; event_key:='solicitacao:new:'||new.id::text;
  else return new;
  end if;
  perform private.emitir_notificacao_admin(category,kind,title,message,module,new.id,'informativa','database_trigger',event_key,target_url);
  return new;
end;
$$;

drop trigger if exists admin_notificacao_lead on public.leads;
create trigger admin_notificacao_lead after insert on public.leads for each row execute function private.criar_notificacao_admin();
drop trigger if exists admin_notificacao_enterprise on public.enterprise_leads;
create trigger admin_notificacao_enterprise after insert on public.enterprise_leads for each row execute function private.criar_notificacao_admin();
drop trigger if exists admin_notificacao_candidatura on public.candidaturas_professores;
create trigger admin_notificacao_candidatura after insert on public.candidaturas_professores for each row execute function private.criar_notificacao_admin();
drop trigger if exists admin_notificacao_solicitacao on public.solicitacoes;
create trigger admin_notificacao_solicitacao after insert on public.solicitacoes for each row execute function private.criar_notificacao_admin();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_preferences') then
    alter publication supabase_realtime add table public.notification_preferences;
  end if;
end $$;

commit;