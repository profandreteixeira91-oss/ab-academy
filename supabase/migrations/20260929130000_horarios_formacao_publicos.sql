alter table public.leads add column if not exists horario_id uuid references public.horarios(id);
alter table public.turmas add column if not exists horario_id uuid references public.horarios(id);
create index if not exists leads_horario_id_idx on public.leads(horario_id);
create index if not exists turmas_horario_id_idx on public.turmas(horario_id);

create or replace view public.horarios_formacao_publicos
as
select h.id as horario_id,h.idioma,h.dia_semana,h.hora_inicio,h.hora_fim,h.tipo_horario,h.disponivel,
       coalesce(t.id,null) as turma_id,coalesce(t.status,'em_formacao') as turma_status,
       coalesce(t.quantidade_minima,case when h.tipo_horario='dupla' then 2 else 3 end) as quantidade_minima,
       coalesce(t.quantidade_maxima,case when h.tipo_horario='dupla' then 2 else 6 end) as quantidade_maxima,
       coalesce((select count(*) from public.turma_participantes tp where tp.turma_id=t.id and tp.status in ('convidado','confirmado')),0)::integer as interessados
from public.horarios h
left join lateral (select t.* from public.turmas t where t.horario_id=h.id and t.status in ('em_formacao','aguardando_confirmacoes') order by t.created_at desc limit 1) t on true
where h.disponivel=true and h.tipo_horario in ('dupla','grupo') and h.aluno_id is null;

revoke all on public.horarios_formacao_publicos from anon, authenticated;
grant select on public.horarios_formacao_publicos to anon, authenticated;