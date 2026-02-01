# @feed-ai/shared

Shared types, test factories, and utility functions used across the monorepo.

## Exports

| Export | Description |
| ------ | ----------- |
| `./types` | TypeScript types for digests, items, sources, AI usage, logs |
| `./factories` | [Fishery](https://github.com/thoughtbot/fishery) factories for test data |
| `./utils` | Shared utility functions |

## Usage

```ts
import type { DigestItem, Source } from "@feed-ai/shared/types";
import { digestItemFactory } from "@feed-ai/shared/factories";
```

This package has no build step — it exports TypeScript directly and is consumed by other workspace packages.
