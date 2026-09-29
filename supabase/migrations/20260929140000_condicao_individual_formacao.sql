alter table public.pagamentos add column if not exists horario_formacao_id uuid references public.horarios(id);
alter table public.matriculas add column if not exists horario_formacao_id uuid references public.horarios(id);
create index if not exists pagamentos_horario_formacao_id_idx on public.pagamentos(horario_formacao_id);
create index if not exists matriculas_horario_formacao_id_idx on public.matriculas(horario_formacao_id);

create or replace function public.validar_pagamento_comercial()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  plano_modalidade text;
  plano_preco numeric;
  coletivo_preco numeric;
  horario_tipo text;
  valor_esperado numeric;
begin
  if new.turma_participante_id is not null then
    select tp.valor_coletivo into coletivo_preco
    from public.turma_participantes tp
    where tp.id = new.turma_participante_id and tp.status = 'confirmado';

    if coletivo_preco is null then
      raise exception 'A condição coletiva não está liberada para este participante.';
    end if;

    if abs(coalesce(new.valor,0) - coletivo_preco) > 0.01 then
      raise exception 'O valor do pagamento coletivo não corresponde ao valor liberado.';
    end if;

    return new;
  end if;

  if new.plano_id is null then
    raise exception 'Um plano válido é obrigatório para iniciar o pagamento.';
  end if;

  select modalidade, preco into plano_modalidade, plano_preco
  from public.planos
  where id = new.plano_id and ativo = true;

  if plano_modalidade is null then
    raise exception 'O plano selecionado não está disponível.';
  end if;

  if plano_modalidade <> 'individual' then
    raise exception 'Planos de dupla ou grupo só podem ser pagos após a confirmação da turma.';
  end if;

  if new.horario_formacao_id is not null then
    select tipo_horario into horario_tipo
    from public.horarios
    where id = new.horario_formacao_id and disponivel = true and aluno_id is null;

    if horario_tipo not in ('dupla','grupo') then
      raise exception 'O horário de formação selecionado não está disponível.';
    end if;

    valor_esperado := round(plano_preco * 0.90, 2);

    if abs(coalesce(new.valor,0) - valor_esperado) > 0.01 then
      raise exception 'O valor inicial com condição de formação não corresponde ao desconto de 10%%.';
    end if;

    return new;
  end if;

  if abs(coalesce(new.valor,0) - coalesce(plano_preco,0)) > 0.01 then
    raise exception 'O valor do pagamento não corresponde ao valor oficial do plano.';
  end if;

  return new;
end;
$function$;