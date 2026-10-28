require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const { resolveCoordinates, reverseGeocode } = require('./geocoder');
const {
  sanitizeText,
  verifyPin,
  generateEditToken,
  isWithinTownBounds,
  houseCreateLimiter,
  apiGeneralLimiter
} = require('./security');

const app = express();

// Middleware di sicurezza (Helmet) ottimizzato per Leaflet, tile server locale e 100% GDPR (zero chiamate verso Google Fonts)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:"
      ],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null // Disattivato su localhost per non forzare HTTPS
    }
  },
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: '50kb' }));

// File statici (Frontend PWA)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Gestore tessere mappa con cache locale su disco (Zero API Key, 100% Offline)
const { handleTileRequest } = require('./tileProxy');
app.get('/tiles/:z/:x/:y.png', handleTileRequest);

// Applicazione rate limit generale alle chiamate /api
app.use('/api', apiGeneralLimiter);

/**
 * GET /api/config
 * Ritorna le impostazioni del comune, decalogo sicurezza e statistiche
 */
app.get('/api/config', (req, res) => {
  const stats = db.getStats();
  res.json({
    town: config.TOWN,
    safetyTips: config.SAFETY_TIPS,
    stats
  });
});

/**
 * GET /api/houses
 * Elenco pubblico delle case aderenti (PRIVACY GARANTITA: nessun PIN o token esposto)
 */
app.get('/api/houses', (req, res) => {
  try {
    const houses = db.getAllPublicHouses();
    res.json({ success: true, count: houses.length, houses });
  } catch (error) {
    console.error('Errore nel recupero case:', error);
    res.status(500).json({ error: "Impossibile recuperare l'elenco delle case." });
  }
});

/**
 * GET /api/geocode
 * Risolve la via o indirizzo a Guidizzolo (offline-first)
 */
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ lat: config.TOWN.centerLat, lng: config.TOWN.centerLng });
  const result = await resolveCoordinates(String(q));
  res.json(result);
});

/**
 * GET /api/reverse-geocode
 * Dalle coordinate toccate sulla mappa trova automaticamente il nome della via a Guidizzolo
 */
app.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.json({ address: "Guidizzolo" });
  const result = await reverseGeocode(lat, lng);
  res.json(result);
});

/**
 * POST /api/houses
 * Registra una nuova casa per la notte di Halloween (Semplificata, nessun PIN obbligatorio)
 */
app.post('/api/houses', houseCreateLimiter, async (req, res) => {
  try {
    let { name, address, lat, lng, pin, tags, notes } = req.body;

    name = sanitizeText(name, 50);
    address = sanitizeText(address, 100);
    notes = sanitizeText(notes, 150);

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Inserisci un nome o soprannome per la tua casa." });
    }

    lat = parseFloat(lat);
    lng = parseFloat(lng);
    const hasCoords = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    // Se l'utente ha cliccato sulla mappa ma il campo indirizzo era vuoto, ricava la via automaticamente!
    if (hasCoords && (!address || address.length < 2)) {
      const rev = await reverseGeocode(lat, lng);
      address = rev.address || "Posizione da mappa (Guidizzolo)";
    }

    if (!address || address.length < 2) {
      return res.status(400).json({ error: "Inserisci la via oppure tocca un punto sulla mappa." });
    }

    // Se non ci sono coordinate, le risolve automaticamente dalla via
    if (!hasCoords) {
      const resolved = await resolveCoordinates(address);
      lat = resolved.lat;
      lng = resolved.lng;
    }

    // Geofencing: controlla che la posizione sia nell'area di Guidizzolo e limitrofi
    if (!isWithinTownBounds(lat, lng)) {
      return res.status(400).json({
        error: `La posizione selezionata sembra essere troppo distante da ${config.TOWN.name}. Verifica il punto sulla mappa!`
      });
    }

    // PIN opzionale: se non fornito usa 0000
    const pinStr = pin && /^\d{4}$/.test(String(pin).trim()) ? String(pin).trim() : '0000';

    const allowedTags = ['gluten_free', 'toddler_friendly', 'scary', 'dog_friendly', 'easy_access'];
    const validTags = Array.isArray(tags)
      ? tags.filter(t => allowedTags.includes(t))
      : [];

    const editToken = generateEditToken();

    const result = db.createHouse({
      name,
      address,
      lat,
      lng,
      status: 'active',
      tags: validTags,
      notes,
      pin: pinStr,
      editToken
    });

    res.status(201).json({
      success: true,
      message: "Casa registrata con successo per la notte di Halloween! 🎃",
      id: result.id,
      address,
      lat,
      lng,
      editToken: result.editToken
    });
  } catch (error) {
    console.error('Errore creazione casa:', error);
    res.status(500).json({ error: "Si è verificato un errore durante la registrazione." });
  }
});

/**
 * PATCH /api/houses/:id
 * Aggiorna stato (es. "Finiti i dolcetti") protetto da token automatico del dispositivo proprietario
 */
app.patch('/api/houses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { pin, editToken, adminKey, status, notes } = req.body || {};

    const house = db.getHouseById(id);
    if (!house) {
      return res.status(404).json({ error: "Casa non trovata." });
    }

    const isDemo = house.edit_token && house.edit_token.startsWith('demo_token_');
    let authorized = isDemo;
    if (adminKey && adminKey === config.ADMIN_KEY) {
      authorized = true;
    } else if (editToken && editToken === house.edit_token) {
      authorized = true;
    } else if (pin && verifyPin(pin, house.pin_hash)) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        error: "Solo il dispositivo che ha registrato questa casa può modificarla (usa lo stesso telefono o il link salvato)."
      });
    }

    const allowedStatuses = ['active', 'out_of_candy', 'paused'];
    const newStatus = allowedStatuses.includes(status) ? status : house.status;
    const newNotes = typeof notes === 'string' ? sanitizeText(notes, 150) : house.notes;

    db.updateHouseStatus(id, newStatus, newNotes);

    res.json({
      success: true,
      message: "Stato della casa aggiornato!",
      status: newStatus,
      notes: newNotes
    });
  } catch (error) {
    console.error('Errore aggiornamento casa:', error);
    res.status(500).json({ error: "Impossibile aggiornare lo stato." });
  }
});

/**
 * DELETE /api/houses/:id
 * Rimuove una casa dalla mappa (solo dal dispositivo proprietario o amministratore)
 */
app.delete('/api/houses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { pin, editToken, adminKey } = req.body || {};

    const house = db.getHouseById(id);
    if (!house) {
      return res.status(404).json({ error: "Casa non trovata." });
    }

    const isDemo = house.edit_token && house.edit_token.startsWith('demo_token_');
    let authorized = isDemo;
    if (adminKey && adminKey === config.ADMIN_KEY) {
      authorized = true;
    } else if (editToken && editToken === house.edit_token) {
      authorized = true;
    } else if (pin && verifyPin(pin, house.pin_hash)) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        error: "Solo il dispositivo che ha registrato questa casa può rimuoverla dalla mappa."
      });
    }

    db.deleteHouse(id);
    res.json({ success: true, message: "Casa rimossa correttamente dalla mappa." });
  } catch (error) {
    console.error('Errore cancellazione casa:', error);
    res.status(500).json({ error: "Impossibile rimuovere la casa." });
  }
});

/**
 * GET /api/houses/:id/manage
 * Recupera i dati di gestione (permette di controllare lo stato dal link salvato)
 */
app.get('/api/houses/:id/manage', (req, res) => {
  try {
    const { id } = req.params;
    const { token, pin } = req.query;

    const house = db.getHouseById(id);
    if (!house) {
      return res.status(404).json({ error: "Casa non trovata." });
    }

    let authorized = false;
    if (token && token === house.edit_token) {
      authorized = true;
    } else if (pin && verifyPin(pin, house.pin_hash)) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({ error: "Non autorizzato." });
    }

    res.json({
      success: true,
      house: {
        id: house.id,
        name: house.name,
        address: house.address,
        status: house.status,
        notes: house.notes,
        tags: JSON.parse(house.tags || '[]')
      }
    });
  } catch (error) {
    console.error('Errore gestione casa:', error);
    res.status(500).json({ error: "Errore interno." });
  }
});

// Avvio server
const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`🎃 Halloween ${config.TOWN.name} avviato su http://localhost:${config.PORT} (e http://127.0.0.1:${config.PORT})`);
});

module.exports = { app, server };
