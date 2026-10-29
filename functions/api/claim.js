/**
 * /api/claim   (POST { code })
 * Chi ha perso il telefono o il link personale ritrova la propria casa con il codice casa
 * e può così rimuoverla da qualsiasi dispositivo.
 */
import { readHouses, hashCode, normalizeCode, json, CODE_LENGTH } from "../_lib/store.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeCode(body.code);
  if (code.length !== CODE_LENGTH) {
    return json({ error: `Il codice ha ${CODE_LENGTH} tra lettere e numeri.` }, 400);
  }

  const houses = await readHouses(env);
  for (const house of houses) {
    if (house.codeHash && (await hashCode(house.id, code)) === house.codeHash) {
      return json({
        success: true,
        house: { id: house.id, name: house.name, address: house.address, hidden: Boolean(house.hidden) },
        editToken: house.editToken
      });
    }
  }
  return json({ error: "Codice non trovato. Controlla di averlo scritto giusto." }, 404);
}
