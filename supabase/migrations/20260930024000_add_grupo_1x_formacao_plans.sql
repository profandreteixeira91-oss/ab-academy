insert into public.planos (idioma,tipo,nome,descricao,preco,parcelas,valor_parcela,ativo,aulas_semana,modalidade,min_alunos,max_alunos)
values
('ingles','mensal','Grupo • 1 aula por semana','Condição de formação: valor individual com 15% de desconto até a formação do grupo.',337.45,null,null,true,1,'grupo',3,6),
('alemao','mensal','Grupo • 1 aula por semana','Condição de formação: valor individual com 15% de desconto até a formação do grupo.',362.95,null,null,true,1,'grupo',3,6)
on conflict do nothing;