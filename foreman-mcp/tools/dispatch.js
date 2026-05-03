import { existsSync } from 'fs';
import { join } from 'path';
import { runForemanBuild, getRepoRoot } from '../lib/runner.js';

export const tool = {
  name: 'foreman.dispatch',
  description: 'Spawn N parallel Bob workers in isolated git worktrees to build features. Each worker is briefed via .foreman-prompts/<task_id>.txt. Returns immediately with a job_id and dashboard URL – does NOT wait for workers to finish. Use foreman.status to poll progress.',
  inputSchema: {
    type: 'object',
    required: ['project_description', 'task_ids'],
    properties: {
      project_description: {
        type: 'string',
        description: 'Short summary of what the workers will build (used by Bob plan-mode to estimate sequential time)'
      },
      task_ids: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Worker task IDs. Each MUST have a corresponding .foreman-prompts/<id>.txt brief file already on disk.'
      },
      max_coins_per_worker: {
        type: 'number',
        default: 3,
        minimum: 1,
        maximum: 10,
        description: 'Max Bobcoins each worker may spend (hard cap). Default 3 – keeps a 4-worker dispatch under ~12 coins.'
      },
      skip_estimate: {
        type: 'boolean',
        default: false,
        description: 'If true, skip the Bob plan-mode estimate call (saves ~0.3 coins, useful for quick re-runs).'
      }
    }
  },
  handler: async (args) => {
    try {
      const repoRoot = getRepoRoot();
      const missingPrompts = [];

      // Debug: log repoRoot for troubleshooting
      console.error(`[dispatch] repoRoot: ${repoRoot}`);

      // Validate prompt files exist
      for (const taskId of args.task_ids) {
        const promptPath = join(repoRoot, '.foreman-prompts', `${taskId}.txt`);
        console.error(`[dispatch] checking: ${promptPath} -> ${existsSync(promptPath)}`);
        if (!existsSync(promptPath)) {
          missingPrompts.push(taskId);
        }
      }

      if (missingPrompts.length > 0) {
        return {
          content: [{
            type: 'text',
            text: `Error: Missing prompt files for task IDs: ${missingPrompts.join(', ')}\nEach task must have a .foreman-prompts/<id>.txt file.`
          }],
          isError: true
        };
      }

      // Dispatch the build
      const result = runForemanBuild({
        projectDescription: args.project_description,
        taskIds: args.task_ids,
        maxCoinsPerWorker: args.max_coins_per_worker || 3,
        skipEstimate: args.skip_estimate || false
      });

      const workerCount = args.task_ids.length;
      const maxCoins = args.max_coins_per_worker || 3;
      const totalMaxCoins = workerCount * maxCoins;

      return {
        content: [{
          type: 'text',
          text: `Foreman dispatched ${workerCount} worker(s).
Tasks: ${args.task_ids.join(', ')}
Job ID: ${result.job_id}
Dashboard: ${result.dashboard_url}
Started: ${result.started_at}
Coin cap: ${maxCoins}/worker (max total: ${totalMaxCoins})

Workers are now running in parallel git worktrees. Use foreman.status to poll progress.`
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
