-- Give each report an explicit submission timestamp. Backfill from a common
-- existing timestamp column when available; old rows remain null otherwise.
alter table public.issue_report
  add column if not exists submitted_at timestamptz;

do $$
declare
  source_column text;
begin
  foreach source_column in array array['created_at', 'submitted_on', 'date_submitted', 'timestamp']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'issue_report'
        and column_name = source_column
        and data_type in ('timestamp without time zone', 'timestamp with time zone', 'date')
    ) then
      execute format(
        'update public.issue_report set submitted_at = %I::timestamptz where submitted_at is null and %I is not null',
        source_column,
        source_column
      );
      exit;
    end if;
  end loop;
end;
$$;

alter table public.issue_report
  alter column submitted_at set default now();
