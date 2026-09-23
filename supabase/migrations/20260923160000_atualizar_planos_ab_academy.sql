-- Atualização comercial dos planos AB Academy
-- Valores exibidos na Home e na matrícula passam a ser controlados pela tabela planos.

alter table public.planos
  drop constraint if exists planos_tipo_check;

alter table public.planos
  add constraint planos_tipo_check
  check (tipo in ('mensal', 'anual', 'personalizado', 'intensivo'));

update public.planos
set
  nome = 'Plano Mensal',
  descricao = 'Aulas individuais de 60 minutos, 1 vez por semana, com acompanhamento personalizado para desenvolver seu inglês de forma consistente.',
  preco = 360,
  parcelas = null,
  valor_parcela = null,
  updated_at = now()
where idioma = 'ingles'
  and tipo = 'mensal';

update public.planos
set
  nome = 'Plano Anual',
  descricao = 'Para quem busca constância e evolução ao longo do ano. Aulas individuais de 60 minutos, 1 vez por semana, com acompanhamento contínuo.',
  preco = 3960,
  parcelas = 12,
  valor_parcela = 330,
  updated_at = now()
where idioma = 'ingles'
  and tipo = 'anual';

update public.planos
set
  nome = 'Plano Mensal',
  descricao = 'Aulas individuais de 60 minutos, 1 vez por semana, com acompanhamento personalizado para construir uma base sólida e evoluir no alemão.',
  preco = 400,
  parcelas = null,
  valor_parcela = null,
  updated_at = now()
where idioma = 'alemao'
  and tipo = 'mensal';

update public.planos
set
  nome = 'Plano Anual',
  descricao = 'Para quem quer manter uma rotina de estudos e desenvolver o alemão com acompanhamento contínuo durante todo o ano.',
  preco = 4380,
  parcelas = 12,
  valor_parcela = 365,
  updated_at = now()
where idioma = 'alemao'
  and tipo = 'anual';

insert into public.planos (idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo)
select 'ingles', 'personalizado', 'Plano Personalizado — 2x por semana',
  'Mais frequência para quem deseja acelerar o aprendizado, desenvolver a conversação e alcançar seus objetivos em menos tempo.',
  680, null, null, true
where not exists (
  select 1 from public.planos where idioma = 'ingles' and tipo = 'personalizado'
);

insert into public.planos (idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo)
select 'ingles', 'intensivo', 'Plano Intensivo — 3x por semana',
  'Uma rotina intensiva para quem precisa de maior contato com o idioma e quer avançar com mais velocidade e consistência.',
  990, null, null, true
where not exists (
  select 1 from public.planos where idioma = 'ingles' and tipo = 'intensivo'
);

insert into public.planos (idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo)
select 'alemao', 'personalizado', 'Plano Personalizado — 2x por semana',
  'Mais contato com o idioma para acelerar a evolução, ampliar o vocabulário e desenvolver a comunicação com mais confiança.',
  760, null, null, true
where not exists (
  select 1 from public.planos where idioma = 'alemao' and tipo = 'personalizado'
);

insert into public.planos (idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo)
select 'alemao', 'intensivo', 'Plano Intensivo — 3x por semana',
  'Uma frequência intensiva para quem possui objetivos específicos e precisa de uma evolução mais rápida e estruturada no alemão.',
  1110, null, null, true
where not exists (
  select 1 from public.planos where idioma = 'alemao' and tipo = 'intensivo'
);
