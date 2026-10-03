alter table public.materiais
  add column if not exists pdf_publicado_path text,
  add column if not exists pdf_publicado_em timestamptz;

create index if not exists materiais_pdf_publicado_path_idx
  on public.materiais (pdf_publicado_path)
  where pdf_publicado_path is not null;
