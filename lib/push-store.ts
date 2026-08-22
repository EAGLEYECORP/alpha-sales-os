import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Stockage des abonnements aux notifications.
 *
 * Isolé des routes parce que DEUX routes s'en servent (l'inscription et
 * l'envoi) : les faire s'importer l'une l'autre marcherait, mais crée un
 * couplage que rien ne justifie et que Next décourage.
 *
 * ⚠ Le repli mémoire ne survit pas à un redéploiement, ni au passage d'une
 * instance serverless à une autre. Sur Vercel, ça veut dire : les
 * notifications s'arrêtent sans prévenir. La table Supabase n'est donc pas
 * un confort, c'est la condition pour que le dispositif existe.
 */

export interface StoredSubscription {
  endpoint: string;
  userId: string | null;
  p256dh: string;
  auth: string;
}

export const memorySubs = new Map<string, StoredSubscription>();

export function pushClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Les clés VAPID sont-elles toutes les trois là ? */
export const vapidConfigured = (): boolean =>
  Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim() && process.env.VAPID_SUBJECT?.trim());

export const vapidKeys = () => ({
  subject: process.env.VAPID_SUBJECT?.trim() ?? "",
  publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? "",
});

export async function loadSubscriptions(): Promise<StoredSubscription[]> {
  const db = pushClient();
  if (!db) return [...memorySubs.values()];
  const { data } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth");
  return (data ?? []).map((r) => ({
    endpoint: String(r.endpoint),
    userId: (r.user_id as string) ?? null,
    p256dh: String(r.p256dh),
    auth: String(r.auth),
  }));
}

/** Retire des abonnements morts (404/410 côté service de push). */
export async function dropSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const db = pushClient();
  if (db) await db.from("push_subscriptions").delete().in("endpoint", endpoints);
  for (const e of endpoints) memorySubs.delete(e);
}
