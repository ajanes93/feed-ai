# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

feed-ai — a personal daily digest app that fetches news/jobs/updates from configured RSS sources, uses AI to curate and summarize into 8-10 important items, and displays them in a scrollable feed.

**Stack:** Cloudflare Workers + D1 + Pages (Vue 3 + TypeScript + Tailwind CSS 4)

## First-Time Setup

After cloning the repo, run these commands to set up the development environment:

```bash
npm install          # Install all workspace deps + lefthook commit hooks
```

The MCP server is deployed as a remote Cloudflare Worker. Add the worker URL to Claude.ai or Claude mobile MCP settings to access 7 tools for querying production data (digests, logs, sources, AI usage) and triggering digest rebuilds.

## Quick Reference Commands

Commands can be run from the root (applies to all workspaces) or from individual packages.

| Task             | Root (all packages)    | Per-package            |
| ---------------- | ---------------------- | ---------------------- |
| Install deps     | `npm install`          | N/A (use root)         |
| Build            | `npm run build`        | `npm run build`        |
| Lint & fix       | `npm run lint`         | `npm run lint`         |
| Lint (check)     | `npm run lint:check`   | `npm run lint:check`   |
| Format           | `npm run format`       | `npm run format`       |
| Format (check)   | `npm run format:check` | `npm run format:check` |
| Test             | `npm test`             | `npm test`             |
| Dev server       | N/A                    | `npm run dev` (worker/web) |
| Deploy worker    | N/A                    | `npm run deploy` (worker)  |

## Directory Structure

```
shared/                     # Shared types, factories, utilities
  types.ts                 # TypeScript types shared across packages
  factories.ts             # Test factories (fishery)
  utils.ts                 # Shared utility functions

worker/                     # Cloudflare Worker (API + Cron)
  src/
    index.ts               # Main worker entry (Hono router + cron)
    types.ts               # Worker-specific types
    sources.ts             # RSS source configuration
    services/
      fetcher.ts           # RSS/Reddit/GitHub/Bluesky fetching
      summarizer.ts        # AI integration (Gemini + Claude fallback)
      logger.ts            # Structured logging to D1
      hn-hiring.ts         # HN hiring thread parser
      bluesky.ts           # Bluesky feed fetcher
      scrape.ts            # HTML scraping utilities
      constants.ts         # Shared constants
  schema.sql               # D1 database schema
  wrangler.toml            # Cloudflare config

mcp/                        # MCP server (Cloudflare Worker)
  src/
    index.ts               # Worker entrypoint (McpAgent + fetch handler)
    tools.ts               # Tool definitions + API client

web/                        # Vue 3 frontend (Cloudflare Pages)
  src/
    App.vue                # Root component
    main.ts                # App entry point
    router.ts              # Vue Router config
    style.css              # Global styles + Tailwind
    types.ts               # Frontend TypeScript types
    components/
      DigestFeed.vue       # Snap-scroll container (Swiper.js)
      DigestCard.vue       # Individual item card
      DateHeader.vue       # Date + item count
      EmptyState.vue       # No digest yet today
      CategoryFilter.vue   # Category filtering
      DataTable.vue        # Data table component
      StatCard.vue         # Dashboard stat card
    composables/
      useDigest.ts         # Digest fetch + state management
      useDashboard.ts      # Dashboard data fetching
    views/                 # Route views
    utils/                 # Frontend utilities
```

## Technology Stack

- **Worker**: Cloudflare Workers, Hono (router), D1 (database), fast-xml-parser
- **AI**: Gemini 2.0 Flash (primary) with Claude Haiku 4.5 fallback
- **Frontend**: Vue 3 with Composition API (`<script setup>`), TypeScript (strict mode)
- **Build**: Vite
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **MCP**: `@modelcontextprotocol/sdk` + Cloudflare Agents SDK, zod v4 schemas
- **Deployment**: GitHub Actions → Cloudflare Workers + Pages

## Monorepo Structure

npm workspaces with 4 packages: `shared`, `worker`, `web`, `mcp`.

Shared config at root level:
- `eslint.config.base.js` — shared ESLint rules, extended by each package
- `.prettierrc` — shared Prettier config (web extends with tailwind plugin)
- `lefthook.yml` — pre-commit hooks for all packages

## Key Conventions

### Vue Component Style

- Use `<script setup lang="ts">` syntax
- Type props with `defineProps<Props>()`
- Type emits with `defineEmits<Emits>()`
- Use Composition API exclusively
- Reactive state uses `ref()` or `reactive()`

### Worker Conventions

- Use Hono for routing
- Use D1 prepared statements with `.bind()` for all queries
- Use `env.DB.batch()` for multi-statement writes (atomic)
- Use `crypto.randomUUID()` for ID generation
- All environment bindings typed via `Env` interface in `types.ts`

### Styling

- Tailwind CSS utility classes (v4 — uses `@import "tailwindcss"` in CSS, no JS config)
- Dark theme by default (gray-900 background)

## Environment Variables

### Worker (Cloudflare secrets)

- `ADMIN_KEY` — Bearer token for admin endpoints
- `GEMINI_API_KEY` — Google Gemini API key (primary AI provider)
- `ANTHROPIC_API_KEY` — Anthropic API key (fallback AI provider)

### Frontend (build-time via Vite)

- `VITE_API_BASE` — Worker API URL (set via GitHub Actions vars)

### MCP Server (Cloudflare Worker)

- `API_BASE` — Worker API URL (defaults to production in `wrangler.toml`, override via Cloudflare dashboard)

## Code Formatting

- **ESLint**: Handles linting and code quality (`npm run lint` / `npm run lint:check`)
- **Prettier**: Handles code formatting (`npm run format` / `npm run format:check`)
- Both run from root across all workspaces

## E2E Tests (Claude Code)

The web package includes Playwright e2e tests. In Claude Code (web/mobile), browser downloads are blocked, so you must symlink an existing Playwright browser installation.

**Setup (run once per session):**

```bash
# Check existing browser version
ls ~/.cache/ms-playwright/

# Create symlinks from existing version (e.g., 1194) to required version (e.g., 1208)
mkdir -p ~/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64
ln -s ~/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell \
      ~/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
```

**Run tests:**

```bash
cd web && npm run test:e2e
```

## Agents & Commands

### Agents (in `.claude/agents/`)

- **code-reviewer**: Reviews code for quality, security, and best practices
- **code-simplifier**: Refactors code for clarity and maintainability

### Commands (in `.claude/commands/`)

- `/pr` — Create or update GitHub pull request
- `/build` — Run TypeScript checking and production build

## Coding Philosophy

> Clear is better than clever.
> Every line of code is a liability.
> Make it work. Make it clear. Make it fast. (in that order)

- Keep it simple — this is a personal daily digest tool
- Prefer explicit code over clever abstractions
- Worker and frontend share types but are independent packages
