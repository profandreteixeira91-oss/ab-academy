create or replace function private.professor_eh_dono_material(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.materiais m
    join public.professores p on p.id = m.professor_id
    where m.id = p_material_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function private.professor_eh_dono_material(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.professor_eh_dono_material(uuid) to authenticated;

drop policy if exists "professores gerenciam destinatarios" on public.material_alunos;

create policy "professores gerenciam destinatarios"
  on public.material_alunos
  for all
  to authenticated
  using (private.professor_eh_dono_material(material_id))
  with check (private.professor_eh_dono_material(material_id));
