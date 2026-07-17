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
| Visual/accessibility | real `GenerationProgress` and `RestaurantSite` components in a credential-free fixture harness | marketing, generation, delayed, complete/sparse, and menu/no-menu states at mobile/desktop; keyboard focus, semantic status, and reduced motion | failure at mobile/desktop, including the database-backed bounded-smoke failure | inspected agent-browser captures listed below and full test suite | no redesign in this routing issue |
| Authorized live smoke | existing code-defined provider/media/AI budgets | one Las Palmeras submission created generation `fb59f360-6ded-4ef0-88d6-f6aecc3c7860` | the bounded first provider attempt failed safely before checkpointing; no manual retry was made | public flow plus sanitized persisted-record query | no deployment, DNS change, secret output, or repeated paid run |

## Commit Milestones

1. `feat(routing)`: installed proxy convention, canonical/discovery metadata, and request-level tests.
2. `docs(release)`: exact release and operational documentation plus finalized acceptance evidence.
3. Focused `fix` or `test` commits only if self-review finds a coherent defect.

## Visual Evidence

The credential-free harness at `/private/tmp/limon-issue9-visual-harness`
imports the production `GenerationProgress` and `RestaurantSite` components
and supplies in-memory props only. Every capture below was visually inspected
as the intended real component/state with no Next.js error overlay. The delayed
captures came from a webpack production build/start and the component's real
30-second timer, not copied markup, a shortened clock, or hot-reloaded state.

| State | Harness path | Desktop evidence | Mobile evidence |
| --- | --- | --- | --- |
| Marketing | repository `/` | `/private/tmp/limon-issue9-marketing-desktop.png` (1280x1593) | `/private/tmp/limon-issue9-marketing-mobile.png` (390x2815) |
| Generation in progress | `/?state=generation` | `/private/tmp/limon-issue9-visual-evidence/generation-desktop.png` (1440x1000) | `/private/tmp/limon-issue9-visual-evidence/generation-mobile.png` (390x844) |
| Delayed work | `/?state=delayed`, after the real 30-second threshold | `/private/tmp/limon-issue9-visual-evidence/delayed-desktop.png` (1440x1000) | `/private/tmp/limon-issue9-visual-evidence/delayed-mobile.png` (390x844) |
| Failure | `/?state=failure` | `/private/tmp/limon-issue9-visual-evidence/failure-desktop.png` (1440x1000) | `/private/tmp/limon-issue9-visual-evidence/failure-mobile.png` (390x844) |
| Complete restaurant | `/?state=complete` | `/private/tmp/limon-issue9-visual-evidence/complete-desktop.png` (1440x3100) | `/private/tmp/limon-issue9-visual-evidence/complete-mobile.png` (390x3021) |
| Sparse restaurant | `/?state=sparse` | `/private/tmp/limon-issue9-visual-evidence/sparse-desktop.png` (1440x2412) | `/private/tmp/limon-issue9-visual-evidence/sparse-mobile.png` (390x2267) |
| Referential menu | `/?state=menu` | `/private/tmp/limon-issue9-visual-evidence/menu-desktop.png` (1440x3819) | `/private/tmp/limon-issue9-visual-evidence/menu-mobile.png` (390x3614) |
| No menu | `/?state=no-menu` | `/private/tmp/limon-issue9-visual-evidence/no-menu-desktop.png` (1440x3100) | `/private/tmp/limon-issue9-visual-evidence/no-menu-mobile.png` (390x3021) |

Accessibility evidence uses the same real components. The generation snapshot
exposed a `status` containing the `Generation progress` labeled list. The
delayed production snapshot exposed a `status` containing "This is taking
longer than usual", `Resume`, and `Use another link`. The failure snapshot
exposed an `alert`, `Try again` button, and `Use another link`. From
`/?state=complete`, one keyboard `Tab` focused
`<a class="wordmark" href="/">Limon</a>`. Reduced-motion emulation returned
`true` for `matchMedia('(prefers-reduced-motion: reduce)').matches`; the
inspected captures are `/private/tmp/limon-issue9-marketing-reduced-motion.png`
and `/private/tmp/limon-issue9-visual-evidence/menu-mobile-reduced-motion.png`
(390x3614).

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
