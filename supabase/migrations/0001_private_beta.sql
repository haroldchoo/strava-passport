create extension if not exists pgcrypto;

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  strava_athlete_id bigint not null unique,
  display_name text not null,
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strava_connections (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  expires_at timestamptz not null,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'rate_limited', 'completed', 'failed')),
  next_page integer not null default 1,
  processed integer not null default 0,
  imported integer not null default 0,
  updated integer not null default 0,
  failed integer not null default 0,
  error text,
  retry_after timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index sync_jobs_athlete_started_idx on public.sync_jobs (athlete_id, started_at desc);
create unique index sync_jobs_one_active_idx on public.sync_jobs (athlete_id)
  where status in ('pending', 'running', 'rate_limited');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  provider_activity_id bigint not null,
  name text not null,
  sport_type text not null,
  start_time timestamptz not null,
  distance_meters double precision not null default 0,
  moving_time_seconds integer not null default 0,
  elapsed_time_seconds integer not null default 0,
  elevation_gain_meters double precision not null default 0,
  manual boolean not null default false,
  commute boolean not null default false,
  trainer boolean not null default false,
  country_code char(2),
  geographic_resolution_status text not null check (geographic_resolution_status in ('resolved', 'unresolved')),
  last_seen_sync_id uuid not null,
  fetched_at timestamptz not null default now(),
  unique (athlete_id, provider_activity_id)
);

create index activities_athlete_start_idx on public.activities (athlete_id, start_time desc);
create index activities_athlete_country_idx on public.activities (athlete_id, country_code);

create table public.privacy_settings (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.athletes enable row level security;
alter table public.strava_connections enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.activities enable row level security;
alter table public.privacy_settings enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
