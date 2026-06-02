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
      erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
initDb();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
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

app.get('/kommentare', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ fehler: 'URL fehlt' });
  const result = await pool.query(
    'SELECT * FROM kommentare WHERE url = $1 ORDER BY erstellt_am ASC',
    [url]
  );
  res.json(result.rows);
});

app.post('/kommentare', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!rateLimit(ip)) {
    return res.status(429).json({ fehler: 'Zu viele Kommentare, bitte warte kurz.' });
  }

  let { url, text, anon_id } = req.body;
  if (!url || !text || !anon_id) return res.status(400).json({ fehler: 'Felder fehlen' });

  if (text.length > 500) return res.status(400).json({ fehler: 'Kommentar zu lang (max 500 Zeichen)' });
  if (url.length > 500) return res.status(400).json({ fehler: 'URL zu lang' });

  text = escapeHtml(text);
  anon_id = escapeHtml(anon_id);

  const result = await pool.query(
    'INSERT INTO kommentare (url, text, anon_id) VALUES ($1, $2, $3) RETURNING id',
    [url, text, anon_id]
  );
  res.json({ id: result.rows[0].id });
});

app.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
