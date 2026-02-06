# CLAUDE.md

Personal daily digest app — fetches RSS/news/jobs, uses AI to curate 8-10 items, displays in a scrollable feed.

**Stack:** Cloudflare Workers + D1 + Pages | Vue 3 + TypeScript + Tailwind CSS 4 | npm workspaces

## Commands

```bash
npm install                 # Install all deps + lefthook hooks (run first)
npm run build               # TypeScript check + production build (all packages)
npm run lint                # ESLint fix (all packages)
npm run lint:check          # ESLint check only
npm run format              # Prettier fix (all packages)
npm run format:check        # Prettier check only
npm test                    # Vitest (all packages)
cd web && npm run test:e2e  # Playwright e2e tests
```

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| shared | `shared/` | Types (`types.ts`), test factories (`factories.ts`), utilities |
| worker | `worker/src/` | Cloudflare Worker — Hono router, D1 database, cron digest pipeline |
| web | `web/src/` | Vue 3 SPA — Composition API, Vite, Swiper.js feed |
| mcp | `mcp/src/` | MCP server — production data queries + digest rebuild |

## Key Files

| File | What it does |
|------|-------------|
| `worker/src/index.ts` | Main router + digest build pipeline |
| `worker/src/sources.ts` | RSS source configuration |
| `worker/src/services/summarizer.ts` | AI integration (Gemini primary, Claude fallback) |
| `worker/src/services/comments.ts` | Reddit + HN comment fetching + AI summarization |
| `worker/src/services/fetcher.ts` | RSS/Reddit/GitHub/Bluesky fetching |
| `worker/schema.sql` | D1 database schema |
| `web/src/components/DigestCard.vue` | Individual digest item card |
| `web/src/composables/useDigest.ts` | Digest fetch + state management |
| `shared/types.ts` | Shared TypeScript interfaces (DigestItem, Digest) |

## Conventions

**Worker:** D1 prepared statements with `.bind()` for all queries. `env.DB.batch()` for atomic writes. `crypto.randomUUID()` for IDs. Env bindings typed via `Env` in `types.ts`.

**Vue:** `<script setup lang="ts">` exclusively. Props: `defineProps<T>()`. Emits: `defineEmits<T>()`. State: `ref()` / `reactive()`.

**Styling:** Tailwind CSS 4 utilities. Dark theme default (gray-900). No JS config — uses `@import "tailwindcss"` in CSS.

**Formatting:** Prettier handles all formatting. ESLint handles linting. Both run via lefthook pre-commit hooks. Never manually fix formatting — run `npm run lint && npm run format`.

## E2E Tests (Claude Code)

Playwright e2e tests are in `web/e2e/`. In Claude Code (web/mobile), browser downloads are blocked — symlink an existing installation:

```bash
ls ~/.cache/ms-playwright/                        # Check existing browser version
# Symlink from existing (e.g. 1194) to required (e.g. 1208):
mkdir -p ~/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64
ln -s ~/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell \
      ~/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
```

## Environment Variables

- `ADMIN_KEY` — Bearer token for admin endpoints (worker secret)
- `GEMINI_API_KEY` — Gemini API key, primary AI provider (worker secret)
- `ANTHROPIC_API_KEY` — Claude API key, fallback provider (worker secret)
- `VITE_API_BASE` — Worker API URL (frontend build-time, via GitHub Actions)

## Philosophy

> Clear is better than clever. Every line of code is a liability.

Keep it simple — this is a personal tool. Prefer explicit code over abstractions. Make it work, make it clear, make it fast (in that order).
