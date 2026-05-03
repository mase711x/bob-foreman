import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getRepoRoot } from '../lib/runner.js';

export const tool = {
  name: 'foreman.status',
  description: 'Report the current state of all Foreman workers including per-worker status, coins consumed, elapsed time, and ETA. Reads .foreman/ filesystem directly.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async () => {
    try {
      const repoRoot = getRepoRoot();
      const tasksDir = join(repoRoot, '.foreman', 'tasks');
      const startTimeFile = join(repoRoot, '.foreman', 'start_time.txt');
      const endTimeFile = join(repoRoot, '.foreman', 'end_time.txt');
      const estimateFile = join(repoRoot, '.foreman', 'estimate.json');

      // Check if tasksDir exists
      if (!existsSync(tasksDir)) {
        return {
          content: [{
            type: 'text',
            text: 'No active Foreman session. Run foreman.dispatch to start workers.'
          }]
        };
      }

      // Read all task files
      const workers = [];
      try {
        const files = readdirSync(tasksDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const taskPath = join(tasksDir, file);
            const taskData = JSON.parse(readFileSync(taskPath, 'utf8'));
            workers.push({
              id: file.replace('.json', ''),
              status: taskData.status || 'unknown',
              coins: taskData.coins || 0
            });
          } catch (e) {
            // Corrupt task file - skip
          }
        }
      } catch (e) {
        // Cannot read tasks dir
      }

      // Sort workers by id
      workers.sort((a, b) => a.id.localeCompare(b.id));

      // Read start_time with literal \n strip
      let startTime = null;
      try {
        const content = readFileSync(startTimeFile, 'utf8');
        const cleaned = content.replace(/\\n$/g, '').replace(/\\r\\n$/g, '').trim();
        startTime = cleaned || null;
      } catch (e) {
        // Missing start_time
      }

      // Read end_time with literal \n strip
      let endTime = null;
      try {
        const content = readFileSync(endTimeFile, 'utf8');
        const cleaned = content.replace(/\\n$/g, '').replace(/\\r\\n$/g, '').trim();
        endTime = cleaned || null;
      } catch (e) {
        // Missing end_time
      }

      // Read estimate
      let estimateSeconds = null;
      try {
        const estimate = JSON.parse(readFileSync(estimateFile, 'utf8'));
        estimateSeconds = estimate.total_seconds || null;
      } catch (e) {
        // Missing or corrupt estimate
      }

      // Compute elapsed_seconds
      let elapsedSeconds = null;
      if (startTime) {
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        elapsedSeconds = Math.floor((end - start) / 1000);
      }

      // Compute status counts
      const doneCount = workers.filter(w => w.status === 'done').length;
      const runningCount = workers.filter(w => w.status === 'running').length;
      const queuedCount = workers.filter(w => w.status === 'queued').length;
      const errorCount = workers.filter(w => w.status === 'error').length;

      // Compute is_active and is_done
      const isActive = !endTime && workers.length > 0;
      const isDone = !!endTime || (workers.length > 0 && workers.every(w => w.status === 'done'));

      // Compute total_coins
      const totalCoins = Math.round(workers.reduce((sum, w) => sum + w.coins, 0) * 10000) / 10000;

      // Compute saved_seconds
      const savedSeconds = isDone && estimateSeconds && elapsedSeconds
        ? Math.max(estimateSeconds - elapsedSeconds, 0)
        : null;

      const summary = {
        is_active: isActive,
        is_done: isDone,
        worker_count: workers.length,
        done_count: doneCount,
        running_count: runningCount,
        queued_count: queuedCount,
        error_count: errorCount,
        total_coins: totalCoins,
        elapsed_seconds: elapsedSeconds,
        estimate_seconds: estimateSeconds,
        saved_seconds: savedSeconds,
        start_time: startTime,
        end_time: endTime,
        dashboard_url: 'http://192.168.178.86:8765/dashboard.html',
        workers
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2)
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
