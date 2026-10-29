/**
 * /api/admin/houses/:id   (POST { action }, solo moderatore)
 *   action = "restore" -> riammette la casa e azzera le segnalazioni
 *   action = "hide"    -> nasconde la casa
 *   action = "delete"  -> elimina la casa
 */
import { readHouses, writeHouses, adminGate, json } from "../../../_lib/store.js";

export async function onRequestPost({ params, request, env }) {
  const denied = await adminGate(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const houses = await readHouses(env);
  const idx = houses.findIndex((h) => h.id === params.id);
  if (idx === -1) {
    return json({ error: "Casa non trovata." }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  const house = houses[idx];
  if (body.action === "delete") {
    houses.splice(idx, 1);
  } else if (body.action === "restore") {
    house.hidden = false;
    delete house.hiddenAt;
    house.reports = [];
    house.restoredAt = now;
  } else if (body.action === "hide") {
    house.hidden = true;
    house.hiddenAt = now;
  } else {
    return json({ error: "Azione non valida." }, 400);
  }

  await writeHouses(env, houses);
  return json({ success: true });
}
