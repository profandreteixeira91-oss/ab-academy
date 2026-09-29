create table if not exists public.modalidade_frequencias (
  id uuid primary key default gen_random_uuid(),
  idioma text not null check (idioma in ('ingles','alemao')),
  modalidade text not null check (modalidade in ('dupla','grupo')),
  aulas_semana integer not null check (aulas_semana between 1 and 7),
  preco_mensal numeric(10,2),
  preco_anual numeric(10,2),
  valor_parcela numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (idioma, modalidade, aulas_semana)
);

alter table public.leads add column if not exists aulas_semana integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_aulas_semana_check') then
    alter table public.leads add constraint leads_aulas_semana_check
      check (aulas_semana is null or aulas_semana between 1 and 7);
  end if;
end $$;

alter table public.modalidade_frequencias enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='modalidade_frequencias'
      and policyname='public_read_active_modalidade_frequencias'
  ) then
    create policy public_read_active_modalidade_frequencias
      on public.modalidade_frequencias for select to anon, authenticated
      using (ativo = true);
  end if;
end $$;

insert into public.modalidade_frequencias (idioma, modalidade, aulas_semana)
values
('ingles','dupla',1),('ingles','dupla',2),('ingles','dupla',3),
('alemao','dupla',1),('alemao','dupla',2),('alemao','dupla',3),
('ingles','grupo',2),('ingles','grupo',3),
('alemao','grupo',2),('alemao','grupo',3)
on conflict (idioma, modalidade, aulas_semana) do nothing;