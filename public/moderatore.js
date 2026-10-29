const REASONS = {
  posizione: '📍 Posizione sbagliata',
  non_esiste: '🚪 Qui non c\'è una casa che partecipa',
  sicurezza: '⚠️ Posto non sicuro per i bambini',
  altro: '💬 Altro'
};
const $ = (id) => document.getElementById(id);
let KEY = '';
try { KEY = sessionStorage.getItem('mod_key') || ''; } catch (e) {}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY }
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function formatDate(ts) {
  return ts ? new Date(ts * 1000).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

async function act(id, action) {
  if (action === 'delete' && !confirm('Eliminare definitivamente questa casa?')) return;
  const r = await api('/api/admin/houses/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({ action }) });
  if (!r.ok) { alert(r.data.error || 'Operazione non riuscita.'); return; }
  load();
}

function card(h) {
  const reports = h.reports || [];
  const c = el('div', { className: 'card' + (h.hidden || reports.length ? ' flag' : '') });
  const title = el('h3', {}, h.name);
  if (h.hidden) title.append(el('span', { className: 'badge hidden-b', textContent: 'NASCOSTA' }));
  if (reports.length) title.append(el('span', { className: 'badge count', textContent: reports.length + ' segnalazioni' }));
  c.append(title);
  c.append(el('div', { className: 'meta', textContent: '📍 ' + h.address }));
  if (h.notes) c.append(el('div', { className: 'meta', textContent: '💬 ' + h.notes }));
  c.append(el('div', { className: 'meta', textContent: 'Ultima modifica: ' + formatDate(h.updated_at) }));

  const osm = el('a', { href: 'https://www.openstreetmap.org/?mlat=' + h.lat + '&mlon=' + h.lng + '#map=19/' + h.lat + '/' + h.lng, target: '_blank', rel: 'noopener', textContent: 'Guarda il punto su OpenStreetMap' });
  c.append(el('div', { className: 'meta' }, osm));

  if (reports.length) {
    const box = el('div', { className: 'reports' });
    reports.forEach((r) => box.append(el('div', { textContent: (REASONS[r.reason] || r.reason) + (r.note ? ' — «' + r.note + '»' : '') + ' (' + formatDate(r.t) + ')' })));
    c.append(box);
  }

  const actions = el('div', { className: 'actions row' });
  if (h.hidden || reports.length) actions.append(el('button', { className: 'ok', type: 'button', textContent: '✓ Riammetti', onclick: () => act(h.id, 'restore') }));
  if (!h.hidden) actions.append(el('button', { className: 'ghost', type: 'button', textContent: 'Nascondi', onclick: () => act(h.id, 'hide') }));
  actions.append(el('button', { className: 'danger', type: 'button', textContent: '🗑️ Elimina', onclick: () => act(h.id, 'delete') }));
  c.append(actions);
  return c;
}

function fill(container, houses, emptyText) {
  container.replaceChildren();
  if (!houses.length) { container.append(el('div', { className: 'empty', textContent: emptyText })); return; }
  houses.forEach((h) => container.append(card(h)));
}

async function load() {
  const r = await api('/api/admin/houses');
  if (!r.ok) {
    $('panel').hidden = true; $('login').hidden = false;
    $('loginError').textContent = r.data.error || 'Accesso non riuscito.';
    $('loginError').hidden = false;
    KEY = ''; try { sessionStorage.removeItem('mod_key'); } catch (e) {}
    return;
  }
  try { sessionStorage.setItem('mod_key', KEY); } catch (e) {}
  $('login').hidden = true; $('panel').hidden = false; $('loginError').hidden = true;
  const houses = r.data.houses || [];
  const review = houses.filter((h) => h.hidden || (h.reports && h.reports.length))
    .sort((a, b) => (b.hidden ? 1 : 0) - (a.hidden ? 1 : 0) || (b.reports.length - a.reports.length));
  const others = houses.filter((h) => !review.includes(h)).sort((a, b) => b.updated_at - a.updated_at);
  $('summary').textContent = houses.length + ' case in totale, ' + review.length + ' da controllare';
  fill($('review'), review, 'Nessuna casa da controllare. 🎃');
  fill($('others'), others, 'Nessun\'altra casa.');
}

$('enter').addEventListener('click', () => { KEY = $('key').value; $('key').value = ''; load(); });
$('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enter').click(); });
$('reload').addEventListener('click', load);
$('logout').addEventListener('click', () => {
  KEY = ''; try { sessionStorage.removeItem('mod_key'); } catch (e) {}
  $('panel').hidden = true; $('login').hidden = false;
});
if (KEY) load();
