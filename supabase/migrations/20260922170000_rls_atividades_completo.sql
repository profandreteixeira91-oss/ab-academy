-- AB Academy
-- RLS completo para atividades, exercícios e respostas.
-- Corrige a diferença entre professores.id e auth.users.id.

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

CREATE OR REPLACE FUNCTION public.professor_dono_atividade(p_atividade_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atividades a
    INNER JOIN public.professores p ON p.id = a.professor_id
    WHERE a.id = p_atividade_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  );
$$;

CREATE OR REPLACE FUNCTION public.aluno_dono_atividade(p_atividade_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atividades a
    INNER JOIN public.alunos al ON al.id = a.aluno_id
    WHERE a.id = p_atividade_id
      AND al.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.professor_dono_exercicio(p_exercicio_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atividade_exercicios e
    INNER JOIN public.atividades a ON a.id = e.atividade_id
    INNER JOIN public.professores p ON p.id = a.professor_id
    WHERE e.id = p_exercicio_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  );
$$;

CREATE OR REPLACE FUNCTION public.aluno_dono_exercicio(p_exercicio_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atividade_exercicios e
    INNER JOIN public.atividades a ON a.id = e.atividade_id
    INNER JOIN public.alunos al ON al.id = a.aluno_id
    WHERE e.id = p_exercicio_id
      AND al.user_id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.aluno_dono_resposta(p_resposta_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.respostas_aluno r
    INNER JOIN public.alunos al ON al.id = r.aluno_id
    WHERE r.id = p_resposta_id
      AND al.user_id = auth.uid()
  );
$$;

-- Estas tabelas pertencem exclusivamente ao módulo de atividades.
-- Removemos políticas anteriores para evitar regras conflitantes/incorretas.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'atividades',
        'atividade_exercicios',
        'exercicio_alternativas',
        'exercicio_conteudos',
        'respostas_aluno'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =========================================================
-- ATIVIDADES
-- =========================================================

CREATE POLICY "atividades_select_admin"
ON public.atividades
FOR SELECT TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(id)
  OR public.aluno_dono_atividade(id)
);

CREATE POLICY "atividades_insert_professor"
ON public.atividades
FOR INSERT TO authenticated
WITH CHECK (
  public.usuario_e_admin()
  OR EXISTS (
    SELECT 1
    FROM public.professores p
    WHERE p.id = professor_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  )
);

CREATE POLICY "atividades_update"
ON public.atividades
FOR UPDATE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(id)
  OR public.aluno_dono_atividade(id)
)
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(id)
  OR public.aluno_dono_atividade(id)
);

CREATE POLICY "atividades_delete_professor_admin"
ON public.atividades
FOR DELETE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(id)
);

-- =========================================================
-- EXERCÍCIOS
-- =========================================================

CREATE POLICY "atividade_exercicios_select"
ON public.atividade_exercicios
FOR SELECT TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(atividade_id)
  OR public.aluno_dono_atividade(atividade_id)
);

CREATE POLICY "atividade_exercicios_insert_professor"
ON public.atividade_exercicios
FOR INSERT TO authenticated
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(atividade_id)
);

CREATE POLICY "atividade_exercicios_update_professor"
ON public.atividade_exercicios
FOR UPDATE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(atividade_id)
)
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(atividade_id)
);

CREATE POLICY "atividade_exercicios_delete_professor"
ON public.atividade_exercicios
FOR DELETE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_atividade(atividade_id)
);

-- =========================================================
-- ALTERNATIVAS
-- =========================================================

CREATE POLICY "exercicio_alternativas_select"
ON public.exercicio_alternativas
FOR SELECT TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
  OR public.aluno_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_alternativas_insert_professor"
ON public.exercicio_alternativas
FOR INSERT TO authenticated
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_alternativas_update_professor"
ON public.exercicio_alternativas
FOR UPDATE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
)
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_alternativas_delete_professor"
ON public.exercicio_alternativas
FOR DELETE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

-- =========================================================
-- CONTEÚDOS
-- =========================================================

CREATE POLICY "exercicio_conteudos_select"
ON public.exercicio_conteudos
FOR SELECT TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
  OR public.aluno_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_conteudos_insert_professor"
ON public.exercicio_conteudos
FOR INSERT TO authenticated
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_conteudos_update_professor"
ON public.exercicio_conteudos
FOR UPDATE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
)
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

CREATE POLICY "exercicio_conteudos_delete_professor"
ON public.exercicio_conteudos
FOR DELETE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_exercicio(exercicio_id)
);

-- =========================================================
-- RESPOSTAS DO ALUNO
-- =========================================================

CREATE POLICY "respostas_select"
ON public.respostas_aluno
FOR SELECT TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_resposta(id)
  OR public.aluno_dono_resposta(id)
);

CREATE POLICY "respostas_insert_aluno"
ON public.respostas_aluno
FOR INSERT TO authenticated
WITH CHECK (
  public.aluno_dono_atividade(atividade_id)
  AND EXISTS (
    SELECT 1
    FROM public.alunos al
    WHERE al.id = aluno_id
      AND al.user_id = auth.uid()
  )
);

CREATE POLICY "respostas_update"
ON public.respostas_aluno
FOR UPDATE TO authenticated
USING (
  public.usuario_e_admin()
  OR public.professor_dono_resposta(id)
  OR public.aluno_dono_resposta(id)
)
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_dono_resposta(id)
  OR public.aluno_dono_resposta(id)
);

CREATE POLICY "respostas_delete_aluno"
ON public.respostas_aluno
FOR DELETE TO authenticated
USING (
  public.aluno_dono_resposta(id)
);

-- Índices úteis para as consultas do portal.
CREATE INDEX IF NOT EXISTS idx_atividades_professor_id
  ON public.atividades (professor_id);

CREATE INDEX IF NOT EXISTS idx_atividades_aluno_id
  ON public.atividades (aluno_id);

CREATE INDEX IF NOT EXISTS idx_atividade_exercicios_atividade_id
  ON public.atividade_exercicios (atividade_id);

CREATE INDEX IF NOT EXISTS idx_respostas_aluno_atividade_aluno
  ON public.respostas_aluno (atividade_id, aluno_id);
