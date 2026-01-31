import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      globals: true,
      setupFiles: ["./src/__tests__/setup.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              ADMIN_KEY: "test-admin-key",
              ANTHROPIC_API_KEY: "test-anthropic",
              GEMINI_API_KEY: "test-gemini",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
