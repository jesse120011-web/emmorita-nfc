# Roadmap

## Foundation (this repository)

- Vite + React + TypeScript app
- Public profile route `/t/:slug`
- Auth login/signup
- Tenant dashboard shells with real reads/writes
- PostgreSQL schema, RLS, public views
- Append-only analytics

## Next MVP slice

1. Logo upload via Supabase Storage with tenant-scoped policies
2. Richer profile editor (textarea, link edit/disable/reorder)
3. Team invites (email) and role changes
4. QR PNG generation for registered `qr_codes` rows
5. Optional `/n/:public_token` NFC redirect that records `nfc_tag_id` then 302s to `/t/:slug?src=nfc`
6. Analytics date filters and simple charts without heavy chart libraries if possible
7. Activate/publish checklist (status, published, at least one link)

## Platform admin

- Business list, suspend/activate
- NFC inventory mint/assign/replace
- Platform-wide event totals
- Plan catalog and assignment to `plan_key`

## Later

- Billing (M-Pesa first for Kenya)
- Rate limits on public analytics inserts
- Daily aggregate tables
- Custom domains per business
- Internationalization and additional country defaults
