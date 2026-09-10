import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Tracking email/DM — ouvertures & clics (le « nombre de clicks »).
 *
 * Un email HTML sortant est réécrit AVANT envoi :
 *   · chaque lien http(s) → passe par /api/track/click/<id>?l=<index>
 *   · un pixel 1×1 → /api/track/open/<id> est injecté avant </body>
 *
 * Les compteurs vivent :
 *   · en mémoire de process (dev / `next start` mono-instance), ET
 *   · dans Supabase (table `tracking_messages`) si SUPABASE_SERVICE_ROLE_KEY
 *     est configuré (survit au serverless).
 *
 * Aucun open-redirect : /track/click ne redirige QUE vers une URL qu'on a
 * nous-mêmes stockée à l'envoi.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface TrackedLink {
  idx: number;
  url: string;
  clicks: number;
}

export interface TrackingRecord {
  id: string;
  /** Locataire propriétaire (multi-locataire). null/undefined = pool solo. */
  userId?: string;
  channel: "email" | "sms";
  prospectId?: string;
  campaignId?: string;
  email?: string;
  subject?: string;
  createdAt: string;
  opens: number;
  clicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  links: TrackedLink[];
}

export interface TrackingMeta {
  channel?: "email" | "sms";
  prospectId?: string;
  campaignId?: string;
  email?: string;
  subject?: string;
  /** Locataire (user_id) qui envoie — estampillé pour l'isolation multi-compte. */
  userId?: string;
}

// ── Stores ─────────────────────────────────────────────────────────────
const memory = new Map<string, TrackingRecord>();

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Mode de persistance actif — mémoire (dev/mono-instance) ou Supabase (durable). */
export function persistenceMode(): "supabase" | "memory" {
  return serviceClient() ? "supabase" : "memory";
}

/**
 * Nombre d'emails envoyés depuis `sinceMs` — base du rate-limit d'envoi.
 * Durable via Supabase, sinon compté en mémoire. Chaque envoi crée une ligne
 * tracking_messages, donc le compteur est partagé entre instances.
 */
export async function countRecentSends(
  channel: "email" | "sms",
  sinceMs: number,
  userId?: string | null
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const sb = serviceClient();
  if (sb) {
    let q = sb
      .from("tracking_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel", channel)
      .gte("created_at", since);
    if (userId) q = q.eq("user_id", userId);
    const { count } = await q;
    return count ?? 0;
  }
  return [...memory.values()].filter(
    (r) => r.channel === channel && r.createdAt > since && (!userId || r.userId === userId)
  ).length;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEPUIS QUAND CETTE BOÎTE ENVOIE — la date du PREMIER message consigné.
 *
 * C'est l'entrée serveur de la montée en charge (`lib/email-ramp.ts`). Le
 * navigateur, lui, lit la même information dans les timelines des fiches, et
 * les deux traversent le même barème (`rampDepuisPremierEnvoi`).
 *
 * ⚠ `null` a un sens PRÉCIS, et il est du bon côté : « aucun envoi consigné »
 * fait retomber le barème sur son palier le plus BAS (5/jour). Une base
 * injoignable, une table vide, un service role absent — tous les chemins de
 * panne mènent donc à la borne la plus stricte, jamais à l'ouverture.
 *
 * C'est l'inverse du réflexe (« en cas de doute, ne pas bloquer ») et c'est
 * délibéré : ce qui est en jeu est la réputation d'un domaine, qui ne se
 * répare pas en redéployant.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function firstSendAt(
  channel: "email" | "sms",
  userId?: string | null
): Promise<string | null> {
  const sb = serviceClient();
  if (sb) {
    let q = sb
      .from("tracking_messages")
      .select("created_at")
      .eq("channel", channel)
      .order("created_at", { ascending: true })
      .limit(1);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    // ⚠ Une erreur ne rend PAS une date : elle rend `null`, donc le palier le
    // plus bas. Renvoyer « maintenant » ouvrirait le plafond au maximum au
    // moment précis où l'on ne sait plus rien.
    if (error) return null;
    const first = (data ?? [])[0] as { created_at?: string } | undefined;
    return first?.created_at ?? null;
  }
  let min: string | null = null;
  for (const r of memory.values()) {
    if (r.channel !== channel) continue;
    if (userId && r.userId !== userId) continue;
    if (!min || r.createdAt < min) min = r.createdAt;
  }
  return min;
}

/**
 * Parmi `emails`, lesquels ont DÉJÀ été contactés depuis `sinceMs` (dédup
 * durable « qui a déjà été contacté »). Comparaison en minuscules.
 */
export async function contactedEmails(
  emails: string[],
  sinceMs: number,
  userId?: string | null
): Promise<Set<string>> {
  const uniq = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];
  const set = new Set<string>();
  if (uniq.length === 0) return set;
  const since = new Date(Date.now() - sinceMs).toISOString();
  const sb = serviceClient();
  if (sb) {
    for (let i = 0; i < uniq.length; i += 200) {
      const chunk = uniq.slice(i, i + 200);
      let q = sb.from("tracking_messages").select("email").in("email", chunk).gte("created_at", since);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      for (const r of data ?? []) if (r.email) set.add(String(r.email).toLowerCase());
    }
  } else {
    const want = new Set(uniq);
    for (const r of memory.values()) {
      const e = r.email?.toLowerCase();
      if (e && want.has(e) && r.createdAt > since && (!userId || r.userId === userId)) set.add(e);
    }
  }
  return set;
}

async function persist(rec: TrackingRecord): Promise<void> {
  memory.set(rec.id, rec);
  if (memory.size > 5000) {
    // drop the 500 oldest to bound memory
    const oldest = [...memory.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 500);
    for (const o of oldest) memory.delete(o.id);
  }
  const sb = serviceClient();
  if (!sb) return;
  await sb.from("tracking_messages").upsert({
    id: rec.id,
    user_id: rec.userId ?? null,
    channel: rec.channel,
    prospect_id: rec.prospectId ?? null,
    campaign_id: rec.campaignId ?? null,
    email: rec.email ?? null,
    subject: rec.subject ?? null,
    created_at: rec.createdAt,
    opens: rec.opens,
    clicks: rec.clicks,
    last_open_at: rec.lastOpenAt ?? null,
    last_click_at: rec.lastClickAt ?? null,
    links: rec.links,
  });
}

function fromRow(r: Record<string, unknown>): TrackingRecord {
  return {
    id: String(r.id),
    userId: (r.user_id as string) ?? undefined,
    channel: (r.channel as TrackingRecord["channel"]) ?? "email",
    prospectId: (r.prospect_id as string) ?? undefined,
    campaignId: (r.campaign_id as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    subject: (r.subject as string) ?? undefined,
    createdAt: String(r.created_at),
    opens: Number(r.opens ?? 0),
    clicks: Number(r.clicks ?? 0),
    lastOpenAt: (r.last_open_at as string) ?? undefined,
    lastClickAt: (r.last_click_at as string) ?? undefined,
    links: Array.isArray(r.links) ? (r.links as TrackedLink[]) : [],
  };
}

async function load(id: string): Promise<TrackingRecord | null> {
  const local = memory.get(id);
  if (local) return local;
  const sb = serviceClient();
  if (!sb) return null;
  const { data } = await sb.from("tracking_messages").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const rec = fromRow(data);
  memory.set(id, rec);
  return rec;
}

// ── Injection : réécrit les liens + pose le pixel ──────────────────────
const HREF_RE = /href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi;

/**
 * Crée un message tracké : réécrit les liens du HTML vers /api/track/click
 * et injecte le pixel /api/track/open. Retourne l'id + le HTML tracké.
 * `baseUrl` DOIT être une URL publique (les clients mail chargent à distance).
 */
export async function createTrackedEmail(
  rawHtml: string,
  baseUrl: string,
  meta: TrackingMeta = {}
): Promise<{ id: string; html: string }> {
  const id = newId();
  const base = baseUrl.replace(/\/+$/, "");
  const links: TrackedLink[] = [];

  const html = rawHtml.replace(HREF_RE, (_m, quote: string, url: string) => {
    // opt-out explicite du tracking sur un lien
    if (/[?&](utm_nofollow|no-?track)=1/i.test(url)) {
      return `href=${quote}${url}${quote}`;
    }
    // dédup : le bouton « bulletproof » émet le même href deux fois (Outlook VML + HTML)
    let link = links.find((l) => l.url === url);
    if (!link) {
      link = { idx: links.length, url, clicks: 0 };
      links.push(link);
    }
    const tracked = `${base}/api/track/click/${id}?l=${link.idx}`;
    return `href=${quote}${tracked}${quote}`;
  });

  const pixel = `<img src="${base}/api/track/open/${id}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  const withPixel = html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : `${html}${pixel}`;

  const rec: TrackingRecord = {
    id,
    userId: meta.userId,
    channel: meta.channel ?? "email",
    prospectId: meta.prospectId,
    campaignId: meta.campaignId,
    email: meta.email?.toLowerCase().trim(),
    subject: meta.subject,
    createdAt: new Date().toISOString(),
    opens: 0,
    clicks: 0,
    links,
  };
  await persist(rec);
  return { id, html: withPixel };
}

/**
 * Variante TEXTE BRUT — pour les messages que l'opérateur envoie lui-même
 * depuis sa propre messagerie (Gmail, client de bureau).
 *
 * Deux différences assumées avec la version HTML :
 *  · pas de pixel. Un message en texte brut n'a pas d'images : les
 *    OUVERTURES sont donc invisibles. On ne les invente pas, on les perd.
 *  · les liens nus sont réécrits en liens tracés — le CLIC, lui, reste
 *    mesurable, et c'est le seul des deux qui demandait un geste humain.
 *
 * L'enregistrement est créé quand même : il alimente l'anti-doublon
 * « déjà contacté » et la fiche de suivi, même sans ouverture.
 */
export async function createTrackedText(
  rawText: string,
  baseUrl: string,
  meta: TrackingMeta = {}
): Promise<{ id: string; text: string }> {
  const id = newId();
  const base = baseUrl.replace(/\/+$/, "");
  const links: TrackedLink[] = [];

  // URL nue, bornée à la ponctuation de fin de phrase — un point collé à la
  // fin d'une URL appartient à la phrase, pas au lien.
  const text = rawText.replace(/https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g, (url) => {
    let link = links.find((l) => l.url === url);
    if (!link) {
      link = { idx: links.length, url, clicks: 0 };
      links.push(link);
    }
    return `${base}/api/track/click/${id}?l=${link.idx}`;
  });

  await persist({
    id,
    userId: meta.userId,
    channel: meta.channel ?? "email",
    prospectId: meta.prospectId,
    campaignId: meta.campaignId,
    email: meta.email?.toLowerCase().trim(),
    subject: meta.subject,
    createdAt: new Date().toISOString(),
    opens: 0,
    clicks: 0,
    links,
  });

  return { id, text };
}

// ── Événements ─────────────────────────────────────────────────────────
async function forwardWebhook(type: "open" | "click", rec: TrackingRecord): Promise<void> {
  const url = process.env.TRACKING_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      // Un webhook de tracking ne doit jamais retarder la réponse au client
      // mail : le pixel doit revenir tout de suite, quoi qu'il arrive en face.
      signal: AbortSignal.timeout(5_000),
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: `email.${type}`,
        messageId: rec.id,
        email: rec.email,
        prospectId: rec.prospectId,
        campaignId: rec.campaignId,
        opens: rec.opens,
        clicks: rec.clicks,
        at: new Date().toISOString(),
      }),
    });
  } catch {
    /* fire-and-forget */
  }
}

export async function recordOpen(id: string): Promise<void> {
  const rec = await load(id);
  if (!rec) return;
  rec.opens += 1;
  rec.lastOpenAt = new Date().toISOString();
  await persist(rec);
  void forwardWebhook("open", rec);
}

/** Enregistre un clic, retourne l'URL cible d'origine (ou null si inconnue). */
export async function recordClick(id: string, idx: number): Promise<string | null> {
  const rec = await load(id);
  if (!rec) return null;
  const link = rec.links.find((l) => l.idx === idx);
  if (!link) return null;
  link.clicks += 1;
  rec.clicks += 1;
  rec.lastClickAt = new Date().toISOString();
  // un clic implique une ouverture (certains clients bloquent le pixel)
  if (rec.opens === 0) rec.opens = 1;
  await persist(rec);
  void forwardWebhook("click", rec);
  return link.url;
}

// ── Stats ──────────────────────────────────────────────────────────────
export interface StatsFilter {
  prospectId?: string;
  campaignId?: string;
  messageId?: string;
}

export interface StatsSummary {
  messages: number;
  opens: number;
  clicks: number;
  openRate: number; // % de messages ouverts au moins une fois
  clickRate: number; // % de messages cliqués au moins une fois
  records: TrackingRecord[];
}

export async function getStats(filter: StatsFilter = {}, userId?: string | null): Promise<StatsSummary> {
  let records: TrackingRecord[] = [];
  const sb = serviceClient();
  if (sb) {
    let q = sb.from("tracking_messages").select("*").order("created_at", { ascending: false }).limit(500);
    if (userId) q = q.eq("user_id", userId);
    if (filter.prospectId) q = q.eq("prospect_id", filter.prospectId);
    if (filter.campaignId) q = q.eq("campaign_id", filter.campaignId);
    if (filter.messageId) q = q.eq("id", filter.messageId);
    const { data } = await q;
    records = (data ?? []).map(fromRow);
  } else {
    records = [...memory.values()]
      .filter(
        (r) =>
          (!userId || r.userId === userId) &&
          (!filter.prospectId || r.prospectId === filter.prospectId) &&
          (!filter.campaignId || r.campaignId === filter.campaignId) &&
          (!filter.messageId || r.id === filter.messageId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const messages = records.length;
  const opens = records.reduce((s, r) => s + r.opens, 0);
  const clicks = records.reduce((s, r) => s + r.clicks, 0);
  const openedMsgs = records.filter((r) => r.opens > 0).length;
  const clickedMsgs = records.filter((r) => r.clicks > 0).length;
  return {
    messages,
    opens,
    clicks,
    openRate: messages ? Math.round((openedMsgs / messages) * 100) : 0,
    clickRate: messages ? Math.round((clickedMsgs / messages) * 100) : 0,
    records,
  };
}

/** GIF transparent 1×1 (bytes) — servi par le pixel d'ouverture. */
export const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
