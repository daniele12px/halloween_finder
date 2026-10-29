/**
 * /api/geocode?q=Via Roma 18
 * Trova il punto sulla mappa a partire da via e numero civico, usando il servizio gratuito
 * Nominatim di OpenStreetMap. La ricerca parte dal nostro sito (OpenStreetMap non vede il telefono
 * di chi cerca), si limita al comune e le risposte vengono tenute in cache.
 * Regole d'uso di Nominatim: poche richieste, solo su azione dell'utente, con un User-Agent che
 * identifica il progetto. Non trasformare questa funzione in un completamento automatico.
 */
import { CENTER, MAX_RADIUS_KM, TOWN, distanceKm, json } from "../_lib/store.js";

const USER_AGENT = "HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)";

export async function onRequestGet(context) {
  const q = (new URL(context.request.url).searchParams.get("q") || "").replace(/[<>]/g, "").trim().slice(0, 100);
  if (q.length < 3) {
    return json({ found: false, error: "Indirizzo troppo corto." }, 400);
  }

  const cache = caches.default;
  const cacheKey = new Request("https://geocode.cache/" + encodeURIComponent(q.toLowerCase()));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Cerca solo dentro il raggio del comune
  const dLat = MAX_RADIUS_KM / 111;
  const dLng = MAX_RADIUS_KM / (111 * Math.cos((CENTER.lat * Math.PI) / 180));
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    countrycodes: "it",
    q: `${q}, ${TOWN}`,
    viewbox: [CENTER.lng - dLng, CENTER.lat + dLat, CENTER.lng + dLng, CENTER.lat - dLat].join(","),
    bounded: "1"
  });

  let results;
  try {
    const res = await fetch("https://nominatim.openstreetmap.org/search?" + params, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "it" }
    });
    if (!res.ok) return json({ found: false }, 502);
    results = await res.json();
  } catch {
    return json({ found: false }, 502);
  }

  const hit = Array.isArray(results) ? results[0] : null;
  const lat = hit ? parseFloat(hit.lat) : NaN;
  const lng = hit ? parseFloat(hit.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || distanceKm(lat, lng, CENTER.lat, CENTER.lng) > MAX_RADIUS_KM) {
    return json({ found: false });
  }

  // "house" = trovato proprio quel numero civico; "street" = solo la via
  const precision = hit.address && hit.address.house_number ? "house" : "street";
  const response = json(
    { found: true, lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)), precision },
    200,
    { "Cache-Control": "public, max-age=86400" }
  );
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
