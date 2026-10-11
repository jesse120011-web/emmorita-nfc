-- Phase 3 backend foundation: branches, customers, reputation, branch-aware analytics
-- Date: 2026-10-04
-- Enums
create type public.customer_status as enum ('lead', 'active', 'inactive');
create type public.customer_source as enum ('profile', 'qr', 'nfc', 'manual', 'import', 'unknown');
-- Branches / locations
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  slug text check (slug is null or (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 64)),
  address text,
  city text,
  country_code char(2) not null default 'KE',
  timezone text not null default 'Africa/Nairobi',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index branches_business_id_idx on public.branches (business_id) where deleted_at is null;
create index branches_default_idx on public.branches (business_id, is_default) where deleted_at is null;
create unique index branches_slug_unique_idx on public.branches (business_id, slug) where slug is not null and deleted_at is null;
create unique index branches_default_unique_idx on public.branches (business_id) where is_default and deleted_at is null;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();
alter table public.branches enable row level security;
create policy branches_select
  on public.branches for select
  to authenticated
  using ((deleted_at is null and public.is_business_member(business_id)) or public.is_platform_admin());
create policy branches_insert
  on public.branches for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]) or public.is_platform_admin());
create policy branches_update
  on public.branches for update
  to authenticated
  using ((deleted_at is null and public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])) or public.is_platform_admin())
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]) or public.is_platform_admin());
-- Touchpoints -> optional branch mapping
alter table public.touchpoints add column if not exists branch_id uuid references public.branches (id) on delete set null;
create index if not exists touchpoints_branch_id_idx on public.touchpoints (branch_id);
create or replace function public.enforce_touchpoint_branch_integrity()
returns trigger
language plpgsql
as $$
declare
  _branch_business uuid;
begin
  if new.branch_id is null then
    return new;
  end if;
  select business_id into _branch_business from public.branches where id = new.branch_id and deleted_at is null;
  if _branch_business is null then
    raise exception using errcode = '23514', message = 'branch_id must reference an active branch';
  end if;
  if _branch_business <> new.business_id then
    raise exception using errcode = '23514', message = 'branch_id must belong to touchpoints.business_id';
  end if;
  return new;
end;
$$;
create trigger touchpoints_branch_integrity
before insert or update on public.touchpoints
for each row execute function public.enforce_touchpoint_branch_integrity();
-- Customers / CRM
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  touchpoint_id uuid references public.touchpoints (id) on delete set null,
  first_name text,
  last_name text,
  email text check (email is null or char_length(email) between 3 and 320),
  phone text check (phone is null or char_length(phone) between 3 and 32),
  source public.customer_source not null default 'unknown',
  status public.customer_status not null default 'lead',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index customers_business_id_idx on public.customers (business_id) where deleted_at is null;
create index customers_branch_id_idx on public.customers (branch_id) where deleted_at is null;
create index customers_touchpoint_id_idx on public.customers (touchpoint_id) where deleted_at is null;
create unique index customers_email_unique_idx on public.customers (business_id, email) where email is not null and deleted_at is null;
create unique index customers_phone_unique_idx on public.customers (business_id, phone) where phone is not null and deleted_at is null;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();
create or replace function public.enforce_customer_integrity()
returns trigger
language plpgsql
as $$
declare
  _branch_business uuid;
  _touch_business uuid;
  _touch_branch uuid;
begin
  if new.branch_id is not null then
    select business_id into _branch_business from public.branches where id = new.branch_id and deleted_at is null;
    if _branch_business is null then
      raise exception using errcode = '23514', message = 'branch_id must reference an active branch';
    end if;
    if _branch_business <> new.business_id then
      raise exception using errcode = '23514', message = 'branch_id must belong to customers.business_id';
    end if;
  end if;
  if new.touchpoint_id is not null then
    select business_id, branch_id into _touch_business, _touch_branch from public.touchpoints where id = new.touchpoint_id;
    if _touch_business is null or _touch_business <> new.business_id then
      raise exception using errcode = '23514', message = 'touchpoint_id must belong to customers.business_id';
    end if;
    if _touch_branch is not null then
      if new.branch_id is null then
        new.branch_id := _touch_branch;
      elsif new.branch_id <> _touch_branch then
        raise exception using errcode = '23514', message = 'branch_id must match touchpoint.branch_id';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger customers_integrity
before insert or update on public.customers
for each row execute function public.enforce_customer_integrity();
alter table public.customers enable row level security;
create policy customers_select
  on public.customers for select
  to authenticated
  using ((deleted_at is null and public.is_business_member(business_id)) or public.is_platform_admin());
create policy customers_insert
  on public.customers for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin', 'staff']::public.business_member_role[]) or public.is_platform_admin());
create policy customers_update
  on public.customers for update
  to authenticated
  using ((deleted_at is null and public.has_business_role(business_id, array['owner', 'admin', 'staff']::public.business_member_role[])) or public.is_platform_admin())
  with check (public.has_business_role(business_id, array['owner', 'admin', 'staff']::public.business_member_role[]) or public.is_platform_admin());
-- Customer timeline events
create table public.customer_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  touchpoint_id uuid references public.touchpoints (id) on delete set null,
  event_type text not null check (event_type in ('created', 'note', 'interaction', 'status_change')),
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index customer_events_business_idx on public.customer_events (business_id, customer_id, created_at desc);
create or replace function public.enforce_customer_event_integrity()
returns trigger
language plpgsql
as $$
declare
  _cust_business uuid;
  _touch_business uuid;
begin
  select business_id into _cust_business from public.customers where id = new.customer_id and deleted_at is null;
  if _cust_business is null or _cust_business <> new.business_id then
    raise exception using errcode = '23514', message = 'customer_id must belong to customer_events.business_id';
  end if;
  if new.touchpoint_id is not null then
    select business_id into _touch_business from public.touchpoints where id = new.touchpoint_id;
    if _touch_business is null or _touch_business <> new.business_id then
      raise exception using errcode = '23514', message = 'touchpoint_id must belong to customer_events.business_id';
    end if;
  end if;
  return new;
end;
$$;
create trigger customer_events_integrity
before insert or update on public.customer_events
for each row execute function public.enforce_customer_event_integrity();
alter table public.customer_events enable row level security;
create policy customer_events_select
  on public.customer_events for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());
create policy customer_events_insert
  on public.customer_events for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin', 'staff']::public.business_member_role[]) or public.is_platform_admin());
-- Reputation configuration
create table public.reputation_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  primary_platform text check (primary_platform is null or primary_platform in ('google', 'whatsapp', 'email', 'custom')),
  review_url text check (review_url is null or (review_url ~* '^https?://[^[:space:]]+$' and char_length(review_url) <= 2048)),
  feedback_instructions text check (feedback_instructions is null or char_length(feedback_instructions) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reputation_settings_set_updated_at
before update on public.reputation_settings
for each row execute function public.set_updated_at();
alter table public.reputation_settings enable row level security;
create policy reputation_settings_select
  on public.reputation_settings for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());
create policy reputation_settings_upsert
  on public.reputation_settings for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]) or public.is_platform_admin());
create policy reputation_settings_update
  on public.reputation_settings for update
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]) or public.is_platform_admin())
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]) or public.is_platform_admin());
-- Branch-aware analytics integrity
alter table public.analytics_events add column if not exists branch_id uuid references public.branches (id) on delete set null;
create index if not exists analytics_events_branch_idx on public.analytics_events (business_id, branch_id, occurred_at desc) where branch_id is not null;
create or replace function public.enforce_analytics_event_tenant_integrity()
returns trigger
language plpgsql
as $$
declare
  _ref_business_id uuid;
  _touchpoint_branch uuid;
begin
  if new.touchpoint_id is not null then
    select t.business_id, t.branch_id into _ref_business_id, _touchpoint_branch
    from public.touchpoints t
    where t.id = new.touchpoint_id;
    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using errcode = '23514', message = 'touchpoint_id must belong to analytics_events.business_id';
    end if;
    if _touchpoint_branch is not null then
      if new.branch_id is null then
        new.branch_id := _touchpoint_branch;
      elsif new.branch_id <> _touchpoint_branch then
        raise exception using errcode = '23514', message = 'branch_id must match touchpoint.branch_id';
      end if;
    end if;
  end if;
  if new.link_id is not null then
    select l.business_id into _ref_business_id
    from public.business_links l
    where l.id = new.link_id;
    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using errcode = '23514', message = 'link_id must belong to analytics_events.business_id';
    end if;
  end if;
  if new.qr_code_id is not null then
    select q.business_id into _ref_business_id
    from public.qr_codes q
    where q.id = new.qr_code_id;
    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using errcode = '23514', message = 'qr_code_id must belong to analytics_events.business_id';
    end if;
  end if;
  if new.nfc_tag_id is not null then
    select n.business_id into _ref_business_id
    from public.nfc_tags n
    where n.id = new.nfc_tag_id;
    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using errcode = '23514', message = 'nfc_tag_id must belong to analytics_events.business_id';
    end if;
  end if;
  if new.branch_id is not null then
    select b.business_id into _ref_business_id from public.branches b where b.id = new.branch_id and b.deleted_at is null;
    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using errcode = '23514', message = 'branch_id must belong to analytics_events.business_id';
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.set_analytics_branch_from_touchpoint()
returns trigger
language plpgsql
as $$
begin
  if new.branch_id is null and new.touchpoint_id is not null then
    select t.branch_id into new.branch_id from public.touchpoints t where t.id = new.touchpoint_id;
  end if;
  return new;
end;
$$;
create trigger analytics_events_set_branch
before insert on public.analytics_events
for each row execute function public.set_analytics_branch_from_touchpoint();
-- Grants for new tables
revoke all on table public.branches from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.customer_events from anon, authenticated;
revoke all on table public.reputation_settings from anon, authenticated;
grant select, insert, update on public.branches to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.customer_events to authenticated;
grant select, insert, update on public.reputation_settings to authenticated;
