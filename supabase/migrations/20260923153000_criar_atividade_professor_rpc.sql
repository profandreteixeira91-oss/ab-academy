-- AB Academy
-- Criação de atividades de professor por função SECURITY DEFINER.
-- Evita que a RLS da tabela atividades bloqueie a criação legítima.

CREATE OR REPLACE FUNCTION public.criar_atividade_professor(
  p_professor_id uuid,
  p_aluno_id uuid,
  p_titulo text,
  p_descricao text,
  p_idioma text,
  p_status text,
  p_prazo timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atividade_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.professores p
    WHERE p.id = p_professor_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  ) THEN
    RAISE EXCEPTION 'Professor não autorizado para criar atividades';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = p_aluno_id
      AND a.professor_id = p_professor_id
  ) THEN
    RAISE EXCEPTION 'Aluno não pertence ao professor autenticado';
  END IF;

  INSERT INTO public.atividades (
    professor_id,
    aluno_id,
    titulo,
    descricao,
    idioma,
    status,
    prazo
  )
  VALUES (
    p_professor_id,
    p_aluno_id,
    p_titulo,
    p_descricao,
    p_idioma,
    p_status,
    p_prazo
  )
  RETURNING id INTO v_atividade_id;

  RETURN v_atividade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_atividade_professor(
  uuid, uuid, text, text, text, text, timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_atividade_professor(
  uuid, uuid, text, text, text, text, timestamptz
) TO authenticated;
