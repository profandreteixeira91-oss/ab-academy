alter table public.planos
  add column if not exists modalidade text not null default 'individual',
  add column if not exists min_alunos integer,
  add column if not exists max_alunos integer;

alter table public.leads
  add column if not exists modalidade text not null default 'individual',
  add column if not exists quantidade_participantes integer,
  add column if not exists horario_preferido text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planos_modalidade_check') then
    alter table public.planos add constraint planos_modalidade_check
      check (modalidade in ('individual','dupla','grupo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planos_participantes_check') then
    alter table public.planos add constraint planos_participantes_check
      check (
        (modalidade = 'individual' and min_alunos is null and max_alunos is null)
        or (modalidade = 'dupla' and min_alunos = 2 and max_alunos = 2)
        or (modalidade = 'grupo' and min_alunos is not null and max_alunos is not null and min_alunos >= 3 and max_alunos >= min_alunos)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_modalidade_check') then
    alter table public.leads add constraint leads_modalidade_check
      check (modalidade in ('individual','dupla','grupo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_quantidade_participantes_check') then
    alter table public.leads add constraint leads_quantidade_participantes_check
      check (quantidade_participantes is null or quantidade_participantes between 1 and 50);
  end if;
end $$;