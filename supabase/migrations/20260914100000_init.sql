-- EmmOrita NFC foundation schema
-- Tenant isolation is enforced with Row Level Security. Anon clients never
-- receive service-role privileges.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations (narrow, stable). Event types stay table-driven so new
-- analytics events do not require a schema redesign.
-- ---------------------------------------------------------------------------

create type public.business_status as enum ('draft', 'active', 'suspended');
create type public.business_member_role as enum ('owner', 'admin', 'staff');
create type public.nfc_tag_status as enum (
  'inventory',
  'assigned',
  'active',
  'inactive',
  'replaced'
);
create type public.qr_code_status as enum ('active', 'inactive');

-- ---------------------------------------------------------------------------
-- Utility triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- User profiles (1:1 with auth.users). Not a tenant table.
-- ---------------------------------------------------------------------------

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Platform operators (EmmOrita staff). Separate from tenant roles.
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Businesses (tenants)
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 64),
  status public.business_status not null default 'draft',
  country_code char(2) not null default 'KE',
  timezone text not null default 'Africa/Nairobi',
  plan_key text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index businesses_slug_live_idx
  on public.businesses (slug)
  where deleted_at is null;

create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_status_idx on public.businesses (status)
  where deleted_at is null;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.business_member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (business_id, user_id)
);

create index business_members_user_id_idx
  on public.business_members (user_id)
  where deleted_at is null;

create trigger business_members_set_updated_at
before update on public.business_members
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public-facing profile (1:1). Identity lives here; CTAs live in links.
-- ---------------------------------------------------------------------------

create table public.business_profiles (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  logo_url text,
  tagline text check (tagline is null or char_length(tagline) <= 160),
  description text check (description is null or char_length(description) <= 2000),
  location_label text check (location_label is null or char_length(location_label) <= 160),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Configurable CTAs / social / contact links
-- ---------------------------------------------------------------------------

create table public.business_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (
    kind in (
      'phone',
      'whatsapp',
      'website',
      'maps',
      'booking',
      'instagram',
      'facebook',
      'tiktok',
      'email',
      'custom'
    )
  ),
  label text not null check (char_length(label) between 1 and 80),
  href text not null check (char_length(href) between 1 and 2048),
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index business_links_business_id_idx
  on public.business_links (business_id, sort_order)
  where deleted_at is null;

create trigger business_links_set_updated_at
before update on public.business_links
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- NFC inventory. Tags encode a URL; they do not require a custom app.
-- Future /n/{public_token} redirects can be added without changing tags.
-- ---------------------------------------------------------------------------

create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid(),
  hardware_uid text,
  business_id uuid references public.businesses (id) on delete set null,
  status public.nfc_tag_status not null default 'inventory',
  label text,
  assigned_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  replaced_by uuid references public.nfc_tags (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_token)
);

create unique index nfc_tags_hardware_uid_idx
  on public.nfc_tags (hardware_uid)
  where hardware_uid is not null;

create index nfc_tags_business_id_idx
  on public.nfc_tags (business_id)
  where business_id is not null;

create trigger nfc_tags_set_updated_at
before update on public.nfc_tags
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- QR inventory. Codes resolve to the same /t/{slug} profile as NFC.
-- ---------------------------------------------------------------------------

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  label text,
  status public.qr_code_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index qr_codes_business_id_idx
  on public.qr_codes (business_id)
  where deleted_at is null;

create trigger qr_codes_set_updated_at
before update on public.qr_codes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Analytics: append-only from the client. Types are rows, not enums.
-- ---------------------------------------------------------------------------

create table public.analytics_event_types (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.analytics_event_types (key, description) values
  ('profile_view', 'Public profile was rendered'),
  ('nfc_scan', 'Profile opened from an NFC tap (src=nfc)'),
  ('qr_scan', 'Profile opened from a QR scan (src=qr)'),
  ('website_click', 'Website CTA clicked'),
  ('whatsapp_click', 'WhatsApp CTA clicked'),
  ('phone_click', 'Phone CTA clicked'),
  ('map_click', 'Maps CTA clicked'),
  ('booking_click', 'Booking CTA clicked'),
  ('social_click', 'Social or custom CTA clicked'),
  ('email_click', 'Email CTA clicked');

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  event_type text not null references public.analytics_event_types (key),
  link_id uuid references public.business_links (id) on delete set null,
  nfc_tag_id uuid references public.nfc_tags (id) on delete set null,
  qr_code_id uuid references public.qr_codes (id) on delete set null,
  source text check (source is null or source in ('nfc', 'qr', 'web', 'unknown')),
  device_class text check (device_class is null or device_class in ('mobile', 'tablet', 'desktop', 'unknown')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 240),
  referrer text check (referrer is null or char_length(referrer) <= 240),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index analytics_events_business_occurred_idx
  on public.analytics_events (business_id, occurred_at desc);

create index analytics_events_type_idx
  on public.analytics_events (business_id, event_type);

-- ---------------------------------------------------------------------------
-- Tenant bootstrap: owner membership + empty profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.business_profiles (business_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_business_created
after insert on public.businesses
for each row execute function public.handle_new_business();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, locked search_path)
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.revoked_at is null
  );
$$;

create or replace function public.is_business_member(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = _business_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
  );
$$;

create or replace function public.has_business_role(_business_id uuid, _roles public.business_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = _business_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
      and m.role = any (_roles)
  );
$$;

create or replace function public.business_is_public(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    join public.business_profiles p on p.business_id = b.id
    where b.id = _business_id
      and b.deleted_at is null
      and b.status = 'active'
      and p.is_published = true
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.has_business_role(uuid, public.business_member_role[]) from public;
revoke all on function public.business_is_public(uuid) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, public.business_member_role[]) to authenticated;
grant execute on function public.business_is_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public-safe views. Owned by the migration role so underlying table RLS
-- does not leak owner_id and other internal columns to anon.
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = false, security_barrier = true) as
select
  b.id,
  b.slug,
  b.name,
  b.country_code,
  p.logo_url,
  p.tagline,
  p.description,
  p.location_label
from public.businesses b
join public.business_profiles p on p.business_id = b.id
where b.deleted_at is null
  and b.status = 'active'
  and p.is_published = true;

create or replace view public.public_links
with (security_invoker = false, security_barrier = true) as
select
  l.id,
  l.business_id,
  l.kind,
  l.label,
  l.href,
  l.sort_order
from public.business_links l
join public.businesses b on b.id = l.business_id
join public.business_profiles p on p.business_id = b.id
where l.deleted_at is null
  and l.is_enabled = true
  and b.deleted_at is null
  and b.status = 'active'
  and p.is_published = true;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_profiles enable row level security;
alter table public.business_links enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.qr_codes enable row level security;
alter table public.analytics_event_types enable row level security;
alter table public.analytics_events enable row level security;

alter table public.user_profiles force row level security;
alter table public.platform_admins force row level security;
alter table public.businesses force row level security;
alter table public.business_members force row level security;
alter table public.business_profiles force row level security;
alter table public.business_links force row level security;
alter table public.nfc_tags force row level security;
alter table public.qr_codes force row level security;
alter table public.analytics_event_types force row level security;
alter table public.analytics_events force row level security;

-- user_profiles
create policy user_profiles_select_self
  on public.user_profiles for select
  to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy user_profiles_update_self
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- platform_admins: readable only by existing admins (bootstrap via service role)
create policy platform_admins_select
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

-- businesses
create policy businesses_select_member
  on public.businesses for select
  to authenticated
  using (public.is_business_member(id) or public.is_platform_admin());

create policy businesses_insert_owner
  on public.businesses for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy businesses_update_admin
  on public.businesses for update
  to authenticated
  using (
    public.has_business_role(id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

-- business_members
create policy business_members_select
  on public.business_members for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy business_members_insert_admin
  on public.business_members for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy business_members_update_admin
  on public.business_members for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

-- Allow the owner-bootstrap trigger to insert the first member even though
-- the inserting user is not yet a member. The trigger runs as definer.

-- business_profiles
create policy business_profiles_select
  on public.business_profiles for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy business_profiles_update
  on public.business_profiles for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

-- business_links
create policy business_links_select
  on public.business_links for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy business_links_insert
  on public.business_links for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy business_links_update
  on public.business_links for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

-- nfc_tags: members see only tags assigned to their business.
-- Unassigned inventory is platform-admin only.
create policy nfc_tags_select_member
  on public.nfc_tags for select
  to authenticated
  using (
    (business_id is not null and public.is_business_member(business_id))
    or public.is_platform_admin()
  );

create policy nfc_tags_update_admin
  on public.nfc_tags for update
  to authenticated
  using (
    (business_id is not null and public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]))
    or public.is_platform_admin()
  )
  with check (
    (business_id is not null and public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[]))
    or public.is_platform_admin()
  );

create policy nfc_tags_insert_platform
  on public.nfc_tags for insert
  to authenticated
  with check (public.is_platform_admin());

-- qr_codes
create policy qr_codes_select
  on public.qr_codes for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy qr_codes_insert
  on public.qr_codes for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy qr_codes_update
  on public.qr_codes for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

-- analytics_event_types: readable so clients can validate keys if needed
create policy analytics_event_types_select
  on public.analytics_event_types for select
  to anon, authenticated
  using (true);

-- analytics_events: public insert for published businesses only; no client reads
create policy analytics_events_insert_public
  on public.analytics_events for insert
  to anon, authenticated
  with check (
    public.business_is_public(business_id)
    and (metadata is not null)
  );

create policy analytics_events_select_member
  on public.analytics_events for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

-- No update/delete policies: events are immutable from the client.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Supabase default privileges can grant ALL on new public tables to anon.
-- Revoke first so public access is only the views + analytics insert.

revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.businesses from anon, authenticated;
revoke all on table public.business_members from anon, authenticated;
revoke all on table public.business_profiles from anon, authenticated;
revoke all on table public.business_links from anon, authenticated;
revoke all on table public.nfc_tags from anon, authenticated;
revoke all on table public.qr_codes from anon, authenticated;
revoke all on table public.analytics_event_types from anon, authenticated;
revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.public_profiles from anon, authenticated;
revoke all on table public.public_links from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_links to anon, authenticated;
grant select on public.analytics_event_types to anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;

grant select, insert, update on public.user_profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant select, insert, update on public.businesses to authenticated;
grant select, insert, update on public.business_members to authenticated;
grant select, update on public.business_profiles to authenticated;
grant select, insert, update on public.business_links to authenticated;
grant select, insert, update on public.nfc_tags to authenticated;
grant select, insert, update on public.qr_codes to authenticated;
grant select on public.analytics_events to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime is not enabled. Analytics aggregation will be query-based.
-- ---------------------------------------------------------------------------
