alter table public.materiais
  add column if not exists conteudo_modelo jsonb,
  add column if not exists operacoes_editor jsonb not null default '[]'::jsonb,
  add column if not exists cursor_estado jsonb,
  add column if not exists versao_editor bigint not null default 0;

create index if not exists materiais_versao_editor_idx
  on public.materiais (id, versao_editor);
