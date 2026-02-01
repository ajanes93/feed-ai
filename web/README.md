# feed-ai-web

Vue 3 frontend for feed-ai. Displays daily digests in a TikTok-style vertical scroll feed.

## Key Files

| File | Description |
| ---- | ----------- |
| `src/App.vue` | Root component |
| `src/router.ts` | Vue Router configuration |
| `src/components/DigestFeed.vue` | Snap-scroll container (Swiper.js) |
| `src/components/DigestCard.vue` | Individual item card |
| `src/composables/useDigest.ts` | Digest fetch + state management |
| `src/composables/useDashboard.ts` | Dashboard data fetching |

## Development

```bash
npm run dev       # Start Vite dev server on :5173
npm run build     # Production build (vue-tsc + vite)
npm test          # Run unit tests
npm run test:e2e  # Run Playwright e2e tests
```

## Stack

- **Vue 3** with Composition API (`<script setup lang="ts">`)
- **Vite** for building
- **Tailwind CSS 4** for styling (dark theme default)
- **Swiper.js** for snap-scroll navigation
- **Vue Router** for routing
- **Vitest** + **Vue Test Utils** for unit tests
- **Playwright** for e2e tests

## Environment Variables

- `VITE_API_BASE` — Worker API URL (defaults to `http://localhost:8787` in dev)
