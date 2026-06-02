const SERVER = 'https://webchan-9w51.onrender.com';

function normalisiereUrl(url) {
  try {
    const u = new URL(url);
    let ergebnis = u.hostname.replace(/^www\./, '') + u.pathname;
    ergebnis = ergebnis.replace(/\/$/, '');
    return ergebnis.toLowerCase();
  } catch {
    return url;
  }
}

const panel = document.createElement('div');
panel.id = 'kommentar-panel';
panel.innerHTML = `
  <h3>💬 Kommentare</h3>
  <div id="kommentar-url">${normalisiereUrl(window.location.href)}</div>
  <div id="kommentar-liste"><p style="color:#bbb; font-size:12px;">Lade Kommentare...</p></div>
  <textarea id="kommentar-eingabe" rows="3" placeholder="Kommentar schreiben..."></textarea>
  <button id="kommentar-senden">Absenden</button>
`;
document.body.appendChild(panel);

const liste = document.getElementById('kommentar-liste');
const eingabe = document.getElementById('kommentar-eingabe');
const button = document.getElementById('kommentar-senden');
const aktuelleUrl = normalisiereUrl(window.location.href);
const anonId = 'Anon-' + Math.random().toString(36).slice(2, 6).toUpperCase();

function kommentarAnzeigen(kommentare) {
  liste.innerHTML = '';
  if (kommentare.length === 0) {
    liste.innerHTML = '<p style="color:#bbb; font-size:12px;">Noch keine Kommentare.</p>';
    return;
  }
  kommentare.forEach(k => {
    const eintrag = document.createElement('div');
    eintrag.className = 'kommentar-eintrag';
    eintrag.innerHTML = `
      <div class="meta">${k.anon_id} · ${new Date(k.erstellt_am).toLocaleTimeString()}</div>
      <div>${k.text}</div>
    `;
    liste.appendChild(eintrag);
  });
  liste.scrollTop = liste.scrollHeight;
}

async function kommentareLaden() {
  const res = await browser.runtime.sendMessage({
    typ: 'GET',
    url: `${SERVER}/kommentare?url=${encodeURIComponent(aktuelleUrl)}`
  });
  if (res.ok) kommentarAnzeigen(res.daten);
  else liste.innerHTML = '<p style="color:#f66; font-size:12px;">Server nicht erreichbar.</p>';
}

button.addEventListener('click', async () => {
  const text = eingabe.value.trim();
  if (!text) return;
  eingabe.value = '';
  await browser.runtime.sendMessage({
    typ: 'POST',
    url: `${SERVER}/kommentare`,
    body: { url: aktuelleUrl, text, anon_id: anonId }
  });
  kommentareLaden();
});

eingabe.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    button.click();
  }
});

kommentareLaden();
setInterval(kommentareLaden, 10000);
