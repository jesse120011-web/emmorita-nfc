\# EMMORITA NFC — STEP 01



\# HARDEN ANONYMOUS ANALYTICS INGESTION



\## SESSION



SESSION TAG: EMMORITA-NFC-AUDIT-20260927-01



Repository:

EmmOrita NFC



Branch:

main



\---



\# OPERATING RULES



You are working on a production-oriented multi-tenant application.



Follow these rules throughout this task:



\* Work only on Step 1.

\* Do not modify unrelated functionality.

\* Do not commit.

\* Do not push.

\* Do not expose secrets.

\* Do not print secret values.

\* Do not introduce unnecessary dependencies.

\* Do not change the approved architecture.

\* Use actual repository evidence rather than assumptions.



\## WINDOWS FILE-EDITING RULE



This repository is being edited from Windows PowerShell.



DO NOT use:



\* `apply\_patch`

\* multiline `apply\_patch` arguments

\* Unix heredocs such as `python - <<'PY'`

\* shell constructs that depend on Bash

\* any previously failed patch mechanism



Use Windows-compatible file creation/editing methods that preserve UTF-8, such as:



\* PowerShell `\[System.IO.File]::WriteAllText()`

\* PowerShell `Set-Content` with explicit UTF-8 encoding

\* another reliable Windows-native UTF-8 method



Before implementation, remove any temporary test files created solely to test file writing.



\---



\# APPROVED ARCHITECTURE



Use Option A only:



Browser

→ Supabase Edge Function

→ validation / authoritative context resolution

→ abuse/rate limiting

→ `analytics\_events` insert using service role



DO NOT implement an HMAC ingestion system.



DO NOT create:



\* `analytics\_ingest\_tokens`

\* permanent ingest secrets

\* an `ingest\_token` column



Do not expose the Supabase service-role key to browser code.



\---



\# OBJECTIVE



Harden anonymous analytics ingestion so that an attacker cannot directly insert arbitrary analytics rows into `analytics\_events` using the public Supabase client.



The existing public analytics functionality must continue working.



The following analytics must remain supported:



\* PROFILE\_VIEW

\* NFC\_TAP

\* QR\_SCAN

\* WEBSITE\_CLICK

\* WHATSAPP\_CLICK

\* CALL\_CLICK

\* DIRECTIONS\_CLICK

\* REVIEW\_CLICK



\---



\# BEFORE CHANGING ANYTHING



Read the actual existing repository implementation.



At minimum inspect:



\* `supabase/migrations/20260914100000\_init.sql`

\* `supabase/migrations/20260914183000\_mvp\_foundation.sql`

\* `supabase/migrations/20260915123000\_enforce\_touchpoint\_asset\_ownership.sql`

\* `src/lib/analytics.ts`

\* `src/pages/PublicProfilePage.tsx`

\* `src/components/PublicLinkButton.tsx`

\* `src/pages/ScanRedirectPage.tsx`

\* relevant public profile/touchpoint code

\* relevant Supabase configuration



Confirm the actual schema and relationships before writing the implementation.



\---



\# IMPLEMENTATION REQUIREMENTS



\## 1. Remove direct public analytics insertion



Remove the anonymous/public INSERT policy that allows the browser to directly insert into:



`public.analytics\_events`



The browser must no longer be able to insert directly into that table.



Existing read access for authorized business members/admins must remain intact.



Do not weaken tenant isolation.



\---



\## 2. Create the Edge Function



Create:



`supabase/functions/track-analytics/index.ts`



The function is the public ingestion endpoint.



It must:



\* accept analytics requests from the public website

\* validate HTTP method

\* handle CORS appropriately

\* validate request body

\* enforce a reasonable payload size

\* validate event type

\* resolve authoritative business/context server-side

\* verify the business is active and published

\* enforce abuse/rate limiting

\* insert the final event using the Supabase service role

\* return appropriate HTTP status codes



Do not return internal database errors or sensitive implementation details to anonymous clients.



\---



\# 3. DO NOT TRUST CLIENT TENANT IDs



The browser must not be trusted for:



\* `business\_id`

\* `qr\_code\_id`

\* `nfc\_tag\_id`

\* `touchpoint\_id`

\* arbitrary asset ownership

\* arbitrary tenant attribution



Resolve authoritative relationships server-side.



A malicious client must not be able to choose another business and generate analytics for it.



\---



\# 4. PUBLIC TOKEN / TOUCHPOINT RESOLUTION



Use the existing public touchpoint/public profile relationships.



For NFC/QR attribution, resolve the public token/touchpoint server-side.



Verify:



\* token exists

\* associated touchpoint exists

\* associated business exists

\* associated assets belong to that business

\* business is active

\* business is published



Do not rely solely on client-supplied `business\_id` or raw asset IDs.



\---



\# 5. LINK CLICK ANALYTICS



Preserve link-click analytics.



Where a link ID is supplied:



\* resolve the link server-side

\* verify the link belongs to the resolved business

\* only then associate the link with the analytics event



Do not allow a client to combine:



Business A + Link from Business B.



\---



\# 6. EVENT VALIDATION



Only accept explicitly supported event types.



Supported events:



\* PROFILE\_VIEW

\* NFC\_TAP

\* QR\_SCAN

\* WEBSITE\_CLICK

\* WHATSAPP\_CLICK

\* CALL\_CLICK

\* DIRECTIONS\_CLICK

\* REVIEW\_CLICK



Reject unknown event types.



Do not allow arbitrary event types to be inserted.



\---



\# 7. PAYLOAD LIMITS



Limit the request body to a reasonable size.



Reject excessively large metadata or unexpected payloads.



Do not allow anonymous users to use analytics ingestion as a general-purpose data storage endpoint.



Only accept fields required for legitimate analytics.



\---



\# 8. RATE LIMITING



Anonymous analytics must have reasonable abuse protection.



A per-IP/per-business time-window approach is acceptable.



The rate limiter must be examined for race conditions.



Prefer atomic database operations where appropriate.



Do not rely on client timestamps for rate limiting.



Do not treat the IP as a permanent visitor identity.



The implementation should account for shared networks/NAT where practical.



The rate limiter must not be writable by:



\* anon

\* authenticated users



Only the trusted server-side path should modify rate-limit state.



\---



\# 9. SERVICE ROLE SECURITY



The service-role key may be used only by the Edge Function server-side.



Verify that:



\* it is never imported into browser code

\* it is never exposed through VITE-prefixed client variables

\* it is never returned in API responses

\* it is never logged



Use environment variables for the secret.



Do not add secrets to source files.



\---



\# 10. CLIENT ANALYTICS FLOW



Update:



`src/lib/analytics.ts`



so it calls the Edge Function instead of directly inserting into:



`analytics\_events`



Update:



`src/pages/PublicProfilePage.tsx`



and:



`src/components/PublicLinkButton.tsx`



as required.



Preserve:



\* profile views

\* NFC attribution

\* QR attribution

\* link click attribution



The public user experience should not require authentication.



\---



\# 11. SCAN FLOW



Inspect:



`src/pages/ScanRedirectPage.tsx`



and the existing `/scan/:publicToken` flow.



Ensure the new analytics system does not break:



\* NFC scans

\* QR scans

\* source attribution

\* touchpoint attribution

\* redirects to `/t/:slug`



Do not unnecessarily redesign the scan flow.



\---



\# 12. EXISTING TENANT-INTEGRITY PROTECTIONS



Do not remove or weaken existing tenant-integrity triggers/functions.



Existing protections around:



\* touchpoints

\* links

\* QR codes

\* NFC tags

\* analytics assets



must remain effective.



\---



\# SECURITY REVIEW AFTER IMPLEMENTATION



After implementation, STOP modifying code and perform a READ-ONLY review of the actual result.



Verify each item as:



PASS / FAIL / NOT VERIFIED



\## Security checklist



1\. No anonymous direct INSERT remains on `analytics\_events`.



2\. Authenticated browser clients cannot bypass the Edge Function and directly insert analytics.



3\. The Edge Function does not trust client-supplied `business\_id`.



4\. The Edge Function does not trust arbitrary QR/NFC/touchpoint IDs.



5\. Touchpoint/public-token resolution cannot cross tenant boundaries.



6\. Link resolution cannot cross tenant boundaries.



7\. Only active + published businesses can receive public analytics.



8\. Unknown event types are rejected.



9\. Oversized payloads are rejected.



10\. Rate limiting is actually enforced.



11\. Rate limiting is safe under concurrent requests.



12\. Anonymous users cannot modify the rate-limit table.



13\. Existing tenant-integrity protections remain intact.



14\. Service-role credentials remain server-side.



15\. CORS is appropriately restricted for the application's public origin(s).



16\. HTTP methods are validated.



17\. Error responses do not leak sensitive tenant/database information.



18\. `PROFILE\_VIEW` still works.



19\. `NFC\_TAP` still works.



20\. `QR\_SCAN` still works.



21\. Link-click analytics still works.



22\. NFC/QR attribution still works.



23\. A malicious client cannot intentionally attribute an event to another tenant.



24\. The function does not become a general-purpose anonymous database write endpoint.



25\. No unnecessary architecture changes were introduced.



\---



\# VALIDATION



After implementation run:



```powershell

npm run typecheck

```



Then:



```powershell

npm run build

```



Then run any relevant repository tests/checks available.



Also run:



```powershell

git status -sb

git diff --check

git diff --stat

```



Inspect the complete diff.



\---



\# BUILD FAILURE HANDLING



If `npm run build` fails with an environment-level Windows error such as:



`spawn EPERM`



do not falsely report it as a code failure.



Determine whether the failure occurs before application compilation.



Report it separately as an environment/tooling failure.



Do not weaken the implementation just to make the build pass.



\---



\# FINAL REPORT



At the end report:



\## Branch



Current branch.



\## Files changed



Every modified/added file.



\## Database changes



Every migration, policy, table, function, trigger, grant, or RLS change.



\## Edge Function



Explain its input, validation, context resolution, rate limiting and insertion path.



\## Security review



Report all 25 checklist items as:



PASS / FAIL / NOT VERIFIED



with concise evidence.



\## Tests



Report:



\* typecheck

\* build

\* relevant tests

\* git diff checks



\## Failures



Clearly separate:



\* code failures

\* environment failures

\* unverified production configuration



\## Remaining risks



List anything that still needs attention.



\---



\# STRICT RESTRICTIONS



DO NOT:



\* commit

\* push

\* modify unrelated features

\* implement HMAC

\* implement ingest tokens

\* add permanent analytics secrets

\* expose service-role credentials

\* restore direct anonymous analytics INSERT

\* weaken RLS

\* bypass tenant isolation

\* use `apply\_patch`

\* use Unix heredocs

\* guess schema relationships



When uncertain about existing schema behavior, inspect the repository first.



Do not silently change the approved design.



END OF STEP 01.



