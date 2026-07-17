# Limon

Limon turns a supported full or shortened Google Maps place link into a
persisted Spanish restaurant page. Production import uses a public Maps preview
as a degraded baseline and Apify enrichment when configured.

## Setup

1. Install dependencies with `bun install`.
2. Copy the four names from `.env.example` into `.env.local` and provide values.
3. Apply the checked-in migration with `bun run db:migrate`.
4. Start Next.js with `bun run dev`.
5. Submit a supported Google Maps place URL and advance the generation.

The current `compass/crawler-google-places` input and dataset contracts were
verified against the actor's published schema on 2026-07-16. A paid run is
bounded to one place, Spanish, three reviews, three images, a 40-second actor
timeout, a 45-second client timeout, and USD 0.50. Contacts, directories,
image-author and review-personal-data scraping, and competitor analysis are
disabled. The Apify token is sent only in the authorization header.

Live debugging is an explicitly paid path. Automated tests use representative
preview and Apify fixtures and never invoke the actor.

The replaceable public-preview adapter intentionally supports only a
Schema.org JSON-LD representation observed in a Maps place response:
one `application/ld+json` block with `name`, `@type`, `address.streetAddress`,
`address.addressLocality`, and `geo.latitude`/`geo.longitude`. The redacted
representative response in
`src/domain/generation/fixtures/google-maps-preview.html` locks that
undocumented contract down. Its header records the capture date and exact
redactions; the JSON-LD structure and field types remain unchanged. Additional,
missing, or malformed JSON-LD blocks and any other representation fail closed
and leave the paid adapter or sanitized failure path to handle the import.
`google-maps-current-preview.html` records a traceable 2026-07-16 response
shape that exposes only undocumented positional state, without a trustworthy
address/category tuple. It deliberately fails closed rather than guessing at
that state; this fixture makes current degraded-baseline behavior explicit.

The exact server-only environment contract is:

- `APIFY_PERSONAL_API_TOKEN`
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `AI_GATEWAY_API_KEY`

All four are validated together at the server boundary. No variable is prefixed
with `NEXT_PUBLIC_`.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Run the development server |
| `bun run build` | Create a production build |
| `bun run start` | Serve the production build |
| `bun run typecheck` | Run strict TypeScript checks |
| `bun run test` | Run deterministic fixture tests with network access disabled |
| `bun run lint` | Run Biome lint rules |
| `bun run format` | Format the repository |
| `bun run format:check` | Check formatting without writing |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations to Neon |
| `bun run db:studio` | Inspect the database with Drizzle Studio |

## Data Flow

The landing Server Action validates and normalizes supported Google Maps place
URLs, manually follows bounded short-link redirects, and atomically creates or
reuses a `restaurant_generations` row. The generation coordinator
claims that row with a fenced lease, asks the injected live provider for a
normalized restaurant, and checkpoints that paid result before media work. It
then copies up to three provider-ranked place photos through a server-only
boundary into Vercel Blob and publishes only successful retained Blob URLs with
available attribution. Photo downloads use a strict HTTPS Google media-host
allowlist, manually revalidate bounded redirects, accept only supported raster
types, and enforce timeout, declared-size, streamed-size, and concurrency
limits. Deterministic generation-scoped Blob paths make retries idempotent. An
individual or total photo failure does not prevent publication, and a retry
reuses the paid provider checkpoint. The restaurant route reads only the ready
row's stored JSON; it does not import or call a provider.

The page uses retained place photography for its dark hero and gallery when
available. Otherwise it renders the branded Limon abstract fallback. Reviews
render text and generated author initials only; reviewer avatars, profile
photos, and review-attached imagery are never normalized, retained, or
rendered. Automated media tests inject fake fetch and Blob writers and perform
no paid network or Blob calls.

The anonymous generation UUID is a non-enumerable capability: anyone holding a
generation URL may advance that record, while malformed identifiers are rejected
before they reach Postgres. This is intentional for the account-free tracer
bullet and must be revisited if generation URLs become discoverable.

Anonymous submissions are limited per UTC hour with one atomic Postgres upsert.
The requester address is converted to an HMAC key before persistence and is
never stored or returned. The HMAC key is derived with domain separation from
`DATABASE_URL`, so credential rotation also resets effective rate-limit buckets.
The deployed limiter trusts only Vercel's overwritten
`x-vercel-forwarded-for` header; other forwarding headers are ignored.

Automated tests exercise the coordinator through persisted state transitions
and rendered Spanish output. Test setup replaces global `fetch` with a function
that throws, so adding an accidental paid network call fails the suite.

### Live provider boundary

The preview adapter, paid adapter, normalization policy, and reconciliation
remain one internal module by design. A repository search after the issue #5
trust fixes finds provider-class references in production only in
`live-provider.ts` and the single composition root in `generation-service.ts`;
there is no independently consumed adapter contract. The 12 issue-branch
commits that touched the module all changed this same fail-closed import
boundary, while the normalized model and coordinator remain separate modules.
Splitting the 334-line implementation now would expose seams without an
independent change driver. Extract an adapter when a second production consumer
appears, or when one transport acquires an independently tested lifecycle or
release cadence; keep `LiveRestaurantProvider` as the reconciliation boundary.

## Limitations

- Published pages are immutable and excluded from indexing.
- Public source information may be incomplete or outdated and is not verified
  by the restaurant.
- Ownership, publication rights, privacy, retention, corrections, and takedown
  processes remain unresolved for production.
- Media checks are technical only. Limon does not perform semantic moderation
  or photo deduplication and cannot establish that a photo depicts the venue or
  is otherwise suitable.
- Photo consent, personal-image privacy, storage and retention policy,
  attribution sufficiency, licensing, and publication rights remain unresolved.
