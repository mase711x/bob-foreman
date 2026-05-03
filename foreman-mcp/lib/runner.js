import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Returns the absolute path to the foreman repo root.
 * Computed as two directories above this file (foreman-mcp/lib/ → foreman-mcp/ → REPO_ROOT)
 */
export function getRepoRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  const libDir = dirname(currentFile);
  const foremanMcpDir = dirname(libDir);
  const repoRoot = dirname(foremanMcpDir);
  return repoRoot;
}

/**
 * Spawns foreman-build.ps1 as a fire-and-forget background process.
 * 
 * @param {Object} options
 * @param {string} options.projectDescription - Description of the project to build
 * @param {string[]} options.taskIds - Array of task IDs to execute
 * @param {number} [options.maxCoinsPerWorker=3] - Maximum coins per worker
 * @param {boolean} [options.skipEstimate=false] - Whether to skip the estimation step
 * @returns {Object} Job metadata: { job_id, dashboard_url, started_at, pid }
 * @throws {Error} If taskIds is not a non-empty array
 */
export function runForemanBuild({ projectDescription, taskIds, maxCoinsPerWorker = 3, skipEstimate = false }) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw new Error('taskIds must be a non-empty array');
  }

  const repoRoot = getRepoRoot();
  const scriptPath = join(repoRoot, 'scripts', 'foreman-build.ps1');

  // Sanitize projectDescription: replace single quotes with double single quotes for PowerShell
  const sanitizedDescription = projectDescription.replace(/'/g, "''");

  // Build PowerShell array literal: @('id1','id2',...)
  const taskIdsArray = `@(${taskIds.map(id => `'${id}'`).join(',')})`;

  // Build PowerShell command
  const psCommand = [
    `& '${scriptPath}'`,
    `-ProjectDescription '${sanitizedDescription}'`,
    `-TaskIds ${taskIdsArray}`,
    `-MaxCoinsPerWorker ${maxCoinsPerWorker}`
  ];

  if (skipEstimate) {
    psCommand.push('-SkipEstimate');
  }

  const fullCommand = psCommand.join(' ');

  // Spawn as detached background process
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', fullCommand], {
    detached: true,
    stdio: 'ignore',
    cwd: repoRoot
  });

  child.unref();

  const jobId = `mcp-${Date.now()}`;
  const dashboardUrl = 'http://192.168.178.86:8765/dashboard.html';
  const startedAt = new Date().toISOString();

  return {
    job_id: jobId,
    dashboard_url: dashboardUrl,
    started_at: startedAt,
    pid: child.pid
  };
}
