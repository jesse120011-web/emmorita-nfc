\# EmmOrita NFC — Production Architecture, Security \& Scalability Audit



\## 1. PURPOSE



This document is the authoritative instruction set for a READ-ONLY audit of the EmmOrita NFC repository.



The objective is to determine whether the current implementation is:



\* Secure

\* Correct

\* Properly multi-tenant

\* Production-ready

\* Resistant to common authorization attacks

\* Suitable for the initial pilot

\* Architecturally capable of scaling from approximately 30 businesses toward approximately 4,500 businesses



The audit MUST inspect the actual repository, source code, database migrations, Supabase configuration, RLS policies, server functions, routes, and deployment configuration.



Do not rely on assumptions.



Do not invent missing implementation details.



If something cannot be verified, explicitly mark it:



`NOT VERIFIED`



\---



\# 2. ABSOLUTE AUDIT RULE: READ ONLY



During this audit:



\* DO NOT modify source files.

\* DO NOT create application/source files.

\* DO NOT delete files.

\* DO NOT install packages.

\* DO NOT modify package.json.

\* DO NOT modify migrations.

\* DO NOT modify Supabase policies.

\* DO NOT modify database state.

\* DO NOT change environment variables.

\* DO NOT commit.

\* DO NOT push.

\* DO NOT automatically fix issues.

\* DO NOT refactor code.

\* DO NOT run destructive commands.



Inspection is allowed.



Safe read-only commands may be used to inspect:



\* Directory structure

\* Source files

\* SQL

\* Configuration

\* Package metadata

\* TypeScript

\* Build configuration

\* Git state

\* Existing tests

\* Existing migrations



If a command might modify project state, DO NOT run it.



The audit must finish with findings and a remediation plan, not code changes.



\---



\# 3. PRODUCT CONTEXT



EmmOrita NFC is a multi-tenant NFC and QR business network platform.



The intended high-level flow is:



Business / Tenant

→ NFC tag or QR code

→ Public business profile

→ Visitor interaction

→ Analytics

→ Authenticated business dashboard

→ Business management



The public profile uses a route similar to:



`/t/{slug}`



The system is intended to support:



\* Approximately 30 businesses in the initial pilot.

\* Hundreds of businesses during growth.

\* Approximately 4,500 retained businesses as a major target.

\* Kenya as the initial market.

\* Future international expansion.



The platform must treat each business as an isolated tenant.



\---



\# 4. PRIMARY SECURITY OBJECTIVE



The most important security requirement is:



> Tenant A must never be able to access or manipulate Tenant B's private data by changing IDs, URLs, request bodies, query parameters, browser state, client-side code, or API requests.



Frontend restrictions are NOT considered sufficient security.



Authorization must ultimately be enforced at the server and/or database level.



\---



\# 5. FIRST STEP — UNDERSTAND THE REPOSITORY



Before making findings:



1\. Inspect the repository structure.

2\. Identify the application framework.

3\. Identify frontend and backend/server architecture.

4\. Identify Supabase integration.

5\. Identify authentication.

6\. Identify dashboard architecture.

7\. Identify public routes.

8\. Identify API/server functions.

9\. Identify database migrations.

10\. Identify RLS policies.

11\. Identify important tables.

12\. Identify environment-variable usage.

13\. Identify deployment configuration.

14\. Identify tests and validation commands.



Do not start by assuming the architecture.



Build an understanding from the actual code.



\---



\# 6. DATABASE AND SUPABASE AUDIT



Inspect all relevant:



\* SQL migrations

\* Tables

\* Views

\* Functions

\* Triggers

\* Foreign keys

\* Unique constraints

\* Check constraints

\* Indexes

\* RLS policies

\* Grants

\* Supabase configuration

\* Seed files



For every important table determine:



1\. What does the table represent?

2\. Is it tenant-owned?

3\. How is tenant ownership represented?

4\. Is tenant ownership enforced by a foreign key?

5\. Is RLS enabled?

6\. What can anonymous users do?

7\. What can authenticated users do?

8\. What can staff/admin users do?

9\. Can one tenant access another tenant's rows?

10\. Can a user insert a row belonging to another tenant?

11\. Can a user change a row's tenant ownership?

12\. Can a user delete another tenant's data?

13\. Can service-role operations bypass expected authorization?



Pay particular attention to:



\* Incorrect `USING` policies.

\* Incorrect `WITH CHECK` policies.

\* Policies that authenticate but do not authorize.

\* Client-supplied tenant IDs.

\* Client-supplied business IDs.

\* Client-supplied membership IDs.

\* SECURITY DEFINER functions.

\* Unsafe `search\_path`.

\* Functions that bypass RLS.

\* Public grants.

\* Views exposing private data.

\* Cross-tenant joins.



\---



\# 7. AUTHENTICATION VS AUTHORIZATION



Determine exactly how the system answers:



\### Authentication



"Who is this user?"



\### Authorization



"What is this user allowed to access or change?"



Inspect:



\* Login

\* Session handling

\* User identity

\* Memberships

\* Tenant selection

\* Roles

\* Staff/admin permissions

\* Server-side checks

\* Database-side checks



A frontend role check must never be treated as sufficient authorization.



Determine whether a malicious authenticated user could:



\* Change their tenant ID.

\* Change their business ID.

\* Change their membership ID.

\* Select another tenant.

\* Call a server function directly.

\* Modify request bodies.

\* Escalate privileges.

\* Modify another tenant's data.

\* Invite unauthorized users.

\* Change their own role.



\---



\# 8. MULTI-TENANT ISOLATION



Trace the complete authorization path:



User

→ Authentication

→ Membership

→ Business/Tenant

→ Server/API

→ Database

→ Returned data



Identify exactly where tenant identity is established.



Look for:



\* `tenant\_id`

\* `business\_id`

\* `membership\_id`

\* `user\_id`

\* role fields

\* URL identifiers

\* query parameters

\* request bodies



Test conceptually for IDOR scenarios.



Examples:



```text

/t/{another-business-slug}

```



or:



```text

?business\_id=OTHER\_BUSINESS\_ID

```



or changing:



```text

tenant\_id

business\_id

membership\_id

user\_id

```



Determine whether the attack succeeds and exactly which security boundary prevents it.



\---



\# 9. PUBLIC NFC / QR SYSTEM



Inspect:



\* NFC URL generation

\* QR URL generation

\* Business slugs

\* Public profile routes

\* Public profile queries

\* Public business data

\* Business activation/deactivation

\* Profile visibility



Determine:



\* Whether slugs are unique.

\* Whether slugs expose internal IDs.

\* Whether IDs are enumerable.

\* Whether inactive businesses remain accessible.

\* Whether unpublished businesses are exposed.

\* Whether private fields leak through public queries.

\* Whether one business can manipulate another business's NFC/QR configuration.

\* Whether public routes can be abused for enumeration.



Public pages must expose only intentionally public information.



\---



\# 10. ANALYTICS



Inspect all analytics/event collection.



Determine:



\* What events are recorded.

\* How an event identifies a business.

\* Whether attribution is trusted from the client.

\* Whether attribution is derived server-side.

\* Whether visitors can submit events for another tenant.

\* Whether duplicate events are possible.

\* Whether events can be replayed.

\* Whether timestamps can be manipulated.

\* Whether analytics can be flooded.

\* Whether analytics queries are tenant-isolated.



Check for:



\* Cross-tenant analytics leakage.

\* Fake attribution.

\* Duplicate counting.

\* Race conditions.

\* Unbounded event insertion.

\* Missing indexes.

\* Expensive aggregation queries.



\---



\# 11. API AND SERVER FUNCTIONS



Inspect every relevant:



\* API route

\* Server function

\* Server action

\* Database function

\* Dashboard data loader

\* Mutation

\* Administrative operation



For each sensitive operation determine:



1\. Is authentication required?

2\. Is authorization required?

3\. Where is authorization enforced?

4\. Is input validated?

5\. Are IDs trusted from the client?

6\. Can the function be called directly?

7\. Can parameters be manipulated?

8\. Can another tenant be accessed?

9\. Are sensitive errors exposed?

10\. Is service-role access used?



Pay special attention to operations involving:



\* Businesses

\* Memberships

\* Roles

\* Profiles

\* NFC

\* QR

\* Analytics

\* Settings

\* User management

\* Administrative functions



\---



\# 12. INPUT VALIDATION



Inspect runtime validation.



Look for:



\* Zod

\* Schema validation

\* Database constraints

\* UUID validation

\* Slug validation

\* URL validation

\* Email validation

\* Role validation

\* Pagination validation

\* Sort validation

\* Filtering validation

\* Date validation

\* Numeric validation

\* Analytics payload validation



Remember:



TypeScript types do not validate malicious runtime input.



Determine whether malformed or malicious data can reach sensitive operations.



\---



\# 13. SECRETS AND ENVIRONMENT VARIABLES



Search for environment-variable usage and determine whether variables are:



\* Public/browser-safe

\* Server-only

\* Build-time

\* Runtime



Pay special attention to:



\* `VITE\_\*`

\* `PUBLIC\_\*`

\* Supabase URL

\* Supabase anon key

\* Supabase service-role key

\* Third-party API keys

\* Tokens

\* Credentials



Never print actual secret values in the audit.



Determine whether any server secret could reach browser code.



The Supabase service-role key must never be exposed to client-side code.



\---



\# 14. CLIENT / SERVER BOUNDARY



Inspect imports and execution paths.



Look for:



\* Server-only modules imported by client code.

\* Secrets imported into client bundles.

\* Database operations performed directly by unsafe browser code.

\* Server functions without authorization.

\* Client-side authorization being treated as security.

\* Sensitive logic implemented only in the browser.



Trace important operations:



UI

→ Client

→ Server

→ Database



\---



\# 15. RACE CONDITIONS AND DATA INTEGRITY



Look for:



\* Duplicate creation.

\* Concurrent updates.

\* Duplicate analytics.

\* Duplicate memberships.

\* Duplicate invitations.

\* Slug collisions.

\* Tenant creation races.

\* Read-then-write authorization gaps.

\* TOCTOU vulnerabilities.

\* Concurrent role changes.



Determine where database constraints or atomic operations are required.



\---



\# 16. DATABASE INTEGRITY



Review:



\* Foreign keys

\* Cascading behavior

\* Unique constraints

\* NOT NULL constraints

\* Check constraints

\* Indexes

\* UUIDs

\* Timestamp handling

\* Tenant ownership relationships



Identify states that should be impossible but the database currently allows.



\---



\# 17. SCALABILITY



Evaluate the architecture at:



\### 30 businesses



Initial pilot.



\### 500 businesses



Early growth.



\### 1,000 businesses



Significant platform usage.



\### 4,500 businesses



Major target.



Consider:



\* Query complexity

\* RLS performance

\* Analytics growth

\* Missing indexes

\* N+1 queries

\* Unbounded queries

\* Dashboard queries

\* Public traffic

\* Database load

\* Serverless execution

\* Connection behavior

\* Caching

\* Rate limiting



Do not invent benchmark numbers.



Base conclusions on actual implementation.



\---



\# 18. TYPESCRIPT / BUILD / DEPLOYMENT



Inspect:



\* `package.json`

\* TypeScript configuration

\* Vite configuration

\* Build scripts

\* Vercel configuration

\* Supabase configuration

\* Environment-variable references



Where safely possible, inspect actual results of:



\* Type checking

\* Build

\* Lint

\* Tests



Do not modify the repository to make these commands pass.



Record existing failures accurately.



\---



\# 19. VERCEL / SUPABASE PRODUCTION REVIEW



Evaluate:



\* Production environment assumptions.

\* Preview environment assumptions.

\* Environment-variable separation.

\* Runtime compatibility.

\* Supabase production configuration.

\* Migration deployment process.

\* Error handling.

\* Logging.

\* Observability.

\* Rate limiting.

\* Backup/recovery considerations.



Do not claim something is verified unless repository evidence supports it.



\---



\# 20. THREAT MODEL



Explicitly evaluate:



\## A. Cross-tenant read



Can Tenant A read Tenant B's private data?



\## B. Cross-tenant write



Can Tenant A modify Tenant B's data?



\## C. Cross-tenant delete



Can Tenant A delete Tenant B's data?



\## D. Tenant impersonation



Can Tenant A operate as Tenant B?



\## E. Role escalation



Can a normal member become admin/staff?



\## F. IDOR



Can changing an identifier expose another resource?



\## G. Public data leakage



Can unauthenticated users access private data?



\## H. Analytics poisoning



Can users create fraudulent events for another business?



\## I. Secret exposure



Can browser code obtain server credentials?



\## J. Direct API abuse



Can the backend be abused by bypassing the UI?



\## K. Race-condition abuse



Can concurrent requests create unauthorized state?



\## L. Enumeration



Can attackers enumerate businesses, IDs, memberships, or private resources?



\---



\# 21. EVIDENCE STANDARD



Every actual finding must contain:



\* Severity

\* Finding title

\* Exact file path

\* Relevant function/table/policy/component

\* What the implementation currently does

\* Why it matters

\* Attack/failure scenario

\* Recommended remediation

\* Correct security boundary for the fix



Do not report generic advice as a vulnerability.



If something is secure, briefly explain why.



If something cannot be verified:



`NOT VERIFIED`



\---



\# 22. SEVERITY



\## CRITICAL



Potential for:



\* Cross-tenant private data exposure

\* Privilege escalation

\* Complete tenant compromise

\* Server credential exposure

\* Destructive unauthorized access



\## HIGH



Significant security, integrity, or production failure requiring attention before serious deployment.



\## MEDIUM



Meaningful security, correctness, maintainability, or scalability weakness.



\## LOW



Minor hardening or future risk.



\## INFO



Observation or improvement that is not currently a vulnerability.



\---



\# 23. REQUIRED OUTPUT



Produce the final audit using this structure.



\# Executive Summary



Explain:



\* Actual architecture discovered.

\* Major strengths.

\* Major risks.

\* Current pilot readiness based on evidence.

\* Important uncertainty.



Do NOT provide a numeric score or ranking.



\# Repository Architecture



Describe the actual architecture.



\# Critical Findings



For every finding:



\* Severity

\* Evidence

\* Impact

\* Attack/failure scenario

\* Recommended fix



\# High Findings



Same structure.



\# Medium Findings



Same structure.



\# Low / Informational Findings



Same structure.



\# Tenant Isolation Matrix



Use:



| Resource | Read | Insert | Update | Delete | Evidence |

| -------- | ---- | ------ | ------ | ------ | -------- |



\# RLS Review



List important tables and policies.



\# Authentication / Authorization Review



Explain the actual identity and permission model.



\# NFC / QR Review



Explain the public identifier and profile security.



\# Analytics Review



Explain attribution, integrity, duplication and scale.



\# API / Server Function Review



List important sensitive operations and authorization status.



\# Secrets Review



Identify public vs server-only variables without exposing secret values.



\# Database Integrity Review



List important constraints, indexes, functions and triggers.



\# Scale Review



Discuss 30 → 500 → 1,000 → 4,500 businesses.



\# TypeScript / Build / Deployment Results



Report actual results.



\# Recommended Remediation Plan



Organize fixes into:



\## Phase 1 — Must Fix Before Pilot



Only genuinely blocking issues.



\## Phase 2 — Production Hardening



Important issues before broader deployment.



\## Phase 3 — Scale Preparation



Changes that become important as usage grows.



\## Phase 4 — Future Enhancements



Non-blocking improvements.



\---



\# 24. FINAL CHECKLIST



Finish with:



\* \[ ] Repository architecture inspected

\* \[ ] Database schema inspected

\* \[ ] RLS inspected

\* \[ ] Authentication inspected

\* \[ ] Authorization inspected

\* \[ ] Tenant isolation inspected

\* \[ ] IDOR paths inspected

\* \[ ] NFC/QR system inspected

\* \[ ] Public profiles inspected

\* \[ ] Analytics inspected

\* \[ ] API/server functions inspected

\* \[ ] Input validation inspected

\* \[ ] Secrets inspected

\* \[ ] Client/server boundary inspected

\* \[ ] Race conditions inspected

\* \[ ] Database constraints inspected

\* \[ ] Indexes inspected

\* \[ ] TypeScript inspected

\* \[ ] Build inspected

\* \[ ] Deployment configuration inspected

\* \[ ] Scale risks inspected

\* \[ ] Remediation plan produced



\---



\# 25. FINAL INSTRUCTION



Do not modify this repository during the audit.



Do not stop after finding only a few issues.



Inspect the complete relevant architecture.



Follow sensitive data from the browser through the server to the database.



Follow tenant identity from authentication through authorization to the database.



Never assume frontend checks provide security.



Never assume RLS is correct merely because RLS exists.



Never assume server-side code is secure merely because it runs on the server.



Use actual repository evidence.



Where evidence is unavailable, write:



`NOT VERIFIED`



The purpose of this audit is to establish an accurate engineering baseline before any implementation changes are made.



