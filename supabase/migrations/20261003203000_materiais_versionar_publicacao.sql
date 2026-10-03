-- Separa o documento que o professor está editando do último documento efetivamente publicado.
-- O aluno sempre lê o snapshot publicado; o professor continua editando o estado atual.
alter table public.materiais
  add column if not exists conteudo_publicado_html text,
  add column if not exists imagens_publicadas jsonb,
  add column if not exists videos_publicados jsonb,
  add column if not exists titulo_publicado text,
  add column if not exists idioma_publicado text;

update public.materiais
set
  conteudo_publicado_html = case when status = 'publicado' then coalesce(conteudo_publicado_html, conteudo_html) else conteudo_publicado_html end,
  imagens_publicadas = case when status = 'publicado' then coalesce(imagens_publicadas, imagens) else imagens_publicadas end,
  videos_publicados = case when status = 'publicado' then coalesce(videos_publicados, videos) else videos_publicados end,
  titulo_publicado = case when status = 'publicado' then coalesce(titulo_publicado, titulo) else titulo_publicado end,
  idioma_publicado = case when status = 'publicado' then coalesce(idioma_publicado, idioma) else idioma_publicado end
where status = 'publicado';
