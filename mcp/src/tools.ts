import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const DEFAULT_API_BASE = "https://feed-ai-worker.andresjanes.workers.dev";

export async function api(
  path: string,
  options?: { method?: string; adminKey?: string; apiBase?: string }
): Promise<unknown> {
  const base = options?.apiBase ?? DEFAULT_API_BASE;
  const headers: Record<string, string> = {};
  if (options?.adminKey) {
    headers["Authorization"] = `Bearer ${options.adminKey}`;
  }
  const res = await fetch(`${base}${path}`, {
    method: options?.method ?? "GET",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// --- Schemas ---

const adminKeySchema = {
  admin_key: z.string().describe("Worker ADMIN_KEY for authentication"),
};

const getDigestSchema = {
  date: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
};

const getLogsSchema = {
  ...adminKeySchema,
  level: z.enum(["info", "warn", "error"]).optional(),
  category: z
    .enum(["ai", "fetch", "parse", "general", "digest", "summarizer"])
    .optional(),
  digest_id: z.string().optional(),
  limit: z.number().max(500).optional().default(50),
};

export function registerTools(server: McpServer, apiBase?: string): void {
  const base = { apiBase };

  server.tool(
    "get_digest",
    "Fetch a digest by date. Returns items with title, summary, category, source.",
    getDigestSchema,
    async ({ date }) => {
      const path = date ? `/api/digest/${date}` : "/api/today";
      const data = await api(path, base);
      return jsonResult(data);
    }
  );

  server.tool(
    "list_digests",
    "List the last 30 digests with dates and item counts.",
    {},
    async () => {
      const data = await api("/api/digests", base);
      return jsonResult(data);
    }
  );

  server.tool(
    "get_source_health",
    "Check health of all RSS sources — staleness, failures, last success.",
    {},
    async () => {
      const data = await api("/api/health", base);
      return jsonResult(data);
    }
  );

  server.tool(
    "get_dashboard",
    "Full admin dashboard: AI usage stats, source health, recent errors, digest count.",
    adminKeySchema,
    async ({ admin_key }) => {
      const data = await api("/api/admin/dashboard", {
        adminKey: admin_key,
        ...base,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "get_logs",
    "Query structured logs. Filter by level (info/warn/error), category (ai/fetch/parse/digest/summarizer), digest_id.",
    getLogsSchema,
    async ({ admin_key, level, category, digest_id, limit }) => {
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      if (category) params.set("category", category);
      if (digest_id) params.set("digest_id", digest_id);
      if (limit) params.set("limit", String(limit));
      const query = params.toString();
      const data = await api(`/api/admin/logs${query ? `?${query}` : ""}`, {
        adminKey: admin_key,
        ...base,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "rebuild_digest",
    "Delete and regenerate today's digest. Use when sources or prompts have changed.",
    adminKeySchema,
    async ({ admin_key }) => {
      const data = await api("/api/rebuild", {
        method: "POST",
        adminKey: admin_key,
        ...base,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "fetch_articles",
    "Fetch from all RSS sources and store raw items for accumulation, without generating a digest.",
    adminKeySchema,
    async ({ admin_key }) => {
      const data = await api("/api/fetch", {
        method: "POST",
        adminKey: admin_key,
        ...base,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "generate_digest",
    "Trigger daily digest generation (skips if already exists).",
    adminKeySchema,
    async ({ admin_key }) => {
      const data = await api("/api/generate", {
        method: "POST",
        adminKey: admin_key,
        ...base,
      });
      return jsonResult(data);
    }
  );
}

export function createServer(apiBase?: string): McpServer {
  const server = new McpServer({ name: "feed-ai", version: "1.0.0" });
  registerTools(server, apiBase);
  return server;
}
