alter table public.materiais
  add column if not exists pdf_publicado_path text;

comment on column public.materiais.pdf_publicado_path is
  'Caminho permanente no Storage do PDF que representa a publicação entregue ao aluno.';
