import { applyD1Migrations, env } from "cloudflare:test";

// Apply D1 migrations before tests run
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
