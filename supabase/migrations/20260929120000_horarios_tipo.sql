alter table public.horarios
  add column if not exists tipo_horario text not null default 'individual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'horarios_tipo_horario_check'
  ) then
    alter table public.horarios
      add constraint horarios_tipo_horario_check
      check (tipo_horario in ('individual','dupla','grupo'));
  end if;
end $$;

create index if not exists horarios_tipo_horario_idx
  on public.horarios (idioma, tipo_horario, dia_semana, hora_inicio)
  where disponivel = true;

comment on column public.horarios.tipo_horario is
  'Define se o horário é exclusivo para aula individual ou destinado à formação/aula de dupla ou grupo.';
