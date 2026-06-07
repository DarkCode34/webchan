const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kommentare (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      text TEXT NOT NULL,
      anon_id TEXT NOT NULL,
      parent_id INTEGER REFERENCES kommentare(id) ON DELETE CASCADE,
      upvotes INTEGER DEFAULT 0,
      erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
initDb();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT');
  next();
});

const rateLimits = {};
function rateLimit(ip) {
  const jetzt = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => jetzt - t < 60000);
  if (rateLimits[ip].length >= 5) return false;
  rateLimits[ip].push(jetzt);
  return true;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function baumeStruktur(rows) {
  const map = {};
  const roots = [];
  rows.forEach(r => map[r.id] = { ...r, antworten: [] });
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].antworten.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  return roots;
}

app.get('/kommentare', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ fehler: 'URL fehlt' });
  const result = await pool.query(
    'SELECT * FROM kommentare WHERE url = $1 ORDER BY erstellt_am ASC',
    [url]
  );
  res.json(baumeStruktur(result.rows));
});

app.post('/kommentare', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!rateLimit(ip)) {
    return res.status(429).json({ fehler: 'Zu viele Kommentare, bitte warte kurz.' });
  }

  let { url, text, parent_id } = req.body;
  if (!url || !text) return res.status(400).json({ fehler: 'Felder fehlen' });
  if (text.length > 500) return res.status(400).json({ fehler: 'Kommentar zu lang (max 500 Zeichen)' });
  if (url.length > 500) return res.status(400).json({ fehler: 'URL zu lang' });

  text = escapeHtml(text);
  parent_id = parent_id ? parseInt(parent_id) : null;

  const anon_id = 'Anon-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  const result = await pool.query(
    'INSERT INTO kommentare (url, text, anon_id, parent_id) VALUES ($1, $2, $3, $4) RETURNING id, anon_id',
    [url, text, anon_id, parent_id]
  );
  res.json({ id: result.rows[0].id, anon_id: result.rows[0].anon_id });
});

app.put('/kommentare/:id/upvote', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE kommentare SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ fehler: 'Kommentar nicht gefunden' });
  res.json({ upvotes: result.rows[0].upvotes });
});

app.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
