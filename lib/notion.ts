import type { Prospect } from "./types";
import { stageById } from "./hormozi";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTION — pousser le pipeline vers une base que l'équipe regarde déjà.
 *
 * Pas d'OAuth ici, et ce n'est pas un raccourci : Notion propose des
 * « intégrations internes » avec un jeton secret que l'on colle. Pour un
 * espace de travail qu'on possède, c'est le chemin prévu par Notion, et
 * il évite tout le cortège consentement / rafraîchissement de jetons.
 *
 * ── SENS UNIQUE, ASSUMÉ ──
 *
 * ALPHA écrit, Notion lit. Une synchro bidirectionnelle demande de
 * décider qui gagne quand les deux côtés ont changé — et cette décision
 * se prend mal, silencieusement, en écrasant du travail. Tant que la
 * question n'est pas tranchée avec des vrais cas, un seul sens vaut mieux
 * qu'un mauvais arbitrage automatique.
 *
 * ── CE QU'ON N'ENVOIE PAS ──
 *
 * Ni les notes libres, ni les transcriptions d'appels. Elles contiennent
 * ce que des gens ont dit au téléphone : les recopier dans un espace
 * partagé change qui peut les lire, sans que personne ne l'ait décidé.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Version d'API épinglée : Notion casse ses formats entre versions. */
export const NOTION_VERSION = "2022-06-28";

export interface NotionConfig {
  token: string;
  databaseId: string;
}

/** Coupe une valeur au format Notion (2000 caractères par bloc de texte). */
const txt = (s: string | undefined | null, max = 1900): string => (s ?? "").slice(0, max);

/**
 * Les propriétés d'une fiche, au format Notion.
 *
 * Les noms de colonnes sont en français parce que ce sont ceux que
 * l'utilisateur voit dans Notion, et qu'ils doivent correspondre EXACTEMENT
 * à sa base — Notion refuse une propriété inconnue au lieu de l'ignorer.
 * La liste est donc aussi la documentation de la base à créer.
 */
export function prospectProperties(p: Prospect): Record<string, unknown> {
  return {
    Société: { title: [{ text: { content: txt(p.company || "(sans nom)", 200) } }] },
    Contact: { rich_text: [{ text: { content: txt(p.name, 200) } }] },
    Étape: { select: { name: stageById(p.stage).label } },
    Ville: { rich_text: [{ text: { content: txt(p.city, 200) } }] },
    Téléphone: p.phone ? { phone_number: p.phone } : { phone_number: null },
    Email: p.email ? { email: p.email } : { email: null },
    Probabilité: { number: p.probability ?? 0 },
    "Setup (€)": { number: p.setupValue ?? 0 },
    "Mensuel (€)": { number: p.monthlyValue ?? 0 },
    Confiance: { number: p.trust ?? 0 },
    // La date du prochain pas : c'est la colonne sur laquelle une équipe
    // trie réellement, bien plus que le montant.
    "Prochain pas": p.nextStep?.date ? { date: { start: p.nextStep.date } } : { date: null },
    Action: { rich_text: [{ text: { content: txt(p.nextStep?.action) } }] },
    "ID Alpha": { rich_text: [{ text: { content: p.id } }] },
  };
}

export interface NotionResult {
  ok: boolean;
  created: number;
  updated: number;
  failed: { company: string; error: string }[];
}

async function notionFetch(cfg: NotionConfig, path: string, init: RequestInit): Promise<Response> {
  return fetch(`https://api.notion.com/v1/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
}

/**
 * Retrouve la page d'un prospect par son identifiant ALPHA.
 *
 * C'est ce qui distingue une synchro d'un déversement : sans cette
 * recherche, chaque passage recréerait toutes les fiches et la base
 * doublerait de taille à chaque envoi.
 */
async function findPage(cfg: NotionConfig, alphaId: string): Promise<string | null> {
  const res = await notionFetch(cfg, `databases/${cfg.databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "ID Alpha", rich_text: { equals: alphaId } },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { id: string }[] };
  return data.results?.[0]?.id ?? null;
}

/**
 * Pousse des fiches vers Notion. Ne jette jamais : un échec sur une fiche
 * ne doit pas interrompre les autres, et le rapport dit lesquelles.
 */
export async function pushProspects(cfg: NotionConfig, prospects: Prospect[]): Promise<NotionResult> {
  const out: NotionResult = { ok: true, created: 0, updated: 0, failed: [] };

  for (const p of prospects) {
    try {
      const pageId = await findPage(cfg, p.id);
      const properties = prospectProperties(p);

      const res = pageId
        ? await notionFetch(cfg, `pages/${pageId}`, { method: "PATCH", body: JSON.stringify({ properties }) })
        : await notionFetch(cfg, "pages", {
            method: "POST",
            body: JSON.stringify({ parent: { database_id: cfg.databaseId }, properties }),
          });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        out.failed.push({ company: p.company, error: `HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}` });
        continue;
      }
      if (pageId) out.updated += 1;
      else out.created += 1;
    } catch (e) {
      out.failed.push({ company: p.company, error: e instanceof Error ? e.message : "échec réseau" });
    }
  }

  out.ok = out.failed.length === 0;
  return out;
}

/**
 * Les colonnes que la base Notion doit avoir, et leur type.
 *
 * Sert à générer une consigne exacte dans l'interface : Notion REFUSE une
 * propriété inconnue au lieu de l'ignorer, donc une colonne manquante fait
 * échouer tout l'envoi avec un message peu parlant.
 */
export const NOTION_SCHEMA: { name: string; type: string; note?: string }[] = [
  { name: "Société", type: "Titre", note: "colonne titre de la base" },
  { name: "Contact", type: "Texte" },
  { name: "Étape", type: "Sélection", note: "les options se créent toutes seules à l'envoi" },
  { name: "Ville", type: "Texte" },
  { name: "Téléphone", type: "Téléphone" },
  { name: "Email", type: "E-mail" },
  { name: "Probabilité", type: "Nombre" },
  { name: "Setup (€)", type: "Nombre" },
  { name: "Mensuel (€)", type: "Nombre" },
  { name: "Confiance", type: "Nombre" },
  { name: "Prochain pas", type: "Date" },
  { name: "Action", type: "Texte" },
  { name: "ID Alpha", type: "Texte", note: "OBLIGATOIRE — c'est lui qui évite les doublons" },
];
