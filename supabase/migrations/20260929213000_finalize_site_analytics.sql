-- Analytics final: visitas, sessões e atribuição de leads
alter table public.leads
  add column if not exists analytics_session_id text;

create index if not exists leads_analytics_session_id_idx
  on public.leads(analytics_session_id);

create or replace function public.admin_site_analytics_summary(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $function$
  select case
    when not private.usuario_e_admin() then jsonb_build_object('error', 'not_authorized')
    else jsonb_build_object(
      'visits', (select count(*) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end),
      'unique_visitors', (select count(distinct session_id) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end),
      'pages', (select count(distinct path) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end),
      'top_pages', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from (
        select path, count(*)::integer as visits from public.site_analytics_events
        where event_type='page_view' and created_at >= p_start and created_at < p_end
        group by path order by count(*) desc limit 8
      ) x), '[]'::jsonb),
      'sources', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from (
        select coalesce(nullif(lower(utm_source),''), nullif(lower(referrer_domain),''), 'Acesso direto') as source,
               count(*)::integer as visits
        from public.site_analytics_events
        where event_type='page_view' and created_at >= p_start and created_at < p_end
        group by coalesce(nullif(lower(utm_source),''), nullif(lower(referrer_domain),''), 'Acesso direto')
        order by count(*) desc limit 8
      ) x), '[]'::jsonb),
      'devices', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from (
        select coalesce(nullif(device_type,''),'Desconhecido') as device, count(*)::integer as visits
        from public.site_analytics_events
        where event_type='page_view' and created_at >= p_start and created_at < p_end
        group by coalesce(nullif(device_type,''),'Desconhecido') order by count(*) desc
      ) x), '[]'::jsonb),
      'campaigns', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from (
        select utm_campaign as campaign, count(*)::integer as visits
        from public.site_analytics_events
        where event_type='page_view' and created_at >= p_start and created_at < p_end and nullif(utm_campaign,'') is not null
        group by utm_campaign order by count(*) desc limit 8
      ) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(to_jsonb(x) order by x.day asc) from (
        select (created_at at time zone 'America/Sao_Paulo')::date::text as day,
               count(*)::integer as visits,
               count(distinct session_id)::integer as visitors
        from public.site_analytics_events
        where event_type='page_view' and created_at >= p_start and created_at < p_end
        group by (created_at at time zone 'America/Sao_Paulo')::date order by day asc
      ) x), '[]'::jsonb),
      'conversion', jsonb_build_object(
        'leads', (select count(*) from public.leads where created_at >= p_start and created_at < p_end),
        'attributed_leads', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and analytics_session_id is not null),
        'contacted', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='contatado'),
        'diagnostico', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='diagnostico'),
        'proposta_enviada', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='proposta_enviada'),
        'negociacao', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='negociacao'),
        'matriculado', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='matriculado'),
        'perdido', (select count(*) from public.leads where created_at >= p_start and created_at < p_end and status='perdido'),
        'lead_rate', case when (select count(distinct session_id) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end)=0 then 0 else round(((select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end)/(select count(distinct session_id)::numeric from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end))*100,2) end,
        'enrollment_rate', case when (select count(distinct session_id) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end)=0 then 0 else round(((select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end and status='matriculado')/(select count(distinct session_id)::numeric from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end))*100,2) end,
        'lead_to_enrollment', case when (select count(*) from public.leads where created_at >= p_start and created_at < p_end)=0 then 0 else round(((select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end and status='matriculado')/(select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end))*100,2) end,
        'attributed_lead_rate', case when (select count(distinct session_id) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end)=0 then 0 else round(((select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end and analytics_session_id is not null)/(select count(distinct session_id)::numeric from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end))*100,2) end,
        'attributed_enrollment_rate', case when (select count(distinct session_id) from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end)=0 then 0 else round(((select count(*)::numeric from public.leads where created_at >= p_start and created_at < p_end and analytics_session_id is not null and status='matriculado')/(select count(distinct session_id)::numeric from public.site_analytics_events where event_type='page_view' and created_at >= p_start and created_at < p_end))*100,2) end,
        'funnel', coalesce((select jsonb_agg(to_jsonb(x) order by x.position) from (
          select 1 as position,'Leads' as stage,count(*)::integer as total from public.leads where created_at >= p_start and created_at < p_end
          union all select 2,'Contatados',count(*)::integer from public.leads where created_at >= p_start and created_at < p_end and status in ('contatado','diagnostico','proposta_enviada','negociacao','matriculado')
          union all select 3,'Diagnóstico',count(*)::integer from public.leads where created_at >= p_start and created_at < p_end and status in ('diagnostico','proposta_enviada','negociacao','matriculado')
          union all select 4,'Proposta',count(*)::integer from public.leads where created_at >= p_start and created_at < p_end and status in ('proposta_enviada','negociacao','matriculado')
          union all select 5,'Negociação',count(*)::integer from public.leads where created_at >= p_start and created_at < p_end and status in ('negociacao','matriculado')
          union all select 6,'Matriculados',count(*)::integer from public.leads where created_at >= p_start and created_at < p_end and status='matriculado'
        ) x), '[]'::jsonb),
        'sources', coalesce((select jsonb_agg(to_jsonb(x) order by x.leads desc) from (
          select coalesce(nullif(source,''),nullif(origem,''),'site') as source,count(*)::integer as leads,count(*) filter(where status='matriculado')::integer as enrolled
          from public.leads where created_at >= p_start and created_at < p_end
          group by coalesce(nullif(source,''),nullif(origem,''),'site') order by count(*) desc limit 8
        ) x), '[]'::jsonb)
      )
    )
  end;
$function$;

grant execute on function public.admin_site_analytics_summary(timestamptz,timestamptz) to authenticated;
