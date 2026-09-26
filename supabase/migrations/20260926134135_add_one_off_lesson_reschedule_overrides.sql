alter table public.registros_aulas
  add column if not exists hora_inicio_override time without time zone;

alter table public.registros_aulas
  add column if not exists hora_fim_override time without time zone;

create index if not exists idx_registros_aulas_data_hora_override
  on public.registros_aulas (data_aula, hora_inicio_override, hora_fim_override);
