# Database

Normalized PostgreSQL schema lives in `supabase/migrations/20260914100000_init.sql`.

## Relationship model

```
auth.users
  ├── user_profiles (1:1)
  ├── platform_admins (0..1)
  └── businesses.owner_id
        ├── business_members (users ↔ businesses, role)
        ├── business_profiles (1:1 identity)
        ├── business_links (CTAs)
        ├── nfc_tags (nullable business_id)
        ├── qr_codes
        └── analytics_events
              └── analytics_event_types
```

## Table intent

### `user_profiles`
Display name for an Auth user. Created by a trigger on `auth.users`.

### `platform_admins`
EmmOrita operators. Bootstrap by inserting a row with the service role or SQL editor. Not granted to ordinary members.

### `businesses`
Tenant root. Live slugs are unique (`deleted_at is null`). Default country `KE`, timezone `Africa/Nairobi`. Soft delete via `deleted_at`. Status: `draft | active | suspended`.

### `business_members`
Membership with `owner | admin | staff`. Unique `(business_id, user_id)`. Inserting a business creates the owner membership in `handle_new_business`.

### `business_profiles`
Public identity: logo, tagline, description, location label, publish flag. Contact/social/booking actions are **not** duplicated here.

### `business_links`
Configurable CTAs. `kind` is a checked text list (`phone`, `whatsapp`, `website`, `maps`, `booking`, `instagram`, `facebook`, `tiktok`, `email`, `custom`) so common actions stay consistent while `custom` remains open.

### `nfc_tags`
Inventory and lifecycle. `public_token` is a stable identifier for a future `/n/:token` redirect. `hardware_uid` is optional and unique when present. Unassigned tags have `business_id` null and status `inventory`. Business members only see tags assigned to their tenant.

### `qr_codes`
Print/display assets that still resolve to `/t/:slug`. Not a second profile.

### `analytics_event_types` + `analytics_events`
Event types are rows. Adding a new type is an insert, not a table rewrite. Events store `occurred_at`, truncated `user_agent`, truncated `referrer`, coarse `device_class`, optional link/tag/qr ids, and a small `metadata` jsonb. No IP column.

## Indexes and constraints

- Partial unique index on `businesses.slug` where not deleted
- Member lookup by `user_id`
- Link order per business
- Analytics `(business_id, occurred_at desc)` and `(business_id, event_type)`
- Unique `nfc_tags.public_token` and partial unique `hardware_uid`

## Triggers

- `set_updated_at` on mutable tables
- `handle_new_user` → `user_profiles`
- `handle_new_business` → owner member + empty profile

## Applying migrations

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

Or paste the migration into the Supabase SQL editor.
