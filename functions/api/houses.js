/**
 * Cloudflare Pages Function per /api/houses
 * Funziona gratis sulla rete edge di Cloudflare (con KV opzionale o memoria edge)
 */

// Il database parte vuoto per impostazione predefinita (nessuna casa reale precaricata)
const DEFAULT_HOUSES = [];

const GUIDIZZOLO_STREETS = [
  { match: /marconi|piazza.*marconi/i, lat: 45.3190, lng: 10.5830, name: "Piazza Guglielmo Marconi" },
  { match: /roma/i, lat: 45.3165, lng: 10.5844, name: "Via Roma" },
  { match: /solferino/i, lat: 45.3205, lng: 10.5815, name: "Via Solferino" },
  { match: /garibaldi/i, lat: 45.3180, lng: 10.5805, name: "Via Giuseppe Garibaldi" },
  { match: /matteotti/i, lat: 45.3185, lng: 10.5825, name: "Via Giacomo Matteotti" },
  { match: /veneto|vittorio.*veneto/i, lat: 45.3175, lng: 10.5855, name: "Via Vittorio Veneto" },
  { match: /goito/i, lat: 45.3160, lng: 10.5870, name: "Via Goito" },
  { match: /cavriana/i, lat: 45.3220, lng: 10.5810, name: "Via Cavriana" },
  { match: /medole/i, lat: 45.3200, lng: 10.5780, name: "Via Medole" },
  { match: /rodella/i, lat: 45.3170, lng: 10.5790, name: "Via Rodella" },
  { match: /birbesi/i, lat: 45.3085, lng: 10.5695, name: "Frazione Birbesi" },
  { match: /rebecco/i, lat: 45.3120, lng: 10.6050, name: "Frazione Rebecco" },
  { match: /selaschi/i, lat: 45.3280, lng: 10.5750, name: "Località Selaschi" }
];

// Memoria temporanea edge caso in cui KV non sia ancora collegato
let memoryHouses = [...DEFAULT_HOUSES];

async function getStoredHouses(env) {
  if (env && env.HOUSES_KV) {
    const raw = await env.HOUSES_KV.get("houses_list", "json");
    if (Array.isArray(raw) && raw.length > 0) return raw;
  }
  return memoryHouses;
}

async function saveStoredHouses(env, list) {
  memoryHouses = list;
  if (env && env.HOUSES_KV) {
    await env.HOUSES_KV.put("houses_list", JSON.stringify(list), {
      expirationTtl: 14 * 86400 // Auto-cancellazione GDPR dopo 14 giorni!
    });
  }
}

export async function onRequestGet(context) {
  const houses = await getStoredHouses(context.env);
  const publicHouses = houses.map(({ editToken, ...rest }) => rest);
  return new Response(JSON.stringify({ success: true, houses: publicHouses }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const name = String(body.name || "").replace(/[<>]/g, "").trim().slice(0, 50);
    let address = String(body.address || "").replace(/[<>]/g, "").trim().slice(0, 100);
    const notes = String(body.notes || "").replace(/[<>]/g, "").trim().slice(0, 150);

    if (name.length < 2) {
      return new Response(JSON.stringify({ error: "Inserisci il nome della casa." }), { status: 400 });
    }

    let lat = parseFloat(body.lat);
    let lng = parseFloat(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      lat = 45.3188;
      lng = 10.5828;
      for (const s of GUIDIZZOLO_STREETS) {
        if (s.match.test(address)) {
          lat = s.lat;
          lng = s.lng;
          break;
        }
      }
    }

    if (!address) {
      address = "Guidizzolo";
    }

    const id = crypto.randomUUID();
    const editToken = crypto.randomUUID().replace(/-/g, "");
    const newHouse = {
      id,
      name,
      address,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      status: "active",
      tags: Array.isArray(body.tags) ? body.tags.filter(t => t === "gluten_free") : [],
      notes,
      editToken,
      updated_at: Math.floor(Date.now() / 1000)
    };

    const houses = await getStoredHouses(context.env);
    houses.unshift(newHouse);
    await saveStoredHouses(context.env, houses);

    return new Response(JSON.stringify({
      success: true,
      id,
      address,
      lat: newHouse.lat,
      lng: newHouse.lng,
      editToken
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Errore registrazione." }), { status: 500 });
  }
}
