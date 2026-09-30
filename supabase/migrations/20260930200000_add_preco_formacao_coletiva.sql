create or replace function public.preco_formacao_coletiva(
  p_idioma text,
  p_modalidade text,
  p_aulas_semana integer
)
returns numeric
language plpgsql
set search_path to ''
as $$
begin
  if p_modalidade='dupla' then
    if p_idioma='ingles' and p_aulas_semana=1 then return 397 * 0.90; end if;
    if p_idioma='ingles' and p_aulas_semana=2 then return 680 * 0.90; end if;
    if p_idioma='alemao' and p_aulas_semana=1 then return 427 * 0.90; end if;
    if p_idioma='alemao' and p_aulas_semana=2 then return 760 * 0.90; end if;
  elsif p_modalidade='grupo' then
    if p_idioma='ingles' and p_aulas_semana=2 then return 397 * 0.85; end if;
    if p_idioma='ingles' and p_aulas_semana=3 then return 990 * 0.85; end if;
    if p_idioma='alemao' and p_aulas_semana=2 then return 427 * 0.85; end if;
    if p_idioma='alemao' and p_aulas_semana=3 then return 1110 * 0.85; end if;
  end if;
  raise exception 'Combinação de formação coletiva inválida.';
end;
$$;

revoke execute on function public.preco_formacao_coletiva(text,text,integer) from public;
grant execute on function public.preco_formacao_coletiva(text,text,integer) to anon, authenticated;
