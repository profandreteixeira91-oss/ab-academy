alter table public.turma_participantes
  add column if not exists forma_inicio text not null default 'coletivo',
  add column if not exists valor_individual numeric(10,2),
  add column if not exists valor_coletivo numeric(10,2),
  add column if not exists condicao_meses integer,
  add column if not exists condicao_inicio date,
  add column if not exists condicao_fim date;

alter table public.turma_participantes
  drop constraint if exists turma_participantes_forma_inicio_check;

alter table public.turma_participantes
  add constraint turma_participantes_forma_inicio_check
  check (forma_inicio in ('coletivo','individual_aguardando'));

alter table public.turma_participantes
  drop constraint if exists turma_participantes_condicao_meses_check;

alter table public.turma_participantes
  add constraint turma_participantes_condicao_meses_check
  check (condicao_meses is null or condicao_meses between 1 and 24);

comment on column public.turma_participantes.forma_inicio is 'Define se o participante inicia diretamente na modalidade coletiva ou começa individualmente aguardando a formação.';
comment on column public.turma_participantes.valor_individual is 'Valor mensal do plano individual usado enquanto o participante aguarda a formação.';
comment on column public.turma_participantes.valor_coletivo is 'Valor mensal por participante após a formação da turma.';
comment on column public.turma_participantes.condicao_meses is 'Quantidade de meses da condição coletiva especial após a formação.';
comment on column public.turma_participantes.condicao_inicio is 'Primeiro dia da condição coletiva especial.';
comment on column public.turma_participantes.condicao_fim is 'Último dia da condição coletiva especial.';