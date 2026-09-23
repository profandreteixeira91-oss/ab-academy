-- Central de Atividades / geração por IA
-- Estrutura necessária para a Edge Function gerar-central-atividades

create extension if not exists pgcrypto;

create table if not exists public.central_atividades (
  id uuid primary key default gen_random_uuid(),
  idioma text not null check (idioma in ('ingles', 'alemao')),
  nivel text not null check (nivel in ('iniciante', 'basico', 'intermediario', 'avancado', 'fluente')),
  categoria text not null check (categoria in ('vocabulario', 'gramatica', 'leitura', 'compreensao', 'escrita', 'cotidiano', 'revisao')),
  tipo_exercicio text not null check (tipo_exercicio in (
    'multipla_escolha',
    'multipla_resposta',
    'verdadeiro_falso',
    'dissertativa',
    'resposta_curta',
    'lacunas',
    'ordenar',
    'associar'
  )),
  titulo text not null,
  descricao text,
  instrucoes text,
  conteudo jsonb not null default '{}'::jsonb,
  explicacao text,
  dificuldade integer not null default 1 check (dificuldade between 1 and 5),
  tempo_estimado integer not null default 5 check (tempo_estimado > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'arquivada')),
  origem text not null default 'manual' check (origem in ('manual', 'ia')),
  mes_referencia date not null default current_date,
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_central_atividades_filtro
  on public.central_atividades (idioma, nivel, status, created_at desc);

create index if not exists idx_central_atividades_categoria
  on public.central_atividades (categoria, tipo_exercicio);

create index if not exists idx_central_atividades_mes
  on public.central_atividades (mes_referencia);

create or replace function public.set_central_atividades_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_central_atividades_updated_at on public.central_atividades;

create trigger trg_central_atividades_updated_at
before update on public.central_atividades
for each row
execute function public.set_central_atividades_updated_at();

alter table public.central_atividades enable row level security;

revoke all on public.central_atividades from anon;
grant select, insert, update, delete on public.central_atividades to authenticated;

drop policy if exists "central_atividades_admin_all" on public.central_atividades;
create policy "central_atividades_admin_all"
on public.central_atividades
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

drop policy if exists "central_atividades_student_published" on public.central_atividades;
create policy "central_atividades_student_published"
on public.central_atividades
for select
to authenticated
using (status = 'publicada');

-- Respostas dos alunos à Central de Atividades.
create table if not exists public.central_respostas (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.central_atividades(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  pontuacao numeric(6,2),
  concluida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (atividade_id, aluno_id)
);

create index if not exists idx_central_respostas_aluno
  on public.central_respostas (aluno_id, concluida);

create index if not exists idx_central_respostas_atividade
  on public.central_respostas (atividade_id);

create or replace function public.set_central_respostas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_central_respostas_updated_at on public.central_respostas;

create trigger trg_central_respostas_updated_at
before update on public.central_respostas
for each row
execute function public.set_central_respostas_updated_at();

alter table public.central_respostas enable row level security;

revoke all on public.central_respostas from anon;
grant select, insert, update on public.central_respostas to authenticated;

drop policy if exists "central_respostas_student_select_own" on public.central_respostas;
create policy "central_respostas_student_select_own"
on public.central_respostas
for select
to authenticated
using (
  exists (
    select 1
    from public.alunos a
    where a.id = central_respostas.aluno_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "central_respostas_student_insert_own" on public.central_respostas;
create policy "central_respostas_student_insert_own"
on public.central_respostas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.alunos a
    where a.id = central_respostas.aluno_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "central_respostas_student_update_own" on public.central_respostas;
create policy "central_respostas_student_update_own"
on public.central_respostas
for update
to authenticated
using (
  exists (
    select 1
    from public.alunos a
    where a.id = central_respostas.aluno_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.alunos a
    where a.id = central_respostas.aluno_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "central_respostas_admin_all" on public.central_respostas;
create policy "central_respostas_admin_all"
on public.central_respostas
for all
to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());
