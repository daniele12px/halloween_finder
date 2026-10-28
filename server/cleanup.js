/**
 * Script di pulizia e rispetto della Privacy (GDPR)
 * Eseguibile al termine della festa di Halloween (es. 2 Novembre)
 * per eliminare tutti i dati e gli indirizzi registrati.
 */

const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'halloween.db');
const db = new Database(DB_PATH);

console.log(`🎃 Avvio procedura di pulizia Privacy per ${config.TOWN.name}...`);

const statsBefore = db.prepare('SELECT COUNT(*) as c FROM houses').get();
console.log(`Numero case attualmente nel database: ${statsBefore.c}`);

// Eliminazione di tutte le case registrate
const result = db.prepare('DELETE FROM houses').run();
db.exec('VACUUM'); // Riorganizza e cancella fisicamente i dati dal file SQLite

console.log(`✅ Pulizia completata! Eliminate ${result.changes} case.`);
console.log(`🔒 La privacy dei cittadini di ${config.TOWN.name} è garantita al 100%.`);
