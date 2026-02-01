import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";
import type { Env } from "./types";

declare module "cloudflare:test" {
  // Controls the type of `import("cloudflare:test").env`
  // Extends Env (wrangler bindings) + test-only bindings
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
