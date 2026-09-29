alter table public.leads add column if not exists horario_id uuid references public.horarios(id);
alter table public.turmas add column if not exists horario_id uuid references public.horarios(id);
create index if not exists leads_horario_id_idx on public.leads(horario_id);
create index if not exists turmas_horario_id_idx on public.turmas(horario_id);

