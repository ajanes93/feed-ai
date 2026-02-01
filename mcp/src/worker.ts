import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerTools } from "./server.js";

export class FeedAiMcp extends McpAgent {
  server = new McpServer({
    name: "feed-ai",
    version: "1.0.0",
  });

  async init() {
    registerTools(this.server);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return FeedAiMcp.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/sse") {
      return FeedAiMcp.serve("/sse").fetch(request, env, ctx);
    }

    return new Response("feed-ai MCP server. Connect via /mcp", {
      status: 200,
    });
  },
};
