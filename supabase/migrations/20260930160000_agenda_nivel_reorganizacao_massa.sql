alter table public.horarios
  add column if not exists nivel_referencia text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'horarios_nivel_referencia_check'
      and conrelid = 'public.horarios'::regclass
  ) then
    alter table public.horarios
      add constraint horarios_nivel_referencia_check
      check (
        nivel_referencia is null
        or nivel_referencia = any (array['A1','A2','B1','B2','C1','C2'])
      );
  end if;
end $$;
