# Foreman MCP Tool Contract

This document specifies the API contract for tool authors building Wave 2 tools for the Foreman MCP server.

## Tool Module Structure

Every tool module must export a single `tool` object with the following shape:

```javascript
export const tool = {
  name: string,           // Dot-namespaced identifier (e.g., "foreman.dispatch", "bauleiter.plan")
  description: string,    // Human-readable description of what the tool does
  inputSchema: object,    // JSON Schema object defining the tool's parameters
  handler: async function // Async function that executes the tool logic
};
```

## Handler Signature

The handler function receives a single `args` object containing the validated input parameters and must return a response object:

```javascript
async function handler(args) {
  // Tool logic here
  return {
    content: [
      {
        type: 'text',
        text: 'Result message or data'
      }
    ],
    isError: false  // Optional: set to true if the operation failed
  };
}
```

### Error Handling

If your tool encounters an error, return `isError: true` in the response:

```javascript
return {
  content: [{ type: 'text', text: `Error: ${error.message}` }],
  isError: true
};
```

## Using the Runner

Import the runner utilities to interact with the Foreman build system:

```javascript
import { runForemanBuild, getRepoRoot } from '../lib/runner.js';
```

### `runForemanBuild(options)`

Spawns a Foreman build as a background process.

**Parameters:**
- `projectDescription` (string, required): Description of the project
- `taskIds` (string[], required): Array of task IDs to execute
- `maxCoinsPerWorker` (number, optional): Max coins per worker (default: 3)
- `skipEstimate` (boolean, optional): Skip estimation step (default: false)

**Returns:**
```javascript
{
  job_id: string,        // Unique job identifier (e.g., "mcp-1234567890")
  dashboard_url: string, // URL to the live dashboard
  started_at: string,    // ISO 8601 timestamp
  pid: number           // Process ID of the spawned build
}
```

**Example:**
```javascript
const result = runForemanBuild({
  projectDescription: 'Build URL shortener service',
  taskIds: ['shortener-api', 'shortener-frontend', 'shortener-tests'],
  maxCoinsPerWorker: 5
});
```

### `getRepoRoot()`

Returns the absolute path to the Foreman repository root directory.

**Example:**
```javascript
const repoRoot = getRepoRoot();
const taskFile = path.join(repoRoot, '.foreman', 'tasks', `${taskId}.json`);
```

## Reading Task Status

Task status is stored in `.foreman/tasks/<taskId>.json` files. Each file contains:

```json
{
  "status": "queued" | "running" | "done" | "error"
}
```

**Example:**
```javascript
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRepoRoot } from '../lib/runner.js';

const taskFile = join(getRepoRoot(), '.foreman', 'tasks', `${taskId}.json`);
const taskData = JSON.parse(readFileSync(taskFile, 'utf8'));
console.log(taskData.status); // "running"
```

## Tool Naming Convention

Use dot-namespaced names to organize tools by domain:

- `foreman.*` - Core Foreman operations (dispatch, status)
- `bauleiter.*` - Project planning and estimation tools
- `worker.*` - Individual worker management tools

**Examples:**
- `foreman.dispatch` - Start a new Foreman build
- `foreman.status` - Query build status
- `bauleiter.plan` - Generate project plan and task breakdown

## Sample Tool Boilerplate

```javascript
import { runForemanBuild, getRepoRoot } from '../lib/runner.js';

export const tool = {
  name: 'foreman.dispatch',
  description: 'Dispatches a new Foreman build with specified tasks',
  inputSchema: {
    type: 'object',
    properties: {
      projectDescription: {
        type: 'string',
        description: 'Description of the project to build'
      },
      taskIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of task IDs to execute'
      }
    },
    required: ['projectDescription', 'taskIds']
  },
  handler: async (args) => {
    try {
      const result = runForemanBuild({
        projectDescription: args.projectDescription,
        taskIds: args.taskIds,
        maxCoinsPerWorker: args.maxCoinsPerWorker || 3
      });
      
      return {
        content: [{
          type: 'text',
          text: `Build started: ${result.job_id}\nDashboard: ${result.dashboard_url}`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
};
```

## File Locations

- Tool files: `foreman-mcp/tools/<name>.js`
- Runner utilities: `foreman-mcp/lib/runner.js`
- Task status: `<repo-root>/.foreman/tasks/<taskId>.json`
- Build logs: `<repo-root>/logs/<taskId>.json`

## Testing Your Tool

Run the MCP server in standalone mode to test your tool:

```bash
cd foreman-mcp
npm start
```

The server will load your tool and report it on stderr. Use an MCP client or Bob IDE to invoke it.
