# feed-ai-worker

Cloudflare Worker that powers the feed-ai API. Handles RSS fetching, AI summarization, and digest storage.

## Key Files

| File | Description |
| ---- | ----------- |
| `src/index.ts` | Hono router + cron trigger entrypoint |
| `src/sources.ts` | RSS/API source configuration |
| `src/services/fetcher.ts` | Fetches RSS, Reddit, HN, GitHub, Bluesky feeds |
| `src/services/summarizer.ts` | AI curation via Gemini (primary) + Claude (fallback) |
| `src/services/logger.ts` | Structured logging to D1 |
| `schema.sql` | D1 database schema (7 tables) |

## Development

```bash
npm run dev       # Start local dev server on :8787
npm test          # Run tests (workerd runtime + in-memory D1)
npm run deploy    # Deploy to Cloudflare
```

## Environment Variables

Set via `wrangler secret put <NAME>`:

- `ADMIN_KEY` — Bearer token for admin endpoints
- `GEMINI_API_KEY` — Google Gemini API key (primary)
- `ANTHROPIC_API_KEY` — Anthropic API key (fallback)

## Testing

Tests run inside the Cloudflare workerd runtime via `@cloudflare/vitest-pool-workers` with a real in-memory D1 database. External HTTP calls are intercepted via `fetchMock` from `cloudflare:test`.
