import { createMcpHandler } from "agents/mcp";
import { createServer } from "./tools.js";

interface Env {
  API: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("feed-ai MCP server. Connect via /mcp");
    }

    return createMcpHandler(createServer(env.API))(request, env, ctx);
  },
};
