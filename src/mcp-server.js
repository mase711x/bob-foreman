#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new Server(
  {
    name: 'bob-foreman',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const SSH_CMD = 'ssh tribe@192.168.179.250';

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'foreman_plan',
        description: 'Creates 3 task JSONs from goal string',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'Goal description',
            },
          },
          required: ['goal'],
        },
      },
      {
        name: 'foreman_build',
        description: 'Starts workers via SSH',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Task to execute',
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'foreman_status',
        description: 'Shows worker status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'foreman_logs',
        description: 'Shows worker logs',
        inputSchema: {
          type: 'object',
          properties: {
            worker_id: {
              type: 'string',
              description: 'Worker ID (optional)',
            },
          },
        },
      },
      {
        name: 'foreman_review',
        description: 'Starts review worker',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Branch to review',
            },
          },
          required: ['branch'],
        },
      },
      {
        name: 'foreman_merge',
        description: 'Merges branches',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source branch',
            },
            target: {
              type: 'string',
              description: 'Target branch',
            },
          },
          required: ['source', 'target'],
        },
      },
      {
        name: 'foreman_budget',
        description: 'Shows coin budget',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'foreman_plan': {
        const tasks = [
          { id: 1, type: 'analyze', goal: args.goal, priority: 'high' },
          { id: 2, type: 'implement', goal: args.goal, priority: 'medium' },
          { id: 3, type: 'test', goal: args.goal, priority: 'low' },
        ];
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case 'foreman_build': {
        const cmd = `${SSH_CMD} "${args.task}" --trust --yolo`;
        const { stdout, stderr } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      case 'foreman_status': {
        const cmd = `${SSH_CMD} "status" --trust --yolo`;
        const { stdout, stderr } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      case 'foreman_logs': {
        const logCmd = args.worker_id 
          ? `${SSH_CMD} "logs ${args.worker_id}" --trust --yolo`
          : `${SSH_CMD} "logs" --trust --yolo`;
        const { stdout, stderr } = await execAsync(logCmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      case 'foreman_review': {
        const cmd = `${SSH_CMD} "review ${args.branch}" --trust --yolo`;
        const { stdout, stderr } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      case 'foreman_merge': {
        const cmd = `${SSH_CMD} "merge ${args.source} ${args.target}" --trust --yolo`;
        const { stdout, stderr } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      case 'foreman_budget': {
        const cmd = `${SSH_CMD} "budget" --trust --yolo`;
        const { stdout, stderr } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || stderr }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bob Foreman MCP Server running');
}

main().catch(console.error);
