create table if not exists public.page_session_activity (
  visitor_id uuid not null,
  session_id uuid not null,
  page_key text not null check (page_key in ('chatbot', 'faq', 'calendar')),
  started_at timestamptz not null default now(),
  engaged_seconds integer not null default 0 check (engaged_seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (session_id, page_key)
);

create index if not exists page_session_activity_started_at_idx
  on public.page_session_activity (started_at desc);

alter table public.page_session_activity enable row level security;
revoke all on public.page_session_activity from public, anon, authenticated;
grant select, insert, update on public.page_session_activity to service_role;

create or replace view public.page_engagement_weekly_summary
with (security_invoker = true)
as
select
  date_trunc('week', started_at at time zone 'America/Denver')::date as week_start,
  page_key,
  count(*)::bigint as total_visits,
  count(distinct visitor_id)::bigint as unique_visitors,
  round((percentile_cont(0.5) within group (order by engaged_seconds))::numeric, 1) as median_engaged_seconds,
  round(avg(engaged_seconds)::numeric, 1) as average_engaged_seconds
from public.page_session_activity
where started_at >= now() - interval '12 weeks'
group by 1, 2;

revoke all on public.page_engagement_weekly_summary from public, anon, authenticated;
grant select on public.page_engagement_weekly_summary to service_role;
