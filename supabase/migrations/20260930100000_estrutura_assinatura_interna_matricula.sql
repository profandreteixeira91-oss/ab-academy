-- Estrutura de assinatura eletrônica interna da matrícula.
-- Não utiliza provedor externo. O conteúdo jurídico do contrato será definido posteriormente.

create table if not exists public.documentos_assinatura (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid references public.matriculas(id) on delete set null,
  reserva_token text not null,
  tipo_assinatura text not null default 'interna',
  status text not null default 'rascunho',
  versao_contrato text,
  hash_contrato text,
  hash_assinatura text,
  nome_signatario text,
  cpf_signatario text,
  email_signatario text,
  assinatura_nome text,
  aceito_em timestamptz,
  assinado_em timestamptz,
  ip_address inet,
  user_agent text,
  documento_path text,
  documento_assinado_path text,
  ultimo_evento text,
  ultimo_evento_em timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentos_assinatura_tipo_check check (tipo_assinatura in ('interna')),
  constraint documentos_assinatura_status_check check (status in ('rascunho','aguardando_assinatura','assinado','recusado','expirado','cancelado','erro'))
);

create unique index if not exists documentos_assinatura_reserva_token_uidx
  on public.documentos_assinatura(reserva_token);

create index if not exists documentos_assinatura_matricula_idx
  on public.documentos_assinatura(matricula_id);

create index if not exists documentos_assinatura_status_idx
  on public.documentos_assinatura(status);

alter table public.documentos_assinatura enable row level security;

revoke all on public.documentos_assinatura from anon, authenticated;

create or replace function public.iniciar_assinatura_interna_matricula(
  p_reserva_token text,
  p_nome text,
  p_cpf text,
  p_email text,
  p_versao_contrato text default null,
  p_hash_contrato text default null
)
returns public.documentos_assinatura
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_documento public.documentos_assinatura;
begin
  if nullif(trim(p_reserva_token), '') is null then
    raise exception 'Token da matrícula inválido.';
  end if;

  if nullif(trim(p_nome), '') is null
     or nullif(trim(p_cpf), '') is null
     or nullif(trim(p_email), '') is null then
    raise exception 'Dados do signatário incompletos.';
  end if;

  insert into public.documentos_assinatura (
    reserva_token,
    tipo_assinatura,
    status,
    versao_contrato,
    hash_contrato,
    nome_signatario,
    cpf_signatario,
    email_signatario,
    ultimo_evento,
    ultimo_evento_em
  )
  values (
    trim(p_reserva_token),
    'interna',
    'aguardando_assinatura',
    nullif(trim(p_versao_contrato), ''),
    nullif(trim(p_hash_contrato), ''),
    trim(p_nome),
    trim(p_cpf),
    lower(trim(p_email)),
    'assinatura_iniciada',
    now()
  )
  on conflict (reserva_token) do update
    set nome_signatario = excluded.nome_signatario,
        cpf_signatario = excluded.cpf_signatario,
        email_signatario = excluded.email_signatario,
        versao_contrato = coalesce(excluded.versao_contrato, documentos_assinatura.versao_contrato),
        hash_contrato = coalesce(excluded.hash_contrato, documentos_assinatura.hash_contrato),
        status = case
          when documentos_assinatura.status in ('assinado','cancelado') then documentos_assinatura.status
          else 'aguardando_assinatura'
        end,
        ultimo_evento = 'assinatura_iniciada',
        ultimo_evento_em = now(),
        updated_at = now()
  returning * into v_documento;

  return v_documento;
end;
$function$;

revoke all on function public.iniciar_assinatura_interna_matricula(text,text,text,text,text,text) from public;
grant execute on function public.iniciar_assinatura_interna_matricula(text,text,text,text,text,text) to anon, authenticated;

create or replace function public.assinar_matricula_internamente(
  p_reserva_token text,
  p_nome_assinatura text,
  p_hash_assinatura text default null
)
returns public.documentos_assinatura
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_documento public.documentos_assinatura;
begin
  if nullif(trim(p_reserva_token), '') is null
     or nullif(trim(p_nome_assinatura), '') is null then
    raise exception 'Dados de assinatura inválidos.';
  end if;

  update public.documentos_assinatura
  set assinatura_nome = trim(p_nome_assinatura),
      hash_assinatura = nullif(trim(p_hash_assinatura), ''),
      status = 'assinado',
      aceito_em = coalesce(aceito_em, now()),
      assinado_em = now(),
      ultimo_evento = 'assinatura_concluida',
      ultimo_evento_em = now(),
      updated_at = now()
  where reserva_token = trim(p_reserva_token)
    and status = 'aguardando_assinatura'
    and lower(trim(nome_signatario)) = lower(trim(p_nome_assinatura))
  returning * into v_documento;

  if not found then
    raise exception 'Assinatura não disponível ou já concluída.';
  end if;

  return v_documento;
end;
$function$;

revoke all on function public.assinar_matricula_internamente(text,text,text) from public;
grant execute on function public.assinar_matricula_internamente(text,text,text) to anon, authenticated;
