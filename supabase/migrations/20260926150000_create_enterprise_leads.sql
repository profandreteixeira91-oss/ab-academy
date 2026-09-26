create table if not exists public.enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text not null,
  cargo text,
  email text not null,
  telefone text,
  colaboradores text,
  idiomas text[] not null default '{}',
  objetivo text,
  mensagem text,
  status text not null default 'novo' check (status in ('novo','contatado','diagnostico','proposta_enviada','negociacao','contratado','perdido')),
  observacoes text,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enterprise_leads enable row level security;

drop policy if exists "enterprise leads public insert" on public.enterprise_leads;
create policy "enterprise leads public insert"
on public.enterprise_leads for insert to anon, authenticated with check (true);

drop policy if exists "enterprise leads admin select" on public.enterprise_leads;
create policy "enterprise leads admin select"
on public.enterprise_leads for select to authenticated
using (exists (select 1 from public.admin_users where admin_users.user_id = (select auth.uid()) and admin_users.ativo = true));

drop policy if exists "enterprise leads admin update" on public.enterprise_leads;
create policy "enterprise leads admin update"
on public.enterprise_leads for update to authenticated
using (exists (select 1 from public.admin_users where admin_users.user_id = (select auth.uid()) and admin_users.ativo = true))
with check (exists (select 1 from public.admin_users where admin_users.user_id = (select auth.uid()) and admin_users.ativo = true));

create index if not exists enterprise_leads_status_idx on public.enterprise_leads(status);
create index if not exists enterprise_leads_created_at_idx on public.enterprise_leads(created_at desc);
