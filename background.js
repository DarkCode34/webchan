browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.typ === 'GET') {
    fetch(request.url)
      .then(r => r.json())
      .then(daten => sendResponse({ ok: true, daten }))
      .catch(() => sendResponse({ ok: false }));
  } else if (request.typ === 'POST') {
    fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    })
      .then(r => r.json())
      .then(daten => sendResponse({ ok: true, daten }))
      .catch(() => sendResponse({ ok: false }));
  } else if (request.typ === 'PUT') {
    fetch(request.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(r => r.json())
      .then(daten => sendResponse({ ok: true, daten }))
      .catch(() => sendResponse({ ok: false }));
  }
  return true;
});
