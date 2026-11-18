create or replace view public.chatbot_monthly_repeat_usage_summary
with (security_invoker = true)
as
with clock as (
  select
    now() as now_at,
    date_trunc('month', now() at time zone 'UTC') as current_month_start_utc
),
calendar_periods as (
  select
    to_char(months.month_start, 'FMMonth YYYY') as period_label,
    months.month_start::date as period_start,
    (months.month_start + interval '1 month' - interval '1 day')::date as period_end,
    months.month_start at time zone 'UTC' as starts_at,
    (months.month_start + interval '1 month') at time zone 'UTC' as ends_at,
    row_number() over (order by months.month_start)::integer as sort_order
  from clock
  cross join lateral generate_series(
    clock.current_month_start_utc - interval '13 months',
    clock.current_month_start_utc - interval '1 month',
    interval '1 month'
  ) as months(month_start)
),
extra_periods as (
  select
    'Month to date'::text as period_label,
    clock.current_month_start_utc::date as period_start,
    (clock.now_at at time zone 'UTC')::date as period_end,
    clock.current_month_start_utc at time zone 'UTC' as starts_at,
    clock.now_at as ends_at,
    14::integer as sort_order
  from clock

  union all

  select
    'Last 30 days'::text as period_label,
    ((clock.now_at - interval '30 days') at time zone 'UTC')::date as period_start,
    (clock.now_at at time zone 'UTC')::date as period_end,
    clock.now_at - interval '30 days' as starts_at,
    clock.now_at as ends_at,
    15::integer as sort_order
  from clock
),
periods as (
  select * from calendar_periods
  union all
  select * from extra_periods
),
user_conversation_use as (
  select
    periods.sort_order,
    conversations.user_id,
    count(distinct conversations.conversation_id)::integer as distinct_conversations
  from periods
  join public.chat_messages as messages
    on messages.created_at >= periods.starts_at
    and messages.created_at < periods.ends_at
    and messages.sender = 'user'
  join public.chat_conversations as conversations
    on conversations.conversation_id = messages.conversation_id
  where conversations.user_id is not null
  group by periods.sort_order, conversations.user_id
),
period_totals as (
  select
    periods.period_label,
    periods.period_start,
    periods.period_end,
    count(user_conversation_use.user_id)::bigint as active_users,
    (count(user_conversation_use.user_id) filter (
      where user_conversation_use.distinct_conversations >= 2
    ))::bigint as repeat_users,
    periods.sort_order
  from periods
  left join user_conversation_use
    on user_conversation_use.sort_order = periods.sort_order
  group by
    periods.period_label,
    periods.period_start,
    periods.period_end,
    periods.sort_order
)
select
  period_label,
  period_start,
  period_end,
  active_users,
  repeat_users,
  case
    when active_users = 0 then 0::numeric
    else round(repeat_users::numeric * 100 / active_users, 1)
  end as repeat_user_percent,
  50::numeric as goal_percent,
  sort_order
from period_totals;

revoke all on public.chatbot_monthly_repeat_usage_summary from public, anon, authenticated;
grant select on public.chatbot_monthly_repeat_usage_summary to service_role;
