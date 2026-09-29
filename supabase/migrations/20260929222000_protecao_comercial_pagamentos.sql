-- Proteção comercial das matrículas individuais
-- Duplas e grupos somente podem chegar ao pagamento após confirmação de turma.

create or replace function public.validar_pagamento_comercial()
returns trigger
language plpgsql
as $$
declare
  plano_modalidade text;
  plano_preco numeric;
begin
  if new.plano_id is null then
    raise exception 'Um plano válido é obrigatório para iniciar o pagamento.';
  end if;

  select modalidade, preco
    into plano_modalidade, plano_preco
  from public.planos
  where id = new.plano_id
    and ativo = true;

  if plano_modalidade is null then
    raise exception 'O plano selecionado não está disponível.';
  end if;

  if plano_modalidade <> 'individual' then
    raise exception 'Planos de dupla ou grupo só podem ser pagos após a confirmação da turma.';
  end if;

  if abs(coalesce(new.valor, 0) - coalesce(plano_preco, 0)) > 0.01 then
    raise exception 'O valor do pagamento não corresponde ao valor oficial do plano.';
  end if;

  return new;
end;
$$;

drop trigger if exists pagamentos_validar_comercial on public.pagamentos;

create trigger pagamentos_validar_comercial
before insert or update of plano_id, valor on public.pagamentos
for each row execute function public.validar_pagamento_comercial();