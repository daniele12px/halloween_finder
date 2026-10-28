/**
 * /api/houses
 *   GET  -> elenco pubblico delle case (senza il codice segreto del proprietario)
 *   POST -> registra una nuova casa
 */
import { CENTER, MAX_RADIUS_KM, MAX_HOUSES, distanceKm, hasStore, readHouses, writeHouses, json } from "../_lib/store.js";

// Aiuto per trovare un punto di partenza quando chi registra scrive solo la via
const STREETS = [
  { match: /marconi|piazza.*marconi/i, lat: 45.3190, lng: 10.5830 },
  { match: /roma/i, lat: 45.3165, lng: 10.5844 },
  { match: /solferino/i, lat: 45.3205, lng: 10.5815 },
  { match: /garibaldi/i, lat: 45.3180, lng: 10.5805 },
  { match: /matteotti/i, lat: 45.3185, lng: 10.5825 },
  { match: /veneto|vittorio.*veneto/i, lat: 45.3175, lng: 10.5855 },
  { match: /goito/i, lat: 45.3160, lng: 10.5870 },
  { match: /cavriana/i, lat: 45.3220, lng: 10.5810 },
  { match: /medole/i, lat: 45.3200, lng: 10.5780 },
  { match: /rodella/i, lat: 45.3170, lng: 10.5790 },
  { match: /birbesi/i, lat: 45.3085, lng: 10.5695 },
  { match: /rebecco/i, lat: 45.3120, lng: 10.6050 },
  { match: /selaschi/i, lat: 45.3280, lng: 10.5750 }
];

export async function onRequestGet({ env }) {
  const houses = await readHouses(env);
  const publicHouses = houses.map(({ editToken, tags, status, ...rest }) => rest);
  return json({ success: true, houses: publicHouses });
}

export async function onRequestPost({ request, env }) {
  if (!hasStore(env)) {
    return json({ error: "L'archivio delle case non è ancora collegato (manca HOUSES_KV). Segui le istruzioni nel README." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }

  const clean = (value, max) => String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
  const name = clean(body.name, 50);
  let address = clean(body.address, 100);
  const notes = clean(body.notes, 120);

  if (name.length < 2) {
    return json({ error: "Inserisci il nome della casa." }, 400);
  }

  let lat = parseFloat(body.lat);
  let lng = parseFloat(body.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = CENTER.lat;
    lng = CENTER.lng;
    for (const s of STREETS) {
      if (s.match.test(address)) {
        lat = s.lat;
        lng = s.lng;
        break;
      }
    }
  }

  if (distanceKm(lat, lng, CENTER.lat, CENTER.lng) > MAX_RADIUS_KM) {
    return json({ error: "Questa posizione è fuori dal comune." }, 400);
  }

  if (!address) address = "Guidizzolo";

  const houses = await readHouses(env);
  if (houses.length >= MAX_HOUSES) {
    return json({ error: "Limite di case raggiunto." }, 429);
  }

  const id = crypto.randomUUID();
  const editToken = crypto.randomUUID().replace(/-/g, "");
  const newHouse = {
    id,
    name,
    address,
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    notes,
    editToken,
    updated_at: Math.floor(Date.now() / 1000)
  };

  houses.unshift(newHouse);
  await writeHouses(env, houses);

  return json({ success: true, id, address, lat: newHouse.lat, lng: newHouse.lng, editToken }, 201);
}
