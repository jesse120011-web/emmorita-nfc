-- MVP architecture foundation: touchpoints, event integrity, menus, reviews
create extension if not exists pgcrypto with schema extensions;

create type public.touchpoint_channel as enum ('qr', 'nfc');
create type public.touchpoint_status as enum ('active', 'inactive');

create table public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  channel public.touchpoint_channel not null,
  label text not null check (char_length(label) between 1 and 120),
  status public.touchpoint_status not null default 'active',
  public_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  qr_code_id uuid references public.qr_codes (id) on delete set null,
  nfc_tag_id uuid references public.nfc_tags (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_token),
  constraint touchpoints_channel_asset_check check (
    (channel = 'qr' and qr_code_id is not null and nfc_tag_id is null)
    or (channel = 'nfc' and nfc_tag_id is not null and qr_code_id is null)
  )
);

create unique index touchpoints_qr_code_id_idx
  on public.touchpoints (qr_code_id)
  where qr_code_id is not null;

create unique index touchpoints_nfc_tag_id_idx
  on public.touchpoints (nfc_tag_id)
  where nfc_tag_id is not null;

create index touchpoints_business_id_idx
  on public.touchpoints (business_id);

create index touchpoints_status_idx
  on public.touchpoints (status);

create index touchpoints_public_token_idx
  on public.touchpoints (public_token);

create trigger touchpoints_set_updated_at
before update on public.touchpoints
for each row execute function public.set_updated_at();

insert into public.touchpoints (
  business_id,
  channel,
  label,
  status,
  public_token,
  qr_code_id
)
select
  q.business_id,
  'qr'::public.touchpoint_channel,
  coalesce(nullif(q.label, ''), 'QR ' || substr(q.id::text, 1, 8)),
  case when q.status = 'active' then 'active'::public.touchpoint_status else 'inactive'::public.touchpoint_status end,
  encode(extensions.gen_random_bytes(16), 'hex'),
  q.id
from public.qr_codes q
where q.deleted_at is null
  and not exists (
    select 1 from public.touchpoints t where t.qr_code_id = q.id
  );

insert into public.touchpoints (
  business_id,
  channel,
  label,
  status,
  public_token,
  nfc_tag_id
)
select
  n.business_id,
  'nfc'::public.touchpoint_channel,
  coalesce(nullif(n.label, ''), 'NFC ' || substr(n.id::text, 1, 8)),
  case when n.status = 'active' then 'active'::public.touchpoint_status else 'inactive'::public.touchpoint_status end,
  encode(extensions.gen_random_bytes(16), 'hex'),
  n.id
from public.nfc_tags n
where n.business_id is not null
  and not exists (
    select 1 from public.touchpoints t where t.nfc_tag_id = n.id
  );

alter table public.analytics_events
  add column touchpoint_id uuid references public.touchpoints (id) on delete set null;

create index analytics_events_touchpoint_idx
  on public.analytics_events (business_id, touchpoint_id, occurred_at desc)
  where touchpoint_id is not null;

insert into public.analytics_event_types (key, description) values
  ('QR_SCAN', 'Touchpoint opened from a QR scan'),
  ('NFC_TAP', 'Touchpoint opened from an NFC tap'),
  ('PROFILE_VIEW', 'Public profile was rendered'),
  ('MENU_VIEW', 'Public menu was viewed'),
  ('WHATSAPP_CLICK', 'WhatsApp CTA clicked'),
  ('CALL_CLICK', 'Phone CTA clicked'),
  ('WEBSITE_CLICK', 'Website or social CTA clicked'),
  ('DIRECTIONS_CLICK', 'Directions CTA clicked'),
  ('REVIEW_CLICK', 'Review CTA clicked')
on conflict (key) do nothing;

create or replace function public.enforce_analytics_event_tenant_integrity()
returns trigger
language plpgsql
as $$
declare
  _ref_business_id uuid;
begin
  if new.touchpoint_id is not null then
    select t.business_id into _ref_business_id
    from public.touchpoints t
    where t.id = new.touchpoint_id;

    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using
        errcode = '23514',
        message = 'touchpoint_id must belong to analytics_events.business_id';
    end if;
  end if;

  if new.link_id is not null then
    select l.business_id into _ref_business_id
    from public.business_links l
    where l.id = new.link_id;

    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using
        errcode = '23514',
        message = 'link_id must belong to analytics_events.business_id';
    end if;
  end if;

  if new.qr_code_id is not null then
    select q.business_id into _ref_business_id
    from public.qr_codes q
    where q.id = new.qr_code_id;

    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using
        errcode = '23514',
        message = 'qr_code_id must belong to analytics_events.business_id';
    end if;
  end if;

  if new.nfc_tag_id is not null then
    select n.business_id into _ref_business_id
    from public.nfc_tags n
    where n.id = new.nfc_tag_id;

    if _ref_business_id is null or _ref_business_id <> new.business_id then
      raise exception using
        errcode = '23514',
        message = 'nfc_tag_id must belong to analytics_events.business_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger analytics_events_enforce_tenant_integrity
before insert or update on public.analytics_events
for each row execute function public.enforce_analytics_event_tenant_integrity();

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index menus_business_id_idx
  on public.menus (business_id)
  where deleted_at is null;

create index menus_status_idx
  on public.menus (business_id, status)
  where deleted_at is null;

create trigger menus_set_updated_at
before update on public.menus
for each row execute function public.set_updated_at();

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index menu_categories_menu_id_idx
  on public.menu_categories (menu_id, display_order)
  where deleted_at is null;

create trigger menu_categories_set_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text check (description is null or char_length(description) <= 3000),
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'KES' check (currency = upper(currency)),
  image_url text,
  display_order integer not null default 0 check (display_order >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index menu_items_category_id_idx
  on public.menu_items (category_id, display_order)
  where deleted_at is null;

create index menu_items_status_idx
  on public.menu_items (status)
  where deleted_at is null;

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text check (review_text is null or char_length(review_text) <= 4000),
  reviewer_name text check (reviewer_name is null or char_length(reviewer_name) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_business_id_idx
  on public.reviews (business_id, status, created_at desc);

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create or replace view public.public_touchpoint_resolutions
with (security_invoker = false, security_barrier = true) as
select
  t.public_token,
  t.id as touchpoint_id,
  t.business_id,
  b.slug,
  t.channel,
  t.qr_code_id,
  t.nfc_tag_id
from public.touchpoints t
join public.businesses b on b.id = t.business_id
join public.business_profiles p on p.business_id = b.id
where b.deleted_at is null
  and b.status = 'active'
  and p.is_published = true
  and t.status = 'active';

create or replace view public.analytics_event_counts_by_type
with (security_invoker = true, security_barrier = true) as
select
  business_id,
  event_type,
  count(*)::bigint as event_count,
  max(occurred_at) as latest_occurred_at
from public.analytics_events
group by business_id, event_type;

alter table public.touchpoints enable row level security;
alter table public.touchpoints force row level security;
alter table public.menus enable row level security;
alter table public.menus force row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;
alter table public.menu_items enable row level security;
alter table public.menu_items force row level security;
alter table public.reviews enable row level security;
alter table public.reviews force row level security;

create policy touchpoints_select
  on public.touchpoints for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy touchpoints_insert
  on public.touchpoints for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy touchpoints_update
  on public.touchpoints for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy menus_select
  on public.menus for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy menus_insert
  on public.menus for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy menus_update
  on public.menus for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

create policy menu_categories_select
  on public.menu_categories for select
  to authenticated
  using (
    exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and (public.is_business_member(m.business_id) or public.is_platform_admin())
    )
  );

create policy menu_categories_insert
  on public.menu_categories for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  );

create policy menu_categories_update
  on public.menu_categories for update
  to authenticated
  using (
    exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  );

create policy menu_items_select
  on public.menu_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and (public.is_business_member(m.business_id) or public.is_platform_admin())
    )
  );

create policy menu_items_insert
  on public.menu_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  );

create policy menu_items_update
  on public.menu_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and (
          public.has_business_role(m.business_id, array['owner', 'admin']::public.business_member_role[])
          or public.is_platform_admin()
        )
    )
  );

create policy reviews_select_member
  on public.reviews for select
  to authenticated
  using (public.is_business_member(business_id) or public.is_platform_admin());

create policy reviews_insert_public
  on public.reviews for insert
  to anon, authenticated
  with check (
    public.business_is_public(business_id)
    and status = 'pending'
  );

create policy reviews_update_member
  on public.reviews for update
  to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_member_role[])
    or public.is_platform_admin()
  );

revoke all on table public.touchpoints from anon, authenticated;
revoke all on table public.menus from anon, authenticated;
revoke all on table public.menu_categories from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
revoke all on table public.public_touchpoint_resolutions from anon, authenticated;
revoke all on table public.analytics_event_counts_by_type from anon, authenticated;

grant select on public.public_touchpoint_resolutions to anon, authenticated;
grant select on public.analytics_event_counts_by_type to authenticated;
grant select, insert, update on public.touchpoints to authenticated;
grant select, insert, update on public.menus to authenticated;
grant select, insert, update on public.menu_categories to authenticated;
grant select, insert, update on public.menu_items to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant insert on public.reviews to anon;
