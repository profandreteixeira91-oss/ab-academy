-- =========================================================
-- COMUNICAÇÃO / SOLICITAÇÕES - AB ACADEMY
-- =========================================================

create table if not exists public.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  assunto text not null,
  categoria text not null default 'outros',
  prioridade text not null default 'normal'
    check (prioridade in ('baixa','normal','alta')),
  status text not null default 'aberta'
    check (status in ('aberta','em_andamento','respondida','fechada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solicitacao_mensagens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  remetente_tipo text not null
    check (remetente_tipo in ('aluno','admin')),
  remetente_id uuid references auth.users(id) on delete set null,
  mensagem text not null,
  created_at timestamptz not null default now()
);

create index if not exists solicitacoes_aluno_idx
  on public.solicitacoes(aluno_id);
create index if not exists solicitacoes_status_idx
  on public.solicitacoes(status);
create index if not exists solicitacoes_updated_idx
  on public.solicitacoes(updated_at desc);
create index if not exists solicitacao_mensagens_solicitacao_idx
  on public.solicitacao_mensagens(solicitacao_id, created_at);

alter table public.solicitacoes enable row level security;
alter table public.solicitacao_mensagens enable row level security;

revoke all on table public.solicitacoes from anon;
revoke all on table public.solicitacao_mensagens from anon;

grant select, insert, update on table public.solicitacoes to authenticated;
grant select, insert on table public.solicitacao_mensagens to authenticated;

drop policy if exists "solicitacoes_admin_all" on public.solicitacoes;
drop policy if exists "solicitacoes_aluno_select" on public.solicitacoes;
drop policy if exists "solicitacoes_aluno_insert" on public.solicitacoes;
drop policy if exists "solicitacoes_aluno_update" on public.solicitacoes;

create policy "solicitacoes_admin_all"
on public.solicitacoes for all to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));

create policy "solicitacoes_aluno_select"
on public.solicitacoes for select to authenticated
using (
  exists (
    select 1 from public.alunos a
    where a.id = solicitacoes.aluno_id
      and a.user_id = auth.uid()
  )
);

create policy "solicitacoes_aluno_insert"
on public.solicitacoes for insert to authenticated
with check (
  exists (
    select 1 from public.alunos a
    where a.id = solicitacoes.aluno_id
      and a.user_id = auth.uid()
  )
);

create policy "solicitacoes_aluno_update"
on public.solicitacoes for update to authenticated
using (
  exists (
    select 1 from public.alunos a
    where a.id = solicitacoes.aluno_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.alunos a
    where a.id = solicitacoes.aluno_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "mensagens_admin_all" on public.solicitacao_mensagens;
drop policy if exists "mensagens_aluno_select" on public.solicitacao_mensagens;
drop policy if exists "mensagens_aluno_insert" on public.solicitacao_mensagens;

create policy "mensagens_admin_all"
on public.solicitacao_mensagens for all to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));

create policy "mensagens_aluno_select"
on public.solicitacao_mensagens for select to authenticated
using (
  exists (
    select 1
    from public.solicitacoes s
    join public.alunos a on a.id = s.aluno_id
    where s.id = solicitacao_mensagens.solicitacao_id
      and a.user_id = auth.uid()
  )
);

create policy "mensagens_aluno_insert"
on public.solicitacao_mensagens for insert to authenticated
with check (
  remetente_tipo = 'aluno'
  and remetente_id = auth.uid()
  and exists (
    select 1
    from public.solicitacoes s
    join public.alunos a on a.id = s.aluno_id
    where s.id = solicitacao_mensagens.solicitacao_id
      and a.user_id = auth.uid()
  )
);

create or replace function public.touch_solicitacao_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists solicitacoes_touch_updated_at on public.solicitacoes;
create trigger solicitacoes_touch_updated_at
before update on public.solicitacoes
for each row execute function public.touch_solicitacao_updated_at();
