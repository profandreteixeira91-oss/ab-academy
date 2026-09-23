-- =========================================================
-- ANEXOS NAS SOLICITAÇÕES - AB ACADEMY
-- =========================================================

create table if not exists public.solicitacao_anexos (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.solicitacao_mensagens(id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  nome_arquivo text not null,
  caminho_storage text not null unique,
  tipo_mime text,
  tamanho bigint not null default 0,
  remetente_tipo text not null
    check (remetente_tipo in ('aluno','admin')),
  remetente_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists solicitacao_anexos_mensagem_idx
  on public.solicitacao_anexos(mensagem_id, created_at);

create index if not exists solicitacao_anexos_solicitacao_idx
  on public.solicitacao_anexos(solicitacao_id, created_at);

alter table public.solicitacao_anexos enable row level security;

revoke all on table public.solicitacao_anexos from anon;
grant select, insert on table public.solicitacao_anexos to authenticated;

drop policy if exists "solicitacao_anexos_admin_all" on public.solicitacao_anexos;
drop policy if exists "solicitacao_anexos_aluno_select" on public.solicitacao_anexos;
drop policy if exists "solicitacao_anexos_aluno_insert" on public.solicitacao_anexos;

create policy "solicitacao_anexos_admin_all"
on public.solicitacao_anexos for all to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));

create policy "solicitacao_anexos_aluno_select"
on public.solicitacao_anexos for select to authenticated
using (
  exists (
    select 1
    from public.solicitacoes s
    join public.alunos a on a.id = s.aluno_id
    where s.id = solicitacao_anexos.solicitacao_id
      and a.user_id = auth.uid()
  )
);

create policy "solicitacao_anexos_aluno_insert"
on public.solicitacao_anexos for insert to authenticated
with check (
  remetente_tipo = 'aluno'
  and remetente_id = auth.uid()
  and exists (
    select 1
    from public.solicitacoes s
    join public.alunos a on a.id = s.aluno_id
    where s.id = solicitacao_anexos.solicitacao_id
      and a.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'solicitacoes-anexos',
  'solicitacoes-anexos',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "solicitacoes_storage_select" on storage.objects;
drop policy if exists "solicitacoes_storage_insert" on storage.objects;

create policy "solicitacoes_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'solicitacoes-anexos'
  and (
    (select public.usuario_e_admin())
    or exists (
      select 1
      from public.solicitacoes s
      join public.alunos a on a.id = s.aluno_id
      where s.id = split_part(name, '/', 1)::uuid
        and a.user_id = auth.uid()
    )
  )
);

create policy "solicitacoes_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'solicitacoes-anexos'
  and (
    (select public.usuario_e_admin())
    or exists (
      select 1
      from public.solicitacoes s
      join public.alunos a on a.id = s.aluno_id
      where s.id = split_part(name, '/', 1)::uuid
        and a.user_id = auth.uid()
    )
  )
);
