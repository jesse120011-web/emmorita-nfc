# EmmOrita NFC & QR Business Network

Multi-tenant platform for businesses in Kenya (and later internationally) to publish a mobile-first profile at `/t/{slug}`. NFC tags and QR codes both open that URL in the browser.

Built by EmmOrita Digital Intelligence.

## Status

Runnable application foundation: public profile, auth, dashboard, Supabase schema, and RLS. Not the finished SaaS.

## Local development

Requirements: Node 22+ (this repo was checked with Node v22.19.0).

```bash
copy .env.example .env
npm install
npm run dev
```

Edit `.env` with your Supabase project URL and **anon** key. Never put the service-role key in a `VITE_` variable.

```
VITE_PUBLIC_APP_URL=http://localhost:5173
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Apply `supabase/migrations/20260914100000_init.sql` to the project (SQL editor or `npx supabase db push`).

Then:

1. Open http://localhost:5173
2. Create an account at `/login`
3. Create a business in `/app`
4. Fill profile + links, publish, set status to active
5. Open `/t/your-slug` (add `?src=nfc` or `?src=qr` to test scan events)

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Analytics](docs/analytics.md)
- [Roadmap](docs/roadmap.md)
- [Environment variables](docs/environment.md)

## License

MIT. See [LICENSE](LICENSE).
