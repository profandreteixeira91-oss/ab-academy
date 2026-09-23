-- =========================================================
-- ACESSO DO ALUNO AO PRÓPRIO HISTÓRICO FINANCEIRO
-- =========================================================

drop policy if exists "mensalidades_aluno_select" on public.mensalidades;

create policy "mensalidades_aluno_select"
on public.mensalidades
for select
to authenticated
using (
  exists (
    select 1
    from public.alunos
    where alunos.id = mensalidades.aluno_id
      and alunos.user_id = auth.uid()
  )
);
