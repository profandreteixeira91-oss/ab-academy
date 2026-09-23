-- AB Academy
-- Corrige o INSERT de atividades para professores.
-- A validação usa uma função SECURITY DEFINER para que a RLS de
-- professores não impeça a checagem do vínculo user_id -> professor.id.

CREATE OR REPLACE FUNCTION public.professor_atual_autorizado(p_professor_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.professores p
    WHERE p.id = p_professor_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
      AND p.acesso_portal = true
  );
$$;

REVOKE ALL ON FUNCTION public.professor_atual_autorizado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professor_atual_autorizado(uuid) TO authenticated;

DROP POLICY IF EXISTS "atividades_insert_professor" ON public.atividades;

CREATE POLICY "atividades_insert_professor"
ON public.atividades
FOR INSERT
TO authenticated
WITH CHECK (
  public.usuario_e_admin()
  OR public.professor_atual_autorizado(professor_id)
);

-- Garante que a tabela continue protegida por RLS.
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
