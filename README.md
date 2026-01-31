# Evening Scroll (feed-ai)

Personal daily digest app that fetches news, jobs, and updates from 26 configured RSS/API sources, uses AI to curate and summarize into 8-10 important items, and displays them in a TikTok-style scrollable feed.

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
              │  26 sources │       │   AI APIs     │
              └─────────────┘       └──────────────┘
```

**Monorepo structure:**

```
worker/          Cloudflare Worker (API + cron trigger)
web/             Vue 3 frontend (Cloudflare Pages)
lefthook.yml     Git hooks config
```

## Dev Setup

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
# Root (git hooks)
npm install

# Worker
cd worker && npm install

# Web
cd web && npm install
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

The worker uses Cloudflare D1 (SQLite). Schema lives in `worker/schema.sql`. Migrations are in `worker/migrations/`.

Apply migrations locally:

```bash
cd worker
npx wrangler d1 migrations apply feed-ai --local
```

Apply to production:

```bash
cd worker
npx wrangler d1 migrations apply feed-ai --remote
```

### Available commands

| Task        | Worker              | Web               |
| ----------- | ------------------- | ----------------- |
| Dev server  | `npm run dev`       | `npm run dev`     |
| Build       | N/A                 | `npm run build`   |
| Lint & fix  | `npm run lint`      | `npm run lint`    |
| Format      | `npm run format`    | `npm run format`  |
| Test        | `npm test`          | `npm test`        |
| Deploy      | `npm run deploy`    | N/A (CI only)     |

## Data Sources

26 sources across 3 categories, configured in `worker/src/sources.ts`:

| Category | Count | Types | Examples |
| -------- | ----- | ----- | -------- |
| AI       | 5     | RSS, HN, Reddit | Anthropic News, OpenAI News, HN AI, r/MachineLearning, r/LocalLLaMA |
| Dev      | 17    | RSS, Reddit, HN, GitHub Atom, Bluesky | Vue/Vite/Nuxt releases, Laravel News, Ruby Weekly, web.dev, JS Weekly |
| Jobs     | 4     | RSS, JSON API | VueJobs, Remotive, We Work Remotely, Jobicy |

Source types are all fetched as XML feeds except `api` type (Jobicy) which returns JSON. The fetcher (`worker/src/services/fetcher.ts`) handles:

- RSS 2.0 and Atom feeds via `fast-xml-parser`
- JSON API responses (Jobicy format)
- HTML stripping and entity decoding from content
- 20-item cap per source
- 48-hour freshness filter (items older than 48h are dropped)

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
1. Fetch all 26 sources in parallel
2. Filter to items from last 48 hours
3. Record source health (success/failure tracking)
4. Deduplicate against last 7 days of digests (by URL and title)
5. Cap at 3 items per source
6. Split into jobs vs news items
7. Send each group to AI for curation
8. Validate, filter, and apply category limits
9. Save digest + items to D1
```

**Category limits** (max items per category in final digest):
- AI: 10
- Dev: 15
- Jobs: 10

## AI Usage

The summarizer (`worker/src/services/summarizer.ts`) supports two providers with automatic fallback:

1. **Gemini 2.0 Flash** (primary) — called via REST API
2. **Claude Haiku 4.5** (fallback) — called via Anthropic SDK

**Fallback logic:** If Gemini fails (rate limit, server error, empty response), the system automatically falls back to Claude. If only one API key is configured, that provider is used directly.

The AI receives items grouped by source with a prompt tailored to the digest type:
- **News prompt**: Curate for a senior engineer interested in AI, Vue.js, frontend. Select across sources, deduplicate stories.
- **Jobs prompt**: Filter for remote UK-accessible roles, senior level, Vue/TS/Laravel/AI stack, GBP 75k+.

The AI returns a JSON array. The parser handles:
- Markdown fence stripping (```` ```json ``` ````)
- Truncated JSON recovery (finds last complete object)
- Validation of required fields and item_index bounds
- Category limit enforcement

All AI calls are tracked in the `ai_usage` table with tokens, latency, provider, fallback status, and errors.

## API Endpoints

All endpoints served by Hono router in `worker/src/index.ts`.

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

## Database Schema

D1 database with 7 tables (see `worker/schema.sql`):

- **digests** — one row per day (`digest-2026-01-31`)
- **items** — digest items with category, summary, source info, position
- **sources** — source configuration (unused at runtime, config is in code)
- **raw_items** — raw fetched items for debugging/reprocessing
- **source_health** — tracks last success/error per source, consecutive failures
- **ai_usage** — tokens, latency, provider, fallback status per AI call
- **error_logs** — structured error/warn/info logs with category and optional details JSON

## Environment Variables

### Worker (Cloudflare secrets)

Set via `wrangler secret put <NAME>` or Cloudflare dashboard:

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

Both packages use Vitest. The worker tests run inside the Cloudflare workerd runtime via `@cloudflare/vitest-pool-workers` with a real in-memory D1 database — no mocks for internal services.

```bash
# Run all worker tests
cd worker && npm test

# Run all web tests
cd web && npm test
```

**Worker tests** (`worker/src/__tests__/`):
- `fetcher.test.ts` — RSS/Atom/JSON parsing, error handling, edge cases
- `summarizer.test.ts` — AI provider calls, fallback, JSON parsing, validation
- `pipeline.test.ts` — deduplication, per-source capping, jobs/news splitting
- `logger.test.ts` — D1 logging, AI usage recording, error resilience
- `index.test.ts` — API route tests (auth, digest CRUD, health)

External HTTP calls (AI APIs, RSS feeds) are intercepted via `fetchMock` from `cloudflare:test`. Test factories use [fishery](https://github.com/thoughtbot/fishery).

**Web tests** (`web/src/__tests__/`):
- Component and composable tests

## CI/CD

### CI (`.github/workflows/ci.yml`)

Runs on push to `main` and all PRs. Two parallel jobs:

**Worker job:** `npm ci` → ESLint → Prettier check → Vitest
**Web job:** `npm ci` → ESLint → Prettier check → Vitest → `vue-tsc --noEmit`

### Deploy (`.github/workflows/deploy.yml`)

Runs on push to `main` only. Two parallel jobs:

**Worker:** `wrangler deploy` (requires `CLOUDFLARE_API_TOKEN` secret)
**Web:** `vue-tsc && vite build` → `wrangler pages deploy dist` (requires `CLOUDFLARE_API_TOKEN` secret + `VITE_API_BASE` variable)

### Git Hooks (lefthook)

Pre-commit hooks run ESLint and Prettier on staged files for both packages. Configured in `lefthook.yml`, installed via root `package.json` dev dependency.

```bash
# Install hooks after cloning
npm install
npx lefthook install
```

## Frontend

Vue 3 SPA with Composition API (`<script setup lang="ts">`), built with Vite, styled with Tailwind CSS 4.

Key components:
- **DigestFeed** — vertical snap-scroll container (Swiper.js)
- **DigestCard** — individual item card with category, title, summary, source
- **DateHeader** — date display with item count
- **EmptyState** — shown when no digest exists for today

Navigation: swipe vertically between items, swipe horizontally between days. State managed via `useDigest` composable.
