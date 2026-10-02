-- Formation pricing for collective plans is always 90% of the selected
-- collective monthly plan. The plan itself remains the source of truth.

create or replace function public.preco_formacao_coletiva(p_idioma text, p_modalidade text, p_aulas_semana integer)
returns numeric
language plpgsql
security invoker
set search_path = ''
stable
as $function$
declare
  v_preco numeric;
begin
  select p.preco
    into v_preco
  from public.planos p
  where p.idioma = p_idioma
    and p.modalidade = p_modalidade
    and p.tipo = 'mensal'
    and p.aulas_semana = p_aulas_semana
    and p.ativo = true
  order by p.updated_at desc nulls last, p.created_at desc
  limit 1;

  if v_preco is null then
    raise exception 'Plano coletivo mensal não encontrado para a combinação informada.';
  end if;

  return round(v_preco * 0.90, 2);
end;
$function$;
