import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../tools.js";

const mockFetch = vi.fn();
const mockFetcher = { fetch: mockFetch };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function setup() {
  mockFetch.mockReset();
  const server = createServer(mockFetcher);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

type TextContent = { type: "text"; text: string };

function resultText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as TextContent[])[0].text;
}

function calledUrl(): string {
  const req: Request = mockFetch.mock.calls[0][0];
  return new URL(req.url).pathname + new URL(req.url).search;
}

function calledRequest(): Request {
  return mockFetch.mock.calls[0][0] as Request;
}

describe("MCP server", () => {
  // --- Tool discovery ---

  it("lists all 8 tools", async () => {
    const client = await setup();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "fetch_articles",
      "generate_digest",
      "get_dashboard",
      "get_digest",
      "get_logs",
      "get_source_health",
      "list_digests",
      "rebuild_digest",
    ]);
  });

  // --- Public tools ---

  it("get_digest calls /api/digest/:date with date param", async () => {
    const client = await setup();
    const digest = { id: "digest-2026-01-30", date: "2026-01-30", items: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(digest));

    const result = await client.callTool({
      name: "get_digest",
      arguments: { date: "2026-01-30" },
    });

    expect(calledUrl()).toBe("/api/digest/2026-01-30");
    expect(calledRequest().method).toBe("GET");
    expect(JSON.parse(resultText(result))).toEqual(digest);
  });

  it("get_digest calls /api/today without date", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "today" }));

    await client.callTool({ name: "get_digest", arguments: {} });

    expect(calledUrl()).toBe("/api/today");
  });

  it("list_digests calls /api/digests", async () => {
    const client = await setup();
    const digests = [{ date: "2026-01-30", item_count: 12 }];
    mockFetch.mockResolvedValueOnce(jsonResponse(digests));

    const result = await client.callTool({
      name: "list_digests",
      arguments: {},
    });

    expect(calledUrl()).toBe("/api/digests");
    expect(calledRequest().method).toBe("GET");
    expect(JSON.parse(resultText(result))).toEqual(digests);
  });

  it("get_source_health calls /api/health", async () => {
    const client = await setup();
    const health = [{ sourceId: "vue-blog", stale: false }];
    mockFetch.mockResolvedValueOnce(jsonResponse(health));

    const result = await client.callTool({
      name: "get_source_health",
      arguments: {},
    });

    expect(calledUrl()).toBe("/api/health");
    expect(calledRequest().method).toBe("GET");
    expect(JSON.parse(resultText(result))).toEqual(health);
  });

  // --- Admin tools (auth) ---

  it("get_dashboard sends Bearer token", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ai: {}, sources: [], errors: [], totalDigests: 30 })
    );

    await client.callTool({
      name: "get_dashboard",
      arguments: { admin_key: "key123" },
    });

    expect(calledUrl()).toBe("/api/admin/dashboard");
    expect(calledRequest().headers.get("Authorization")).toBe("Bearer key123");
  });

  it("get_logs passes query params and auth", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await client.callTool({
      name: "get_logs",
      arguments: {
        admin_key: "secret123",
        level: "error",
        category: "fetch",
        limit: 10,
      },
    });

    const url = calledUrl();
    expect(url).toContain("/api/admin/logs?");
    expect(url).toContain("level=error");
    expect(url).toContain("category=fetch");
    expect(url).toContain("limit=10");
    expect(calledRequest().headers.get("Authorization")).toBe(
      "Bearer secret123"
    );
  });

  it("get_logs omits unset optional params from URL", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await client.callTool({
      name: "get_logs",
      arguments: { admin_key: "key" },
    });

    const url = calledUrl();
    expect(url).not.toContain("level=");
    expect(url).not.toContain("category=");
    expect(url).not.toContain("digest_id=");
  });

  it("rebuild_digest sends POST with auth", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.callTool({
      name: "rebuild_digest",
      arguments: { admin_key: "mykey" },
    });

    expect(calledUrl()).toBe("/api/rebuild");
    expect(calledRequest().method).toBe("POST");
    expect(calledRequest().headers.get("Authorization")).toBe("Bearer mykey");
  });

  it("fetch_articles sends POST with auth", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ sources: 10, newItems: 42 })
    );

    await client.callTool({
      name: "fetch_articles",
      arguments: { admin_key: "mykey" },
    });

    expect(calledUrl()).toBe("/api/fetch");
    expect(calledRequest().method).toBe("POST");
    expect(calledRequest().headers.get("Authorization")).toBe("Bearer mykey");
  });

  it("generate_digest sends POST with auth", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.callTool({
      name: "generate_digest",
      arguments: { admin_key: "mykey" },
    });

    expect(calledUrl()).toBe("/api/generate");
    expect(calledRequest().method).toBe("POST");
    expect(calledRequest().headers.get("Authorization")).toBe("Bearer mykey");
  });

  // --- Error handling ---

  it("returns error when API responds with non-ok status", async () => {
    const client = await setup();
    mockFetch.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const result = await client.callTool({
      name: "list_digests",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("401");
  });

  it("returns error on network failure", async () => {
    const client = await setup();
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await client.callTool({
      name: "get_source_health",
      arguments: {},
    });

    expect(result.isError).toBe(true);
  });

  // --- Input validation ---

  it("rejects get_logs with invalid level enum", async () => {
    const client = await setup();

    const result = await client.callTool({
      name: "get_logs",
      arguments: { admin_key: "key", level: "invalid" },
    });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Invalid");
  });

  // --- Concurrent requests ---

  it("handles concurrent requests", async () => {
    const client = await setup();
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ date: "2026-01-28" }]))
      .mockResolvedValueOnce(jsonResponse([{ sourceId: "vue-blog" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "digest-2026-01-30" }));

    const results = await Promise.all([
      client.callTool({ name: "list_digests", arguments: {} }),
      client.callTool({ name: "get_source_health", arguments: {} }),
      client.callTool({
        name: "get_digest",
        arguments: { date: "2026-01-30" },
      }),
    ]);

    results.forEach((r) => expect(r.isError).toBeUndefined());
  });
});
