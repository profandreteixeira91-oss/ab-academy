create or replace function public.vincular_lead_formacao_ao_inserir()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(new.formacao_turma,'') <> 'reservar_vaga'
     and new.modalidade in ('dupla','grupo')
     and new.horario_id is not null then
    perform public.vincular_lead_formacao(new.id, new.horario_id);
  end if;
  return new;
end;
$function$;