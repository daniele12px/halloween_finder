/**
 * Configurazione dell'applicazione Halloween Finder
 * Totalmente personalizzabile tramite variabili d'ambiente (.env)
 */

require('dotenv').config();
const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const PLACEHOLDER_ADMIN_KEY = 'cambia-questa-password';
const PLACEHOLDER_SALT = 'cambia-questo-valore-segreto';

const rawAdminKey = process.env.ADMIN_KEY ? process.env.ADMIN_KEY.trim() : '';
const rawSalt = process.env.SALT ? process.env.SALT.trim() : '';

if (isProduction) {
  if (!rawAdminKey || rawAdminKey === PLACEHOLDER_ADMIN_KEY) {
    console.error(
      '[ERRORE FATALE] Variabile d\'ambiente ADMIN_KEY mancante o impostata al valore di esempio. ' +
      'Configura un valore segreto reale per ADMIN_KEY prima di avviare l\'applicazione in produzione.'
    );
    process.exit(1);
  }
  if (!rawSalt || rawSalt === PLACEHOLDER_SALT) {
    console.error(
      '[ERRORE FATALE] Variabile d\'ambiente SALT mancante o impostata al valore di esempio. ' +
      'Configura un valore segreto reale per SALT prima di avviare l\'applicazione in produzione.'
    );
    process.exit(1);
  }
}

// In ambiente di sviluppo locale (se non configurato in .env), genera segreti casuali effimeri in memoria
// a ogni avvio anziché usare valori statici noti nel codice sorgente.
const ADMIN_KEY = (rawAdminKey && rawAdminKey !== PLACEHOLDER_ADMIN_KEY)
  ? rawAdminKey
  : crypto.randomBytes(24).toString('hex');

const SALT = (rawSalt && rawSalt !== PLACEHOLDER_SALT)
  ? rawSalt
  : crypto.randomBytes(24).toString('hex');

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV,

  // Informazioni sul Comune
  TOWN: {
    name: process.env.TOWN_NAME || 'Guidizzolo',
    province: process.env.TOWN_PROVINCE || 'MN',
    region: process.env.TOWN_REGION || 'Lombardia',
    centerLat: parseFloat(process.env.CENTER_LAT) || 45.3188,
    centerLng: parseFloat(process.env.CENTER_LNG) || 10.5828,
    defaultZoom: 15,
    // Raggio di tolleranza in km per evitare registrazioni spam fuori comune
    maxRadiusKm: parseFloat(process.env.MAX_RADIUS_KM) || 8.0
  },

  // Chiave di amministrazione e salt crittografico
  ADMIN_KEY,
  SALT,

  // Sicurezza e limiti anti-abuso
  SECURITY: {
    maxHousesPerIPPerHour: 10,
    maxRequestsPerMinute: 60,
    pinLength: 4,
    autoExpireDays: 14
  },

  // Decalogo di sicurezza per i bambini e i genitori
  SAFETY_TIPS: [
    "Muovetevi sempre in gruppo o accompagnati da un adulto.",
    "Indossate qualcosa di riflettente o portate una torcia per farvi vedere dalle auto.",
    "Attraversate sempre sulle strisce pedonali e camminate sui marciapiedi.",
    "Non entrate mai nelle case o nei cancelli chiusi: suonate solo alle case segnalate con l'icona attiva.",
    "Rispettate chi non partecipa: se le luci sono spente o la casa non è registrata, non disturbate.",
    "Controllate sempre i dolcetti con i genitori prima di mangiarli (soprattutto per eventuali allergie)."
  ]
};
