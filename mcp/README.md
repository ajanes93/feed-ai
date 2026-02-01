# feed-ai-mcp

MCP (Model Context Protocol) server that gives Claude Code direct access to Evening Scroll production data and actions.

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

The MCP server config is committed in `.claude/settings.json` and picked up automatically by Claude Code. After cloning:

```bash
npm install            # From repo root
npm run build -w mcp   # Build the MCP server
```

## Development

```bash
npm run build     # Compile TypeScript
npm test          # Run tests
```

## Environment Variables

- `FEED_AI_API_BASE` — Worker API URL (defaults to production)

## Architecture

The server is a thin HTTP proxy — each tool maps to a worker API endpoint. It uses stdio transport for Claude Code communication and zod v4 for input validation.

```
Claude Code ──stdio──▶ MCP Server ──HTTP──▶ Cloudflare Worker
```
