/**
 * /api/houses/:id
 *   DELETE -> il proprietario rimuove la propria casa (serve il suo codice segreto)
 */
import { readHouses, writeHouses, json } from "../../_lib/store.js";

export async function onRequestDelete({ params, request, env }) {
  const body = await request.json().catch(() => ({}));
  const houses = await readHouses(env);
  const idx = houses.findIndex((h) => h.id === params.id);

  if (idx === -1) {
    return json({ error: "Casa non trovata." }, 404);
  }

  const house = houses[idx];
  if (!house.editToken || body.editToken !== house.editToken) {
    return json({ error: "Solo il telefono che ha registrato la casa può rimuoverla." }, 403);
  }

  houses.splice(idx, 1);
  await writeHouses(env, houses);
  return json({ success: true });
}
