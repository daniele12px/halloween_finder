const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('./config');

/**
 * Pulisce e sanitizza stringhe da input utente per prevenire XSS
 */
function sanitizeText(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Rimuove tag HTML
    .trim()
    .slice(0, maxLength);
}

/**
 * Hash sicuro per il PIN a 4 cifre (usa il SALT verificato da config.js)
 */
function hashPin(pin) {
  return crypto.createHmac('sha256', config.SALT).update(String(pin)).digest('hex');
}

function verifyPin(pin, storedHash) {
  const hash = hashPin(pin);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

/**
 * Genera un token univoco per la gestione veloce da link (senza riscrivere il PIN)
 */
function generateEditToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Calcola la distanza in km tra due coordinate geografiche (formula di Haversine)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raggio della terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Verifica se un punto si trova nel raggio ammesso intorno al comune
 */
function isWithinTownBounds(lat, lng) {
  const dist = calculateDistanceKm(config.TOWN.centerLat, config.TOWN.centerLng, lat, lng);
  return dist <= config.TOWN.maxRadiusKm;
}

/**
 * Rate Limiter per la creazione di nuove case (anti-spam / anti-bot)
 */
const houseCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: config.SECURITY.maxHousesPerIPPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Troppe registrazioni da questa connessione. Riprova più tardi."
  }
});

/**
 * Rate Limiter generale per chiamate API
 */
const apiGeneralLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.SECURITY.maxRequestsPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Troppe richieste. Rallenta un attimo!"
  }
});

module.exports = {
  sanitizeText,
  hashPin,
  verifyPin,
  generateEditToken,
  calculateDistanceKm,
  isWithinTownBounds,
  houseCreateLimiter,
  apiGeneralLimiter
};
