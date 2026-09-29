create or replace function public.selecionar_horario_matricula(
  p_horario_id uuid,
  p_idioma text,
  p_tipo_horario text
)
returns public.horarios
language plpgsql
set search_path = public
as $function$
declare
  horario_atual public.horarios;
begin
  if p_tipo_horario not in ('individual','dupla','grupo') then
    raise exception 'Tipo de horário inválido.';
  end if;

  select * into horario_atual
  from public.horarios
  where id = p_horario_id
    and idioma = p_idioma
    and disponivel = true
    and aluno_id is null
  for update;

  if not found then
    raise exception 'Este horário não está mais disponível.';
  end if;

  if horario_atual.tipo_horario <> p_tipo_horario then
    update public.horarios
    set tipo_horario = p_tipo_horario
    where id = p_horario_id
    returning * into horario_atual;
  end if;

  return horario_atual;
end;
$function$;

revoke all on function public.selecionar_horario_matricula(uuid,text,text) from public;
grant execute on function public.selecionar_horario_matricula(uuid,text,text) to anon, authenticated;