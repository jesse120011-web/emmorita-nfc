\# CODEX CURRENT TASK



The instructions below are the current task.



IMPORTANT:

\- Read this entire file before acting.

\- Follow the instructions exactly.

\- Do not invent missing requirements.

\- Do not modify unrelated functionality.

\- Do not commit or push unless explicitly instructed.

\- If the instructions say READ-ONLY, make no changes.

\- If something is unclear or cannot be verified, report it instead of guessing.



\--- BEGIN CURRENT TASK ---



STEP 2 — REVIEW SUBMISSION SECURITY AUDIT



Perform a READ-ONLY audit of the existing review submission flow.



Do NOT modify any files.

Do NOT create migrations.

Do NOT deploy anything.



The objective is to determine exactly how public/anonymous reviews currently enter the system and what must be hardened for production.



Inspect:



1\. The review database table/schema and all relevant migrations.

2\. All RLS policies on the review table.

3\. All client-side review submission code.

4\. Any server functions, RPCs, API routes, or Edge Functions involved.

5\. Whether anonymous users can directly INSERT reviews.

6\. Whether authenticated users can directly INSERT reviews.

7\. Whether the business\_id/tenant\_id is supplied by the browser and whether it is trusted.

8\. Whether the submitted review can be associated with a business the requester should not be able to target.

9\. Whether there is currently any rate limiting.

10\. Whether duplicate submissions are prevented.

11\. Whether the same IP/client can submit unlimited reviews.

12\. Whether payload size/content is validated server-side.

13\. Whether review status/moderation fields can be controlled by the client.

14\. Whether created\_at, business\_id, author/user identity, rating, and other authoritative fields can be forged.

15\. Whether review counts/aggregates can be manipulated through direct writes.

16\. Whether there are database constraints protecting rating ranges and required fields.

17\. Whether tenant isolation is preserved.

18\. Search the entire repository for every review INSERT/write path.



Also inspect whether the existing analytics hardening pattern can be reused without introducing unnecessary complexity.



Produce a report with:



\- Current architecture

\- Current security controls

\- PASS / FAIL / NOT VERIFIED for each relevant check

\- Exact files/functions/policies involved

\- Recommended production architecture

\- Smallest required remediation

\- Any migration(s) that would be required

\- Any Edge Function(s) that would be required

\- Any client changes that would be required



Do NOT implement the remediation yet.



Do NOT recommend HMACs, permanent client secrets, or browser-held service-role credentials unless you can demonstrate a concrete requirement for them.



Remember that the objective is production hardening for approximately 30 pilot businesses initially, with eventual scaling toward thousands of businesses.



\--- END CURRENT TASK ---

