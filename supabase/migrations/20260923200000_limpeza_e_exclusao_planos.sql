-- =========================================================
-- PLANOS - LIMPEZA, UNICIDADE E EXCLUSÃO COMPLETA
-- =========================================================
--
-- 1. Mantém apenas um plano por idioma + tipo.
-- 2. Ao encontrar duplicatas, migra os registros vinculados
--    para o plano mantido antes de excluir o registro antigo.
-- 3. Cria unicidade definitiva em idioma + tipo.
-- 4. Cria RPC administrativa para excluir um plano e seus
--    registros diretamente vinculados.
-- =========================================================

alter table public.planos
  drop constraint if exists planos_tipo_check;

alter table public.planos
  add constraint planos_tipo_check
  check (
    tipo in (
      'mensal',
      'anual',
      'personalizado',
      'intensivo',
      'avulso'
    )
  );

do $$
declare
  duplicata record;
begin
  for duplicata in
    select
      p.id as duplicado_id,
      keeper.id as manter_id
    from public.planos p
    cross join lateral (
      select k.id
      from public.planos k
      where k.idioma = p.idioma
        and k.tipo = p.tipo
      order by
        k.ativo desc,
        k.updated_at desc nulls last,
        k.created_at desc nulls last,
        k.id desc
      limit 1
    ) keeper
    where p.id <> keeper.id
  loop
    update public.matriculas
    set plano_id = duplicata.manter_id
    where plano_id = duplicata.duplicado_id;

    update public.pagamentos
    set plano_id = duplicata.manter_id
    where plano_id = duplicata.duplicado_id;

    update public.mensalidades
    set plano_id = duplicata.manter_id
    where plano_id = duplicata.duplicado_id;

    delete from public.planos
    where id = duplicata.duplicado_id;
  end loop;
end
$$;

create unique index if not exists planos_idioma_tipo_unique_idx
  on public.planos (idioma, tipo);

-- =========================================================
-- EXCLUSÃO COMPLETA DE UM PLANO
-- =========================================================

create or replace function public.admin_excluir_plano(
  p_plano_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano_exists boolean;
  v_pagamento_ids uuid[];
  v_mensalidades integer := 0;
  v_pagamentos integer := 0;
  v_matriculas integer := 0;
begin
  if not public.usuario_e_admin() then
    raise exception 'Acesso negado.'
      using errcode = '42501';
  end if;

  select exists(
    select 1
    from public.planos
    where id = p_plano_id
  )
  into v_plano_exists;

  if not v_plano_exists then
    raise exception 'Plano não encontrado.'
      using errcode = 'P0002';
  end if;

  select coalesce(array_agg(id), '{}')
  into v_pagamento_ids
  from public.pagamentos
  where plano_id = p_plano_id;

  if coalesce(array_length(v_pagamento_ids, 1), 0) > 0 then
    delete from public.lancamentos_financeiros
    where pagamento_id = any(v_pagamento_ids);
  end if;

  delete from public.mensalidades
  where plano_id = p_plano_id;

  get diagnostics v_mensalidades = row_count;

  delete from public.pagamentos
  where plano_id = p_plano_id;

  get diagnostics v_pagamentos = row_count;

  delete from public.matriculas
  where plano_id = p_plano_id;

  get diagnostics v_matriculas = row_count;

  delete from public.planos
  where id = p_plano_id;

  if not found then
    raise exception 'Não foi possível excluir o plano.'
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'success', true,
    'plano_id', p_plano_id,
    'mensalidades_excluidas', v_mensalidades,
    'pagamentos_excluidos', v_pagamentos,
    'matriculas_excluidas', v_matriculas
  );
end
$$;

revoke all on function public.admin_excluir_plano(uuid)
  from public, anon;

grant execute on function public.admin_excluir_plano(uuid)
  to authenticated;
