# Environment variables

Never commit real credentials. Copy `.env.example` to `.env`.

## Browser (Vite)

These are embedded in the client bundle. Only public values.

| Name | Purpose |
| --- | --- |
| `VITE_PUBLIC_APP_URL` | Canonical origin for NFC/QR URLs (example `http://localhost:5173`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

Do **not** create `VITE_SUPABASE_SERVICE_ROLE_KEY`. The app throws if that variable exists.

## Server only (not loaded by Vite)

| Name | Purpose |
| --- | --- |
| `PUBLIC_APP_URL` | Same origin for future Edge Functions and auth site URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Edge Functions / admin jobs only |

`.gitignore` ignores `.env` and `.env.*` except `.env.example`.
