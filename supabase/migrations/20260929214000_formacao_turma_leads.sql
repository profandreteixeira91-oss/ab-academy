alter table public.leads add column if not exists formacao_turma text;
alter table public.leads drop constraint if exists leads_formacao_turma_check;
alter table public.leads add constraint leads_formacao_turma_check check (
  formacao_turma is null
  or formacao_turma in ('ja_tenho_participantes','preciso_formar_turma','iniciar_individual')
);