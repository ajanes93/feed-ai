# feed-ai-mcp

MCP (Model Context Protocol) server that gives Claude Code direct access to feed-ai production data and actions.

## Tools

| Tool | Auth | Description |
| ---- | ---- | ----------- |
| `get_digest` | No | Fetch a digest by date |
| `list_digests` | No | List last 30 digests |
| `get_source_health` | No | Check RSS source health |
| `get_dashboard` | Yes | Full admin dashboard (AI usage, errors, source health) |
| `get_logs` | Yes | Query structured logs with filters |
| `rebuild_digest` | Yes | Delete and regenerate today's digest |
| `generate_digest` | Yes | Trigger daily digest generation |

Admin tools require the `admin_key` parameter (the worker's `ADMIN_KEY` secret). This is passed as a tool input rather than stored in environment, since this server is designed for use on Claude mobile where persistent env config isn't available.

## Setup

The MCP server is deployed as a Cloudflare Worker. Add the worker URL to Claude.ai or Claude mobile MCP settings:

```
https://feed-ai-mcp.andresjanes.workers.dev/mcp
```

## Development

```bash
npm test          # Run tests
npm run dev       # Local development server
npm run deploy    # Deploy to Cloudflare
```

## Architecture

The MCP server runs as a Cloudflare Worker using the Cloudflare Agents SDK. It's a thin HTTP proxy — each tool maps to the main feed-ai worker API endpoint.

```
Claude (desktop/mobile) ──SSE/HTTP──▶ MCP Worker ──HTTP──▶ feed-ai Worker
```
