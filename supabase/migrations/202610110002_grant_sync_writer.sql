grant select, insert, update, delete
  on public.source_snapshots to service_role;

grant select, insert, update, delete
  on public.sync_runs to service_role;

grant usage, select
  on sequence public.sync_runs_id_seq to service_role;

