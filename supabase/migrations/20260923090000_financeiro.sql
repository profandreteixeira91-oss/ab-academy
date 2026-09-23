-- =========================================================
-- FINANCEIRO - AB ACADEMY
-- =========================================================

create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria text not null default 'Outros',
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'cancelado')),
  data_vencimento date,
  data_pagamento date,
  metodo_pagamento text,
  aluno_id uuid references public.alunos(id) on delete set null,
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  recorrente boolean not null default false,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lancamentos_financeiros_tipo_idx
  on public.lancamentos_financeiros(tipo);

create index if not exists lancamentos_financeiros_status_idx
  on public.lancamentos_financeiros(status);

create index if not exists lancamentos_financeiros_vencimento_idx
  on public.lancamentos_financeiros(data_vencimento);

create index if not exists lancamentos_financeiros_aluno_idx
  on public.lancamentos_financeiros(aluno_id);

create index if not exists lancamentos_financeiros_pagamento_idx
  on public.lancamentos_financeiros(pagamento_id);

alter table public.lancamentos_financeiros enable row level security;

revoke all on table public.lancamentos_financeiros from anon;
grant select, insert, update, delete on table public.lancamentos_financeiros to authenticated;

drop policy if exists "lancamentos_financeiros_admin_select" on public.lancamentos_financeiros;
drop policy if exists "lancamentos_financeiros_admin_insert" on public.lancamentos_financeiros;
drop policy if exists "lancamentos_financeiros_admin_update" on public.lancamentos_financeiros;
drop policy if exists "lancamentos_financeiros_admin_delete" on public.lancamentos_financeiros;

create policy "lancamentos_financeiros_admin_select"
on public.lancamentos_financeiros
for select
to authenticated
using ((select public.usuario_e_admin()));

create policy "lancamentos_financeiros_admin_insert"
on public.lancamentos_financeiros
for insert
to authenticated
with check ((select public.usuario_e_admin()));

create policy "lancamentos_financeiros_admin_update"
on public.lancamentos_financeiros
for update
to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));

create policy "lancamentos_financeiros_admin_delete"
on public.lancamentos_financeiros
for delete
to authenticated
using ((select public.usuario_e_admin()));
