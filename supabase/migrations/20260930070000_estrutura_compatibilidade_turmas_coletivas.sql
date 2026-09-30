-- Etapa 2: estrutura base para compatibilidade de turmas coletivas.
-- Alterações aditivas e retrocompatíveis. A lógica de matching será implementada em etapa posterior.

alter table public.turmas
  add column if not exists professor_id uuid,
  add column if not exists nivel_referencia text,
  add column if not exists nivel_minimo text,
  add column if not exists nivel_maximo text;

alter table public.turma_participantes
  add column if not exists nivel_conversacao text,
  add column if not exists nivel_escrita text,
  add column if not exists nivel_compreensao text;

create index if not exists turmas_match_coletiva_idx
  on public.turmas (idioma, modalidade, aulas_semana, professor_id, status);

create index if not exists turma_participantes_nivel_idx
  on public.turma_participantes (turma_id, nivel_conversacao, nivel_escrita, nivel_compreensao);

-- Preserva a estrutura existente e registra o professor quando todos os
-- encontros atuais da turma usam o mesmo professor.
update public.turmas t
set professor_id = p.professor_id
from (
  select th.turma_id, (array_agg(h.professor_id))[1] as professor_id
  from public.turma_horarios th
  join public.horarios h on h.id = th.horario_id
  where h.professor_id is not null
  group by th.turma_id
  having count(distinct h.professor_id) = 1
) p
where t.id = p.turma_id
  and t.professor_id is null;

-- Snapshot pedagógico do participante. Para leads/reservas ainda sem aluno_id,
-- os campos permanecem nulos e serão preenchidos no fluxo de matrícula.
update public.turma_participantes tp
set
  nivel_conversacao = a.nivel_conversacao,
  nivel_escrita = a.nivel_escrita,
  nivel_compreensao = a.nivel_compreensao
from public.alunos a
where a.id = tp.aluno_id
  and (
    tp.nivel_conversacao is null
    or tp.nivel_escrita is null
    or tp.nivel_compreensao is null
  );
