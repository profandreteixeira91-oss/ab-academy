create table if not exists public.enterprise_lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.enterprise_leads(id) on delete cascade,
  status text not null check (status in ('novo','contatado','diagnostico','proposta_enviada','negociacao','contratado','perdido')),
  observacao text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists enterprise_lead_history_lead_idx
  on public.enterprise_lead_history(lead_id, created_at desc);

alter table public.enterprise_lead_history enable row level security;

drop policy if exists "Admins can read Enterprise lead history" on public.enterprise_lead_history;
create policy "Admins can read Enterprise lead history"
  on public.enterprise_lead_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = (select auth.uid())
        and au.ativo = true
    )
  );

drop policy if exists "Admins can insert Enterprise lead history" on public.enterprise_lead_history;
create policy "Admins can insert Enterprise lead history"
  on public.enterprise_lead_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = (select auth.uid())
        and au.ativo = true
    )
  );

create or replace function public.record_enterprise_lead_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.enterprise_lead_history (lead_id, status, observacao, changed_by)
    values (new.id, new.status, null, (select auth.uid()));
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.enterprise_lead_history (lead_id, status, observacao, changed_by)
    values (new.id, new.status, null, (select auth.uid()));
  end if;

  return new;
end;
$$;

drop trigger if exists enterprise_lead_history_trigger on public.enterprise_leads;
create trigger enterprise_lead_history_trigger
after insert or update of status on public.enterprise_leads
for each row execute function public.record_enterprise_lead_history();

insert into public.enterprise_lead_history (lead_id, status, observacao, changed_by)
select el.id, el.status, null, null
from public.enterprise_leads el
where not exists (
  select 1
  from public.enterprise_lead_history h
  where h.lead_id = el.id
);
