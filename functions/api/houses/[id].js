/**
 * Cloudflare Pages Function per /api/houses/:id (PATCH stato e DELETE casa)
 */

async function getStoredHouses(env) {
  if (env && env.HOUSES_KV) {
    const raw = await env.HOUSES_KV.get("houses_list", "json");
    if (Array.isArray(raw)) return raw;
  }
  return [];
}

async function saveStoredHouses(env, list) {
  if (env && env.HOUSES_KV) {
    await env.HOUSES_KV.put("houses_list", JSON.stringify(list), {
      expirationTtl: 14 * 86400
    });
  }
}

export async function onRequestPatch(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    const houses = await getStoredHouses(context.env);
    const idx = houses.findIndex(h => h.id === id);

    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Casa non trovata." }), { status: 404 });
    }

    const house = houses[idx];
    const isDemo = String(house.id).startsWith("demo-");
    if (!isDemo && house.editToken && body.editToken !== house.editToken) {
      return new Response(JSON.stringify({ error: "Solo il dispositivo che ha registrato la casa può modificarla." }), { status: 403 });
    }

    if (body.status === "active" || body.status === "out_of_candy") {
      house.status = body.status;
    }
    await saveStoredHouses(context.env, houses);

    return new Response(JSON.stringify({ success: true, status: house.status }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Errore modifica." }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json().catch(() => ({}));
    const houses = await getStoredHouses(context.env);
    const idx = houses.findIndex(h => h.id === id);

    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Casa non trovata." }), { status: 404 });
    }

    const house = houses[idx];
    const isDemo = String(house.id).startsWith("demo-");
    if (!isDemo && house.editToken && body.editToken !== house.editToken) {
      return new Response(JSON.stringify({ error: "Non autorizzato." }), { status: 403 });
    }

    houses.splice(idx, 1);
    await saveStoredHouses(context.env, houses);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Errore cancellazione." }), { status: 500 });
  }
}
