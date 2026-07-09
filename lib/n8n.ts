"use client";

import type { Prospect, Sector, Stage } from "./types";
import { prospectDefaults } from "./seed";
import { STAGES } from "./hormozi";
import { daysAhead, uid } from "./utils";
import { parseDeadline, parseDelivery, parseHistory, parseObjections, parseObstacles } from "./crm-parse";
import { useAlpha } from "./store";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Connecteur n8n — l'app est un TABLEAU DE BORD ; la mémoire et les APIs
 * vivent dans n8n. On parle à UN webhook n8n, on récupère les infos, on
 * fait les calculs et on affiche les métriques.
 *
 * Contrat (POST JSON au webhook) :
 *   { action: "ping" }                      → { ok: true }
 *   { action: "list" }                      → { rows: [ {…prospect…} ] }
 *   { action: "event", type, id, payload }  → { ok: true }   (optionnel)
 *
 * Config stockée dans le navigateur (localStorage) — collée par l'utilisateur
 * via l'assistant de configuration. Rien de secret n'est commité.
 * ─────────────────────────────────────────────────────────────────────
 */

const LS_KEY = "alpha_n8n";

export interface N8nConfig {
  url: string;
  /** En-tête optionnel envoyé à chaque appel (ex. mot de passe partagé). */
  secret?: string;
}

export function getN8nConfig(): N8nConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<N8nConfig>;
    if (p.url) return { url: p.url, secret: p.secret };
  } catch {
    /* ignore */
  }
  return null;
}

export function setN8nConfig(url: string, secret?: string): void {
  if (typeof window !== "undefined")
    window.localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim(), secret: secret?.trim() || undefined }));
}

export function clearN8nConfig(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
}

export const n8nConnected = () => getN8nConfig() !== null;

/** Appel générique au webhook n8n. */
export async function callN8n<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const cfg = getN8nConfig();
  if (!cfg) return { ok: false, error: "n8n non connecté" };
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.secret ? { "x-alpha-secret": cfg.secret } : {}),
      },
      body: JSON.stringify({ action, secret: cfg.secret, ...payload }),
    });
    if (!res.ok) {
      return { ok: false, error: `n8n a répondu ${res.status}${res.status === 404 ? " — l'URL du webhook est-elle en mode « Production » ?" : ""}` };
    }
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: true, data };
  } catch (e) {
    // souvent : CORS non autorisé côté n8n, ou URL injoignable
    return {
      ok: false,
      error:
        e instanceof Error && /Failed to fetch|NetworkError/i.test(e.message)
          ? "Connexion impossible — vérifie l'URL, et autorise l'origine (CORS) dans le nœud Webhook n8n."
          : e instanceof Error
            ? e.message
            : "Erreur inconnue",
    };
  }
}

/** Teste la connexion : renvoie un message clair + le nombre de lignes si dispo. */
export async function testN8n(): Promise<{ ok: boolean; message: string; count?: number }> {
  // On tente `list` (utile) ; si le workflow ne gère que `ping`, on retombe dessus.
  const list = await callN8n<{ rows?: unknown[] }>("list");
  if (list.ok) {
    const count = Array.isArray(list.data?.rows) ? list.data!.rows!.length : undefined;
    return { ok: true, message: count !== undefined ? `Connecté ✓ — ${count} ligne(s) trouvée(s).` : "Connecté ✓.", count };
  }
  const ping = await callN8n<{ ok?: boolean }>("ping");
  if (ping.ok) return { ok: true, message: "Connecté ✓ (workflow joignable)." };
  return { ok: false, message: list.error ?? ping.error ?? "Échec de connexion." };
}

/* ── Mapping ligne n8n → Prospect (défensif : plusieurs alias de clés) ── */
const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const SECTOR_ALIASES: Record<string, Sector> = {
  restaurant: "restaurant", resto: "restaurant", restauration: "restaurant", bouchon: "restaurant",
  pub: "pub", bar: "pub", brasserie: "pub",
  ambulance: "ambulance", ambulances: "ambulance", vsl: "ambulance",
  artisan: "artisan", artisanat: "artisan", plomberie: "artisan", menuiserie: "artisan", batiment: "artisan",
};

function pick(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function toNum(v: string): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function rowToStage(v: string): Stage {
  const s = strip(v);
  const found = STAGES.find((x) => x.id === s || strip(x.label) === s);
  return (found?.id ?? "prospect") as Stage;
}

/**
 * Normalise les CLÉS d'une ligne n8n/Sheets : le nœud Google Sheets renvoie
 * les libellés de colonnes tels quels (« Note d'avis », « num de tel »,
 * « Delivery status »…). On les réduit en minuscules sans accents ni
 * ponctuation pour que le mapping tienne quel que soit le libellé exact.
 */
function normalizeKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[strip(k)] = v;
  return out;
}

/** Convertit les lignes renvoyées par n8n en prospects de l'app. */
export function n8nRowsToProspects(rows: unknown[]): Prospect[] {
  const out: Prospect[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const o = normalizeKeys(raw as Record<string, unknown>);
    const company = pick(o, ["prospect", "company", "commerce", "entreprise", "societe", "nomentreprise"]);
    if (!company) continue;
    const stage = rowToStage(pick(o, ["stage", "etape", "statut", "status"]));
    const sector = SECTOR_ALIASES[strip(pick(o, ["sector", "secteur", "industrie", "type"]))] ?? "autre";
    const now = new Date().toISOString();
    const tax = toNum(pick(o, ["tax", "ignorancetax", "taxe", "taxedignorancemois", "perte"])) ?? 0;
    out.push({
      ...prospectDefaults,
      id: uid(),
      company,
      name: pick(o, ["contact", "name", "nom", "decideur", "gerant"]),
      sector,
      city: pick(o, ["city", "ville", "emplacement"]) || "Lyon",
      phone: pick(o, ["phone", "telephone", "tel", "numdetel"]) || undefined,
      email: pick(o, ["email", "mail", "courriel"]) || undefined,
      linkedin: pick(o, ["linkedin", "linkedinurl", "profillinkedin"]) || undefined,
      stage,
      trust: 10,
      auditScore: 0,
      conviction: 8,
      monthlyValue: toNum(pick(o, ["monthlyvalue", "abonnement", "mrr", "mensuel"])) ?? 0,
      setupValue: toNum(pick(o, ["setupvalue", "setup"])) ?? 0,
      probability: STAGES.find((s) => s.id === stage)?.probability ?? 5,
      ignoranceTax: tax,
      croyances: { produit: 5, soutien: 5, pourLui: 3 },
      obstacles: parseObstacles(pick(o, ["obstacles"])),
      objections: parseObjections(pick(o, ["objections"])),
      // Journal History du Sheet (écrit par n8n) → timeline visible sur la fiche
      events: parseHistory(pick(o, ["history", "historique", "journal"])),
      demoShownBeforePrice: false,
      // Deadline du Sheet (next step daté) → sinon défaut doctrine J+3
      nextStep:
        parseDeadline(pick(o, ["deadline", "echeance"]), pick(o, ["nextstepaction", "nextstep", "prochaineaction"])) ??
        { date: daysAhead(3), action: "Premier contact terrain" },
      tags: pick(o, ["typedentreprise", "type"]) ? [pick(o, ["typedentreprise", "type"]).replace(/^[·\s]+/, "")] : [],
      attachments: [],
      notes: pick(o, ["notes", "note", "commentaire"]),
      preferredChannel: pick(o, ["channel", "canal", "platform", "plateforme"]) || undefined,
      satisfaction: toNum(pick(o, ["satisfaction", "satisfactionscore"])),
      testimonial: pick(o, ["testimonial", "temoignage", "avisclient"]) || undefined,
      upsell: pick(o, ["upsell", "upsellnote"]) ? { note: pick(o, ["upsell", "upsellnote"]), status: "identifie" as const } : undefined,
      problems: [],
      solution: "",
      personalizedOffer: "",
      deepAudit: {
        ...prospectDefaults.deepAudit,
        googleRating: toNum(pick(o, ["rating", "googlerating", "notegoogle", "notedavis", "note"])),
        googleReviews: (() => { const n = toNum(pick(o, ["reviews", "googlereviews", "avis", "nombredavis", "nombreavis"])); return n === undefined ? undefined : Math.abs(n); })(),
        websiteState: pick(o, ["website", "site", "siteweb"]),
        currentProcess: pick(o, ["audit", "process", "processus"]),
        updatedAt: now,
      },
      delivery: parseDelivery(pick(o, ["delivery", "deliverystatus", "livraison"])) ?? prospectDefaults.delivery,
      wonAt: (pick(o, ["closedate", "datesignature"]).match(/\d{4}-\d{2}-\d{2}/) || [undefined])[0],
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

/** Récupère les prospects depuis n8n et les fusionne dans le tableau de bord. */
export async function syncFromN8n(): Promise<{ ok: boolean; added?: number; updated?: number; error?: string }> {
  const res = await callN8n<{ rows?: unknown[] }>("list");
  if (!res.ok) return { ok: false, error: res.error };
  const rows = Array.isArray(res.data?.rows) ? res.data!.rows! : Array.isArray(res.data) ? (res.data as unknown[]) : [];
  const prospects = n8nRowsToProspects(rows);
  if (prospects.length === 0) return { ok: true, added: 0, updated: 0 };
  const { added, updated } = useAlpha.getState().importProspects(prospects);
  return { ok: true, added, updated };
}

/** Notifie n8n d'un événement (fire-and-forget) — garde la mémoire à jour. */
export function notifyN8n(type: string, id: string, payload: Record<string, unknown> = {}): void {
  if (!n8nConnected()) return;
  void callN8n("event", { type, id, payload });
}

/** Prospect → ligne CRM (clés alignées sur le schéma Sheets / Apps Script). */
export function prospectToRow(p: Prospect): Record<string, unknown> {
  return {
    prospect: p.company,
    contact: p.name,
    email: p.email ?? "",
    phone: p.phone ?? "",
    linkedin: p.linkedin ?? "",
    city: p.city,
    stage: p.stage,
    rating: p.deepAudit.googleRating ?? "",
    reviews: p.deepAudit.googleReviews ?? "",
    tax: p.ignoranceTax || "",
    website: p.deepAudit.websiteState ?? "",
    audit: p.deepAudit.currentProcess ?? "",
    notes: p.notes ?? "",
    channel: p.preferredChannel ?? "",
    satisfaction: p.satisfaction ?? "",
    testimonial: p.testimonial ?? "",
    upsell: p.upsell?.note ?? "",
    delivery: p.delivery,
    updatedAt: p.updatedAt,
  };
}

/**
 * Repousse un prospect vers le CRM centralisé : d'abord Supabase (durable,
 * service role côté serveur via /api/crm/patch), puis n8n → Google Sheets.
 * Les infos critiques saisies dans l'app remontent ainsi jusqu'à la feuille.
 */
export async function syncProspectToCrm(p: Prospect): Promise<{ ok: boolean; via: string[]; error?: string }> {
  const via: string[] = [];
  const row = prospectToRow(p);
  // 1) Supabase (serveur, service role) — la source durable
  try {
    const res = await fetch("/api/crm/patch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: p.company, company: p.company, data: row }),
    });
    const d = (await res.json()) as { persisted?: string };
    if (res.ok && d.persisted === "supabase") via.push("supabase");
  } catch {
    /* best-effort */
  }
  // 2) n8n → Google Sheets (immédiat)
  if (n8nConnected()) {
    const r = await callN8n("upsert", { data: row });
    if (r.ok) via.push("n8n → Sheets");
    else if (via.length === 0) return { ok: false, via, error: r.error };
  }
  return { ok: via.length > 0, via };
}
