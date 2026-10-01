-- Harden review ingestion: remove public inserts; edge function uses service role.
-- Date: 2026-10-01

begin;

drop policy if exists reviews_insert_public on public.reviews;

revoke insert on table public.reviews from public, anon, authenticated;
grant insert on table public.reviews to service_role;

-- Freeze tenant ownership after insert. Owner/admin may still update status and
-- content for their own rows; they must not reassign a review to another business.
create or replace function public.reviews_prevent_business_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '23514',
      message = 'reviews.business_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_prevent_business_id_change on public.reviews;
create trigger reviews_prevent_business_id_change
before update on public.reviews
for each row execute function public.reviews_prevent_business_id_change();

revoke all on function public.reviews_prevent_business_id_change() from public, anon, authenticated;

-- Per-IP per-business windowed counter; separate from analytics quotas.
create table if not exists public.review_ingest_rate_limits (
  ip_hash text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 1,
  constraint review_ingest_rate_limits_pkey primary key (ip_hash, business_id, window_start)
);

create index if not exists review_ingest_rate_limits_window_idx
  on public.review_ingest_rate_limits (window_start);

create or replace function public.increment_review_rate_limit(
  _ip_hash text,
  _business_id uuid,
  _window_seconds int,
  _max_reviews int
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
  if _max_reviews < 1 then
    raise exception 'max_reviews must be positive';
  end if;

  _window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  insert into public.review_ingest_rate_limits (ip_hash, business_id, window_start, count)
  values (_ip_hash, _business_id, _window_start, 1)
  on conflict (ip_hash, business_id, window_start)
  do update set count = public.review_ingest_rate_limits.count + 1
  returning count into _current;

  if _current > _max_reviews then
    raise exception 'rate limit exceeded';
  end if;

  return _current;
end;
$$;

revoke all on table public.review_ingest_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.review_ingest_rate_limits to service_role;

revoke all on function public.increment_review_rate_limit(text, uuid, int, int) from public, anon, authenticated;
grant execute on function public.increment_review_rate_limit(text, uuid, int, int) to service_role;

commit;
