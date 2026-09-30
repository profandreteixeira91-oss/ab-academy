drop function if exists public.obter_pagamento_checkout(uuid);

create function public.obter_pagamento_checkout(p_pagamento_id uuid)
returns table (
  id uuid,
  idioma text,
  tipo_plano text,
  valor numeric,
  status text,
  matricula_id uuid,
  plano_id uuid,
  plano_nome text
)
language sql
security definer
set search_path = ''
as $function$
  select p.id,p.idioma,p.tipo_plano,p.valor,p.status,p.matricula_id,p.plano_id,pl.nome
  from public.pagamentos p
  left join public.planos pl on pl.id=p.plano_id
  where p.id=p_pagamento_id
  limit 1
$function$;

revoke execute on function public.obter_pagamento_checkout(uuid) from public;
grant execute on function public.obter_pagamento_checkout(uuid) to anon, authenticated;