-- Commercial pricing for AB Academy doubles and groups
-- Applied to project vwmrxdzskvwojyfddjwd on 2026-09-29.

create table if not exists public.modalidade_frequencia_precos (
  id uuid primary key default gen_random_uuid(),
  frequencia_id uuid not null references public.modalidade_frequencias(id) on delete cascade,
  quantidade_participantes integer not null,
  preco_mensal numeric(10,2) not null,
  preco_anual numeric(10,2),
  valor_parcela numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint modalidade_frequencia_precos_qtd_check check (quantidade_participantes between 3 and 50),
  constraint modalidade_frequencia_precos_unique unique (frequencia_id, quantidade_participantes)
);

alter table public.modalidade_frequencia_precos enable row level security;
grant select on public.modalidade_frequencia_precos to anon, authenticated;

drop policy if exists "Public can view active modality frequency prices" on public.modalidade_frequencia_precos;
create policy "Public can view active modality frequency prices"
on public.modalidade_frequencia_precos
for select to anon, authenticated
using (ativo = true);

update public.modalidade_frequencias
set preco_mensal = case
  when idioma='ingles' and modalidade='dupla' and aulas_semana=1 then 160
  when idioma='ingles' and modalidade='dupla' and aulas_semana=2 then 300
  when idioma='alemao' and modalidade='dupla' and aulas_semana=1 then 180
  when idioma='alemao' and modalidade='dupla' and aulas_semana=2 then 340
  else preco_mensal
end
where modalidade='dupla';

insert into public.modalidade_frequencia_precos (frequencia_id, quantidade_participantes, preco_mensal)
select mf.id, v.qtd, v.preco
from public.modalidade_frequencias mf
join (values
  ('ingles','grupo',2,3,180),('ingles','grupo',2,4,170),('ingles','grupo',2,5,160),('ingles','grupo',2,6,150),
  ('ingles','grupo',3,3,260),('ingles','grupo',3,4,245),('ingles','grupo',3,5,230),('ingles','grupo',3,6,215),
  ('alemao','grupo',2,3,200),('alemao','grupo',2,4,190),('alemao','grupo',2,5,180),('alemao','grupo',2,6,170),
  ('alemao','grupo',3,3,290),('alemao','grupo',3,4,275),('alemao','grupo',3,5,260),('alemao','grupo',3,6,245)
) as v(idioma, modalidade, aulas_semana, qtd, preco)
on mf.idioma=v.idioma and mf.modalidade=v.modalidade and mf.aulas_semana=v.aulas_semana
on conflict (frequencia_id, quantidade_participantes)
do update set preco_mensal=excluded.preco_mensal, ativo=true;
