# FRONTEND_AUDIT_AND_ROADMAP

## 1) Executive summary
- **Overall state:** The repository is a solid MVP foundation (React + TypeScript + Vite + Supabase) with clear route boundaries and tenant-aware data access, but several core flows are still partial and some risks can produce blank/failure states in production-like environments.
- **Most important gaps:**
  1. No runtime error boundary around app bootstrap/provider failures.
  2. Public link URLs are not validated client-side before rendering clickable `<a href>` values.
  3. Reviews hardened flow (`submit-review` Edge Function) is not implemented in frontend code.
  4. NFC/QR/team/analytics/settings are mostly foundational and not yet feature-complete.
  5. Local setup docs are inconsistent with repository contents and migration dependencies.
- **Readiness:** Suitable as a pilot foundation; **not yet production-complete** for broad multi-tenant rollout without addressing P1/P2 items below.

---

## 2) Verified architecture map

### Entry and providers
- Entry point: `/home/runner/work/emmorita-nfc/emmorita-nfc/src/main.tsx:1-22`
  - `StrictMode` → `BrowserRouter` → `AuthProvider` → `App`.
- Auth state/context:
  - Provider: `src/auth/AuthProvider.tsx:12-79`
  - Hook/context split: `src/auth/useAuth.ts:1-10`, `src/auth/auth-context.ts:1-14`
- Tenant state/context:
  - Provider: `src/dashboard/TenantProvider.tsx:25-101`
  - Hook/context split: `src/dashboard/useTenant.ts:1-10`, `src/dashboard/tenant-context.ts:1-14`

### Routing
- Router tree defined in `src/App.tsx:20-45`.
- Protected dashboard subtree wraps `RequireAuth` + `TenantProvider` + `DashboardLayout` (`src/App.tsx:25-42`, `src/auth/RequireAuth.tsx:5-26`).

### Backend integration
- Supabase client initialization: `src/lib/supabase.ts:6-23`.
- Environment validation and service-role guard:
  - `src/lib/env.ts:21-38`
  - Throws if `VITE_SUPABASE_SERVICE_ROLE_KEY` is exposed (`src/lib/env.ts:22-25`).
- Data access is direct from UI/pages to Supabase table/view endpoints (no frontend API layer).

### Layout and styling
- Dashboard shell + nav: `src/pages/dashboard/DashboardLayout.tsx:14-38`.
- Global tokens/styles/responsive rules: `src/index.css:1-247`.
- SPA fallback deployment assumptions: `vercel.json:1-3`, `public/_redirects:1`.

### Architecture interaction map
1. `main.tsx` boots providers.
2. `RequireAuth` enforces configured env + signed-in user for `/app/*`.
3. `TenantProvider` resolves memberships from `business_members` and sets active business.
4. Dashboard pages read/write tenant tables (`business_profiles`, `business_links`, `qr_codes`, `businesses`, `business_members`, `analytics_events`).
5. Public routes read view-projected public data (`public_profiles`, `public_links`, `public_touchpoint_resolutions`) and write analytics events.

---

## 3) Complete route inventory

| Route | Component | Auth/Tenant requirement | Backend dependency | Runtime states in code | Status |
|---|---|---|---|---|---|
| `/` | `HomePage` (`src/pages/HomePage.tsx`) | Public | `getPublicEnv()` | standard render + setup warning card when unconfigured (`:40-49`) | Implemented, not runtime-verified |
| `/login` | `LoginPage` (`src/pages/LoginPage.tsx`) | Public, but redirects if already signed in | Supabase auth (`signIn`, `signUp`) | pending/error/notice handled (`:25-40`, `:74-78`) | Implemented, not runtime-verified |
| `/scan/:publicToken` | `ScanRedirectPage` (`src/pages/ScanRedirectPage.tsx`) | Public | `public_touchpoint_resolutions` view | loading/unconfigured/missing/redirect (`:11-12`, `:48-73`) | Implemented, not runtime-verified |
| `/t/:slug` | `PublicProfilePage` (`src/pages/PublicProfilePage.tsx`) | Public | `public_profiles`, `public_links`, `public_touchpoint_resolutions`, analytics insert | loading/unconfigured/missing/ready (`:15`, `:134-174`) | Implemented, not runtime-verified |
| `/app` | `OverviewPage` inside protected layout | Requires configured env + auth + tenant provider | `business_members`, `businesses` insert | loading/error/create-business/active business states (`OverviewPage.tsx:25-76`) | Implemented, not runtime-verified |
| `/app/profile` | `ProfilePage` | Requires active tenant | `business_profiles`, `business_links` via `LinksEditor` | loading/no-active/form/save message (`ProfilePage.tsx:73-137`) | Partially implemented |
| `/app/nfc` | `NfcPage` | Requires active tenant | none (display only) | loading/no-active/static instructions (`NfcPage.tsx:7-27`) | Partially implemented |
| `/app/qr` | `QrPage` | Requires active tenant | `qr_codes` select/insert | loading/no-active/list/error/add (`QrPage.tsx:52-79`) | Partially implemented |
| `/app/analytics` | `AnalyticsPage` | Requires active tenant | `analytics_events` select | loading/no-active/error/empty/list (`AnalyticsPage.tsx:34-57`) | Partially implemented |
| `/app/team` | `TeamPage` | Requires active tenant | `business_members` select | loading/no-active/error/list (`TeamPage.tsx:31-48`) | Partially implemented |
| `/app/settings` | `SettingsPage` | Requires active tenant | `businesses` update | loading/no-active/status controls/message (`SettingsPage.tsx:23-44`) | Partially implemented |
| `/dashboard` | Redirect route | none | none | `Navigate` to `/app` (`App.tsx:43`) | Implemented and verified (static code path) |
| `*` unknown | `NotFoundPage` | Public | none | static card (`NotFoundPage.tsx:3-15`) | Implemented and verified (static code path) |

### Unreachable/unused/duplicated findings
- CSS selectors `.app-nav` and `.banner` are defined but unused in JSX (`src/index.css:75-83`, `:220-224`; no usage via search).
- `AnalyticsEventType` includes legacy lowercase + uppercase variants (`src/lib/types.ts:13-32`) while link-event mapper currently emits uppercase values (`src/lib/analytics.ts:24-37`).

---

## 4) Feature completeness matrix

| Feature group | Status | Evidence |
|---|---|---|
| Auth sign-in/sign-up/sign-out | Implemented, not runtime-verified | `AuthProvider.tsx:51-73`, `LoginPage.tsx:25-40`, `DashboardLayout.tsx:23-25` |
| Protected route gating | Implemented, not runtime-verified | `RequireAuth.tsx:9-25` |
| Tenant discovery/active selection | Implemented, not runtime-verified | `TenantProvider.tsx:31-68`, `OverviewPage.tsx:28-41` |
| Create first business | Implemented, not runtime-verified | `TenantProvider.tsx:69-95`, `OverviewPage.tsx:61-75` |
| Business profile edit/publish toggle | Partially implemented | `ProfilePage.tsx:59-71`, `:122-133` |
| Public links add/list | Partially implemented | `LinksEditor.tsx:27-113` (no edit/delete/reorder UI) |
| Public profile rendering | Implemented, not runtime-verified | `PublicProfilePage.tsx:147-174` |
| NFC asset management | Not implemented | `NfcPage.tsx:12-25` is informational only |
| QR asset management/download/print | Partially implemented | `QrPage.tsx:31-50` only create/list rows |
| Analytics dashboard (basic counts) | Partially implemented | `AnalyticsPage.tsx:17-31`, no filter/date/grouping |
| Team management/invites | Partially implemented | `TeamPage.tsx:39` explicitly says invites not implemented |
| Settings/business status controls | Partially implemented | `SettingsPage.tsx:36-41`; no suspend action UI or confirmation step |
| Reviews submission/moderation UI | Not implemented | no review route/component usage in `src/App.tsx`; no review form/components found |
| submit-review Edge Function integration | Not implemented | no `supabase.functions.invoke`/`submit-review` references in `src/` |

---

## 5) White-screen and rendering investigation (priority)

### Confirmed high-confidence blank/failure risks

#### FE-001 (P1) — Bootstrap crash can blank the app without user-facing recovery
- **Affected routes:** all routes (global boot path).
- **Evidence:**
  - `getPublicEnv()` throws on forbidden `VITE_SUPABASE_SERVICE_ROLE_KEY` (`src/lib/env.ts:22-25`).
  - This is called during render path from providers/pages (`AuthProvider.tsx:13`, `HomePage.tsx:6`, others).
  - No React error boundary exists around app tree in `src/main.tsx:14-22`.
- **Reproduced vs inferred:** inferred from code path; not browser-reproduced in this environment.
- **Root cause:** render-time exception without boundary.
- **Smallest safe correction:** add top-level error boundary/fatal-config screen for startup exceptions.
- **Regression check:** set `VITE_SUPABASE_SERVICE_ROLE_KEY` in local env, confirm app shows explicit blocking message instead of blank/crash.

### Confirmed route-level non-blank failure modes

#### FE-002 (P2) — `/scan/:publicToken` may misreport missing token when backend object is absent/migration-missing
- **Affected route:** `/scan/:publicToken`.
- **Evidence:** query error and no-data both collapse to `missing` (`src/pages/ScanRedirectPage.tsx:33-35`), which displays “invalid/inactive/unpublished” (`:67-71`).
- **Reproduced vs inferred:** inferred.
- **Root cause:** error taxonomy conflates missing row with infrastructure/schema issues.
- **Smallest safe correction:** distinguish query error vs not-found states and present actionable diagnostic copy.
- **Regression check:** simulate missing relation (or denied select) and verify explicit error state.

### Other white/blank hypotheses requiring runtime verification
- If Supabase auth session bootstrap fails via rejected promise, loading may not recover cleanly (no explicit catch in `AuthProvider.tsx:26-31`).
- If root mount node is missing, app hard-throws (`src/main.tsx:10-12`) — expected but no recovery UI.

---

## 6) UI/UX findings

### Confirmed
- Dashboard IA is clear and consistent via subnav (`DashboardLayout.tsx:28-34`).
- Core cards/forms/buttons follow a consistent style token system (`index.css:1-247`).
- Several actions have weak feedback/guardrails:
  - Staff-disabled mutations rely on disabled buttons with no explicit reason in some pages (`ProfilePage.tsx:130`, `QrPage.tsx:75`).
  - Settings status changes lack confirmation for consequential actions (`SettingsPage.tsx:36-41`).
  - Team page exposes raw `user_id` values without friendly identity mapping (`TeamPage.tsx:43`).

### Unverified (needs runtime)
- Form error/success persistence behavior across navigation.
- Perceived hierarchy/spacing under real content length and translation pressure.

---

## 7) Responsive and accessibility findings

### Responsive (code-based)
- Positive:
  - Horizontal-scroll fallback nav on small widths (`index.css:197-203`).
  - Desktop breakpoint adjusts shell to side-nav layout (`index.css:226-246`).
  - Inputs/buttons meet ≥44px target in many controls (`index.css:89-92`, `:136`, `:179`).
- Risks:
  - Long unbroken content (emails, UUIDs, URLs) may overflow cards/lists (no word-break utilities applied in list items such as `TeamPage.tsx:43`).
  - No route-level component-specific responsive tuning for analytics list density.
- Runtime viewport verification: **not performed** (tooling/browser interaction not used for visual QA here).

### Accessibility (WCAG 2.2 AA-oriented)
- Positive:
  - Landmark usage with `<main>` and labeled nav (`DashboardLayout.tsx:28`, `SiteHeader.tsx:9`).
  - Visible focus style for links/buttons/inputs (`index.css:50-55`).
- Gaps:
  - Error and success messages are plain text without `aria-live` announcement semantics (`LoginPage.tsx:74-76`, `ProfilePage.tsx:133`, `SettingsPage.tsx:42`).
  - No explicit skip link.
  - Checkbox in profile has inline label text but no helper text linkage for consequence (“published”).
- Manual keyboard/screen-reader verification: **not performed**.

---

## 8) Functional and integration findings

### Authentication
- Implemented flows exist (`AuthProvider`, `LoginPage`, `RequireAuth`), with pending/error rendering.
- No explicit expired-session banner; behavior relies on Supabase session updates.

### Business profile
- Edit/save implemented (`ProfilePage.tsx:59-71`), but no optimistic conflict handling and no field-level validation messages beyond browser defaults.

### NFC and QR
- NFC page is informational only; no inventory/assignment lifecycle UI despite schema support.
- QR supports row creation/listing only; no generated image/download/print UI.

### Analytics
- Tracks events on profile view and CTA click (`PublicProfilePage.tsx:92-121`, `PublicLinkButton.tsx:15-24`).
- Dashboard analytics is simple count by event_type and lacks filters/date range.

### Team
- Member listing only; invites explicitly absent (`TeamPage.tsx:39`).

### Settings
- Status update to active/draft only, no suspend action and no confirmation modal.

### Reviews
- DB schema and policies for reviews exist (`supabase/migrations/20260914183000_mvp_foundation.sql:241-498`), but frontend has no review route/UI and no Edge Function integration references.

---

## 9) Security-boundary findings

### FE-003 (P1) — Unvalidated link href rendered directly to public users
- **Affected feature:** public profile CTA links.
- **Evidence:**
  - CTA render uses direct `href` from DB (`src/components/PublicLinkButton.tsx:27`).
  - `business_links.href` DB constraint only enforces length, not safe scheme (`20260914100000_init.sql:176`).
- **Impact:** tenant admins could store unsafe schemes (e.g., `javascript:`), causing phishing/script execution risk when visitors click.
- **Root cause:** missing input/output URL sanitization/allowlist.
- **Correction:** enforce scheme allowlist (`https:`, `http:`, `tel:`, `mailto:`, approved WhatsApp format) both client and DB/check-function layer.
- **Verification:** attempt unsafe scheme insert and confirm rejected + rendered links always safe.

### FE-004 (P2) — Documentation/setup drift can leave analytics/touchpoint behavior partially broken
- **Evidence:**
  - README instructs applying only `20260914100000_init.sql` (`README.md:29`).
  - Later migration adds `public_touchpoint_resolutions`, touchpoints, uppercase analytics event types (`20260914183000_mvp_foundation.sql:95-105`, `:259-275`).
  - Frontend uses `public_touchpoint_resolutions` and uppercase event names (`ScanRedirectPage.tsx:25-28`, `PublicProfilePage.tsx:64-67`, `lib/analytics.ts:24-37`).
- **Impact:** mismatched DB state can silently degrade scan resolution and analytics ingestion.
- **Correction:** align setup docs/scripts with required migration chain.

### Additional boundary observations
- Positive: service-role browser exposure is actively blocked (`env.ts:22-25`).
- Positive: SQL uses RLS + security-definer helpers (`20260914100000_init.sql:319-383`, policies onward).
- Needs backend verification (not done here):
  - live production policy deployment parity,
  - Edge Function hardening for review ingestion,
  - abuse/rate limiting for public analytics/review inserts.

---

## 10) Performance and maintainability findings

- Data fetching is page-local and repetitive; no shared query abstraction/caching layer.
- Analytics dashboard computes counts client-side by selecting all event rows (`AnalyticsPage.tsx:18-31`) rather than using aggregate views (`analytics_event_counts_by_type` exists in SQL migration).
- No route-level code splitting; all pages load in main bundle (`App.tsx` imports all page modules directly).
- Type discipline is generally strong (`strict` tsconfig), but there are broad casts from Supabase data results (multiple `as ...` casts in pages/providers).
- Unused CSS selectors suggest minor dead-style drift (`index.css` `.app-nav`, `.banner`).

---

## 11) Test results and limitations

### Commands run
1. `npm run typecheck` → **failed** (missing local module resolution; e.g., cannot find `react`, `react-router-dom`).
2. `npm run lint` → **failed** (`eslint: not found`).
3. `npm run build` → **failed** (same missing module/type resolution errors as typecheck).

### Interpretation
- Failures are environment/dependency-state related in this sandbox session, not code-logic verification.
- No unit/component/e2e tests are present in repository (no `*.test.*` / `*.spec.*` files found).

### Limitations
- No browser runtime verification was performed for interactive rendering paths.
- No live Supabase project connectivity verification was performed.

---

## 12) Prioritized defect register

| ID | Severity | Route/Feature | Evidence | Impact | Root cause | Recommended correction | Acceptance criteria / regression checks |
|---|---|---|---|---|---|---|---|
| FE-001 | P1 | Global render boot | `env.ts:22-25`, `main.tsx:14-22` | Potential full-app blank/crash on config mistake | Throw without boundary | Add top-level fatal error boundary + startup config screen | Misconfigured env renders actionable fatal state, not blank/crash |
| FE-003 | P1 | Public profile links | `PublicLinkButton.tsx:27`, `20260914100000_init.sql:176` | Public users can be sent to unsafe link schemes | Missing href allowlist validation | Validate and sanitize href at create/update/render boundaries | Unsafe schemes rejected; only allowed protocols render clickable |
| FE-002 | P2 | `/scan/:publicToken` diagnostics | `ScanRedirectPage.tsx:33-35`, `:67-71` | Operators get misleading “not found” for infra/schema/query errors | Error/no-data conflated | Separate error state with actionable message | Missing row and query error produce distinct user/admin-facing states |
| FE-004 | P2 | Setup/migration consistency | `README.md:29`, `mvp_foundation.sql:95-105`, `ScanRedirectPage.tsx:25-28` | Partial/failed behavior in fresh setups | Documentation drift vs frontend + migration requirements | Update setup documentation and required migration order | Fresh setup using docs supports scan + analytics without schema mismatch |
| FE-005 | P2 | Reviews secure ingestion objective | No review UI/routes in `App.tsx`; no function invoke references | Intended hardened review flow is absent in frontend | Feature not implemented | Add explicit review submission flow via secured backend function | Review submit path exists with pending/success/error/rate-limit handling |

### Hypotheses (not confirmed defects)
- Auth bootstrap rejection paths may leave ambiguous loading behavior due lack of explicit catch handling (`AuthProvider.tsx:26-31`).
- Some mobile overflow scenarios may appear with extreme text lengths; requires runtime viewport checks.

---

## 13) Ordered implementation roadmap

### Milestone 1 — Stabilize rendering and startup diagnostics
- **Objective:** eliminate app-wide blank/fatal experiences.
- **Likely files:** `src/main.tsx`, new error boundary component file(s), possibly `src/lib/env.ts` messaging.
- **Dependencies:** none.
- **User-visible result:** clear fatal setup error screen instead of crash/blank.
- **Acceptance:** FE-001 criteria pass.
- **Verification:** startup misconfig scenario + normal path sanity check.
- **Risks/backends:** none.
- **Definition of done:** global error boundary and deterministic startup states documented.

### Milestone 2 — Harden public-link trust boundary
- **Objective:** prevent unsafe link schemes from reaching public CTA UI.
- **Likely files:** `src/pages/dashboard/LinksEditor.tsx`, `src/components/PublicLinkButton.tsx`, relevant SQL migration/check constraint.
- **Dependencies:** migration deployment process.
- **User-visible result:** invalid link formats rejected with clear errors.
- **Acceptance:** FE-003 criteria pass.
- **Verification:** positive/negative URL protocol tests.
- **Risks/backends:** existing invalid data may require cleanup.
- **Definition of done:** allowlist enforced in write and render paths.

### Milestone 3 — Align setup/docs with required schema runtime
- **Objective:** remove setup ambiguity and prevent silent feature failures.
- **Likely files:** `README.md`, `docs/database.md`, `docs/environment.md` (and deployment runbook docs if present).
- **Dependencies:** agreed migration baseline.
- **User-visible result:** consistent local/dev/prod schema expectations.
- **Acceptance:** FE-004 criteria pass.
- **Verification:** fresh environment install runbook.
- **Risks/backends:** migration order differences across existing environments.
- **Definition of done:** docs and frontend runtime dependencies are consistent.

### Milestone 4 — Complete core dashboard journeys (profile, QR, team, settings)
- **Objective:** move from partial to reliable day-to-day operations.
- **Likely files:** dashboard pages under `src/pages/dashboard/*`.
- **Dependencies:** Milestones 1-3.
- **User-visible result:** robust mutation feedback, permission messaging, and missing CRUD gaps closed.
- **Acceptance:** save/add/update flows have pending/success/error and authorization UX.
- **Verification:** role-based manual test matrix (owner/admin/staff).
- **Risks/backends:** RLS policy edge cases.
- **Definition of done:** all dashboard routes pass role-aware functional checks.

### Milestone 5 — Implement review flow with hardened ingestion
- **Objective:** ship reviews with secure ingestion path.
- **Likely files:** new review page/components, route registration, Supabase function invoke integration.
- **Dependencies:** backend Edge Function readiness.
- **User-visible result:** review submission with clear moderation/rate-limit handling.
- **Acceptance:** FE-005 criteria pass.
- **Verification:** integration tests/manual checks against function responses.
- **Risks/backends:** CORS/function auth/rate-limit policy config.
- **Definition of done:** review UX + secure backend flow are end-to-end validated.

### Milestone 6 — Responsive/accessibility pass
- **Objective:** ensure mobile-first NFC/QR journeys are accessible and robust.
- **Likely files:** `src/index.css`, route/page components requiring semantic/live-region improvements.
- **Dependencies:** core flow stabilization.
- **User-visible result:** improved keyboard/screen-reader/mobile usability.
- **Acceptance:** targeted WCAG AA checklist pass for key routes.
- **Verification:** viewport + keyboard + SR smoke tests.
- **Risks/backends:** none.
- **Definition of done:** documented accessibility baseline and regression checks.

### Milestone 7 — Performance and maintainability hardening
- **Objective:** reduce avoidable load/query costs and code duplication.
- **Likely files:** route module boundaries, analytics page querying, shared data hooks.
- **Dependencies:** functional completeness.
- **User-visible result:** faster route loads and cleaner state handling.
- **Acceptance:** fewer redundant queries; route bundle split where justified.
- **Verification:** build artifact comparison + route interaction profiling.
- **Risks/backends:** aggregation/query API shape changes.
- **Definition of done:** measurable improvements recorded.

---

## 14) Acceptance criteria and regression checklist

- [ ] App startup never results in unhandled blank page for known config errors.
- [ ] Public CTA links cannot use unsafe protocols.
- [ ] `/scan/:publicToken` communicates not-found vs system error distinctly.
- [ ] Fresh setup documentation matches required migration set.
- [ ] Login → dashboard → profile save → public profile view works for owner/admin roles.
- [ ] Staff role restrictions are clearly communicated in UI (not only disabled controls).
- [ ] Analytics events are ingested and visible on dashboard with expected event names.
- [ ] Responsive checks pass on small phone, phone, tablet, desktop widths.
- [ ] Accessibility checks cover focus visibility, labels, error announcements, and landmarks.

---

## 15) Open questions and missing evidence

1. What is the authoritative required migration baseline for frontend runtime (init only vs full chain)?
2. Is a `submit-review` Edge Function already deployed externally but not represented in this repository?
3. Should public analytics insert remain direct table insert, or move to an ingestion function for abuse controls?
4. Are there existing production incidents for white/blank pages tied to env misconfiguration?
5. Should QR/NFC management stay minimal for MVP, or is full lifecycle now required?

---

## 16) Single recommended first implementation task

**Implement Milestone 1 (global startup/error boundary) first:** add a top-level error boundary and explicit fatal configuration UI so misconfiguration/runtime bootstrap errors cannot surface as blank or crash-only experiences.
