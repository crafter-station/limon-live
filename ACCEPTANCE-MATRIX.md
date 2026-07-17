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
| Visual/accessibility | existing UI and browser walkthrough | required states at mobile/desktop, keyboard/status/reduced motion | sparse/no-menu/failure/delay states | agent-browser evidence outside repository | no redesign in this routing issue |
| Authorized live smoke | existing code-defined provider/media/AI budgets | one Las Palmeras run only with all local credentials | absent credentials stop the live path without fabricated evidence | secret-name presence check, then bounded manual smoke | no deployment, DNS change, secret output, or repeated paid run |

## Commit Milestones

1. `feat(routing)`: installed proxy convention, canonical/discovery metadata, and request-level tests.
2. `docs(release)`: exact release and operational documentation plus finalized acceptance evidence.
3. Focused `fix` or `test` commits only if self-review finds a coherent defect.
