# Issue 8 acceptance matrix

Model catalog evidence checked 2026-07-16: the official AI Gateway `/v1/models`
catalog includes `google/gemini-2.5-flash-lite` and describes multimodal input.

| Criterion | Implementation boundary | Happy-path evidence | Adversarial / malformed case | Focused check | Non-goal / decision |
| --- | --- | --- | --- | --- | --- |
| Candidate image identity and count | Menu processor accepts retained place photos only and caps candidates with a typed server constant | Retained Blob URLs become image parts | Extra photos, reviewer avatars, review imagery | Exact capped photo objects; review/avatar payload excluded | No OCR of reviews or provider hotlinks |
| No reviewer/review imagery | Normalized restaurant `photos` is the sole candidate source | Place photo is submitted | Review text/image-like fields never enter request | Request-spy assertion | No semantic person detection beyond upstream retained-photo policy |
| Timeout, retry, output, concurrency bounds | Typed attempt timeout/retry policy wraps injected executor; abort signal reaches AI SDK; output token constant and process-local semaphore bound work | Valid response within limits publishes | Delayed fake aborts twice, transient fake retries once, four fake executions contend | Deterministic executor tests plus request constants | No environment overrides |
| Schema variants and decimal strings | Zod output schema models sections/items/descriptions/prices/variants | Labeled item and variant prices parse | Numeric, exponent, negative, or over-precision amounts reject | Schema unit tests | No arithmetic inferred from prose |
| Visibly grounded anti-invention | Output carries source-image evidence tokens; validator requires item fields, each non-null price currency, and section names in supplied transcription/evidence | Exact source spelling survives | Invented item/price/currency/description/section rejects | Grounding unit tests | Model transcription is not cryptographic pixel grounding |
| Nullable/missing values | Description and labeled price are explicitly nullable | Missing description/price remains null | Omitted required shape or fabricated placeholder rejects | Schema tests | Never display “unknown” as menu text |
| PEN normalization | Every non-null item and variant currency must visibly occur as S/, S/. or PEN before normalization; amount stays decimal string | `S/ 12.50` renders as PEN | Missing, invented, dollar, or ambiguous currency rejects publication | Item and variant normalization tests | No currency conversion |
| Empty/non-menu semantics | Explicit classification gates publication | Menu image yields sections | Empty, unreadable, food-only, people, interior, storefront yields no menu | Parameterized tests | No menu inferred from food photography |
| Independent persistence/safe failure | Separate menu status/data/error columns and repository operation; primary restaurant JSON and stable slug remain immutable | Menu metadata publishes after restaurant ready | AI/database menu write failure leaves primary ready and unchanged | Repository/coordinator tests plus documented invariant | Menu metadata is the sole narrow post-publication enrichment and is not part of generation lease success |
| Primary readiness under every AI outcome | Primary publish completes before best-effort menu call | Ready slug returned with menu | Failure/timeout/invalid/no-menu still returns ready | Coordinator matrix test | No user-facing retry gate for menu |
| Menu/no-menu rendering | Restaurant page conditionally renders persisted menu; the actual menu grid joins the repository `800px` one-column rule | Responsive sections, details, referential label and warning | Null/failed menu emits no section; mobile CSS regression is source-asserted | Server render and deterministic CSS tests | No editor or verification badge |
| External image processing documentation | README data flow and limitations | Documents Gateway image transfer | Calls out no human review, fallibility, unresolved rights | Documentation grep/review | No legal conclusion |
| Migration compatibility | Nullable additive columns with defaults where needed; stored parser defaults menu absent | New row stores menu state | Legacy row/JSON without menu still renders | DB contract and legacy parser tests | No backfill AI calls |
| Strict no-paid-call tests | Executor, Blob, and repositories are injected/faked; global fetch remains blocked | Full suite runs locally | Any accidental network call throws | Test setup plus request spies | Live smoke test is manual and excluded |

## Commit milestones

1. `docs(menu)`: record acceptance, official model evidence, and implementation decisions.
2. `feat(menu)`: add the bounded structured model boundary and its deterministic tests.
3. `feat(menu)`: add additive independent persistence and best-effort post-publication orchestration with tests.
4. `feat(menu)`: render referential menus and document image processing, fallibility, and rights with tests.
5. `fix(menu)` / `test(menu)`: apply coherent self-review findings and close matrix gaps.
