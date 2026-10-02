-- The first participant of a collective fixed turma is still a
-- collective participant. The 10% formation price is a commercial
-- condition of the dupla/grupo and must never be persisted as an
-- individual enrollment origin.
--
-- Keep the existing public reservation function and replace only the
-- legacy origin label.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'reservar_turma_matricula_publico'
    and pg_get_function_identity_arguments(p.oid) =
      'p_turma_id uuid, p_horario_ids uuid[], p_idioma text, p_modalidade text, p_aulas_semana integer, p_nivel_conversacao text, p_nivel_escrita text, p_nivel_compreensao text, p_reserva_token text, p_nome text, p_email text';

  if v_definition is null then
    raise exception 'Função reservar_turma_matricula_publico não encontrada.';
  end if;

  v_definition := replace(
    v_definition,
    'case when v_count=0 then ''individual_aguardando'' else ''coletivo'' end',
    'case when v_count=0 then ''coletivo_em_formacao'' else ''coletivo'' end'
  );

  execute v_definition;
end $$;
