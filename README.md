# Limon

Limon turns a supported Google Maps fixture into a persisted Spanish restaurant
page. This first tracer bullet deliberately uses a local fixture provider: it
establishes the production database, provider, coordinator, and rendering seams
without making Google, Apify, Vercel Blob, or AI calls.

## Setup

1. Install dependencies with `bun install`.
2. Copy the four names from `.env.example` into `.env.local` and provide values.
3. Apply the checked-in migration with `bun run db:migrate`.
4. Start Next.js with `bun run dev`.
5. Submit the prefilled Las Palmeras URL, advance its generation, and open the
   resulting `/r/las-palmeras` page.

The exact server-only environment contract is:

- `APIFY_PERSONAL_API_TOKEN`
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `AI_GATEWAY_API_KEY`

Only `DATABASE_URL` is used by this fixture slice. All four are validated
together at the server boundary because later provider work must not expand or
leak the contract. No variable is prefixed with `NEXT_PUBLIC_`.

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

The landing Server Action normalizes the supported fixture URL and atomically
creates or reuses a `restaurant_generations` row. The generation coordinator
claims that row with a fenced lease, asks the injected fixture provider for a
normalized restaurant, checkpoints that data, then publishes the same data and
a stable slug. The restaurant route reads only the ready row's stored JSON; it
does not import or call a provider.

The anonymous generation UUID is a non-enumerable capability: anyone holding a
generation URL may advance that record, while malformed identifiers are rejected
before they reach Postgres. This is intentional for the account-free tracer
bullet and must be revisited if generation URLs become discoverable.

Automated tests exercise the coordinator through persisted state transitions
and rendered Spanish output. Test setup replaces global `fetch` with a function
that throws, so adding an accidental paid network call fails the suite.

## Fixture Limitations

- Only the documented Las Palmeras URL is accepted; general Maps URL resolution
  and live providers are later work.
- Published pages are immutable and excluded from indexing.
- Public source information may be incomplete or outdated and is not verified
  by the restaurant.
- Ownership, publication rights, privacy, retention, corrections, and takedown
  processes remain unresolved for production.
