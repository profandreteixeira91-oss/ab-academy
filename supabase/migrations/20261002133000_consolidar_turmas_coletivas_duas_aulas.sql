-- Consolidate the existing fixed collective schedules into real 2x/week
-- turmas. The commercial collective plans use aulas_semana = 2, so both
-- weekly encounters must belong to the same fixed turma.
--
-- This migration is intentionally limited to the four empty formation pairs
-- created before the fixed-turma model was consolidated.

do $$
declare
  pairs text[][] := array[
    array['66aa9537-fa8a-4994-9414-78ca6d423697','f2866bda-dfb0-4671-93e9-41fb88e5065b'],
    array['42bc203c-172d-4a32-bf3d-fe5ad9347580','c29eeed1-f3a8-42d6-bd5a-2e47e5697a0b'],
    array['8f692438-bfdd-439a-bc03-cf300b29a8f7','c18b4c46-8363-4ac7-99b3-ad131d13e0ba'],
    array['4a34651e-0b65-4d59-a0c5-14d25dda36e3','2baeb738-4552-4ece-95f8-bf18820ff56f']
  ];
  p text[];
  keep_id uuid;
  drop_id uuid;
begin
  foreach p slice 1 in array pairs loop
    keep_id := p[1]::uuid;
    drop_id := p[2]::uuid;

    if exists (
      select 1
      from public.turma_participantes
      where turma_id = drop_id
        and status in ('confirmado', 'convidado')
    ) then
      raise exception 'Turma % possui participantes ativos.', drop_id;
    end if;

    update public.turmas
    set aulas_semana = 2,
        quantidade_minima = case when modalidade = 'dupla' then 2 else 3 end,
        quantidade_maxima = case when modalidade = 'dupla' then 2 else 3 end,
        updated_at = now()
    where id = keep_id
      and fixa = true
      and status not in ('cancelada', 'encerrada');

    update public.turma_horarios
    set ordem = 2
    where turma_id = drop_id;

    update public.turma_horarios
    set turma_id = keep_id
    where turma_id = drop_id;

    delete from public.turmas
    where id = drop_id
      and not exists (
        select 1
        from public.turma_participantes tp
        where tp.turma_id = drop_id
      );
  end loop;
end $$;
