-- =========================================================
-- AB ACADEMY — AULA DIAGNÓSTICA AVULSA
-- =========================================================
-- Execute este script no SQL Editor do Supabase.
--
-- A aula diagnóstica:
--   • é um plano do tipo avulso;
--   • custa R$ 50;
--   • é uma cobrança única;
--   • não cria assinatura recorrente;
--   • existe uma opção para Inglês e outra para Alemão.
-- =========================================================

-- 1. Permite o novo tipo de plano.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.planos'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%mensal%'
    AND pg_get_constraintdef(con.oid) ILIKE '%anual%'
    AND pg_get_constraintdef(con.oid) ILIKE '%personalizado%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.planos DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.planos
DROP CONSTRAINT IF EXISTS planos_tipo_check;

ALTER TABLE public.planos
ADD CONSTRAINT planos_tipo_check
CHECK (
  tipo IN (
    'mensal',
    'anual',
    'personalizado',
    'intensivo',
    'avulso'
  )
);

-- 2. Garante exatamente uma aula diagnóstica por idioma.
DELETE FROM public.planos
WHERE tipo = 'avulso'
  AND nome IN (
    'Aula Diagnóstica - Inglês',
    'Aula Diagnóstica - Alemão'
  );

INSERT INTO public.planos (
  idioma,
  tipo,
  nome,
  descricao,
  preco,
  parcelas,
  valor_parcela,
  ativo
)
VALUES
(
  'ingles',
  'avulso',
  'Aula Diagnóstica - Inglês',
  'Aula individual de 60 minutos para avaliar seu nível de Inglês e orientar o melhor caminho de estudos.',
  50.00,
  NULL,
  NULL,
  true
),
(
  'alemao',
  'avulso',
  'Aula Diagnóstica - Alemão',
  'Aula individual de 60 minutos para avaliar seu nível de Alemão e orientar o melhor caminho de estudos.',
  50.00,
  NULL,
  NULL,
  true
);

-- 3. Conferência.
SELECT
  id,
  idioma,
  tipo,
  nome,
  preco,
  parcelas,
  valor_parcela,
  ativo
FROM public.planos
WHERE tipo = 'avulso'
ORDER BY idioma;
