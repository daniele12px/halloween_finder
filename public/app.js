/**
 * ZuccAmica Guidizzolo - Logica Semplificata, Sicura e 100% GDPR
 * Zero PIN da ricordare: riconoscimento automatico del telefono proprietario via localStorage
 */

const AppState = {
  map: null,
  markersLayer: null,
  userMarker: null,
  houses: [],
  pickingLocationOnMap: false,
  ownedHouses: JSON.parse(localStorage.getItem('halloween_owned_houses') || '{}')
};

function saveHouseOwnership(id, token) {
  if (!id || !token) return;
  AppState.ownedHouses[id] = token;
  localStorage.setItem('halloween_owned_houses', JSON.stringify(AppState.ownedHouses));
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

  L.control.zoom({ position: 'bottomright' }).addTo(AppState.map);

  // Mappa OpenStreetMap servita dal nostro stesso sito: nessun IP dei visitatori arriva a terzi
  L.tileLayer('/tiles/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    minZoom: 12,
    maxZoom: 18
  }).addTo(AppState.map);

  AppState.markersLayer = L.layerGroup().addTo(AppState.map);

  // Click su mappa per scegliere posizione casa
  AppState.map.on('click', (e) => {
    if (AppState.pickingLocationOnMap) {
      handleLocationPicked(e.latlng.lat, e.latlng.lng);
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

        ${isOwner ? `<button class="btn-popup-manage" onclick="openManageHouse('${house.id}', '${escapeAttr(house.name)}', '${escapeAttr(house.address)}')">
          ⚙️ Gestisci la tua casa (Rimuovi)
        </button>` : ''}
      </div>
    `;

    marker.bindPopup(popupHtml);
    AppState.markersLayer.addLayer(marker);
  });
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
// 4. Scelta Posizione su Mappa con Compilazione Automatica Indirizzo
// ==========================================================================

function startPickOnMap() {
  AppState.pickingLocationOnMap = true;
  closeAllModals();
  const banner = document.getElementById('pickLocationBanner');
  if (banner) banner.classList.remove('hidden');
  showToast('Tocca sulla mappa il punto esatto della tua casa!');
}

function cancelPickOnMap() {
  AppState.pickingLocationOnMap = false;
  const banner = document.getElementById('pickLocationBanner');
  if (banner) banner.classList.add('hidden');
  openModal('modalRegister');
}

async function handleLocationPicked(lat, lng) {
  AppState.pickingLocationOnMap = false;
  const banner = document.getElementById('pickLocationBanner');
  if (banner) banner.classList.add('hidden');

  document.getElementById('regLat').value = lat.toFixed(5);
  document.getElementById('regLng').value = lng.toFixed(5);

  // Compila SUBITO il campo indirizzo con la via più vicina così non rimane mai vuoto!
  const addressInput = document.getElementById('regAddress');
  const fallbackStreet = findClosestStreetLocal(lat, lng);
  addressInput.value = fallbackStreet;

  const badge = document.getElementById('locationConfirmedBadge');
  badge.textContent = `✓ Posizione impostata su mappa (${fallbackStreet})`;
  badge.classList.remove('hidden');

  openModal('modalRegister');
  showToast(`Posizione scelta: ${fallbackStreet} 📍`, 'success');

  // Affina il nome della via chiedendo al server (reverse geocoding)
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (data && data.address) {
      addressInput.value = data.address;
      badge.textContent = `✓ Posizione selezionata: ${data.address}`;
    }
  } catch (e) {
    // Mantiene il valore già inserito dallo stradario locale
  }
}

// ==========================================================================
// 5. Invio Registrazione Casa (Salvataggio Automatico Token Dispositivo)
// ==========================================================================

async function handleRegisterSubmit(e) {
  e.preventDefault();
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

    const btnWhatsapp = document.getElementById('btnShareWhatsApp');
    if (btnWhatsapp) {
      const whatsappText = `Ecco il link per gestire la nostra casa di Halloween (${name}): ${manageUrl}`;
      btnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
    }

    const btnEmail = document.getElementById('btnSendEmail');
    if (btnEmail) {
      const emailSubject = `Halloween - Link gestione casa: ${name}`;
      const emailBody = `Ecco il link personale per gestire la casa "${name}" (${address}):\n\n${manageUrl}`;
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

function initApp() {
  const btnAdd = document.getElementById('btnOpenRegister');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
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

  const btnPrivacy = document.getElementById('btnOpenPrivacy');
  if (btnPrivacy) {
    btnPrivacy.addEventListener('click', () => openModal('modalPrivacy'));
  }

  const btnLocate = document.getElementById('btnLocateMe');
  if (btnLocate) btnLocate.addEventListener('click', locateMe);

  const btnPick = document.getElementById('btnPickOnMap');
  if (btnPick) btnPick.addEventListener('click', startPickOnMap);

  const btnCancelPick = document.getElementById('btnCancelPick');
  if (btnCancelPick) btnCancelPick.addEventListener('click', cancelPickOnMap);

  const formReg = document.getElementById('formRegisterHouse');
  if (formReg) formReg.addEventListener('submit', handleRegisterSubmit);


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
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
