alter table public.materiais
  add column if not exists pdf_publicado_em timestamptz;

comment on column public.materiais.pdf_publicado_em is
  'Data/hora da geração do PDF que representa a publicação entregue ao aluno.';
