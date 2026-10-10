create table if not exists public.source_snapshots (
  source text primary key,
  schema_version integer not null default 1,
  fetched_at timestamptz not null,
  payload jsonb not null,
  record_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint source_snapshots_source_format check (source ~ '^[A-Z0-9_]+$'),
  constraint source_snapshots_record_count_nonnegative check (record_count >= 0)
);

comment on table public.source_snapshots is
  'Latest durable snapshot for each baseball record provider and derived view.';

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  games_added integer not null default 0 check (games_added >= 0),
  details jsonb not null default '{}'::jsonb,
  error_message text,
  constraint sync_runs_source_format check (source ~ '^[A-Z0-9_]+$')
);

create index if not exists sync_runs_source_started_at_idx
  on public.sync_runs (source, started_at desc);

alter table public.source_snapshots enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "Public can read record snapshots" on public.source_snapshots;
create policy "Public can read record snapshots"
  on public.source_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read sync history" on public.sync_runs;
create policy "Public can read sync history"
  on public.sync_runs
  for select
  to anon, authenticated
  using (true);

grant select on public.source_snapshots to anon, authenticated;
grant select on public.sync_runs to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.source_snapshots from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.sync_runs from anon, authenticated;

