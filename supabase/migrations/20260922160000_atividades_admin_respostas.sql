-- Corrige acesso administrativo e de professores às atividades e respostas
-- AB Academy

CREATE OR REPLACE FUNCTION public.usuario_e_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.professor_dono_resposta(p_resposta_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.respostas_aluno r
    INNER JOIN public.atividades a ON a.id = r.atividade_id
    INNER JOIN public.professores p ON p.id = a.professor_id
    WHERE r.id = p_resposta_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  );
$$;

DROP POLICY IF EXISTS "Admin pode visualizar atividades" ON public.atividades;
CREATE POLICY "Admin pode visualizar atividades"
ON public.atividades
FOR SELECT
TO authenticated
USING (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode atualizar atividades" ON public.atividades;
CREATE POLICY "Admin pode atualizar atividades"
ON public.atividades
FOR UPDATE
TO authenticated
USING (public.usuario_e_admin())
WITH CHECK (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode visualizar exercicios" ON public.atividade_exercicios;
CREATE POLICY "Admin pode visualizar exercicios"
ON public.atividade_exercicios
FOR SELECT
TO authenticated
USING (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode visualizar alternativas" ON public.exercicio_alternativas;
CREATE POLICY "Admin pode visualizar alternativas"
ON public.exercicio_alternativas
FOR SELECT
TO authenticated
USING (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode visualizar conteudos" ON public.exercicio_conteudos;
CREATE POLICY "Admin pode visualizar conteudos"
ON public.exercicio_conteudos
FOR SELECT
TO authenticated
USING (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode visualizar respostas" ON public.respostas_aluno;
CREATE POLICY "Admin pode visualizar respostas"
ON public.respostas_aluno
FOR SELECT
TO authenticated
USING (public.usuario_e_admin());

DROP POLICY IF EXISTS "Admin pode corrigir respostas" ON public.respostas_aluno;
CREATE POLICY "Admin pode corrigir respostas"
ON public.respostas_aluno
FOR UPDATE
TO authenticated
USING (public.usuario_e_admin())
WITH CHECK (public.usuario_e_admin());

DROP POLICY IF EXISTS "Professor pode visualizar respostas dos seus alunos" ON public.respostas_aluno;
CREATE POLICY "Professor pode visualizar respostas dos seus alunos"
ON public.respostas_aluno
FOR SELECT
TO authenticated
USING (public.professor_dono_resposta(id));

DROP POLICY IF EXISTS "Professor pode corrigir respostas dos seus alunos" ON public.respostas_aluno;
CREATE POLICY "Professor pode corrigir respostas dos seus alunos"
ON public.respostas_aluno
FOR UPDATE
TO authenticated
USING (public.professor_dono_resposta(id))
WITH CHECK (public.professor_dono_resposta(id));
