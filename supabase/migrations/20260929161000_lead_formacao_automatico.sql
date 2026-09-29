create or replace function public.vincular_lead_formacao_ao_inserir()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.modalidade in ('dupla','grupo') and new.horario_id is not null then
    perform public.vincular_lead_formacao(new.id, new.horario_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_vincular_formacao_trigger on public.leads;

create trigger leads_vincular_formacao_trigger
after insert on public.leads
for each row
execute function public.vincular_lead_formacao_ao_inserir();

revoke all on function public.vincular_lead_formacao_ao_inserir() from public;