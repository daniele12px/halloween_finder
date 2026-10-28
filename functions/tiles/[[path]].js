/**
 * /tiles/{z}/{x}/{y}.png
 * Porta le tessere della mappa di OpenStreetMap passando dal nostro sito:
 * i visitatori non contattano mai OpenStreetMap direttamente (privacy) e Cloudflare
 * le tiene in cache, così carichiamo poco i server di OpenStreetMap.
 * Si servono solo le tessere vicine al comune, per evitare che qualcuno usi il sito come proxy generico.
 */
import { CENTER, MAX_RADIUS_KM, distanceKm } from "../_lib/store.js";

const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
const USER_AGENT = "HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)";

function tileCenter(z, x, y) {
  const n = 2 ** z;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return { lat, lng };
}

export async function onRequestGet(context) {
  const { params, request } = context;
  const parts = params.path;
  if (!Array.isArray(parts) || parts.length !== 3) {
    return new Response("Non trovata", { status: 404 });
  }

  const [zs, xs, ysRaw] = parts;
  const ys = ysRaw.replace(/\.png$/, "");
  if (![zs, xs, ys].every((v) => /^\d{1,7}$/.test(v)) || !/\.png$/.test(ysRaw)) {
    return new Response("Richiesta non valida", { status: 400 });
  }

  const z = Number(zs), x = Number(xs), y = Number(ys);
  const n = 2 ** z;
  if (z < MIN_ZOOM || z > MAX_ZOOM || x >= n || y >= n) {
    return new Response("Fuori limite", { status: 400 });
  }

  const c = tileCenter(z, x, y);
  const tileKm = (40075 * Math.cos((CENTER.lat * Math.PI) / 180)) / n;
  if (distanceKm(c.lat, c.lng, CENTER.lat, CENTER.lng) > MAX_RADIUS_KM + tileKm * 1.5) {
    return new Response("Fuori zona", { status: 403 });
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!upstream.ok) {
    return new Response("Tessera non disponibile", { status: 502 });
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" }
  });
  context.waitUntil(cache.put(request, response.clone()));
  return response;
}
