-- Preserve financial history when a matrícula is deleted.
-- Payments remain recorded, while the optional matrícula reference is cleared.
alter table public.pagamentos
  drop constraint if exists pagamentos_matricula_id_fkey;

alter table public.pagamentos
  add constraint pagamentos_matricula_id_fkey
  foreign key (matricula_id)
  references public.matriculas(id)
  on delete set null
  on update no action;
