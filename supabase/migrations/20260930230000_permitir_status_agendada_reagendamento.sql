-- Permite que o registro de uma aula futura fique em estado agendado.
-- As aulas continuam sendo finalizadas pelo professor como presente ou falta.
alter table public.registros_aulas
  drop constraint if exists registros_aulas_status_check;

alter table public.registros_aulas
  add constraint registros_aulas_status_check
  check (status = any (array['agendada'::text, 'presente'::text, 'falta'::text]));
