# Foreman MCP

MCP (Model Context Protocol) server that exposes Bob Foreman as tools callable from Bob IDE and other MCP clients. Enables programmatic control of parallel Bob worker builds through a standardized interface.

## What It Does

Foreman MCP wraps the Bob Foreman build system in an MCP server, allowing AI assistants and automation tools to:
- Dispatch parallel builds with multiple Bob workers
- Query real-time build status and progress
- Plan and estimate project timelines
- Access the live dashboard and build artifacts

## Installation

```bash
cd foreman-mcp
npm install
```

## Register in Bob IDE

Add the following to your `.bob/mcp.json`:

```json
{
  "mcpServers": {
    "foreman": {
      "command": "node",
      "args": ["C:\\Users\\tribe\\bob-foreman\\worktrees\\mcp-foundation\\foreman-mcp\\server.js"],
      "env": {}
    }
  }
}
```

Adjust the absolute path to match your installation location.

## Available Tools

- **foreman.dispatch** - Start a new parallel build with specified tasks
- **foreman.status** - Query current build status, worker progress, and coin usage
- **bauleiter.plan** - Generate project plans and task breakdowns with time estimates

(Additional tools will be added by Wave 2 workers)

## Run Standalone

For debugging or testing without Bob IDE:

```bash
npm start
```

The server will start on stdio and report loaded tools to stderr. Use any MCP client to connect and invoke tools.

## Development

See `lib/contract.md` for the tool authoring specification. Wave 2 workers will create individual tool files in `tools/` that are automatically loaded by the server.
