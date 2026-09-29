create extension if not exists pgcrypto;

create table if not exists public.turma_matriculas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  participante_id uuid not null references public.turma_participantes(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  status text not null default 'liberada' check (status in ('liberada','em_preenchimento','pagamento_pendente','paga','ativa','cancelada','expirada')),
  valor_mensal numeric(10,2) not null,
  condicao_meses integer,
  condicao_inicio date,
  condicao_fim date,
  matricula_id uuid references public.matriculas(id) on delete set null,
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turma_matriculas_condicao_check check (condicao_meses is null or condicao_meses between 1 and 24)
);

create unique index if not exists turma_matriculas_participante_unique on public.turma_matriculas(participante_id);
create index if not exists turma_matriculas_token_idx on public.turma_matriculas(token);

alter table public.matriculas add column if not exists turma_id uuid references public.turmas(id) on delete set null;
alter table public.matriculas add column if not exists turma_participante_id uuid references public.turma_participantes(id) on delete set null;
alter table public.matriculas add column if not exists valor_coletivo numeric(10,2);
alter table public.matriculas add column if not exists condicao_meses integer;
alter table public.matriculas add column if not exists condicao_inicio date;
alter table public.matriculas add column if not exists condicao_fim date;

alter table public.pagamentos add column if not exists turma_id uuid references public.turmas(id) on delete set null;
alter table public.pagamentos add column if not exists turma_participante_id uuid references public.turma_participantes(id) on delete set null;

alter table public.turma_matriculas enable row level security;
revoke all on public.turma_matriculas from anon, authenticated;
grant select, insert, update, delete on public.turma_matriculas to authenticated;

create policy turma_matriculas_admin_all on public.turma_matriculas for all to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.ativo = true))
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.ativo = true));

create or replace function public.validar_pagamento_comercial()
returns trigger language plpgsql as $$
declare plano_modalidade text; plano_preco numeric; coletivo_preco numeric;
begin
  if new.turma_participante_id is not null then
    select tp.valor_coletivo into coletivo_preco from public.turma_participantes tp where tp.id = new.turma_participante_id and tp.status = 'confirmado';
    if coletivo_preco is null then raise exception 'A condição coletiva não está liberada para este participante.'; end if;
    if abs(coalesce(new.valor, 0) - coletivo_preco) > 0.01 then raise exception 'O valor do pagamento coletivo não corresponde ao valor liberado.'; end if;
    return new;
  end if;
  if new.plano_id is null then raise exception 'Um plano válido é obrigatório para iniciar o pagamento.'; end if;
  select modalidade, preco into plano_modalidade, plano_preco from public.planos where id = new.plano_id and ativo = true;
  if plano_modalidade is null then raise exception 'O plano selecionado não está disponível.'; end if;
  if plano_modalidade <> 'individual' then raise exception 'Planos de dupla ou grupo só podem ser pagos após a confirmação da turma.'; end if;
  if abs(coalesce(new.valor, 0) - coalesce(plano_preco, 0)) > 0.01 then raise exception 'O valor do pagamento não corresponde ao valor oficial do plano.'; end if;
  return new;
end; $$;

drop trigger if exists pagamentos_validar_comercial on public.pagamentos;
create trigger pagamentos_validar_comercial before insert or update of plano_id, valor, turma_participante_id on public.pagamentos for each row execute function public.validar_pagamento_comercial();

alter table public.turmas add column if not exists condicao_meses integer default 3;