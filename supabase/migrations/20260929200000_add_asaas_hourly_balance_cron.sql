create extension if not exists pg_net with schema extensions;

create table if not exists public.asaas_saldo_cache (
  id boolean primary key default true check (id = true),
  saldo numeric(14,2) not null default 0,
  consultado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.asaas_saldo_cache enable row level security;
drop policy if exists "Admins can read Asaas balance cache" on public.asaas_saldo_cache;
create policy "Admins can read Asaas balance cache"
on public.asaas_saldo_cache for select to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.ativo = true));

create table if not exists public.asaas_cron_config (
  id boolean primary key default true check (id = true),
  cron_token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.asaas_cron_config enable row level security;
revoke all on public.asaas_cron_config from anon, authenticated;
insert into public.asaas_cron_config (id) values (true) on conflict (id) do nothing;

select cron.unschedule('asaas-atualiza-saldo-hora')
where exists (select 1 from cron.job where jobname = 'asaas-atualiza-saldo-hora');

select cron.schedule(
  'asaas-atualiza-saldo-hora',
  '0 * * * *',
  $job$
    select extensions.http_post(
      url := 'https://vwmrxdzskvwojyfddjwd.supabase.co/functions/v1/asaas-finance-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (select cron_token from public.asaas_cron_config where id = true)
      ),
      body := '{}'::jsonb
    );
  $job$
);