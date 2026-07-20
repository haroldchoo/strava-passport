create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text,
  code_hash text not null unique,
  status text not null default 'unused' check (status in ('unused', 'accepted', 'revoked')),
  expires_at timestamptz,
  accepted_athlete_id bigint references public.athletes(strava_athlete_id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_rate_limits (
  provider text primary key,
  retry_after timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sync_jobs
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists last_page_processed_at timestamptz;

create index if not exists sync_jobs_claim_idx on public.sync_jobs (status, retry_after, started_at)
  where status in ('pending', 'running', 'rate_limited');
create index if not exists activities_athlete_start_provider_idx on public.activities (athlete_id, start_time desc, provider_activity_id desc);

create table public.passport_country_summaries (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  country_code char(2) not null,
  first_visited_at timestamptz not null,
  last_visited_at timestamptz not null,
  activity_count integer not null,
  total_distance_meters double precision not null default 0,
  total_moving_time_seconds integer not null default 0,
  total_elevation_gain_meters double precision not null default 0,
  sport_types text[] not null default '{}',
  stamp_variant text not null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, country_code)
);

create table public.athlete_activity_totals (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  activity_count integer not null default 0,
  unresolved_activity_count integer not null default 0,
  total_distance_meters double precision not null default 0,
  total_moving_time_seconds integer not null default 0,
  total_elevation_gain_meters double precision not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.provider_rate_limits enable row level security;
alter table public.passport_country_summaries enable row level security;
alter table public.athlete_activity_totals enable row level security;

revoke all on public.invites from anon, authenticated;
revoke all on public.provider_rate_limits from anon, authenticated;
revoke all on public.passport_country_summaries from anon, authenticated;
revoke all on public.athlete_activity_totals from anon, authenticated;

grant select, insert, update, delete on public.invites to service_role;
grant select, insert, update, delete on public.provider_rate_limits to service_role;
grant select, insert, update, delete on public.passport_country_summaries to service_role;
grant select, insert, update, delete on public.athlete_activity_totals to service_role;

create or replace function public.claim_sync_jobs(
  p_worker_id text,
  p_limit integer,
  p_stale_before timestamptz
)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.sync_jobs
    where status in ('pending', 'running', 'rate_limited')
      and (status <> 'rate_limited' or retry_after is null or retry_after <= now())
      and (locked_at is null or locked_at <= p_stale_before)
    order by started_at asc
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.sync_jobs jobs
  set
    status = 'running',
    locked_at = now(),
    locked_by = p_worker_id,
    attempts = jobs.attempts + 1,
    last_heartbeat_at = now(),
    error = null
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

grant execute on function public.claim_sync_jobs(text, integer, timestamptz) to service_role;
