/**
 * Funzioni condivise dalle API (non è una pagina: Cloudflare la usa solo come "libreria").
 * Le case sono salvate in Cloudflare KV, nello spazio chiamato HOUSES_KV.
 * Se vuoi usare il progetto in un altro comune, cambia CENTER (coordinate del centro).
 */

export const TOWN = "Guidizzolo";                      // nome del comune (usato nella ricerca indirizzi)
export const CENTER = { lat: 45.3188, lng: 10.5828 }; // Guidizzolo
export const MAX_RADIUS_KM = 8;   // oltre questo raggio dal centro non si registrano case
export const MAX_HOUSES = 500;    // limite di sicurezza contro gli abusi
export const REPORT_THRESHOLD = 3; // segnalazioni da telefoni diversi dopo cui la casa viene nascosta
export const MAX_REPORTS_PER_HOUSE = 50;
export const REPORT_REASONS = ["posizione", "non_esiste", "sicurezza", "altro"];

const KEY = "houses_list";
const TTL_SECONDS = 14 * 86400;   // l'elenco si cancella da solo 14 giorni dopo l'ultima modifica

export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasStore(env) {
  return Boolean(env && env.HOUSES_KV);
}

export async function readHouses(env) {
  if (!hasStore(env)) return [];
  const raw = await env.HOUSES_KV.get(KEY, "json");
  return Array.isArray(raw) ? raw : [];
}

export async function writeHouses(env, list) {
  await env.HOUSES_KV.put(KEY, JSON.stringify(list), { expirationTtl: TTL_SECONDS });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }
  });
}

// ---------------------------------------------------------------------------
// Codice casa: 8 caratteri da annotare. Serve a ritrovare la propria casa da un altro telefono.
// Niente I, L, O, 0, 1 per non confondersi quando lo si ricopia.
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 caratteri
export const CODE_LENGTH = 8;

export function newHouseCode() {
  let out = "";
  const bytes = new Uint8Array(32);
  while (out.length < CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 248 && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % 31]; // 248 = 31 * 8, nessuna distorsione
    }
  }
  return out;
}

export function normalizeCode(text) {
  return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Il codice non viene salvato in chiaro: si conserva solo la sua impronta, legata alla singola casa.
export function hashCode(houseId, code) {
  return sha256Hex(`${houseId}:${normalizeCode(code)}`);
}

// ---------------------------------------------------------------------------
// Che cosa vede il pubblico e che cosa vede il moderatore
// ---------------------------------------------------------------------------

export function publicHouse(house) {
  const { editToken, codeHash, reports, hidden, hiddenAt, restoredAt, tags, status, ...rest } = house;
  return rest;
}

export function adminHouse(house) {
  const { editToken, codeHash, reports, ...rest } = house;
  return { ...rest, reports: (Array.isArray(reports) ? reports : []).map(({ h, ...r }) => r) };
}

// ---------------------------------------------------------------------------
// Accesso del moderatore: la password sta in ADMIN_KEY (segreto di Cloudflare, mai nel codice).
// Restituisce null se l'accesso è consentito, altrimenti la risposta di errore da inviare.
// ---------------------------------------------------------------------------

export async function adminGate(request, env) {
  const key = env && env.ADMIN_KEY ? String(env.ADMIN_KEY) : "";
  if (key.length < 12) {
    return json({ error: "La password del moderatore non è impostata (ADMIN_KEY, almeno 12 caratteri). Vedi il README." }, 503);
  }
  const header = request.headers.get("Authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(key)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff !== 0) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // rallenta chi prova password a caso
    return json({ error: "Password non corretta." }, 401);
  }
  return null;
}
