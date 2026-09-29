-- Turmas para duplas e grupos
-- A modalidade só pode ser efetivada quando os participantes estiverem
-- identificados e confirmados.

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  modalidade text not null check (modalidade in ('dupla','grupo')),
  idioma text not null check (idioma in ('ingles','alemao')),
  aulas_semana integer not null check (aulas_semana between 1 and 7),
  quantidade_minima integer not null,
  quantidade_maxima integer not null,
  horario_preferido text,
  status text not null default 'em_formacao'
    check (status in ('em_formacao','aguardando_confirmacoes','pronta','ativa','encerrada','cancelada')),
  origem_lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turmas_quantidade_check check (
    (modalidade = 'dupla' and quantidade_minima = 2 and quantidade_maxima = 2)
    or
    (modalidade = 'grupo' and quantidade_minima = 3 and quantidade_maxima between 3 and 6)
  )
);

create table if not exists public.turma_participantes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  aluno_id uuid references public.alunos(id) on delete set null,
  nome text not null,
  email text not null,
  telefone text,
  papel text not null default 'participante'
    check (papel in ('organizador','participante')),
  status text not null default 'convidado'
    check (status in ('convidado','confirmado','recusado','cancelado')),
  convidado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists turma_participantes_email_unique
  on public.turma_participantes (turma_id, lower(email));

create index if not exists turma_participantes_turma_idx
  on public.turma_participantes (turma_id);

create index if not exists turma_participantes_aluno_idx
  on public.turma_participantes (aluno_id);

alter table public.turmas enable row level security;
alter table public.turma_participantes enable row level security;

revoke all on table public.turmas, public.turma_participantes from anon, authenticated;
grant select, insert, update, delete on table public.turmas, public.turma_participantes to authenticated;

create policy "Admins can manage turmas"
on public.turmas
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
);

create policy "Admins can manage turma participantes"
on public.turma_participantes
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.ativo = true
  )
);

create or replace function public.validar_turma_participantes()
returns trigger
language plpgsql
as $$
declare
  turma_max integer;
  confirmados integer;
begin
  select quantidade_maxima into turma_max
  from public.turmas
  where id = new.turma_id;

  if turma_max is null then
    raise exception 'Turma não encontrada.';
  end if;

  select count(*) into confirmados
  from public.turma_participantes
  where turma_id = new.turma_id
    and status = 'confirmado'
    and id <> coalesce(new.id, gen_random_uuid());

  if new.status = 'confirmado' and confirmados >= turma_max then
    raise exception 'A turma já atingiu o número máximo de participantes.';
  end if;

  if new.status = 'confirmado' and new.confirmado_em is null then
    new.confirmado_em := now();
  end if;

  if new.status <> 'confirmado' then
    new.confirmado_em := null;
  end if;

  return new;
end;
$$;

create trigger turma_participantes_validar
before insert or update on public.turma_participantes
for each row execute function public.validar_turma_participantes();

create or replace function public.atualizar_turma_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger turmas_updated_at
before update on public.turmas
for each row execute function public.atualizar_turma_updated_at();

create trigger turma_participantes_updated_at
before update on public.turma_participantes
for each row execute function public.atualizar_turma_updated_at();
