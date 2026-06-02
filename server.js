const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('kommentare.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS kommentare (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    anon_id TEXT NOT NULL,
    erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Rate-Limiting: max 5 Kommentare pro IP pro Minute
const rateLimits = {};
function rateLimit(ip) {
  const jetzt = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => jetzt - t < 60000);
  if (rateLimits[ip].length >= 5) return false;
  rateLimits[ip].push(jetzt);
  return true;
}

// XSS-Schutz: HTML escapen
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.get('/kommentare', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ fehler: 'URL fehlt' });
  const rows = db.prepare('SELECT * FROM kommentare WHERE url = ? ORDER BY erstellt_am ASC').all(url);
  res.json(rows);
});

app.post('/kommentare', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (!rateLimit(ip)) {
    return res.status(429).json({ fehler: 'Zu viele Kommentare, bitte warte kurz.' });
  }

  let { url, text, anon_id } = req.body;
  if (!url || !text || !anon_id) return res.status(400).json({ fehler: 'Felder fehlen' });

  // Länge begrenzen
  if (text.length > 500) return res.status(400).json({ fehler: 'Kommentar zu lang (max 500 Zeichen)' });
  if (url.length > 500) return res.status(400).json({ fehler: 'URL zu lang' });

  // HTML escapen
  text = escapeHtml(text);
  anon_id = escapeHtml(anon_id);

  const result = db.prepare('INSERT INTO kommentare (url, text, anon_id) VALUES (?, ?, ?)').run(url, text, anon_id);
  res.json({ id: result.lastInsertRowid });
});

app.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
