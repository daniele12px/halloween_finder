/**
 * /api/houses/:id/manage?token=...
 *   GET -> controlla il link personale di gestione e restituisce nome e indirizzo della casa
 */
import { readHouses, json } from "../../../_lib/store.js";

export async function onRequestGet({ params, request, env }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const houses = await readHouses(env);
  const house = houses.find((h) => h.id === params.id);

  if (!house) {
    return json({ error: "Casa non trovata." }, 404);
  }
  if (!house.editToken || token !== house.editToken) {
    return json({ error: "Non autorizzato." }, 403);
  }

  return json({ success: true, house: { id: house.id, name: house.name, address: house.address, notes: house.notes } });
}
