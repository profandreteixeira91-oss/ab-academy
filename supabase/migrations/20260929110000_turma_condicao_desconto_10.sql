alter table public.turma_participantes add column if not exists valor_coletivo_normal numeric(10,2);
alter table public.turma_matriculas add column if not exists valor_coletivo_normal numeric(10,2);
comment on column public.turma_participantes.valor_coletivo is 'Valor mensal com a condição especial aplicada';
comment on column public.turma_participantes.valor_coletivo_normal is 'Valor mensal coletivo normal, antes da condição especial';
comment on column public.turma_matriculas.valor_mensal is 'Valor mensal da condição liberada';
comment on column public.turma_matriculas.valor_coletivo_normal is 'Valor mensal coletivo normal, após o fim da condição';