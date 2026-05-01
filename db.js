const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'urls.db');
let db;

async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      code TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (code) REFERENCES links(code)
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);
  `);

  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(dbPath, data);
}

function insertLink(code, url, created_at) {
  db.run('INSERT INTO links (code, url, created_at) VALUES (?, ?, ?)', [code, url, created_at]);
  saveDb();
}

function getLink(code) {
  const result = db.exec('SELECT url FROM links WHERE code = ?', [code]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return { url: result[0].values[0][0] };
}

function insertClick(code, timestamp) {
  db.run('INSERT INTO clicks (code, timestamp) VALUES (?, ?)', [code, timestamp]);
  saveDb();
}

function getStats(code) {
  const result = db.exec('SELECT COUNT(*) as click_count FROM clicks WHERE code = ?', [code]);
  if (result.length === 0) return { click_count: 0 };
  return { click_count: result[0].values[0][0] };
}

function getTimestamps(code) {
  const result = db.exec('SELECT timestamp FROM clicks WHERE code = ? ORDER BY timestamp', [code]);
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}

module.exports = {
  initDb,
  insertLink,
  getLink,
  insertClick,
  getStats,
  getTimestamps
};