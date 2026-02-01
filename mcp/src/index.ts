import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerTools } from "./tools.js";

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  API_BASE?: string;
}

export class FeedAiMcp extends McpAgent<Env> {
  server = new McpServer({
    name: "feed-ai",
    version: "1.0.0",
  });

  async init() {
    registerTools(this.server, this.env.API_BASE);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/mcp" || url.pathname === "/sse") {
        return await FeedAiMcp.serve(url.pathname).fetch(request, env, ctx);
      }
    } catch (err) {
      console.error("MCP error:", err);
      return new Response("Internal server error", { status: 500 });
    }

    if (url.pathname === "/") {
      return new Response("feed-ai MCP server. Connect via /mcp");
    }

    return new Response("Not found", { status: 404 });
  },
};
