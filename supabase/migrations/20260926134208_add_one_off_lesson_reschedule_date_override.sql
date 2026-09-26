alter table public.registros_aulas
  add column if not exists data_aula_override date;

create index if not exists idx_registros_aulas_override
  on public.registros_aulas (data_aula_override, hora_inicio_override, hora_fim_override);
