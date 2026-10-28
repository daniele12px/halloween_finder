/**
 * Funzioni condivise dalle API (non è una pagina: Cloudflare la usa solo come "libreria").
 * Le case sono salvate in Cloudflare KV, nello spazio chiamato HOUSES_KV.
 * Se vuoi usare il progetto in un altro comune, cambia CENTER (coordinate del centro).
 */

export const CENTER = { lat: 45.3188, lng: 10.5828 }; // Guidizzolo
export const MAX_RADIUS_KM = 8;   // oltre questo raggio dal centro non si registrano case
export const MAX_HOUSES = 500;    // limite di sicurezza contro gli abusi

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

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
