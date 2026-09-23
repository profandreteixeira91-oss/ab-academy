-- =========================================================
-- MENSALIDADES - AB ACADEMY
-- Contas a receber específicas de mensalidades.
-- Não duplica pagamentos do checkout: o pagamento confirmado
-- pode ser vinculado posteriormente pelo pagamento_id.
-- =========================================================

create table if not exists public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  plano_id uuid references public.planos(id) on delete set null,
  competencia date not null,
  numero_parcela integer,
  total_parcelas integer,
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'vencido', 'cancelado')),
  metodo_pagamento text,
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mensalidades_parcela_check
    check (
      (numero_parcela is null and total_parcelas is null)
      or
      (numero_parcela is not null and total_parcelas is not null
       and numero_parcela > 0 and total_parcelas > 0
       and numero_parcela <= total_parcelas)
    )
);

create index if not exists mensalidades_aluno_idx
  on public.mensalidades(aluno_id);
create index if not exists mensalidades_plano_idx
  on public.mensalidades(plano_id);
create index if not exists mensalidades_competencia_idx
  on public.mensalidades(competencia);
create index if not exists mensalidades_vencimento_idx
  on public.mensalidades(data_vencimento);
create index if not exists mensalidades_status_idx
  on public.mensalidades(status);
create index if not exists mensalidades_pagamento_idx
  on public.mensalidades(pagamento_id);

alter table public.mensalidades enable row level security;

revoke all on table public.mensalidades from anon;
grant select, insert, update, delete on table public.mensalidades to authenticated;

drop policy if exists "mensalidades_admin_select" on public.mensalidades;
drop policy if exists "mensalidades_admin_insert" on public.mensalidades;
drop policy if exists "mensalidades_admin_update" on public.mensalidades;
drop policy if exists "mensalidades_admin_delete" on public.mensalidades;

create policy "mensalidades_admin_select"
on public.mensalidades for select to authenticated
using ((select public.usuario_e_admin()));

create policy "mensalidades_admin_insert"
on public.mensalidades for insert to authenticated
with check ((select public.usuario_e_admin()));

create policy "mensalidades_admin_update"
on public.mensalidades for update to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));

create policy "mensalidades_admin_delete"
on public.mensalidades for delete to authenticated
using ((select public.usuario_e_admin()));
