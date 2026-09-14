# Security

## Trust boundaries

1. **Browser** may hold `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.
2. **Postgres RLS** is the tenant isolation boundary. The anon key is useless for other tenants' private rows.
3. **Service role** bypasses RLS. It must stay in server-side environment variables (`SUPABASE_SERVICE_ROLE_KEY`) and never ship in the Vite bundle.

`src/lib/env.ts` refuses to boot if a `VITE_` service-role variable is present.

## RLS summary

| Table | Anon | Authenticated member | Platform admin |
| --- | --- | --- | --- |
| `public_profiles` / `public_links` views | SELECT published/active | SELECT | SELECT |
| `businesses` and tenant tables | none | own membership | all |
| `nfc_tags` | none | assigned to their business | inventory + all |
| `analytics_events` | INSERT if business is public | INSERT public + SELECT own | SELECT all |
| `analytics_events` UPDATE/DELETE | none | none | none (service role only) |
| `platform_admins` | none | none | SELECT |

Staff can read tenant data. Profile, link, QR, and business updates require `owner` or `admin`. NFC tag inserts require platform admin.

## Public exposure

Anon has no `GRANT` on base tenant tables. Public data is the column-limited views `public_profiles` and `public_links`, filtered to `status = active`, `is_published = true`, and `deleted_at is null`.

## Auth roles (architecture, not extra IdP complexity)

- Business owner / admin / staff: `business_members.role`
- Platform administrator: `platform_admins`
- Sign-up and password login use Supabase Auth only

## Analytics privacy

Events record timestamps, event type, source, coarse device class, truncated user agent, and truncated referrer. They do not store IP addresses or the viewer's Auth user id.

## Operational rules

- `.env` and `.env.*` are gitignored except `.env.example`
- Dashboard mutations use the user JWT; they cannot escalate to service role
- First platform admin must be inserted with a privileged SQL session
