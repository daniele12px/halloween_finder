const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { hashPin } = require('./security');
const config = require('./config');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'halloween.db');
const JSON_EXPORT_PATH = process.env.JSON_EXPORT_PATH || null;
const db = new Database(DB_PATH);

// Attiva WAL mode per performance e concorrenza elevata
if (DB_PATH !== ':memory:') {
  db.pragma('journal_mode = WAL');
}

// Creazione tabella (il database parte vuoto per impostazione predefinita)
db.exec(`
  CREATE TABLE IF NOT EXISTS houses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT DEFAULT '',
    pin_hash TEXT NOT NULL,
    edit_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_houses_coords ON houses (lat, lng);
  CREATE INDEX IF NOT EXISTS idx_houses_token ON houses (id, edit_token);
`);

// QUERY PUBBLICA: Solo dati utili per la mappa, MAI pin_hash o edit_token!
const getPublicHousesStmt = db.prepare(`
  SELECT id, name, address, lat, lng, status, tags, notes, updated_at
  FROM houses
  ORDER BY created_at DESC
`);

function getAllPublicHouses() {
  const rows = getPublicHousesStmt.all();
  return rows.map(r => {
    let parsedTags = [];
    try {
      parsedTags = JSON.parse(r.tags);
    } catch (e) {
      parsedTags = [];
    }
    return {
      ...r,
      tags: parsedTags
    };
  });
}

function syncJsonExport() {
  if (!JSON_EXPORT_PATH) return;
  try {
    const houses = getAllPublicHouses();
    fs.writeFileSync(JSON_EXPORT_PATH, JSON.stringify({ houses }, null, 2), 'utf8');
  } catch (e) {
    console.warn('Nota sync houses.json:', e.message);
  }
}

// QUERY INTERNA: per verifica PIN/token e gestione
const getHouseByIdStmt = db.prepare(`SELECT * FROM houses WHERE id = ?`);

function getHouseById(id) {
  return getHouseByIdStmt.get(id);
}

// INSERIMENTO NUOVA CASA
const insertHouseStmt = db.prepare(`
  INSERT INTO houses (id, name, address, lat, lng, status, tags, notes, pin_hash, edit_token, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function createHouse({ name, address, lat, lng, status = 'active', tags = [], notes = '', pin = '0000', editToken = '' }) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const pinHash = hashPin(pin);
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  // Arrotonda le coordinate a 5 decimali per privacy (precisione ~1 metro, nessun metadato GPS grezzo)
  const cleanLat = Number(parseFloat(lat).toFixed(5));
  const cleanLng = Number(parseFloat(lng).toFixed(5));

  insertHouseStmt.run(id, name, address, cleanLat, cleanLng, status, tagsJson, notes, pinHash, editToken, now, now);
  syncJsonExport();

  return { id, editToken };
}

// AGGIORNAMENTO STATO (attivo / dolcetti finiti / pausa)
const updateStatusStmt = db.prepare(`
  UPDATE houses 
  SET status = ?, notes = ?, updated_at = ?
  WHERE id = ?
`);

function updateHouseStatus(id, status, notes) {
  const now = Math.floor(Date.now() / 1000);
  const res = updateStatusStmt.run(status, notes, now, id);
  syncJsonExport();
  return res;
}

// CANCELLAZIONE CASA
const deleteHouseStmt = db.prepare(`DELETE FROM houses WHERE id = ?`);

function deleteHouse(id) {
  const res = deleteHouseStmt.run(id);
  syncJsonExport();
  return res;
}

// CONTEGGIO TOTALE CASE
const getStatsStmt = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status = 'out_of_candy' THEN 1 ELSE 0 END) as out_of_candy
  FROM houses
`);

function getStats() {
  const row = getStatsStmt.get();
  return {
    total: row.total || 0,
    active: row.active || 0,
    out_of_candy: row.out_of_candy || 0
  };
}

/**
 * ZERO MANUTENZIONE & GDPR:
 * Elimina automaticamente le registrazioni scadute (più vecchie di 14 giorni)
 * così nessun indirizzo rimane salvato dopo il periodo di Halloween.
 */
const purgeExpiredStmt = db.prepare(`
  DELETE FROM houses 
  WHERE created_at < ? AND edit_token NOT LIKE 'demo_token_%'
`);

function autoPurgeExpiredHouses(maxDays = 14) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - (maxDays * 86400);
    const info = purgeExpiredStmt.run(cutoff);
    if (info.changes > 0) {
      syncJsonExport();
      console.log(`[Privacy Auto-Purge] Eliminate automaticamente ${info.changes} case scadute.`);
    }
    return info.changes;
  } catch (e) {
    console.warn('Errore auto-purge:', e.message);
    return 0;
  }
}

// Esegue controllo all'avvio e ogni 12 ore in automatico (Zero Manutenzione)
autoPurgeExpiredHouses(config.SECURITY.autoExpireDays || 14);
const purgeTimer = setInterval(() => {
  autoPurgeExpiredHouses(config.SECURITY.autoExpireDays || 14);
}, 12 * 3600 * 1000);
if (purgeTimer.unref) purgeTimer.unref();

module.exports = {
  db,
  getAllPublicHouses,
  getHouseById,
  createHouse,
  updateHouseStatus,
  deleteHouse,
  getStats,
  autoPurgeExpiredHouses
};
