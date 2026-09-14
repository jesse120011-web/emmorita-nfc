[1mdiff --git a/.gitignore b/.gitignore[m
[1mindex 872d5f6..ea38338 100644[m
[1m--- a/.gitignore[m
[1m+++ b/.gitignore[m
[36m@@ -141,3 +141,8 @@[m [mdist[m
 vite.config.js.timestamp-*[m
 vite.config.ts.timestamp-*[m
 .vite/[m
[32m+[m
[32m+[m[32m# Supabase CLI[m
[32m+[m[32m.supabase[m
[32m+[m[32msupabase/.temp[m
[32m+[m[32msupabase/.branches[m
[1mdiff --git a/README.md b/README.md[m
[1mindex 2853d2e..a510d82 100644[m
[1m--- a/README.md[m
[1m+++ b/README.md[m
[36m@@ -1,2 +1,60 @@[m
[31m-# emmorita-nfc[m
[31m-Multi-tenant NFC and QR business network platform by EmmOrita Digital Intelligence.[m
[32m+[m[32m# EmmOrita NFC & QR Business Network[m
[32m+[m
[32m+[m[32mMulti-tenant platform for businesses in Kenya (and later internationally) to publish a mobile-first profile at `/t/{slug}`. NFC tags and QR codes both open that URL in the browser.[m
[32m+[m
[32m+[m[32mBuilt by EmmOrita Digital Intelligence.[m
[32m+[m
[32m+[m[32m## Status[m
[32m+[m
[32m+[m[32mRunnable application foundation: public profile, auth, dashboard, Supabase schema, and RLS. Not the finished SaaS.[m
[32m+[m
[32m+[m[32m## Local development[m
[32m+[m
[32m+[m[32mRequirements: Node 22+ (this repo was checked with Node v22.19.0).[m
[32m+[m
[32m+[m[32m```bash[m
[32m+[m[32mcopy .env.example .env[m
[32m+[m[32mnpm install[m
[32m+[m[32mnpm run dev[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mEdit `.env` with your Supabase project URL and **anon** key. Never put the service-role key in a `VITE_` variable.[m
[32m+[m
[32m+[m[32m```[m
[32m+[m[32mVITE_PUBLIC_APP_URL=http://localhost:5173[m
[32m+[m[32mVITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co[m
[32m+[m[32mVITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mApply `supabase/migrations/20260914100000_init.sql` to the project (SQL editor or `npx supabase db push`).[m
[32m+[m
[32m+[m[32mThen:[m
[32m+[m
[32m+[m[32m1. Open http://localhost:5173[m
[32m+[m[32m2. Create an account at `/login`[m
[32m+[m[32m3. Create a business in `/app`[m
[32m+[m[32m4. Fill profile + links, publish, set status to active[m
[32m+[m[32m5. Open `/t/your-slug` (add `?src=nfc` or `?src=qr` to test scan events)[m
[32m+[m
[32m+[m[32m## Scripts[m
[32m+[m
[32m+[m[32m| Command | Purpose |[m
[32m+[m[32m| --- | --- |[m
[32m+[m[32m| `npm run dev` | Vite dev server on port 5173 |[m
[32m+[m[32m| `npm run build` | Typecheck and production build |[m
[32m+[m[32m| `npm run preview` | Serve the production build |[m
[32m+[m[32m| `npm run typecheck` | `tsc -b --noEmit` |[m
[32m+[m[32m| `npm run lint` | ESLint |[m
[32m+[m
[32m+[m[32m## Documentation[m
[32m+[m
[32m+[m[32m- [Architecture](docs/architecture.md)[m
[32m+[m[32m- [Database](docs/database.md)[m
[32m+[m[32m- [Security](docs/security.md)[m
[32m+[m[32m- [Analytics](docs/analytics.md)[m
[32m+[m[32m- [Roadmap](docs/roadmap.md)[m
[32m+[m[32m- [Environment variables](docs/environment.md)[m
[32m+[m
[32m+[m[32m## License[m
[32m+[m
[32m+[m[32mMIT. See [LICENSE](LICENSE).[m
