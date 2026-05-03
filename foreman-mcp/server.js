#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new Server(
  {
    name: 'foreman',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Storage for dynamically loaded tools
const tools = new Map();

/**
 * Dynamically loads all .js files from the tools/ directory
 */
async function loadTools() {
  const toolsDir = join(__dirname, 'tools');
  
  try {
    const files = await readdir(toolsDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    for (const file of jsFiles) {
      try {
        const modulePath = join(toolsDir, file);
        const module = await import(`file://${modulePath}`);
        
        if (module.tool && module.tool.name) {
          tools.set(module.tool.name, module.tool);
        } else {
          console.error(`[foreman] Warning: ${file} does not export a valid tool object`, { stdio: 'inherit' });
        }
      } catch (err) {
        console.error(`[foreman] Error loading tool ${file}: ${err.message}`, { stdio: 'inherit' });
      }
    }
    
    const toolNames = Array.from(tools.keys()).join(', ');
    console.error(`[foreman] Foreman MCP loaded ${tools.size} tools: ${toolNames || '(none)'}`, { stdio: 'inherit' });
  } catch (err) {
    // tools/ directory might be empty or not exist yet (Wave 1 standalone)
    console.error('[foreman] Foreman MCP loaded 0 tools', { stdio: 'inherit' });
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.get(name);
  if (!tool) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }
  
  try {
    const result = await tool.handler(args || {});
    return result;
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  await loadTools();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[foreman] MCP server running on stdio', { stdio: 'inherit' });
}

main().catch((error) => {
  console.error('[foreman] Fatal error:', error, { stdio: 'inherit' });
  process.exit(1);
});
