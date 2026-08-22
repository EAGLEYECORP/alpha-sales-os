import { NextRequest, NextResponse } from "next/server";
import type { Prospect, Meeting } from "@/lib/types";
import { pickPush } from "@/lib/push-digest";
import { sendPush, type PushSubscription } from "@/lib/webpush";
import { safeEqual } from "@/lib/access";
import { loadSubscriptions, dropSubscriptions, pushClient, vapidKeys } from "@/lib/push-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * ENVOI DES NOTIFICATIONS — appelé par un cron (n8n, Vercel Cron…).
 *
 * C'est LA pièce qui rend les rappels utiles : jusqu'ici ils ne partaient
 * que pendant que l'onglet était ouvert, c'est-à-dire jamais au moment où
 * ils comptent. Ici le serveur décide et pousse, app fermée, téléphone dans
 * la poche.
 *
 * Trois verrous, comme l'autopilote d'appels :
 *  1. CRON_SECRET exigé — une route qui fait vibrer des téléphones ne
 *     s'ouvre pas au monde.
 *  2. Clés VAPID configurées — sinon on répond 503 en le disant.
 *  3. Prospects synchronisés dans Supabase — le store vit dans le
 *     navigateur ; sans synchro, un cron serveur ne voit RIEN et ne peut
 *     rien décider. On le dit au lieu de rendre un succès vide.
 *
 * `dryRun: true` rend ce qui SERAIT envoyé, sans rien envoyer. C'est la
 * façon de vérifier la pertinence des règles sans réveiller personne.
 * ─────────────────────────────────────────────────────────────────────
 */

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return provided.length > 0 && safeEqual(provided, secret);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Une route qui fait vibrer des téléphones ne s'ouvre pas." },
      { status: 401 }
    );
  }

  const v = vapidKeys();
  if (!v.publicKey || !v.privateKey || !v.subject) {
    return NextResponse.json({ error: "Clés VAPID non configurées.", voir: "docs/NOTIFICATIONS.md" }, { status: 503 });
  }

  let body: { dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* corps optionnel */
  }

  const db = pushClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Supabase non configuré",
        why: "Les prospects vivent dans le navigateur tant que la synchronisation n'est pas activée. Un cron serveur ne voit rien à notifier.",
      },
      { status: 503 }
    );
  }

  const [{ data: pRows }, { data: mRows }] = await Promise.all([
    db.from("prospects").select("data"),
    db.from("meetings").select("data"),
  ]);
  const prospects = (pRows ?? []).map((r) => (r as { data: Prospect }).data).filter(Boolean);
  const meetings = (mRows ?? []).map((r) => (r as { data: Meeting }).data).filter(Boolean);

  const now = new Date();
  const message = pickPush(prospects, meetings, now);

  if (!message) {
    // Réponse volontairement explicite : « rien à dire » est une décision, pas
    // une panne. Sans ça, on soupçonne le cron à chaque passage silencieux.
    return NextResponse.json({ ok: true, envoye: 0, raison: "rien d'actionnable maintenant (ou hors fenêtre utile)" });
  }

  const subs = await loadSubscriptions();
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, envoye: 0, raison: "aucun appareil abonné", message });
  }

  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, destinataires: subs.length, message });
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url,
    tag: message.tag,
  });

  let envoye = 0;
  const morts: string[] = [];
  for (const s of subs) {
    const sub: PushSubscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    const r = await sendPush(sub, payload, v, { ttlSec: message.ttlSec, urgency: message.urgency });
    if (r.ok) envoye += 1;
    // 404/410 : l'appareil ne reviendra pas. Garder l'abonnement ferait
    // échouer tous les envois suivants, et masquerait les vrais problèmes.
    if (r.gone) morts.push(s.endpoint);
  }

  await dropSubscriptions(morts);

  return NextResponse.json({ ok: true, envoye, purges: morts.length, message });
}

/** État du dispositif — pour diagnostiquer sans envoyer. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const v = vapidKeys();
  return NextResponse.json({
    vapid: Boolean(v.publicKey && v.privateKey && v.subject),
    durable: Boolean(pushClient()),
    abonnements: (await loadSubscriptions()).length,
  });
}
