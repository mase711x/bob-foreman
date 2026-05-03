import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Returns the absolute path to the foreman repo root.
 * Uses process.cwd() because when loaded via MCP by Bob, import.meta.url
 * points to Bob's internal module cache, not the actual disk location.
 */
export function getRepoRoot() {
  // Assume MCP server is started from repo root (standard practice)
  return process.cwd();
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

  // Windows: Use Start-Process for proper background execution
  // spawn() with detached:true silently fails on Windows
  const startProcessCmd = `Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}','-ProjectDescription','${sanitizedDescription}','-TaskIds',${taskIdsArray},'-MaxCoinsPerWorker',${maxCoinsPerWorker}${skipEstimate ? ',"-SkipEstimate"' : ''} -WindowStyle Hidden -WorkingDirectory '${repoRoot}'`;
  
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', startProcessCmd], {
    stdio: 'ignore',
    cwd: repoRoot
  });

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

// Made with Bob
