import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.FEED_AI_API_BASE ?? "https://feed-ai-worker.andresjanes.workers.dev";

async function api(
  path: string,
  options?: { method?: string; adminKey?: string }
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (options?.adminKey) {
    headers["Authorization"] = `Bearer ${options.adminKey}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const server = new McpServer({
  name: "feed-ai",
  version: "1.0.0",
});

// --- Public tools (no auth) ---

server.tool(
  "get_digest",
  "Fetch a digest by date. Returns items with title, summary, category, source.",
  { date: z.string().optional().describe("YYYY-MM-DD, defaults to today") },
  async ({ date }) => {
    const path = date ? `/api/digest/${date}` : "/api/today";
    const data = await api(path);
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

server.tool(
  "list_digests",
  "List the last 30 digests with dates and item counts.",
  {},
  async () => {
    const data = await api("/api/digests");
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

server.tool(
  "get_source_health",
  "Check health of all RSS sources — staleness, failures, last success.",
  {},
  async () => {
    const data = await api("/api/health");
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

// --- Admin tools (require admin_key parameter) ---

server.tool(
  "get_dashboard",
  "Full admin dashboard: AI usage stats, source health, recent errors, digest count.",
  { admin_key: z.string().describe("Worker ADMIN_KEY for authentication") },
  async ({ admin_key }) => {
    const data = await api("/api/admin/dashboard", { adminKey: admin_key });
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

server.tool(
  "get_logs",
  "Query structured logs. Filter by level (info/warn/error), category (ai/fetch/parse/digest/summarizer), digest_id.",
  {
    admin_key: z.string().describe("Worker ADMIN_KEY for authentication"),
    level: z.enum(["info", "warn", "error"]).optional(),
    category: z
      .enum(["ai", "fetch", "parse", "general", "digest", "summarizer"])
      .optional(),
    digest_id: z.string().optional(),
    limit: z.number().max(500).optional().default(50),
  },
  async ({ admin_key, level, category, digest_id, limit }) => {
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (category) params.set("category", category);
    if (digest_id) params.set("digest_id", digest_id);
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    const data = await api(`/api/admin/logs${query ? `?${query}` : ""}`, {
      adminKey: admin_key,
    });
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

server.tool(
  "rebuild_digest",
  "Delete and regenerate today's digest. Use when sources or prompts have changed.",
  { admin_key: z.string().describe("Worker ADMIN_KEY for authentication") },
  async ({ admin_key }) => {
    const data = await api("/api/rebuild", {
      method: "POST",
      adminKey: admin_key,
    });
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

server.tool(
  "generate_digest",
  "Trigger daily digest generation (skips if already exists).",
  { admin_key: z.string().describe("Worker ADMIN_KEY for authentication") },
  async ({ admin_key }) => {
    const data = await api("/api/generate", {
      method: "POST",
      adminKey: admin_key,
    });
    return { content: [{ type: "text" as const, text: formatJson(data) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
