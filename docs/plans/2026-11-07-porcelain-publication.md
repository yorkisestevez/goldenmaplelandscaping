# Porcelain publication release — 2026-11-07
Epic; Implement + Ship. Base 6c384f22362d608971e7e43e4a3770d3a1589d40; isolated blog-only branch.
User explicitly authorized drafting all 52, publishing one today and scheduling the rest. Earlier draft-only limit is superseded for this programme only.

## Scope Lock
1. Complete 52 distinct natural-voice articles, two audiences, evidence for claims, no invented stories/prices/credentials or unverified photos.
2. Publish first 2026-11-07 and verify live. Queue 51 Mondays 09:00 America/Toronto 2026-11-09 through 2027-10-25.
3. Materialize only due posts during builds; future bodies/routes absent from public assets. Idempotent compiler; malformed and duplicate queue fail closed; preserve existing posts/routes.
4. Use existing GitHub-to-Netlify path with current pinned site and env injection. DST and expiry handled. No new secrets or dependencies; only the two explicitly approved transitive security patches. Replace only current chat draft heartbeat after queue exists.
5. Tests/types/build/content checks, independent review, live probe pass. Homepage WIP and unrelated publishers remain unchanged.

## Parallel tasks
T1 [P] Weeks 03–26 manuscripts; only own week-NN.md files in output drafts. Acceptance 1.
T2 [P] Weeks 27–52 manuscripts; same contract and no shared files. Acceptance 1.
T3 Publication compiler/scheduler with tests first, in this worktree. Acceptance 2–5. Reuse BlogPostLayout and index/route conventions. Controller integrates and verifies.
T4 Independent review of all content/code; actual validation, release and live checks. Acceptance 1–5.
Worker brief: ../porcelain-author-brief.md. No worker external writes. Shared-calendar edits reserved to controller.

## Review focus
Timezone boundary/DST; malformed/duplicate queue; preserve existing route/index; prevent future article leakage; unsupported marketing or technical claims.

## Progress
Fetched main and isolated from homepage branch. Existing Netlify workflow on main pinned site 549b17bd-15af-42ee-8f0c-7fef576cf664. Existing dependencies reused by junction. Required engineering/ship skills read. Exact release design still being inspected.

## Integration ruling
The two already-reviewed porcelain enquiry files (LeadForm.tsx and Contact.tsx) are included because every article CTA uses service=porcelain and trade articles also use audience=trade. They preserve audience in the registered details field and existing acquisition attribution. Their diff is limited to porcelain option/preset, audience copy and fixed enquiry notes. No homepage hero, gallery or feature files are included. Final local browser payload tests will rerun for both paths.

## Security gate repair authorization
2026-11-07: npm audit --omit=dev reported existing DOMPurify 3.4.16 critical and source-map-js 1.2.1 high advisories. User explicitly approved DOMPurify3.4.17 and source-map-js1.2.2 and continuing publication. Only these two package-lock resolution records changed. Shared dependency junction removed (link only); fresh isolated npm ci started. Reaudit, build and integration verification required after installation.

## Final local evidence
52 manuscripts passed independent editorial review; publication compiler and scope passed independent code review. The approved two lockfile patches passed an independent scope review. Fresh isolated installation; production audit reports zero vulnerabilities. All 11 publisher tests, existing 91 blog-publisher tests, full lint/type checks and production build including postbuild passed. Desktop/mobile article and both intercepted enquiry paths passed with no live lead submitted; existing patio preset preserved. Public build scan confirms only week 1 is materialized and future 51 titles/slugs are absent. New compiler/workflow formatting passes. Generated audit and llms output are excluded; owned route/index blocks are committed empty. Remote CI, deployment, workflow activation and live readback remain the final publication checks.
