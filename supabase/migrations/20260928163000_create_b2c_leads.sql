-- B2C lead capture
-- Applied to production Supabase project AB Academy.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text not null,
  idioma_interesse text not null check (idioma_interesse in ('ingles','alemao','ambos')),
  objetivo text,
  nivel text,
  origem text not null default 'site',
  landing_page text,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  referrer text,
  status text not null default 'novo' check (status in ('novo','contatado','diagnostico','proposta_enviada','negociacao','matriculado','perdido')),
  observacoes text,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_email_idx on public.leads(lower(email));
create index if not exists leads_source_idx on public.leads(source);
create index if not exists leads_campaign_idx on public.leads(campaign);

alter table public.leads enable row level security;

drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads" on public.leads for insert to anon, authenticated with check (true);
drop policy if exists "Admins can read leads" on public.leads;
create policy "Admins can read leads" on public.leads for select to authenticated using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.ativo=true));
drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads" on public.leads for update to authenticated using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.ativo=true)) with check (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.ativo=true));
drop policy if exists "Admins can delete leads" on public.leads;
create policy "Admins can delete leads" on public.leads for delete to authenticated using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.ativo=true));

grant insert on public.leads to anon, authenticated;
grant select, update, delete on public.leads to authenticated;
