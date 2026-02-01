# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Evening Scroll (feed-ai) — a personal daily digest app that fetches news/jobs/updates from configured RSS sources, uses Claude to summarize into 8-10 important items, and displays them in a TikTok-style scrollable feed.

**Stack:** Cloudflare Workers + D1 + Pages (Vue 3 + TypeScript + Tailwind CSS 4)

## First-Time Setup

After cloning the repo, run these commands to set up the development environment:

```bash
npm install          # Install all workspace deps + lefthook commit hooks
npm run build -w mcp # Build the MCP server (required for Claude Code tools)
```

The MCP server config is committed in `.claude/settings.json` and will be picked up automatically by Claude Code. It exposes 7 tools for querying production data (digests, logs, sources, AI usage) and triggering digest rebuilds.

## Quick Reference Commands

| Task                | Command (web)          | Command (worker)      |
| ------------------- | ---------------------- | --------------------- |
| Start dev server    | `npm run dev`          | `npm run dev`         |
| Build               | `npm run build`        | N/A                   |
| Lint & fix          | `npm run lint`         | `npm run lint`        |
| Format code         | `npm run format`       | `npm run format`      |
| Deploy worker       | N/A                    | `npm run deploy`      |
| Query D1            | N/A                    | `wrangler d1 execute` |

## Directory Structure

```
worker/                     # Cloudflare Worker (API + Cron)
  src/
    index.ts               # Main worker entry (Hono router + cron)
    types.ts               # TypeScript types
    sources.ts             # RSS source configuration
    services/
      fetcher.ts           # RSS/Reddit/GitHub fetching
      summarizer.ts        # Claude API integration
  schema.sql               # D1 database schema
  wrangler.toml            # Cloudflare config

mcp/                        # MCP server (Claude Code tools)
  src/
    index.ts               # Stdio transport entrypoint
    server.ts              # Tool definitions + API client

web/                        # Vue 3 frontend
  src/
    App.vue                # Root component
    main.ts                # App entry point
    style.css              # Global styles + Tailwind
    types.ts               # Frontend TypeScript types
    components/
      DigestFeed.vue       # Snap-scroll container
      DigestCard.vue       # Individual item card
      DateHeader.vue       # Date + item count
      EmptyState.vue       # No digest yet today
    composables/
      useDigest.ts         # Fetch + state management
```

## Technology Stack

- **Worker**: Cloudflare Workers, Hono (router), D1 (database), rss-parser
- **AI**: Anthropic Claude API (Haiku for summarization)
- **Frontend**: Vue 3 with Composition API (`<script setup>`), TypeScript (strict mode)
- **Build**: Vite
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Deployment**: GitHub Actions → Cloudflare Workers + Pages

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

- `ANTHROPIC_API_KEY` — Claude API key (set via `wrangler secret put`)

### Frontend (build-time via Vite)

- `VITE_API_BASE` — Worker API URL (set via GitHub Actions vars)

## Code Formatting

- **ESLint**: Handles linting and code quality (`npm run lint`)
- **Prettier**: Handles code formatting (`npm run format`)

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
