create table if not exists public.registros_aulas (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  professor_id uuid not null references public.professores(id) on delete restrict,
  data_aula date not null,
  status text not null check (status in ('presente', 'falta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registros_aulas_horario_data_unique unique (horario_id, data_aula)
);

create index if not exists registros_aulas_aluno_id_idx
  on public.registros_aulas(aluno_id);

create index if not exists registros_aulas_professor_id_idx
  on public.registros_aulas(professor_id);

create index if not exists registros_aulas_data_aula_idx
  on public.registros_aulas(data_aula desc);

alter table public.registros_aulas enable row level security;

revoke all on table public.registros_aulas from anon;
grant select, insert, update on table public.registros_aulas to authenticated;

DROP POLICY IF EXISTS "registros_aulas_select_aluno" ON public.registros_aulas;
DROP POLICY IF EXISTS "registros_aulas_select_professor" ON public.registros_aulas;
DROP POLICY IF EXISTS "registros_aulas_select_admin" ON public.registros_aulas;
DROP POLICY IF EXISTS "registros_aulas_insert_professor" ON public.registros_aulas;
DROP POLICY IF EXISTS "registros_aulas_update_professor" ON public.registros_aulas;

create policy "registros_aulas_select_aluno"
on public.registros_aulas
for select
to authenticated
using (
  exists (
    select 1
    from public.alunos a
    where a.id = registros_aulas.aluno_id
      and a.user_id = auth.uid()
  )
);

create policy "registros_aulas_select_professor"
on public.registros_aulas
for select
to authenticated
using (
  exists (
    select 1
    from public.professores p
    where p.id = registros_aulas.professor_id
      and p.user_id = auth.uid()
      and p.ativo = true
      and p.acesso_portal = true
  )
);

create policy "registros_aulas_select_admin"
on public.registros_aulas
for select
to authenticated
using ((select public.usuario_e_admin()));

create policy "registros_aulas_insert_professor"
on public.registros_aulas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.professores p
    where p.id = registros_aulas.professor_id
      and p.user_id = auth.uid()
      and p.ativo = true
      and p.acesso_portal = true
  )
  and exists (
    select 1
    from public.horarios h
    where h.id = registros_aulas.horario_id
      and h.professor_id = registros_aulas.professor_id
      and h.aluno_id = registros_aulas.aluno_id
  )
);

create policy "registros_aulas_update_professor"
on public.registros_aulas
for update
to authenticated
using (
  exists (
    select 1
    from public.professores p
    where p.id = registros_aulas.professor_id
      and p.user_id = auth.uid()
      and p.ativo = true
      and p.acesso_portal = true
  )
)
with check (
  exists (
    select 1
    from public.professores p
    where p.id = registros_aulas.professor_id
      and p.user_id = auth.uid()
      and p.ativo = true
      and p.acesso_portal = true
  )
  and exists (
    select 1
    from public.horarios h
    where h.id = registros_aulas.horario_id
      and h.professor_id = registros_aulas.professor_id
      and h.aluno_id = registros_aulas.aluno_id
  )
);
