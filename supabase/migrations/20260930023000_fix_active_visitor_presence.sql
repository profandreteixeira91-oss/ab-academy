create or replace function public.touch_active_visitor(
  p_session_id text,
  p_path text,
  p_page_title text,
  p_referrer_domain text,
  p_device_type text,
  p_browser text,
  p_os text,
  p_language text,
  p_screen_width integer,
  p_last_seen_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_id is null
     or char_length(trim(p_session_id)) < 16
     or char_length(trim(p_session_id)) > 128 then
    raise exception 'invalid session_id';
  end if;

  if p_path is null
     or char_length(trim(p_path)) < 1
     or char_length(trim(p_path)) > 500 then
    raise exception 'invalid path';
  end if;

  insert into public.site_active_visitors (
    session_id, path, page_title, referrer_domain, device_type,
    browser, os, language, screen_width, last_seen_at
  )
  values (
    trim(p_session_id), p_path, p_page_title, p_referrer_domain, p_device_type,
    p_browser, p_os, p_language, p_screen_width, coalesce(p_last_seen_at, now())
  )
  on conflict (session_id) do update
  set
    path = excluded.path,
    page_title = excluded.page_title,
    referrer_domain = excluded.referrer_domain,
    device_type = excluded.device_type,
    browser = excluded.browser,
    os = excluded.os,
    language = excluded.language,
    screen_width = excluded.screen_width,
    last_seen_at = excluded.last_seen_at;
end;
$$;

revoke execute on function public.touch_active_visitor(text,text,text,text,text,text,text,text,integer,timestamptz) from public;
grant execute on function public.touch_active_visitor(text,text,text,text,text,text,text,text,integer,timestamptz) to anon, authenticated;
