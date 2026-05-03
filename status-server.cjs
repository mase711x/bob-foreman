const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

// Serve dashboard.html
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Helper function to safely read JSON file
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Helper function to safely read text file
function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').replace(/\\n$/g,'').replace(/\\r\\n$/g,'').trim();
  } catch (error) {
    return null;
  }
}

// Helper function to get last N lines from a file
function getLastLines(filePath, n = 10) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(-n);
  } catch (error) {
    return [];
  }
}

// Helper function to get file modification time
function getFileModTime(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch (error) {
    return null;
  }
}

// Helper function to extract coins from Bob CLI log file (raw text)
// Bob CLI writes plaintext output with embedded `"sessionCost": N.NNN` strings,
// not valid JSON. We sum all sessionCost matches found in the raw text.
function extractCoinsFromRaw(rawText) {
  if (!rawText || typeof rawText !== 'string') return 0;
  const re = /"sessionCost":\s*([\d.]+)/g;
  let total = 0;
  let m;
  while ((m = re.exec(rawText)) !== null) {
    const v = parseFloat(m[1]);
    if (!isNaN(v)) total += v;
  }
  return total;
}

// Helper function to get all task IDs
function getAllTaskIds() {
  const taskIds = new Set();
  const rootDir = process.cwd();
  
  // Scan .foreman/tasks/*.json
  const tasksDir = path.join(rootDir, '.foreman', 'tasks');
  try {
    const files = fs.readdirSync(tasksDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        taskIds.add(file.replace('.json', ''));
      }
    });
  } catch (error) {
    // Directory doesn't exist, continue
  }
  
  // Scan logs/*.setup.log
  const logsDir = path.join(rootDir, 'logs');
  try {
    const files = fs.readdirSync(logsDir);
    files.forEach(file => {
      if (file.endsWith('.setup.log')) {
        taskIds.add(file.replace('.setup.log', ''));
      }
    });
  } catch (error) {
    // Directory doesn't exist, continue
  }
  
  return Array.from(taskIds);
}

// Helper function to determine worker status
function getWorkerStatus(taskId, rootDir) {
  // Check for status file first
  const statusFile = path.join(rootDir, '.foreman', 'tasks', `${taskId}.json`);
  const statusData = readJsonFile(statusFile);
  if (statusData && statusData.status) {
    return statusData.status;
  }
  
  // Check if log file was modified recently (within 60 seconds)
  const logFile = path.join(rootDir, 'logs', `${taskId}.setup.log`);
  const modTime = getFileModTime(logFile);
  if (modTime) {
    const now = new Date();
    const diffSeconds = (now - modTime) / 1000;
    if (diffSeconds < 60) {
      return 'running';
    }
    return 'done';
  }
  
  return 'queued';
}

// Main endpoint
app.get('/dashboard/status.json', (req, res) => {
  const rootDir = process.cwd();
  
  // Read start_time
  const startTimeFile = path.join(rootDir, '.foreman', 'start_time.txt');
  const startTimeStr = ((readTextFile(startTimeFile) || '').trim()) || null;
  
  // If no start_time, return empty state
  if (!startTimeStr) {
    return res.json({
      is_active: false,
      is_done: false,
      elapsed_seconds: 0,
      saved_seconds: 0,
      totalCoins: 0,
      workers: [],
      estimate: null,
      start_time: null,
      end_time: null
    });
  }
  
  const startTime = new Date(startTimeStr);
  
  // Read end_time
  const endTimeFile = path.join(rootDir, '.foreman', 'end_time.txt');
  let   endTimeStr = ((readTextFile(endTimeFile) || '').trim()) || null;
  let   endTime    = endTimeStr ? new Date(endTimeStr) : null;
  
  // Read estimate
  const estimateFile = path.join(rootDir, '.foreman', 'estimate.json');
  const estimate = readJsonFile(estimateFile);
  
  // Calculate elapsed_seconds
  let   currentTime    = endTime || new Date();
  let   elapsed_seconds = Math.floor((currentTime - startTime) / 1000);
  
  // Calculate is_active and is_done
  let   is_active = !endTime;
  let   is_done   = !!endTime;
  
  // Get all task IDs and build workers array
  const taskIds = getAllTaskIds();
  const workers = taskIds.map(taskId => {
    const status = getWorkerStatus(taskId, rootDir);
    
    // Get coins from logs/${taskId}.json (raw plaintext from Bob CLI, not JSON)
    const logJsonFile = path.join(rootDir, 'logs', `${taskId}.json`);
    let coins = 0;
    try {
      if (fs.existsSync(logJsonFile)) {
        const rawText = fs.readFileSync(logJsonFile, 'utf-8');
        coins = extractCoinsFromRaw(rawText);
      }
    } catch (e) { coins = 0; }
    
    // Get last 10 lines from logs/${taskId}.setup.log
    const logFile = path.join(rootDir, 'logs', `${taskId}.setup.log`);
    const logs = getLastLines(logFile, 10);
    
    return {
      taskId,
      status,
      coins,
      logs
    };
  });
  
  // v0.2.2: Auto-detect session completion when end_time.txt is missing.
  // Persists end_time on first detection so later polls remain cheap.
  if (!is_done && workers.length > 0 && workers.every(function(w){return w.status === 'done';})) {
    const nowIso = new Date().toISOString();
    try { fs.writeFileSync(endTimeFile, nowIso, 'utf-8'); } catch (e) {}
    endTime = new Date(nowIso);
    endTimeStr = nowIso;
    currentTime = endTime;
    elapsed_seconds = Math.floor((currentTime - startTime) / 1000);
    is_active = false;
    is_done = true;
  }

  // Calculate totalCoins
  const totalCoins = workers.reduce((sum, worker) => sum + worker.coins, 0);
  
  // Calculate saved_seconds
  const saved_seconds = is_done && estimate && estimate.total_seconds
    ? Math.max(estimate.total_seconds - elapsed_seconds, 0)
    : 0;
  
  // Build response
  const response = {
    estimate,
    start_time: startTimeStr,
    end_time: endTimeStr,
    elapsed_seconds,
    saved_seconds,
    is_active,
    is_done,
    totalCoins,
    workers
  };
  
  const aliased = Object.assign({}, response, { started_at: response.start_time, ended_at: response.end_time, estimate_seconds: response.estimate ? response.estimate.total_seconds : null, workers: (response.workers || []).map(function(w) { return Object.assign({}, w, { coins_used: w.coins, id: w.taskId, log_tail: w.logs }); }) });
  res.json(aliased);
});

// === v3-status-api: BEGIN ===
// Endpoint: GET /dashboard/runs.json
// Returns array of all run records, newest first
app.get('/dashboard/runs.json', (req, res) => {
  const rootDir = process.cwd();
  const runsDir = path.join(rootDir, '.foreman', 'runs');
  
  const runs = [];
  
  try {
    const jobIds = fs.readdirSync(runsDir);
    
    for (const jobId of jobIds) {
      const runDir = path.join(runsDir, jobId);
      const stats = fs.statSync(runDir);
      if (!stats.isDirectory()) continue;
      
      // Read run files
      const estimateData = readJsonFile(path.join(runDir, 'estimate.json'));
      const startData = readJsonFile(path.join(runDir, 'start.json'));
      const endData = readJsonFile(path.join(runDir, 'end.json'));
      const tasksData = readJsonFile(path.join(runDir, 'tasks.json'));
      
      if (!startData || !startData.start_iso) continue;
      
      const startTime = new Date(startData.start_iso);
      const endTime = endData && endData.end_iso ? new Date(endData.end_iso) : null;
      const estimateSeconds = estimateData && estimateData.total_seconds ? estimateData.total_seconds : null;
      
      const elapsedSeconds = endTime 
        ? Math.floor((endTime - startTime) / 1000)
        : Math.floor((new Date() - startTime) / 1000);
      
      const savedSeconds = estimateSeconds && endTime
        ? Math.max(estimateSeconds - elapsedSeconds, 0)
        : null;
      
      runs.push({
        job_id: jobId,
        estimate_seconds: estimateSeconds,
        start_iso: startData.start_iso,
        end_iso: endData ? endData.end_iso : null,
        tasks: tasksData && tasksData.task_ids ? tasksData.task_ids : [],
        elapsed_seconds: elapsedSeconds,
        saved_seconds: savedSeconds
      });
    }
  } catch (error) {
    // Directory doesn't exist or other error
  }
  
  // Sort by start_iso descending (newest first)
  runs.sort((a, b) => {
    const timeA = new Date(a.start_iso).getTime();
    const timeB = new Date(b.start_iso).getTime();
    return timeB - timeA;
  });
  
  res.json(runs);
});

// Endpoint: GET /api/reviewer
// Returns reviewer summary, lifetime stats, and intervention list
app.get('/api/reviewer', (req, res) => {
  const rootDir = process.cwd();
  
  // Initialize response with zeros
  const response = {
    summary: {
      issues_found: 0,
      auto_fixed: 0,
      skipped: 0,
      last_run_id: null
    },
    lifetime: {
      total_runs: 0,
      total_issues_found: 0,
      total_auto_fixed: 0,
      total_skipped: 0
    },
    interventions: []
  };
  
  // Read reviewer.json (current run summary)
  const reviewerFile = path.join(rootDir, '.foreman', 'tasks', 'reviewer.json');
  const reviewerData = readJsonFile(reviewerFile);
  
  if (reviewerData) {
    // Populate summary
    if (reviewerData.summary) {
      response.summary.issues_found = reviewerData.summary.issues_found || 0;
      response.summary.auto_fixed = reviewerData.summary.auto_fixed || 0;
      response.summary.skipped = reviewerData.summary.skipped || 0;
    }
    
    // Set last_run_id
    if (reviewerData.run_id) {
      response.summary.last_run_id = reviewerData.run_id;
    }
    
    // Populate interventions
    if (Array.isArray(reviewerData.interventions)) {
      response.interventions = reviewerData.interventions;
    }
  }
  
  // Read reviewer-history.json (lifetime stats)
  const historyFile = path.join(rootDir, '.foreman', 'reviewer-history.json');
  const historyData = readJsonFile(historyFile);
  
  if (historyData && historyData.lifetime) {
    response.lifetime.total_runs = historyData.lifetime.total_runs || 0;
    response.lifetime.total_issues_found = historyData.lifetime.total_issues_found || 0;
    response.lifetime.total_auto_fixed = historyData.lifetime.total_auto_fixed || 0;
    response.lifetime.total_skipped = historyData.lifetime.total_skipped || 0;
  }
  
  res.json(response);
});
// === v3-status-api: END ===

// Start server
app.listen(PORT, () => {
  console.log(`Status server running on port ${PORT}`);
});
