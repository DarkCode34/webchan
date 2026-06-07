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

const toggle = document.createElement('button');
toggle.id = 'kommentar-toggle';
toggle.textContent = '💬';
document.body.appendChild(toggle);

const panel = document.createElement('div');
panel.id = 'kommentar-panel';
panel.innerHTML = `
  <h3>💬 Kommentare</h3>
  <div id="kommentar-url">${normalisiereUrl(window.location.href)}</div>
  <div id="kommentar-liste"><p style="color:#bbb; font-size:12px;">Lade Kommentare...</p></div>
  <div id="kommentar-formular">
    <textarea id="kommentar-eingabe" rows="3" placeholder="Kommentar schreiben..."></textarea>
    <button id="kommentar-senden">Absenden</button>
  </div>
`;
document.body.appendChild(panel);

const liste = document.getElementById('kommentar-liste');
const eingabe = document.getElementById('kommentar-eingabe');
const button = document.getElementById('kommentar-senden');
const aktuelleUrl = normalisiereUrl(window.location.href);

let aktiverParent = null;

toggle.addEventListener('click', () => {
  panel.classList.toggle('offen');
  toggle.textContent = panel.classList.contains('offen') ? '✕' : '💬';
  if (panel.classList.contains('offen')) kommentareLaden();
});

function zeitAnzeigen(datum) {
  return new Date(datum).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function kommentarHtml(k, eingerueckt = false) {
  const div = document.createElement('div');
  div.className = 'kommentar-eintrag' + (eingerueckt ? ' antwort' : '');
  div.innerHTML = `
    <div class="meta">
      <span class="anon-id">${k.anon_id}</span>
      <span class="zeit">· ${zeitAnzeigen(k.erstellt_am)}</span>
      <span class="upvote-btn" data-id="${k.id}">▲ ${k.upvotes}</span>
    </div>
    <div class="kommentar-text">${k.text}</div>
    <div class="antwort-btn" data-id="${k.id}">↩ Antworten</div>
  `;

  div.querySelector('.upvote-btn').addEventListener('click', async () => {
    const res = await browser.runtime.sendMessage({
      typ: 'PUT',
      url: `${SERVER}/kommentare/${k.id}/upvote`
    });
    if (res.ok) div.querySelector('.upvote-btn').textContent = `▲ ${res.daten.upvotes}`;
  });

  div.querySelector('.antwort-btn').addEventListener('click', () => {
    aktiverParent = k.id;
    eingabe.placeholder = `Antwort an ${k.anon_id}...`;
    eingabe.focus();
  });

  return div;
}

function kommentarAnzeigen(kommentare) {
  liste.innerHTML = '';
  if (kommentare.length === 0) {
    liste.innerHTML = '<p style="color:#bbb; font-size:12px;">Noch keine Kommentare.</p>';
    return;
  }
  kommentare.forEach(k => {
    liste.appendChild(kommentarHtml(k, false));
    if (k.antworten && k.antworten.length > 0) {
      k.antworten.forEach(a => liste.appendChild(kommentarHtml(a, true)));
    }
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
  if (text.length > 500) {
    alert('Kommentar zu lang! Maximum 500 Zeichen.');
    return;
  }
  eingabe.value = '';
  eingabe.placeholder = 'Kommentar schreiben...';

  await browser.runtime.sendMessage({
    typ: 'POST',
    url: `${SERVER}/kommentare`,
    body: { url: aktuelleUrl, text, parent_id: aktiverParent }
  });

  aktiverParent = null;
  kommentareLaden();
});

eingabe.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    button.click();
  }
  if (e.key === 'Escape') {
    aktiverParent = null;
    eingabe.placeholder = 'Kommentar schreiben...';
  }
});

kommentareLaden();
setInterval(kommentareLaden, 10000);
