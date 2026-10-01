-- Harden analytics ingestion: remove anon inserts; edge function uses service role
-- Date: 2026-09-27

begin;

-- Remove public/anon insert access; edge function will use service role.
drop policy if exists analytics_events_insert_public on public.analytics_events;

-- Simple per-IP per-business windowed counter for rate limiting.
create table if not exists public.analytics_ingest_rate_limits (
  ip_hash text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 1,
  constraint analytics_ingest_rate_limits_pkey primary key (ip_hash, business_id, window_start)
);

create index if not exists analytics_ingest_rate_limits_window_idx
  on public.analytics_ingest_rate_limits (window_start);

-- Increment rate counter and return current count; enforce max inside function to avoid race.
create or replace function public.increment_analytics_rate_limit(
  _ip_hash text,
  _business_id uuid,
  _window_seconds int,
  _max_events int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  _window_start timestamptz;
  _current int;
begin
  if _window_seconds < 1 then
    raise exception 'window_seconds must be positive';
  end if;
  if _max_events < 1 then
    raise exception 'max_events must be positive';
  end if;

  _window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  insert into public.analytics_ingest_rate_limits (ip_hash, business_id, window_start, count)
  values (_ip_hash, _business_id, _window_start, 1)
  on conflict (ip_hash, business_id, window_start)
  do update set count = public.analytics_ingest_rate_limits.count + 1
  returning count into _current;

  if _current > _max_events then
    raise exception 'rate limit exceeded';
  end if;

  return _current;
end;
$$;

-- Restrict table visibility to service role; service_role bypasses RLS for writes.
revoke all on table public.analytics_ingest_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.analytics_ingest_rate_limits to service_role;

commit;
