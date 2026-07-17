# Issue #9 Acceptance Matrix

| Criterion | Implementation boundary | Happy-path evidence | Adversarial or malformed case | Focused check | Non-goal or decision |
| --- | --- | --- | --- | --- | --- |
| Host identity and apex | `src/proxy.ts` authority parsing | `limon.lat` passes through; `www` redirects with path/query | conflicting forwarded authority fails closed | proxy request tests | no DNS or deployment changes |
| Tenant hosts | first-level `*.limon.lat` classifier | valid tenant `/` rewrites to `/r/:slug` | malformed labels and nested hosts are rejected | proxy request tests | proxy performs no database reads |
| Canonical paths | tenant redirect/rewrite policy | tenant root is the production canonical | tenant non-root permanently redirects to root | proxy request tests | local and preview `/r/:slug` remain stable |
| Framework/static exclusions | static `config.matcher` | API, `_next`, image, metadata and assets bypass proxy | extension-bearing and nested paths bypass routing | `unstable_doesProxyMatch` tests | exclusions retain their normal 404/route behavior |
| Canonical/noindex | restaurant `generateMetadata`, generation metadata, robots/sitemap | canonical is `https://:slug.limon.lat/` | unknown restaurant still fails through normal not-found path | metadata and discovery tests | restaurant pages are intentionally undiscoverable |
| Exact environment | `src/server/env-schema.ts` and typed constants | exactly four secrets cross the environment boundary | missing/extra public values cannot enter parsed config | env schema test and repository search | limits/models/retries/domains are code, not env knobs |
| Deterministic automation | injected providers and global fetch guard | full suite uses fixtures/mocks | accidental network access throws | test suite and production build | no paid calls in automated checks |
| Release documentation | `README.md` | setup, architecture, routing and operations documented | unavailable providers have explicit fallback/limitations | documentation review | POC does not resolve legal ownership/rights |
| Visual/accessibility | existing UI and browser walkthrough | marketing at mobile/desktop, keyboard focus, semantic status, and reduced motion | database-backed live failure at mobile/desktop; deterministic tests cover delayed, sparse/complete, and menu/no-menu states | agent-browser evidence outside repository and full test suite | no redesign in this routing issue |
| Authorized live smoke | existing code-defined provider/media/AI budgets | one Las Palmeras submission created generation `fb59f360-6ded-4ef0-88d6-f6aecc3c7860` | the bounded first provider attempt failed safely before checkpointing; no manual retry was made | public flow plus sanitized persisted-record query | no deployment, DNS change, secret output, or repeated paid run |

## Commit Milestones

1. `feat(routing)`: installed proxy convention, canonical/discovery metadata, and request-level tests.
2. `docs(release)`: exact release and operational documentation plus finalized acceptance evidence.
3. Focused `fix` or `test` commits only if self-review finds a coherent defect.

## Live Evidence

The authorized 2026-07-17 Las Palmeras journey used the public form with the
four-key environment loaded directly from the original checkout. The target
Neon database was reachable but initially empty, so the checked-in migrations
were applied before the single provider-bearing submission. Generation
`fb59f360-6ded-4ef0-88d6-f6aecc3c7860` reached the application's failure UI
after its first bounded attempt. Its persisted sanitized outcome was `failed`,
attempt count `1`, provider checkpoint absent, publication absent, menu status
`pending`, and safe public error present. Consequently Blob retention, optional
AI handling, publication, equivalent duplicate reuse, and stored-data-only
repeat loads could not be evidenced. No retry, deployment, or DNS change was
performed.

New database-backed failure screenshots are preserved at
`/tmp/limon-issue9-live-failure-desktop.png` and
`/tmp/limon-issue9-live-failure-mobile.png`. The prior marketing desktop,
mobile, and reduced-motion screenshots remain unchanged. Deterministic tests
remain the evidence for delayed work, complete/sparse restaurant data, and
menu/no-menu rendering because reproducing those variants against the live
record would require paid rework or production-like data mutation.
