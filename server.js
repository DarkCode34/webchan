const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('kommentare.db');

// Tabelle erstellen falls nicht vorhanden
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

// CORS erlauben damit die Extension zugreifen darf
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Kommentare für eine URL abrufen
app.get('/kommentare', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ fehler: 'URL fehlt' });
  const rows = db.prepare('SELECT * FROM kommentare WHERE url = ? ORDER BY erstellt_am ASC').all(url);
  res.json(rows);
});

// Neuen Kommentar speichern
app.post('/kommentare', (req, res) => {
  const { url, text, anon_id } = req.body;
  if (!url || !text || !anon_id) return res.status(400).json({ fehler: 'Felder fehlen' });
  const result = db.prepare('INSERT INTO kommentare (url, text, anon_id) VALUES (?, ?, ?)').run(url, text, anon_id);
  res.json({ id: result.lastInsertRowid });
});

app.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
