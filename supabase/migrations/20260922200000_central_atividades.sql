-- =========================================================
-- CENTRAL DE ATIVIDADES - AB ACADEMY
-- Biblioteca geral de prática por idioma e nível.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.central_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idioma text NOT NULL CHECK (idioma IN ('ingles', 'alemao')),
  nivel text NOT NULL CHECK (nivel IN ('iniciante','basico','intermediario','avancado','fluente')),
  categoria text NOT NULL CHECK (categoria IN ('vocabulario','gramatica','leitura','compreensao','escrita','cotidiano','revisao')),
  tipo_exercicio text NOT NULL CHECK (tipo_exercicio IN ('multipla_escolha','multipla_resposta','verdadeiro_falso','dissertativa','resposta_curta','lacunas','ordenar','associar')),
  titulo text NOT NULL,
  descricao text,
  instrucoes text,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  explicacao text,
  dificuldade smallint NOT NULL DEFAULT 1 CHECK (dificuldade BETWEEN 1 AND 5),
  tempo_estimado integer NOT NULL DEFAULT 5 CHECK (tempo_estimado > 0),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada','arquivada')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia')),
  mes_referencia date,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS central_atividades_filtro_idx ON public.central_atividades (idioma, nivel, status, categoria);
CREATE INDEX IF NOT EXISTS central_atividades_mes_idx ON public.central_atividades (mes_referencia);

CREATE TABLE IF NOT EXISTS public.central_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.central_atividades(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  pontuacao numeric(8,2),
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atividade_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS central_respostas_aluno_idx ON public.central_respostas (aluno_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.aluno_dono_resposta_central(p_resposta_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.central_respostas r
    INNER JOIN public.alunos a ON a.id = r.aluno_id
    WHERE r.id = p_resposta_id AND a.user_id = auth.uid()
  );
$$;

ALTER TABLE public.central_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno pode visualizar atividades publicadas da central" ON public.central_atividades;
CREATE POLICY "Aluno pode visualizar atividades publicadas da central"
ON public.central_atividades FOR SELECT TO authenticated
USING (
  status = 'publicada'
  AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin pode gerenciar atividades da central" ON public.central_atividades;
CREATE POLICY "Admin pode gerenciar atividades da central"
ON public.central_atividades FOR ALL TO authenticated
USING (public.usuario_e_admin()) WITH CHECK (public.usuario_e_admin());

DROP POLICY IF EXISTS "Aluno pode visualizar suas respostas da central" ON public.central_respostas;
CREATE POLICY "Aluno pode visualizar suas respostas da central"
ON public.central_respostas FOR SELECT TO authenticated
USING (public.aluno_dono_resposta_central(id));

DROP POLICY IF EXISTS "Aluno pode criar suas respostas da central" ON public.central_respostas;
CREATE POLICY "Aluno pode criar suas respostas da central"
ON public.central_respostas FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.alunos a
  WHERE a.id = aluno_id AND a.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Aluno pode atualizar suas respostas da central" ON public.central_respostas;
CREATE POLICY "Aluno pode atualizar suas respostas da central"
ON public.central_respostas FOR UPDATE TO authenticated
USING (public.aluno_dono_resposta_central(id))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.alunos a
  WHERE a.id = aluno_id AND a.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admin pode gerenciar respostas da central" ON public.central_respostas;
CREATE POLICY "Admin pode gerenciar respostas da central"
ON public.central_respostas FOR ALL TO authenticated
USING (public.usuario_e_admin()) WITH CHECK (public.usuario_e_admin());

CREATE OR REPLACE FUNCTION public.central_atividades_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS central_atividades_updated_at_trigger ON public.central_atividades;
CREATE TRIGGER central_atividades_updated_at_trigger
BEFORE UPDATE ON public.central_atividades FOR EACH ROW
EXECUTE FUNCTION public.central_atividades_updated_at();

CREATE OR REPLACE FUNCTION public.central_respostas_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS central_respostas_updated_at_trigger ON public.central_respostas;
CREATE TRIGGER central_respostas_updated_at_trigger
BEFORE UPDATE ON public.central_respostas FOR EACH ROW
EXECUTE FUNCTION public.central_respostas_updated_at();
