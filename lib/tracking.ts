import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "./voice-script";

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
  /**
   * Destinataire NORMALISÉ — email en minuscules, téléphone en E.164.
   * C'est la clé qui répond à « lui a-t-on déjà écrit ? » (`aDejaEcrit`), et
   * la seule qui reconnaisse la même personne d'une saisie à l'autre.
   */
  destinataire?: string | null;
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
  /** Destinataire brut ; il est normalisé à l'écriture (`cleDestinataire`). */
  destinataire?: string;
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

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CLÉ DU DESTINATAIRE — ce qui fait que c'est « la même personne ».
 *
 * ⚠⚠ C'EST ICI QUE LA FONCTIONNALITÉ SE JOUE, PAS DANS LA REQUÊTE. Comparer
 * les saisies brutes ferait de « 04 51 22 21 82 » et « +33451222182 » deux
 * personnes distinctes : `aDejaEcrit` rendrait toujours `false`, la mention
 * serait exigée à chaque message, et tout aurait l'air correctement branché.
 * Une panne qui se présente comme un fonctionnement normal.
 *
 * ⚠ Le téléphone passe par `toE164` — IMPORTÉ, jamais recopié. Le dépôt en
 * porte déjà deux définitions (`toE164` côté serveur, `normTel` côté store
 * pour la fusion de fiches) ; une troisième, ici, finirait par diverger des
 * deux autres, et c'est le canal d'envoi qui trancherait à sa façon.
 *
 * ⚠ `null` quand le numéro est inexploitable : on ne devine pas. L'appelant
 * traite `null` comme « je ne sais pas », donc comme « premier message »,
 * donc en EXIGEANT la mention.
 * ─────────────────────────────────────────────────────────────────────
 */
export function cleDestinataire(
  channel: "email" | "sms",
  brut: string | null | undefined
): string | null {
  const v = (brut ?? "").trim();
  if (!v) return null;
  if (channel === "email") return v.toLowerCase();
  return toE164(v);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * A-T-ON DÉJÀ ÉCRIT À CETTE PERSONNE — un jour, pas « récemment ».
 *
 * Sert UNIQUEMENT à décider du `rang` passé à `verifieMentions` : la mention
 * de provenance n'est due qu'au PREMIER message (`lib/conformite.ts`).
 *
 * ══ ⚠⚠ POURQUOI CE N'EST PAS `contactedEmails` AVEC UNE GRANDE FENÊTRE ══
 *
 * Les deux questions se ressemblent et ont des sens OPPOSÉS en cas de panne :
 *
 *  · `contactedEmails` sert la fenêtre de recontact. Base muette ⇒ ensemble
 *    vide ⇒ « jamais contacté » ⇒ **l'envoi passe**. Panne permissive.
 *  · ici, base muette ⇒ `false` ⇒ « premier message » ⇒ **la mention est
 *    EXIGÉE**. Panne restrictive.
 *
 * C'est le même repli technique qui produit les deux, et c'est exactement
 * pour ça qu'il faut deux fonctions : le jour où quelqu'un « réparera »
 * `contactedEmails` pour qu'elle lève au lieu de rendre vide — ce qui serait
 * défendable pour la fenêtre — il casserait cette règle-ci sans le voir.
 *
 * ⚠ **L'inconnu vaut « premier », et c'est le bon sens du repli.** Mettre la
 * mention à quelqu'un qui l'a déjà lue coûte une phrase ; l'omettre à
 * quelqu'un qui ne l'a jamais lue est le manquement qu'on corrige ici. Les
 * deux erreurs ne coûtent pas pareil, donc le repli n'est pas symétrique.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function aDejaEcrit(
  channel: "email" | "sms",
  destinataireBrut: string | null | undefined,
  userId?: string | null
): Promise<boolean> {
  const cible = cleDestinataire(channel, destinataireBrut);
  // Numéro illisible ou champ vide ⇒ on ne sait pas ⇒ « premier ».
  if (!cible) return false;
  const sb = serviceClient();
  if (sb) {
    // `limit(1)` : on demande l'existence, pas un compte. Compter ferait
    // parcourir tout l'historique d'une adresse relancée dix fois.
    let q = sb
      .from("tracking_messages")
      .select("id")
      .eq("channel", channel)
      .eq("destinataire", cible)
      .limit(1);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    // ⚠ Une erreur ne se distingue pas d'un vide côté appelant : on tranche
    // ici, et on tranche vers « premier ». Ça couvre aussi le cas où la
    // migration 009 n'a pas été passée : la colonne manque, la requête
    // échoue, et on retombe sur le comportement d'avant — exiger la mention.
    if (error) return false;
    return (data ?? []).length > 0;
  }
  for (const r of memory.values()) {
    if (r.channel === channel && r.destinataire === cible && (!userId || r.userId === userId)) return true;
  }
  return false;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * TRACER UN SMS — la branche qui n'écrivait rien.
 *
 * Pas d'ouvertures, pas de clics, pas de pixel : un SMS ne se track pas, il
 * se COMPTE. La ligne existe pour trois consommateurs qui en avaient déjà
 * besoin et se débrouillaient sans : le plafond horaire (`countRecentSends`),
 * le palier du jour, et « lui a-t-on déjà écrit ? ».
 *
 * ⚠⚠ À N'APPELER QU'APRÈS UN ENVOI RÉELLEMENT ACCEPTÉ. Une trace écrite sur
 * un envoi qui a échoué ferait croire qu'on a informé quelqu'un qu'on n'a
 * jamais joint — et le message suivant partirait sans la mention de
 * provenance, pour une raison invisible.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function tracerEnvoiSms(meta: TrackingMeta = {}): Promise<{ id: string }> {
  const id = newId();
  const rec: TrackingRecord = {
    id,
    userId: meta.userId,
    channel: "sms",
    prospectId: meta.prospectId,
    campaignId: meta.campaignId,
    destinataire: cleDestinataire("sms", meta.destinataire),
    createdAt: new Date().toISOString(),
    opens: 0,
    clicks: 0,
    links: [],
  };
  await persist(rec);
  return { id };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * EFFACER UNE TRACE — quand l'envoi a échoué après l'avoir créée.
 *
 * ⚠⚠ L'ORDRE DES OPÉRATIONS L'IMPOSE, et c'est un défaut qu'on ne voyait pas.
 * `createTrackedEmail` doit s'exécuter AVANT l'envoi : c'est elle qui réécrit
 * les liens et injecte le pixel. Donc un SMTP qui échoue laissait une ligne
 * derrière lui.
 *
 * Tant que cette ligne ne servait qu'à compter des ouvertures, ça ne coûtait
 * rien. Depuis qu'elle répond aussi à « lui a-t-on déjà écrit ? », elle
 * dispenserait le message SUIVANT de la mention de provenance — alors que le
 * premier n'est jamais arrivé.
 *
 * L'invariant qu'on restaure : **une ligne = un message effectivement parti.**
 * Corollaire assumé : un envoi échoué ne compte plus non plus dans le palier
 * du jour ni dans le plafond horaire. C'est cohérent — ces deux bornes
 * protègent la réputation du domaine, et un message qui n'est jamais parti ne
 * peut pas l'abîmer.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function supprimerTrace(id: string): Promise<void> {
  memory.delete(id);
  const sb = serviceClient();
  if (!sb) return;
  await sb.from("tracking_messages").delete().eq("id", id);
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
    destinataire: rec.destinataire ?? null,
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
    // Le destinataire normalisé double `email` : c'est LUI qu'interroge
    // `aDejaEcrit`, pour que les deux canaux passent par la même colonne.
    destinataire: cleDestinataire(meta.channel ?? "email", meta.destinataire ?? meta.email),
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
