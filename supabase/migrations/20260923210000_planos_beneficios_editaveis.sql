-- =========================================================
-- PLANOS - DESCRIÇÃO E BENEFÍCIOS EDITÁVEIS
-- =========================================================

alter table public.planos
  add column if not exists beneficios text[] not null default array[]::text[];

update public.planos
set beneficios = array[
  'Conteúdo 100% personalizado para o seu nível, objetivos e necessidades',
  'Material e atividades de apoio personalizados para acelerar sua evolução',
  'Acesso ao app do aluno para acompanhar sua jornada de estudos',
  'Acesso à Central de Atividades com conteúdos e exercícios',
  'Plantão de dúvidas para receber suporte durante seus estudos'
]
where coalesce(array_length(beneficios, 1), 0) = 0;
