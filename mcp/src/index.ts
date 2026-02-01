import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerTools } from "./tools.js";

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

    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      return FeedAiMcp.serve(url.pathname).fetch(request, env, ctx);
    }

    return new Response("feed-ai MCP server. Connect via /mcp", {
      status: 200,
    });
  },
};
