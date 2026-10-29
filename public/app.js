/**
 * ZuccAmica Guidizzolo - Logica Semplificata, Sicura e 100% GDPR
 * Zero PIN da ricordare: riconoscimento automatico del telefono proprietario via localStorage
 */

const AppState = {
  map: null,
  markersLayer: null,
  userMarker: null,
  houses: [],
  placing: false,
  draftMarker: null,
  markerById: {},
  view: 'map',
  ownedHouses: JSON.parse(localStorage.getItem('halloween_owned_houses') || '{}')
};

function saveHouseOwnership(id, token) {
  if (!id || !token) return;
  AppState.ownedHouses[id] = token;
  localStorage.setItem('halloween_owned_houses', JSON.stringify(AppState.ownedHouses));
}

// Identificativo casuale del telefono: serve solo a contare una segnalazione per telefono
function getDeviceId() {
  try {
    let id = localStorage.getItem('halloween_device_id');
    if (!id) {
      id = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('halloween_device_id', id);
    }
    return id;
  } catch (e) {
    return '';
  }
}

function formatCode(code) {
  return code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
}

// Stradario locale client-side per trovare istantaneamente la via più vicina quando si tocca la mappa
const LOCAL_STREETS = [
  { lat: 45.3190, lng: 10.5830, name: "Piazza Guglielmo Marconi" },
  { lat: 45.3165, lng: 10.5844, name: "Via Roma" },
  { lat: 45.3205, lng: 10.5815, name: "Via Solferino" },
  { lat: 45.3180, lng: 10.5805, name: "Via Giuseppe Garibaldi" },
  { lat: 45.3185, lng: 10.5825, name: "Via Giacomo Matteotti" },
  { lat: 45.3175, lng: 10.5855, name: "Via Vittorio Veneto" },
  { lat: 45.3160, lng: 10.5870, name: "Via Goito" },
  { lat: 45.3220, lng: 10.5810, name: "Via Cavriana" },
  { lat: 45.3200, lng: 10.5780, name: "Via Medole" },
  { lat: 45.3170, lng: 10.5790, name: "Via Rodella" },
  { lat: 45.3140, lng: 10.5800, name: "Via per Ceresara" },
  { lat: 45.3210, lng: 10.5840, name: "Via Don Minzoni" },
  { lat: 45.3195, lng: 10.5860, name: "Via Don Carra" },
  { lat: 45.3150, lng: 10.5860, name: "Via San Cassiano" },
  { lat: 45.3175, lng: 10.5815, name: "Via Dante Alighieri" },
  { lat: 45.3180, lng: 10.5835, name: "Via Alessandro Manzoni" },
  { lat: 45.3085, lng: 10.5695, name: "Frazione Birbesi" },
  { lat: 45.3120, lng: 10.6050, name: "Frazione Rebecco" },
  { lat: 45.3280, lng: 10.5750, name: "Località Selaschi" }
];

function findClosestStreetLocal(lat, lng) {
  let closest = "Posizione da mappa (Guidizzolo)";
  let minD = Infinity;
  for (const s of LOCAL_STREETS) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    if (d < minD) {
      minD = d;
      closest = s.name;
    }
  }
  return closest;
}

// ==========================================================================
// 1. Inizializzazione Mappa Locale
// ==========================================================================

function initMap() {
  if (typeof L === 'undefined') {
    setTimeout(initMap, 200);
    return;
  }

  const mapContainer = document.getElementById('map');
  if (!mapContainer || AppState.map) return;

  mapContainer.classList.add('spooky-tiles');

  AppState.map = L.map('map', {
    zoomControl: false,
    preferCanvas: true
  }).setView([45.3188, 10.5828], 15);

  L.control.zoom({ position: 'topright' }).addTo(AppState.map);

  // Mappa OpenStreetMap servita dal nostro stesso sito: nessun IP dei visitatori arriva a terzi
  L.tileLayer('/tiles/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    minZoom: 12,
    maxZoom: 18
  }).addTo(AppState.map);

  AppState.markersLayer = L.layerGroup().addTo(AppState.map);

  // Click su mappa per scegliere posizione casa
  AppState.map.on('click', (e) => {
    if (AppState.placing && AppState.draftMarker) {
      AppState.draftMarker.setLatLng(e.latlng);
    }
  });

  setTimeout(() => {
    if (AppState.map) AppState.map.invalidateSize();
  }, 150);

  window.addEventListener('resize', () => {
    if (AppState.map) AppState.map.invalidateSize();
  });
}

// ==========================================================================
// 2. Rendering Case & Popups Grandi
// ==========================================================================

function createHouseIcon(house) {
  const emoji = '🎃';
  const statusClass = 'active';

  const html = `
    <div class="custom-pumpkin-marker">
      <div class="marker-pin ${statusClass}">
        <span class="marker-emoji">${emoji}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-pumpkin-icon',
    html: html,
    iconSize: [48, 48],
    iconAnchor: [24, 44],
    popupAnchor: [0, -40]
  });
}

function renderHouses() {
  if (!AppState.markersLayer) return;
  AppState.markersLayer.clearLayers();
  AppState.markerById = {};

  AppState.houses.forEach(house => {
    const marker = L.marker([house.lat, house.lng], {
      icon: createHouseIcon(house)
    });

    const statusText = '🎃 Casa aperta ai bimbi!';
    const statusClass = 'active';
    const isOwner = Boolean(AppState.ownedHouses[house.id]);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${house.lat},${house.lng}&travelmode=walking`;

    const popupHtml = `
      <div class="house-popup">
        <span class="popup-status ${statusClass}">${statusText}</span>
        <h3 class="popup-title">${escapeHtml(house.name)}</h3>
        <p class="popup-address">📍 ${escapeHtml(house.address)}</p>
        ${house.notes ? `<div class="popup-notes">💬 ${escapeHtml(house.notes)}</div>` : ''}

        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-popup-nav">
          🚶 Portami qui (Navigatore)
        </a>

        ${isOwner ? `<button type="button" class="btn-popup-manage" data-manage="${escapeAttr(house.id)}">
          ⚙️ Gestisci la tua casa (Rimuovi)
        </button>` : ''}
        <button type="button" class="btn-popup-report" data-report="${escapeAttr(house.id)}">
          🚩 Segnala un problema
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    AppState.markersLayer.addLayer(marker);
    AppState.markerById[house.id] = marker;
  });

  updateCounter();
  renderList();
}

async function loadHouses() {
  try {
    const res = await fetch('/api/houses');
    const data = await res.json();
    if (data.houses) {
      AppState.houses = data.houses;
      renderHouses();
      return;
    }
  } catch (e) {
    // Fallback statico: legge direttamente houses.json se ospitato senza backend
    try {
      const staticRes = await fetch('/houses.json');
      const staticData = await staticRes.json();
      if (staticData.houses) {
        AppState.houses = staticData.houses;
        renderHouses();
      }
    } catch (err) {
      console.error('Errore caricamento case:', err);
    }
  }
}

// ==========================================================================
// 3. Geolocalizzazione 100% Locale ("Dove sono?")
// ==========================================================================

function locateMe() {
  if (!navigator.geolocation) {
    showToast('Geolocalizzazione non supportata dal telefono', 'error');
    return;
  }

  showToast('Calcolo posizione sul tuo telefono... 📡');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (!AppState.userMarker) {
        const userIcon = L.divIcon({
          className: 'leaflet-gps-wrap',
          html: '<div class="user-gps-marker"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        AppState.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(AppState.map);
        AppState.userMarker.bindPopup('<strong style="font-size:18px;">📍 Tu sei qui!</strong><br><small>Visibile solo sul tuo schermo</small>');
      } else {
        AppState.userMarker.setLatLng([lat, lng]);
      }

      AppState.map.setView([lat, lng], 17);
      showToast('Posizione trovata! 📍', 'success');
    },
    (err) => {
      console.warn('GPS error:', err);
      showToast('Attiva il GPS per vedere dove ti trovi', 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ==========================================================================
// 4. Posizione della casa: ricerca per indirizzo e conferma sulla mappa
// ==========================================================================

function startPlacement(lat, lng, messageHtml) {
  AppState.placing = true;
  closeAllModals();
  setView('map');
  document.querySelector('.map-wrapper').classList.add('is-placing');

  if (AppState.draftMarker) AppState.map.removeLayer(AppState.draftMarker);
  AppState.draftMarker = L.marker([lat, lng], {
    draggable: true,
    icon: createHouseIcon()
  }).addTo(AppState.map);
  AppState.map.setView([lat, lng], 18);

  document.getElementById('pickBannerText').innerHTML = messageHtml;
  document.getElementById('pickLocationBanner').classList.remove('hidden');
}

function endPlacement() {
  AppState.placing = false;
  document.querySelector('.map-wrapper').classList.remove('is-placing');
  if (AppState.draftMarker) {
    AppState.map.removeLayer(AppState.draftMarker);
    AppState.draftMarker = null;
  }
  document.getElementById('pickLocationBanner').classList.add('hidden');
}

function cancelPlacement() {
  endPlacement();
  openModal('modalRegister');
}

function confirmPlacement() {
  if (!AppState.draftMarker) return;
  const { lat, lng } = AppState.draftMarker.getLatLng();
  endPlacement();

  document.getElementById('regLat').value = lat.toFixed(5);
  document.getElementById('regLng').value = lng.toFixed(5);

  // L'indirizzo scritto dall'utente (con il civico) resta quello mostrato a tutti
  const addressInput = document.getElementById('regAddress');
  if (!addressInput.value.trim()) addressInput.value = findClosestStreetLocal(lat, lng);

  const badge = document.getElementById('locationConfirmedBadge');
  badge.textContent = '✓ Posizione confermata sulla mappa!';
  badge.classList.remove('hidden');

  openModal('modalRegister');
  showToast('Posizione confermata 📍', 'success');
}

async function searchAddressOnMap() {
  const address = document.getElementById('regAddress').value.trim();
  if (address.length < 3) {
    showToast('Scrivi prima la via e il numero civico', 'error');
    return;
  }

  const btn = document.getElementById('btnPickOnMap');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Cerco...';

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (res.ok && data.found) {
      startPlacement(
        data.lat,
        data.lng,
        data.precision === 'house'
          ? '📍 <strong>Controlla che il segnaposto sia sulla tua casa.</strong> Se serve, trascinalo o tocca la mappa.'
          : '📍 Ho trovato la via ma non il numero: <strong>trascina il segnaposto sulla tua casa.</strong>'
      );
      return;
    }
  } catch (e) {
    // Si passa alla scelta manuale qui sotto
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }

  showToast('Non trovo questo indirizzo: posiziona tu il segnaposto', 'error');
  const c = AppState.map.getCenter();
  startPlacement(c.lat, c.lng, '👉 <strong>Trascina il segnaposto sulla tua casa</strong> (o tocca la mappa), poi conferma.');
}

// ==========================================================================
// 5. Invio Registrazione Casa (Salvataggio Automatico Token Dispositivo)
// ==========================================================================

async function handleRegisterSubmit(e) {
  e.preventDefault();

  // Senza un punto confermato sulla mappa si parte dalla ricerca dell'indirizzo
  if (isNaN(parseFloat(document.getElementById('regLat').value)) || isNaN(parseFloat(document.getElementById('regLng').value))) {
    searchAddressOnMap();
    return;
  }

  const btn = document.getElementById('btnSubmitRegister');
  btn.disabled = true;
  btn.textContent = 'Salvataggio in corso...';

  const latVal = parseFloat(document.getElementById('regLat').value);
  const lngVal = parseFloat(document.getElementById('regLng').value);
  const address = document.getElementById('regAddress').value.trim();
  const name = document.getElementById('regName').value.trim();
  const notes = document.getElementById('regNotes').value.trim();

  try {
    const payload = {
      name,
      address,
      lat: isNaN(latVal) ? null : latVal,
      lng: isNaN(lngVal) ? null : lngVal,
      notes
    };

    const res = await fetch('/api/houses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Errore durante la registrazione.');
      btn.disabled = false;
      btn.textContent = '🎃 Metti la Casa sulla Mappa';
      return;
    }

    // Salva automaticamente il token sul telefono del proprietario (Zero PIN da ricordare!)
    saveHouseOwnership(data.id, data.editToken);

    const manageUrl = `${window.location.origin}/?manage=${data.id}&token=${data.editToken}`;
    const linkInput = document.getElementById('directManageLink');
    if (linkInput) linkInput.value = manageUrl;

    const codeBox = document.getElementById('houseCodeDisplay');
    if (codeBox) codeBox.textContent = formatCode(data.code);

    const btnWhatsapp = document.getElementById('btnShareWhatsApp');
    if (btnWhatsapp) {
      const whatsappText = `Ecco il link per gestire la nostra casa di Halloween (${name}): ${manageUrl}\nCodice casa: ${formatCode(data.code)}`;
      btnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
    }

    const btnEmail = document.getElementById('btnSendEmail');
    if (btnEmail) {
      const emailSubject = `Halloween - Link gestione casa: ${name}`;
      const emailBody = `Ecco il link personale per gestire la casa "${name}" (${address}):\n\n${manageUrl}\n\nCodice casa: ${formatCode(data.code)}`;
      btnEmail.href = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    }

    document.getElementById('formRegisterHouse').classList.add('hidden');
    document.getElementById('registerSuccessView').classList.remove('hidden');

    await loadHouses();
    if (AppState.map && data.lat && data.lng) {
      AppState.map.flyTo([data.lat, data.lng], 17);
    }
    showToast('Casa aggiunta sulla mappa! 🎃', 'success');
  } catch (err) {
    console.error('Errore submit:', err);
    showToast('Errore di connessione durante il salvataggio.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎃 Metti la Casa sulla Mappa';
  }
}

// ==========================================================================
// 6. Gestione Casa (Protetta da Token Dispositivo - Zero PIN)
// ==========================================================================

window.openManageHouse = function(id, name, address) {
  document.getElementById('manageHouseId').value = id;
  document.getElementById('manageEditToken').value = AppState.ownedHouses[id] || '';
  document.getElementById('manageHouseName').textContent = name;
  document.getElementById('manageHouseAddress').textContent = address;

  openModal('modalManage');
};

async function openDirectManagement(id, token) {
  saveHouseOwnership(id, token);
  try {
    const res = await fetch(`/api/houses/${id}/manage?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById('manageHouseId').value = id;
    document.getElementById('manageEditToken').value = token;
    document.getElementById('manageHouseName').textContent = data.house.name;
    document.getElementById('manageHouseAddress').textContent = data.house.address;

    openModal('modalManage');
  } catch (e) {
    console.error(e);
  }
}

async function handleDeleteHouse() {
  if (!confirm('Vuoi rimuovere la tua casa dalla mappa?')) return;

  const id = document.getElementById('manageHouseId').value;
  const editToken = document.getElementById('manageEditToken').value || AppState.ownedHouses[id] || '';

  try {
    const res = await fetch(`/api/houses/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editToken })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Impossibile rimuovere.');
      return;
    }

    showToast('Casa rimossa dalla mappa.');
    closeAllModals();
    await loadHouses();
  } catch (err) {
    alert('Errore di connessione.');
  }
}

// ==========================================================================
// 6b. "La mia casa" (con il codice) e segnalazioni
// ==========================================================================

async function handleClaimSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('claimCode');
  const errorBox = document.getElementById('claimError');
  const btn = document.getElementById('btnClaim');
  errorBox.classList.add('hidden');
  btn.disabled = true;

  try {
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: input.value })
    });
    const data = await res.json();
    if (!res.ok) {
      errorBox.textContent = data.error || 'Codice non valido.';
      errorBox.classList.remove('hidden');
      return;
    }

    // Da ora questo telefono riconosce la casa come sua
    saveHouseOwnership(data.house.id, data.editToken);
    input.value = '';
    openManageHouse(data.house.id, data.house.name, data.house.address);
    if (data.house.hidden) {
      showToast('Questa casa è nascosta in attesa di controllo dopo alcune segnalazioni.', 'error');
    }
  } catch (err) {
    errorBox.textContent = 'Errore di connessione. Riprova.';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

window.openReportHouse = function(id, name) {
  document.getElementById('formReport').reset();
  document.getElementById('reportHouseId').value = id;
  document.getElementById('reportHouseName').textContent = name;
  openModal('modalReport');
};

async function handleReportSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('reportHouseId').value;
  const checked = document.querySelector('input[name="reportReason"]:checked');
  if (!checked) {
    showToast('Scegli quale problema vuoi segnalare', 'error');
    return;
  }
  const reporterId = getDeviceId();
  if (!reporterId) {
    showToast('Da questo browser non riesco a inviare la segnalazione', 'error');
    return;
  }

  const btn = document.getElementById('btnSendReport');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/houses/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: checked.value,
        note: document.getElementById('reportNote').value.trim(),
        reporterId
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Non sono riuscito a inviare la segnalazione.', 'error');
      return;
    }
    closeAllModals();
    showToast(data.already ? 'Avevamo già ricevuto la tua segnalazione. Grazie!' : 'Segnalazione inviata, grazie! 🙏', 'success');
    await loadHouses();
  } catch (err) {
    showToast('Errore di connessione. Riprova.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 7. Utility Modali & Toast
// ==========================================================================

function openModal(id) {
  closeAllModals();
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : '')}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ==========================================================================
// 8. Setup & Avvio Immediato
// ==========================================================================

// ==========================================================================
// 7b. Contatore, elenco delle case e cambio vista
// ==========================================================================

function updateCounter() {
  const n = AppState.houses.length;
  const number = document.getElementById('houseCounterNumber');
  const label = document.getElementById('houseCounterLabel');
  if (number) number.textContent = String(n);
  if (label) label.textContent = n === 1 ? 'casa aperta ai bimbi' : 'case aperte ai bimbi';
}

function renderList() {
  const container = document.getElementById('listItems');
  if (!container) return;

  const searchInput = document.getElementById('listSearch');
  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

  const items = AppState.houses
    .filter(h => !q || `${h.name} ${h.address}`.toLowerCase().includes(q))
    .sort((a, b) => String(a.address).localeCompare(String(b.address), 'it', { numeric: true }));

  if (items.length === 0) {
    container.innerHTML = `<p class="list-empty">${
      AppState.houses.length
        ? 'Nessuna casa corrisponde alla ricerca.'
        : 'Ancora nessuna casa sulla mappa. Aggiungi la tua con il pulsante arancione! 🎃'
    }</p>`;
    return;
  }

  container.innerHTML = items.map(h => `
    <article class="list-item">
      <h3 class="list-item-title">🎃 ${escapeHtml(h.name)}</h3>
      <p class="list-item-address">📍 ${escapeHtml(h.address)}</p>
      ${h.notes ? `<p class="list-item-notes">💬 ${escapeHtml(h.notes)}</p>` : ''}
      <div class="list-item-actions">
        <button type="button" class="btn-list-map" data-house="${escapeAttr(h.id)}">🗺️ Vedi sulla mappa</button>
        <a class="btn-list-nav" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.lat + ',' + h.lng)}&travelmode=walking">🚶 Portami qui</a>
        <button type="button" class="btn-list-report" data-report="${escapeAttr(h.id)}">🚩 Segnala un problema</button>
      </div>
    </article>
  `).join('');
}

function setView(name) {
  AppState.view = name;
  const wrapper = document.querySelector('.map-wrapper');
  if (wrapper) wrapper.classList.toggle('is-list', name === 'list');
  document.getElementById('listView').classList.toggle('hidden', name !== 'list');
  document.getElementById('btnViewMap').classList.toggle('active', name === 'map');
  document.getElementById('btnViewList').classList.toggle('active', name === 'list');
  if (name === 'map' && AppState.map) {
    setTimeout(() => AppState.map.invalidateSize(), 50);
  }
}

function showHouseOnMap(id) {
  setView('map');
  const house = AppState.houses.find(h => h.id === id);
  const marker = AppState.markerById[id];
  if (!house || !AppState.map) return;
  AppState.map.flyTo([house.lat, house.lng], 17);
  if (marker) setTimeout(() => marker.openPopup(), 400);
}

// Cartellino di benvenuto: solo alla prima visita, si chiude con un tocco
function initWelcome(showNow) {
  const card = document.getElementById('welcomeCard');
  if (!card) return;
  const close = () => {
    card.classList.add('hidden');
    try { localStorage.setItem('halloween_welcome_seen', '1'); } catch (e) { /* ok */ }
  };
  document.getElementById('btnWelcomeClose').addEventListener('click', close);
  document.getElementById('btnWelcomeAdd').addEventListener('click', () => {
    close();
    document.getElementById('btnOpenRegister').click();
  });
  // Il pulsante "Aiuto" in alto riapre il cartellino quando si vuole
  const help = document.getElementById('btnOpenHelp');
  if (help) help.addEventListener('click', () => {
    setView('map');
    card.classList.remove('hidden');
  });

  if (!showNow) return;
  try {
    if (localStorage.getItem('halloween_welcome_seen') === '1') return;
  } catch (e) { /* senza memoria del browser compare ogni volta, nessun danno */ }
  card.classList.remove('hidden');
}

function initApp() {
  const btnAdd = document.getElementById('btnOpenRegister');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      // Chi inizia ad aggiungere la casa ha capito: il cartellino non deve coprire la mappa
      const welcome = document.getElementById('welcomeCard');
      if (welcome && !welcome.classList.contains('hidden')) {
        welcome.classList.add('hidden');
        try { localStorage.setItem('halloween_welcome_seen', '1'); } catch (e) { /* ok */ }
      }
      document.getElementById('formRegisterHouse').classList.remove('hidden');
      document.getElementById('registerSuccessView').classList.add('hidden');
      document.getElementById('formRegisterHouse').reset();
      document.getElementById('locationConfirmedBadge').classList.add('hidden');
      document.getElementById('regLat').value = '';
      document.getElementById('regLng').value = '';
      const btn = document.getElementById('btnSubmitRegister');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🎃 Metti la Casa sulla Mappa';
      }
      openModal('modalRegister');
    });
  }

  const btnAddBig = document.getElementById('btnAddHouseBig');
  if (btnAddBig) btnAddBig.addEventListener('click', () => document.getElementById('btnOpenRegister').click());

  const btnPrivacy = document.getElementById('btnOpenPrivacy');
  if (btnPrivacy) {
    btnPrivacy.addEventListener('click', () => openModal('modalPrivacy'));
  }

  const btnLocate = document.getElementById('btnLocateMe');
  if (btnLocate) btnLocate.addEventListener('click', locateMe);

  const btnPick = document.getElementById('btnPickOnMap');
  if (btnPick) btnPick.addEventListener('click', searchAddressOnMap);

  const btnCancelPick = document.getElementById('btnCancelPick');
  if (btnCancelPick) btnCancelPick.addEventListener('click', cancelPlacement);

  const btnConfirmPick = document.getElementById('btnConfirmPick');
  if (btnConfirmPick) btnConfirmPick.addEventListener('click', confirmPlacement);

  // Se cambia l'indirizzo scritto, il punto già confermato non vale più
  const regAddress = document.getElementById('regAddress');
  if (regAddress) {
    regAddress.addEventListener('input', () => {
      document.getElementById('regLat').value = '';
      document.getElementById('regLng').value = '';
      document.getElementById('locationConfirmedBadge').classList.add('hidden');
    });
  }

  // Cambio vista Mappa / Elenco, ricerca e pulsanti dell'elenco
  const btnViewMap = document.getElementById('btnViewMap');
  if (btnViewMap) btnViewMap.addEventListener('click', () => setView('map'));
  const btnViewList = document.getElementById('btnViewList');
  if (btnViewList) btnViewList.addEventListener('click', () => setView('list'));
  const listSearch = document.getElementById('listSearch');
  if (listSearch) listSearch.addEventListener('input', renderList);
  // Pulsanti dentro i fumetti della mappa (niente onclick nell'HTML: più sicuro)
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.addEventListener('click', (e) => {
      const man = e.target.closest('[data-manage]');
      const rep = e.target.closest('[data-report]');
      const id = man ? man.dataset.manage : rep ? rep.dataset.report : '';
      const house = AppState.houses.find(x => x.id === id);
      if (!house) return;
      if (man) openManageHouse(house.id, house.name, house.address);
      if (rep) openReportHouse(house.id, house.name);
    });
  }

  const listItems = document.getElementById('listItems');
  if (listItems) {
    listItems.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-house]');
      if (btn) showHouseOnMap(btn.dataset.house);
      const rep = e.target.closest('[data-report]');
      if (rep) {
        const house = AppState.houses.find(x => x.id === rep.dataset.report);
        if (house) openReportHouse(house.id, house.name);
      }
    });
  }

  const formReg = document.getElementById('formRegisterHouse');
  if (formReg) formReg.addEventListener('submit', handleRegisterSubmit);


  const btnMyHouse = document.getElementById('btnMyHouse');
  if (btnMyHouse) btnMyHouse.addEventListener('click', () => openModal('modalClaim'));
  const btnMyHouseList = document.getElementById('btnMyHouseList');
  if (btnMyHouseList) btnMyHouseList.addEventListener('click', () => openModal('modalClaim'));
  const formClaim = document.getElementById('formClaim');
  if (formClaim) formClaim.addEventListener('submit', handleClaimSubmit);
  const formReport = document.getElementById('formReport');
  if (formReport) formReport.addEventListener('submit', handleReportSubmit);

  const btnDelete = document.getElementById('btnDeleteHouse');
  if (btnDelete) btnDelete.addEventListener('click', handleDeleteHouse);

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.dataset.close;
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  initMap();
  loadHouses();

  const urlParams = new URLSearchParams(window.location.search);
  const manageId = urlParams.get('manage');
  const token = urlParams.get('token');
  if (manageId && token) {
    openDirectManagement(manageId, token);
    // Il codice segreto è già salvato sul telefono: lo togliamo dalla barra degli indirizzi
    try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* ok */ }
    initWelcome(false);
  } else {
    initWelcome(true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
