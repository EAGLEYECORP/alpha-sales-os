import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { memorySubs, pushClient, vapidConfigured, type StoredSubscription } from "@/lib/push-store";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Abonnements aux notifications poussées.
 *
 *   POST   { endpoint, keys:{p256dh, auth} }  → enregistre l'appareil
 *   DELETE { endpoint }                       → le retire
 *   GET                                       → { configured, publicKey }
 *
 * La clé PUBLIQUE VAPID est servie par le GET : le navigateur en a besoin
 * pour s'abonner, et elle est publique par construction. La privée ne quitte
 * jamais le serveur.
 *
 * Stockage : Supabase (`push_subscriptions`) dès que la clé service role est
 * là, sinon mémoire de process. En mémoire, un redéploiement efface tous les
 * abonnements et plus aucune notification ne part — c'est dit dans la réponse
 * plutôt que découvert trois jours plus tard.
 *
 * Table attendue (à créer une fois) :
 *   create table push_subscriptions (
 *     endpoint text primary key,
 *     user_id uuid,
 *     p256dh text not null,
 *     auth text not null,
 *     created_at timestamptz default now(),
 *     last_ok_at timestamptz,
 *     failures int default 0
 *   );
 * ─────────────────────────────────────────────────────────────────────
 */

export async function GET() {
  return NextResponse.json({
    configured: vapidConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? null,
    durable: Boolean(pushClient()),
    why: vapidConfigured()
      ? undefined
      : "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT manquantes — génère-les une fois (docs/NOTIFICATIONS.md).",
  });
}

export async function POST(req: NextRequest) {
  if (!vapidConfigured()) {
    return NextResponse.json({ error: "Notifications non configurées côté serveur (clés VAPID absentes)." }, { status: 503 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "endpoint et keys{p256dh,auth} requis" }, { status: 400 });
  }
  // L'endpoint est fourni par le navigateur : on vérifie quand même que c'est
  // une URL https, pour ne pas stocker n'importe quoi.
  try {
    if (new URL(endpoint).protocol !== "https:") throw new Error();
  } catch {
    return NextResponse.json({ error: "endpoint invalide" }, { status: 400 });
  }

  const userId = await getTenantId(req);
  const sub: StoredSubscription = { endpoint, userId, p256dh, auth };

  const db = pushClient();
  if (db) {
    const { error } = await db.from("push_subscriptions").upsert(
      { endpoint, user_id: userId, p256dh, auth, failures: 0 },
      { onConflict: "endpoint" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, durable: true });
  }

  memorySubs.set(endpoint, sub);
  return NextResponse.json({
    ok: true,
    durable: false,
    note: "Enregistré en MÉMOIRE : un redéploiement effacera cet abonnement et les notifications cesseront sans prévenir. Crée la table push_subscriptions dans Supabase.",
  });
}

export async function DELETE(req: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const endpoint = body.endpoint?.trim();
  if (!endpoint) return NextResponse.json({ error: "endpoint requis" }, { status: 400 });

  const db = pushClient();
  if (db) await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  memorySubs.delete(endpoint);
  return NextResponse.json({ ok: true });
}
