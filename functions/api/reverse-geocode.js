/**
 * Cloudflare Pages Function per /api/reverse-geocode
 */

const LOCAL_STREETS = [
  { lat: 45.3190, lng: 10.5830, name: "Piazza Guglielmo Marconi" },
  { lat: 45.3165, lng: 10.5844, name: "Via Roma" },
  { lat: 45.3205, lng: 10.5815, name: "Via Solferino" },
  { lat: 45.3180, lng: 10.5805, name: "Via Giuseppe Garibaldi" },
  { lat: 45.3185, lng: 10.5825, name: "Via Giacomo Matteotti" },
  { lat: 45.3175, lng: 10.5855, name: "Via Vittorio Veneto" },
  { lat: 45.3160, lng: 10.5870, name: "Via Goito" },
  { lat: 45.3220, lng: 10.5810, name: "Via Cavriana" },
  { lat: 45.3200, lng: 10.5780, name: "Via Medole" },
  { lat: 45.3170, lng: 10.5790, name: "Via Rodella" },
  { lat: 45.3085, lng: 10.5695, name: "Frazione Birbesi" },
  { lat: 45.3120, lng: 10.6050, name: "Frazione Rebecco" },
  { lat: 45.3280, lng: 10.5750, name: "Località Selaschi" }
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lng = parseFloat(url.searchParams.get("lng"));

  let closest = "Guidizzolo";
  let minD = Infinity;
  if (!isNaN(lat) && !isNaN(lng)) {
    for (const s of LOCAL_STREETS) {
      const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
      if (d < minD) {
        minD = d;
        closest = s.name;
      }
    }
  }

  return new Response(JSON.stringify({ address: closest, source: "cloudflare_edge" }), {
    headers: { "Content-Type": "application/json" }
  });
}
