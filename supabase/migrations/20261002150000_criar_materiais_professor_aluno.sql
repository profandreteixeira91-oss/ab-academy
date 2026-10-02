create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.professores(id) on delete cascade,
  titulo text not null,
  idioma text null check (idioma is null or idioma = any (array['ingles','alemao'])),
  conteudo_html text not null default '',
  imagens jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho','publicado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publicado_em timestamptz null
);

create table if not exists public.material_alunos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  visualizado_em timestamptz null,
  created_at timestamptz not null default now(),
  unique(material_id, aluno_id)
);

create index if not exists materiais_professor_id_idx on public.materiais(professor_id);
create index if not exists materiais_status_idx on public.materiais(status);
create index if not exists material_alunos_material_id_idx on public.material_alunos(material_id);
create index if not exists material_alunos_aluno_id_idx on public.material_alunos(aluno_id);

alter table public.materiais enable row level security;
alter table public.material_alunos enable row level security;

drop policy if exists "professores podem consultar seus materiais" on public.materiais;
create policy "professores podem consultar seus materiais" on public.materiais for select to authenticated using (exists (select 1 from public.professores p where p.id = materiais.professor_id and p.user_id = (select auth.uid())));

drop policy if exists "alunos podem consultar materiais direcionados" on public.materiais;
create policy "alunos podem consultar materiais direcionados" on public.materiais for select to authenticated using (status = 'publicado' and exists (select 1 from public.material_alunos ma join public.alunos a on a.id = ma.aluno_id where ma.material_id = materiais.id and a.user_id = (select auth.uid())));

drop policy if exists "professores podem criar materiais" on public.materiais;
create policy "professores podem criar materiais" on public.materiais for insert to authenticated with check (exists (select 1 from public.professores p where p.id = materiais.professor_id and p.user_id = (select auth.uid()) and p.ativo = true and p.acesso_portal = true));

drop policy if exists "professores podem atualizar seus materiais" on public.materiais;
create policy "professores podem atualizar seus materiais" on public.materiais for update to authenticated using (exists (select 1 from public.professores p where p.id = materiais.professor_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.professores p where p.id = materiais.professor_id and p.user_id = (select auth.uid())));

drop policy if exists "professores podem excluir seus materiais" on public.materiais;
create policy "professores podem excluir seus materiais" on public.materiais for delete to authenticated using (exists (select 1 from public.professores p where p.id = materiais.professor_id and p.user_id = (select auth.uid())));

drop policy if exists "professores gerenciam destinatarios" on public.material_alunos;
create policy "professores gerenciam destinatarios" on public.material_alunos for all to authenticated using (exists (select 1 from public.materiais m join public.professores p on p.id = m.professor_id where m.id = material_alunos.material_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.materiais m join public.professores p on p.id = m.professor_id where m.id = material_alunos.material_id and p.user_id = (select auth.uid())));

drop policy if exists "alunos consultam seus materiais" on public.material_alunos;
create policy "alunos consultam seus materiais" on public.material_alunos for select to authenticated using (exists (select 1 from public.alunos a where a.id = material_alunos.aluno_id and a.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public) values ('materiais', 'materiais', false) on conflict (id) do update set public = false;

drop policy if exists "professores fazem upload de materiais" on storage.objects;
create policy "professores fazem upload de materiais" on storage.objects for insert to authenticated with check (bucket_id = 'materiais' and exists (select 1 from public.professores p where p.user_id = (select auth.uid()) and p.ativo = true and p.acesso_portal = true and split_part(name, '/', 1) = p.id::text));

drop policy if exists "professores atualizam uploads de materiais" on storage.objects;
create policy "professores atualizam uploads de materiais" on storage.objects for update to authenticated using (bucket_id = 'materiais' and exists (select 1 from public.professores p where p.user_id = (select auth.uid()) and split_part(name, '/', 1) = p.id::text)) with check (bucket_id = 'materiais' and exists (select 1 from public.professores p where p.user_id = (select auth.uid()) and split_part(name, '/', 1) = p.id::text));

drop policy if exists "professores excluem uploads de materiais" on storage.objects;
create policy "professores excluem uploads de materiais" on storage.objects for delete to authenticated using (bucket_id = 'materiais' and exists (select 1 from public.professores p where p.user_id = (select auth.uid()) and split_part(name, '/', 1) = p.id::text));

drop policy if exists "usuarios autorizados leem uploads de materiais" on storage.objects;
create policy "usuarios autorizados leem uploads de materiais" on storage.objects for select to authenticated using (bucket_id = 'materiais' and (exists (select 1 from public.professores p where p.user_id = (select auth.uid()) and split_part(name, '/', 1) = p.id::text) or exists (select 1 from public.material_alunos ma join public.alunos a on a.id = ma.aluno_id where a.user_id = (select auth.uid()) and ma.material_id = split_part(name, '/', 2)::uuid)));