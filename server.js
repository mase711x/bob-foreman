const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const { initDb, insertLink, getLink, insertClick, getStats, getTimestamps } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/shorten', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'url field required' });
  }

  const code = nanoid(6);
  const created_at = Date.now();
  
  try {
    insertLink(code, url, created_at);
    const shortUrl = `http://localhost:${PORT}/${code}`;
    res.json({ code, shortUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create short URL' });
  }
});

app.get('/:code', (req, res) => {
  const { code } = req.params;
  
  const result = getLink(code);
  
  if (!result) {
    return res.status(404).json({ error: 'URL not found' });
  }

  insertClick(code, Date.now());
  
  res.redirect(302, result.url);
});

app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  
  const stats = getStats(code);
  const timestamps = getTimestamps(code);
  
  res.json({
    click_count: stats.click_count,
    timestamps
  });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`URL shortener API running on port ${PORT}`);
  });
}

start();