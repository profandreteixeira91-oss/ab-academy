create table if not exists public.asaas_transferencias (
  id uuid primary key default gen_random_uuid(),
  asaas_transfer_id text unique,
  valor numeric(14,2) not null check (valor > 0),
  chave_pix text not null,
  tipo_chave_pix text not null check (tipo_chave_pix in ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  descricao text,
  status text not null default 'PENDING',
  fail_reason text,
  solicitado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asaas_transferencias enable row level security;

drop policy if exists "admin select asaas transfers" on public.asaas_transferencias;
create policy "admin select asaas transfers"
on public.asaas_transferencias
for select to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.ativo = true
  )
);

drop policy if exists "admin insert asaas transfers" on public.asaas_transferencias;
create policy "admin insert asaas transfers"
on public.asaas_transferencias
for insert to authenticated
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.ativo = true
  )
  and solicitado_por = auth.uid()
);
