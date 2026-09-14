# Architecture

This repository is a Vite + React + TypeScript single-page app with PostgreSQL/Supabase as the system of record. It is the foundation for the EmmOrita NFC and QR business network, Kenya-first, multi-tenant.

## Decisions that are in the code

- **One public profile, two entry methods.** NFC tags and QR codes both open `/t/:slug`. There is no second profile renderer. Optional `?src=nfc` or `?src=qr` distinguishes scans for analytics.
- **NFC is a URL.** Tags are expected to store `https://<domain>/t/<slug>?src=nfc`. The customer uses the phone browser. Tag hardware is tracked in `nfc_tags` for later assignment, activation, deactivation, reassignment, and replacement.
- **Tenant boundary is a `businesses` row.** Users authenticate with Supabase Auth. Access to tenant data is through `business_members` roles (`owner`, `admin`, `staff`). Platform operators are a separate `platform_admins` table so EmmOrita staff are not a tenant role.
- **Browser client uses the anon key only.** `src/lib/supabase.ts` creates a single browser client. A service-role key must never be prefixed with `VITE_`. `getPublicEnv()` throws if that mistake is present.
- **Public reads go through views.** Anon cannot select base tenant tables. `public_profiles` and `public_links` expose only published, active, non-deleted businesses.
- **Analytics are append-only events.** Clients may insert events for published businesses. Clients cannot update or delete events. Members may read their own tenant events.
- **No billing engine yet.** `businesses.plan_key` defaults to `free` so plans can attach later without a rewrite.
- **Deploy target.** Static Vite output with SPA fallback (`vercel.json` and `public/_redirects`) for Vercel or Cloudflare Pages.

## Runtime shape

```
Browser (Vite/React)
  ├── Public routes: /, /t/:slug
  ├── Auth routes: /login
  └── Dashboard routes: /app/*
        └── Supabase JS (anon key + user JWT)
              └── PostgreSQL RLS
```

Trusted server jobs (tag inventory minting, platform-wide reports, webhooks) belong in Supabase Edge Functions or a later Node server using `SUPABASE_SERVICE_ROLE_KEY`. Those functions are not in this foundation because they are not required to run the public profile or the first dashboard.

## Application modules

| Path | Role |
| --- | --- |
| `src/lib/env.ts` | Public env validation |
| `src/lib/supabase.ts` | Browser Supabase client |
| `src/lib/analytics.ts` | Event insert helper |
| `src/auth/AuthProvider.tsx` | Session |
| `src/dashboard/TenantProvider.tsx` | Memberships and active business |
| `src/pages/PublicProfilePage.tsx` | Mobile-first public card |
| `src/pages/dashboard/*` | Authenticated shells that read/write real tables |

## What is intentionally not built yet

- Email invites and team management UI beyond listing members
- NFC hardware provisioning UI for businesses (platform-admin insert only)
- QR image generation (inventory rows exist; rendering comes later)
- Aggregated analytics materialized views
- Billing, usage limits, and plan enforcement
- Platform admin console
- i18n (copy is English; timezone default is Africa/Nairobi)
