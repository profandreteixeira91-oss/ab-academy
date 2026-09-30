update public.turmas set fixa=false where created_at < now() and modalidade in ('dupla','grupo');
