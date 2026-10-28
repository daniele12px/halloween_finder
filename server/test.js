/**
 * Test suite completa per database (in-memory), geocodifica, sicurezza, GDPR e zero-manutenzione.
 * Usa sempre un database SQLite in memoria (:memory:) così non tocca mai halloween.db su disco.
 */

process.env.DB_PATH = ':memory:';

const db = require('./db');
const { resolveCoordinates, reverseGeocode } = require('./geocoder');
const {
  sanitizeText,
  hashPin,
  verifyPin,
  isWithinTownBounds
} = require('./security');
const config = require('./config');

console.log('🧪 Inizio suite di test (In-Process su database isolato :memory:)...');
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLITO: ${message}`);
    failed++;
  } else {
    console.log(`✅ OK: ${message}`);
  }
}

async function runAllTests() {
  try {
    // 1. Configurazione Comune
    assert(config.TOWN.name === 'Guidizzolo', 'Nome comune è configurato su Guidizzolo');
    assert(config.TOWN.centerLat > 45 && config.TOWN.centerLat < 46, 'Latitudine comune corretta');
    assert(config.TOWN.centerLng > 10 && config.TOWN.centerLng < 11, 'Longitudine comune corretta');

    // 2. Database vuoto all'avvio (nessun dato reale o seed automatico)
    const initialHouses = db.getAllPublicHouses();
    assert(Array.isArray(initialHouses) && initialHouses.length === 0, 'Il database parte vuoto (0 case precaricate)');

    // 3. Geofencing: Comune vs Altre Città
    assert(isWithinTownBounds(45.3188, 10.5828) === true, 'Centro paese è ammesso dal geofence');
    assert(isWithinTownBounds(45.3085, 10.5695) === true, 'Frazione limitrofa è ammessa dal geofence');
    assert(isWithinTownBounds(41.9028, 12.4964) === false, 'Roma viene respinta dal geofence');
    assert(isWithinTownBounds(45.4642, 9.1900) === false, 'Milano viene respinta dal geofence');

    // 4. Sanitizzazione XSS
    const maliciousInput = '<script>alert("hack")</script>Casa <b>Spaventosa</b>';
    const cleanInput = sanitizeText(maliciousInput);
    assert(!cleanInput.includes('<') && !cleanInput.includes('>'), 'XSS tags rimossi con successo');
    assert(cleanInput.includes('Casa'), 'Testo legittimo preservato');

    // 5. Hashing e Verifica Token/PIN
    const pin = '4321';
    const hash = hashPin(pin);
    assert(hash.length === 64, 'Hash SHA-256 generato correttamente');
    assert(verifyPin('4321', hash) === true, 'Verifica PIN corretto ha successo');
    assert(verifyPin('0000', hash) === false, 'Verifica PIN errato fallisce');

    // 6. Geocodifica e Reverse Geocodifica Locale
    const fwd = await resolveCoordinates('Piazza Guglielmo Marconi');
    assert(isWithinTownBounds(fwd.lat, fwd.lng) === true, 'Geocodifica restituisce coordinate valide nel comune');
    const rev = await reverseGeocode(45.3190, 10.5830);
    assert(typeof rev.address === 'string' && rev.address.length > 2, `Reverse geocoding mappa restituisce indirizzo: "${rev.address}"`);

    // 7. Ciclo di vita Registrazione (con dati finti e arrotondamento privacy coordinate) -> Modifica -> Cancellazione
    const newHouse = db.createHouse({
      name: "Castello Fantasma Test 🦇",
      address: "Via delle Streghe, 99 (Test)",
      lat: 45.3195444,
      lng: 10.5820444,
      status: 'active',
      tags: ['gluten_free'],
      notes: ' Casa di test inventata',
      editToken: 'test_edit_token_finto'
    });

    assert(newHouse.id !== undefined, 'Casa creata con ID univoco senza obbligo di PIN');
    assert(newHouse.editToken === 'test_edit_token_finto', 'Edit token restituito correttamente');

    // 8. Verifica Privacy Query Pubblica
    const publicHouses = db.getAllPublicHouses();
    assert(publicHouses.length === 1, 'Database contiene la casa di test appena creata');
    for (const h of publicHouses) {
      assert(h.pin_hash === undefined, `Privacy OK: pin_hash non esposto in ${h.name}`);
      assert(h.edit_token === undefined, `Privacy OK: edit_token non esposto in ${h.name}`);
      assert(typeof h.lat === 'number' && typeof h.lng === 'number', 'Coordinate numeriche valide');
      assert(Array.isArray(h.tags), 'Tags convertiti correttamente in array');
    }

    const retrieved = db.getHouseById(newHouse.id);
    assert(retrieved !== undefined, 'Casa trovata nel database');
    assert(retrieved.status === 'active', 'Stato iniziale è active');
    assert(String(retrieved.lat).split('.')[1].length <= 5, 'GDPR Privacy: latitudine arrotondata a max 5 decimali');

    // Aggiornamento stato a "out_of_candy"
    db.updateHouseStatus(newHouse.id, 'out_of_candy', 'Caramelle finite!');
    const updated = db.getHouseById(newHouse.id);
    assert(updated.status === 'out_of_candy', 'Stato aggiornato a out_of_candy');
    assert(updated.notes === 'Caramelle finite!', 'Note aggiornate');

    // Cancellazione della casa
    db.deleteHouse(newHouse.id);
    const deleted = db.getHouseById(newHouse.id);
    assert(deleted === undefined, 'Casa cancellata correttamente dal database');

    // 9. Zero Manutenzione: Auto-purge case scadute
    const purgedCount = db.autoPurgeExpiredHouses(14);
    assert(typeof purgedCount === 'number', 'Procedura automatica di pulizia GDPR attiva');

    // 10. Statistiche
    const stats = db.getStats();
    assert(stats.total === 0, 'Statistiche riportano 0 case dopo la cancellazione');

    console.log(`\n🎉 Tutti i test completati con successo! Errori: ${failed}`);
  } catch (err) {
    console.error('Errore durante i test:', err);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAllTests();
