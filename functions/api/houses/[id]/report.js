/**
 * /api/houses/:id/report   (POST { reason, note, reporterId })
 * Segnalazione anonima di un problema. Per ogni casa conta una sola segnalazione per telefono.
 * Dopo REPORT_THRESHOLD segnalazioni da telefoni diversi la casa viene nascosta in attesa del moderatore.
 * Non si salvano indirizzi IP: del telefono resta solo un'impronta legata alla singola casa.
 */
import {
  readHouses, writeHouses, sha256Hex, json, networkFingerprint,
  REPORT_THRESHOLD, MAX_REPORTS_PER_HOUSE, REPORT_REASONS
} from "../../../_lib/store.js";

export async function onRequestPost({ params, request, env }) {
  const body = await request.json().catch(() => ({}));

  const reason = String(body.reason || "");
  if (!REPORT_REASONS.includes(reason)) {
    return json({ error: "Scegli il tipo di problema." }, 400);
  }
  const reporterId = String(body.reporterId || "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(reporterId)) {
    return json({ error: "Segnalazione non valida." }, 400);
  }
  const note = String(body.note || "").replace(/[<>]/g, "").trim().slice(0, 200);

  const houses = await readHouses(env);
  const house = houses.find((h) => h.id === params.id);
  if (!house) {
    return json({ error: "Casa non trovata." }, 404);
  }

  const reporter = await sha256Hex(`${house.id}:${reporterId}`);
  house.reports = Array.isArray(house.reports) ? house.reports : [];
  const net = await networkFingerprint(request, env, "segnalazione:" + house.id);
  // Una segnalazione per telefono E per connessione: tre telefoni sulla stessa rete contano come una
  if (house.reports.some((r) => r.h === reporter || (net && r.n === net))) {
    return json({ success: true, already: true });
  }

  if (house.reports.length < MAX_REPORTS_PER_HOUSE) {
    house.reports.push({ h: reporter, n: net, reason, note, t: Math.floor(Date.now() / 1000) });
  }
  if (house.reports.length >= REPORT_THRESHOLD && !house.hidden) {
    house.hidden = true;
    house.hiddenAt = Math.floor(Date.now() / 1000);
  }

  await writeHouses(env, houses);
  return json({ success: true });
}
