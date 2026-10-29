/**
 * /api/admin/houses   (GET, solo moderatore)
 * Elenco completo delle case, comprese quelle nascoste, con le segnalazioni ricevute.
 */
import { readHouses, adminGate, adminHouse, json } from "../../_lib/store.js";

export async function onRequestGet({ request, env }) {
  const denied = await adminGate(request, env);
  if (denied) return denied;

  const houses = await readHouses(env);
  return json({ success: true, houses: houses.map(adminHouse) });
}
