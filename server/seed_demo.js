/**
 * Script opzionale per caricare 5 case dimostrative completamente inventate.
 * Non viene mai eseguito in automatico all'avvio dell'app.
 *
 * Uso:
 *   npm run seed:demo
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');

const demoFilePath = path.join(__dirname, '..', 'demo', 'demo_houses.json');
const demoHouses = JSON.parse(fs.readFileSync(demoFilePath, 'utf8'));

console.log(`🎃 Caricamento di ${demoHouses.length} case finte di esempio da demo/demo_houses.json...`);

let inserted = 0;
demoHouses.forEach((h, index) => {
  const lat = Number((config.TOWN.centerLat + (h.latOffset || 0)).toFixed(5));
  const lng = Number((config.TOWN.centerLng + (h.lngOffset || 0)).toFixed(5));

  db.createHouse({
    name: h.name,
    address: h.address,
    lat,
    lng,
    status: h.status || 'active',
    tags: h.tags || [],
    notes: h.notes || '',
    pin: '0000',
    editToken: `demo_token_${index + 1}`
  });
  inserted++;
});

console.log(`✅ Inserite ${inserted} case dimostrative inventate per ${config.TOWN.name}.`);
console.log(`🧹 Per rimuoverle e riportare il database vuoto, esegui: npm run purge`);
