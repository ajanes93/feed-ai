# Evening Scroll (feed-ai)

Personal daily digest app that fetches news, jobs, and updates from configured RSS/API sources, uses AI to curate and summarize into 8-10 important items, and displays them in a scrollable feed.

**Stack:** Cloudflare Workers + D1 + Pages | Vue 3 + TypeScript + Tailwind CSS 4

## Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Vue 3 SPA   │────▶│  Cloudflare Worker    │────▶│  D1 Database │
│  (CF Pages)  │     │  (Hono API + Cron)    │     │  (SQLite)    │
└──────────────┘     └──────────────────────-┘     └──────────────┘
                            │         │
                     ┌──────┘         └──────┐
                     ▼                       ▼
              ┌─────────────┐       ┌──────────────┐
              │ RSS/Atom/API│       │ Gemini/Claude │
              │   sources   │       │   AI APIs     │
              └─────────────┘       └──────────────┘
```

## Packages

This is an npm workspaces monorepo with 4 packages:

| Package | Description | README |
| ------- | ----------- | ------ |
| [`shared/`](shared/) | Shared types, test factories, and utilities | [shared/README.md](shared/README.md) |
| [`worker/`](worker/) | Cloudflare Worker — API, cron, fetching, AI summarization | [worker/README.md](worker/README.md) |
| [`web/`](web/) | Vue 3 frontend — scrollable digest feed | [web/README.md](web/README.md) |
| [`mcp/`](mcp/) | MCP server — Claude Code tools for production data access | [mcp/README.md](mcp/README.md) |

## Dev Setup

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install            # All workspace deps + lefthook commit hooks
npm run build -w mcp   # Build MCP server (for Claude Code tools)
```

### Run locally

```bash
# Worker (serves API on :8787)
cd worker && npm run dev

# Web (serves frontend on :5173)
cd web && npm run dev
```

The web dev server connects to `http://localhost:8787` by default (configurable via `VITE_API_BASE`).

### Database

The worker uses Cloudflare D1 (SQLite). Migrations are in `worker/migrations/`.

```bash
# Apply locally
cd worker && npx wrangler d1 migrations apply feed-ai --local

# Apply to production
cd worker && npx wrangler d1 migrations apply feed-ai --remote
```

### Commands

All commands can be run from the root (applies to all workspaces):

```bash
npm run lint           # Lint & fix all packages
npm run lint:check     # Lint check (CI mode)
npm run format         # Format all packages
npm run format:check   # Format check (CI mode)
npm test               # Test all packages
npm run build          # Build all packages
```

Or from individual package directories.

## Data Sources

Sources are split across 3 categories:

| Category | Types | Examples |
| -------- | ----- | -------- |
| AI       | RSS, HN, Reddit | Anthropic News, OpenAI News, HN AI, r/MachineLearning, r/LocalLLaMA |
| Dev      | RSS, Reddit, HN, GitHub Atom, Bluesky | Vue/Vite/Nuxt releases, Laravel News, Ruby Weekly, web.dev, JS Weekly |
| Jobs     | RSS, JSON API | VueJobs, Remotive, We Work Remotely, Jobicy |

### Adding a source

Add an entry to the `sources` array in `worker/src/sources.ts`:

```ts
{
  id: "my-source",
  name: "My Source",
  type: "rss",           // rss | reddit | hn | github | bluesky | api
  url: "https://example.com/feed.xml",
  category: "dev",       // ai | dev | jobs
}
```

## Digest Generation Pipeline

Triggered daily at 6pm UTC via cron, or manually via `POST /api/generate`.

```
1. Fetch all sources in parallel
2. Filter to items from last 48 hours
3. Record source health (success/failure tracking)
4. Deduplicate against last 7 days of digests (by URL and title)
5. Cap at 3 items per source
6. Split into jobs vs news items
7. Send each group to AI for curation
8. Validate, filter, and apply category limits
9. Save digest + items to D1
```

## API Endpoints

### Public

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/today` | Redirects to today's digest |
| GET | `/api/digest/:date` | Get digest for a specific date |
| GET | `/api/digests` | List available dates (last 30) |
| GET | `/api/health` | Source health status |

### Admin (requires `Authorization: Bearer <ADMIN_KEY>`)

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/generate` | Trigger digest generation |
| POST | `/api/rebuild` | Delete and regenerate today's digest |
| GET | `/api/admin/dashboard` | AI usage, errors, source health summary |

## Environment Variables

### Worker (Cloudflare secrets)

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `ADMIN_KEY` | Yes | Bearer token for admin endpoints |
| `GEMINI_API_KEY` | One of these | Google Gemini API key |
| `ANTHROPIC_API_KEY` | One of these | Anthropic API key |

### Web (build-time)

| Variable | Description |
| -------- | ----------- |
| `VITE_API_BASE` | Worker API URL (set in GitHub Actions vars) |

## Testing

All packages use Vitest. Run from root with `npm test`.

- **Worker**: Tests run inside Cloudflare workerd runtime via `@cloudflare/vitest-pool-workers` with a real in-memory D1 database. External HTTP calls intercepted via `fetchMock`. Test factories use [fishery](https://github.com/thoughtbot/fishery).
- **Web**: Component and composable tests with Vue Test Utils.
- **MCP**: In-process tests using `InMemoryTransport` with mocked `fetch`.

## CI/CD

### CI (`.github/workflows/ci.yml`)

Runs on push to `main` and all PRs:

- **lint-format**: ESLint + Prettier check across all packages
- **worker-tests**: Vitest in workerd runtime
- **web-tests**: Vitest + `vue-tsc --noEmit`
- **mcp-build-test**: TypeScript build + Vitest
- **e2e**: Playwright browser tests

### Deploy (`.github/workflows/deploy.yml`)

Runs on push to `main`:

- **Worker**: `wrangler deploy`
- **Web**: `vue-tsc && vite build` → `wrangler pages deploy`

### Git Hooks (lefthook)

Pre-commit hooks run ESLint and Prettier on staged files for all packages.
