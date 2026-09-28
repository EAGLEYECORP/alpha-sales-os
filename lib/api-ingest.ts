import type { Prospect, Sector } from "./types";
import { prospectDefaults } from "./seed";
import { ORDRE_SECTEURS } from "./secteurs";
import { toE164 } from "./voice-script";
import { auditCompleteness } from "./deep-dive";

/**
 * ─────────────────────────────────────────────────────────────────────
 * INGESTION API — transformer du JSON étranger en fiche exploitable.
 *
 * C'est la porte d'entrée des intégrations : n8n, un CRM client, un
 * formulaire, un scraper. Le monde extérieur envoie ce qu'il veut ; ce
 * module décide ce qui entre.
 *
 * Trois principes, dans cet ordre :
 *
 *  1. ON REFUSE PLUTÔT QUE DE DEVINER. Une fiche sans société n'est pas une
 *     fiche : elle est rejetée avec sa raison. Inventer un nom pour « sauver »
 *     la ligne pollue le pipe et fausse tous les taux.
 *
 *  2. ON DIT CE QU'ON A IGNORÉ. Chaque champ non reconnu remonte en
 *     avertissement. Une intégration qui envoie `telephone` au lieu de `phone`
 *     doit l'apprendre en une requête, pas après trois semaines de silence.
 *
 *  3. ON NE FAIT JAMAIS CONFIANCE AU STADE FOURNI. Un système externe n'a pas
 *     à décider qu'un prospect est « signé ». L'ingestion entre en `prospect`
 *     ou `contact`, jamais plus loin.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠ C'ÉTAIT UNE COPIE DE L'UNION, ÉCRITE À LA MAIN. Elle serait restée au
 * marché d'avant : une fiche de maîtrise d'ouvrage postée sur cette API
 * aurait été refusée en « secteur inconnu → autre », avec un avertissement
 * qui liste des valeurs périmées. On dérive du type.
 */
const SECTORS: readonly Sector[] = ORDRE_SECTEURS;

/** Alias acceptés pour chaque champ — le monde réel n'utilise pas nos noms. */
const ALIASES: Record<string, string[]> = {
  company: ["company", "societe", "société", "entreprise", "commerce", "raison_sociale", "name_company", "organisation"],
  name: ["name", "nom", "contact", "prenom", "prénom", "dirigeant", "gerant", "gérant", "full_name"],
  email: ["email", "mail", "e-mail", "courriel", "email_address"],
  phone: ["phone", "telephone", "téléphone", "tel", "mobile", "phone_number", "numero", "numéro"],
  city: ["city", "ville", "commune", "localite", "localité"],
  sector: ["sector", "secteur", "activite", "activité", "metier", "métier", "industry"],
  notes: ["notes", "note", "commentaire", "comment", "remarques"],
  website: ["website", "site", "site_web", "url", "web"],
  linkedin: ["linkedin", "linkedin_url", "profil_linkedin"],
};

const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, "_");

/** Retrouve une valeur quel que soit l'alias employé par l'appelant. */
function pick(raw: Record<string, unknown>, field: string): string | undefined {
  const keys = ALIASES[field] ?? [field];
  for (const [k, v] of Object.entries(raw)) {
    if (!keys.includes(norm(k))) continue;
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
}

const numOr = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

export interface IngestResult {
  ok: boolean;
  prospect?: Prospect;
  /** Pourquoi la ligne est refusée. */
  error?: string;
  /** Ce qui a été ignoré ou corrigé — l'intégrateur doit pouvoir s'améliorer. */
  warnings: string[];
}

/** Toutes les clés que l'ingestion sait lire (pour le message d'erreur). */
export const KNOWN_FIELDS = Object.values(ALIASES).flat();

/**
 * Normalise UNE fiche entrante.
 * `id` est dérivé de l'email ou de la société : deux envois de la même
 * entreprise produisent le même id, donc une mise à jour et pas un doublon.
 */
export function normalizeIncoming(raw: unknown, now: Date = new Date()): IngestResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Chaque entrée doit être un objet JSON.", warnings };
  }
  const r = raw as Record<string, unknown>;

  const company = pick(r, "company");
  if (!company) {
    return {
      ok: false,
      error: `Champ « company » obligatoire (alias acceptés : ${ALIASES.company.join(", ")}).`,
      warnings,
    };
  }

  // Les champs qu'on ne comprend pas : on le DIT, on ne les avale pas.
  const consumed = new Set(KNOWN_FIELDS);
  const ignored = Object.keys(r).filter((k) => !consumed.has(norm(k)));
  if (ignored.length) warnings.push(`Champs ignorés : ${ignored.join(", ")}.`);

  const rawPhone = pick(r, "phone");
  const phone = rawPhone ? toE164(rawPhone) : undefined;
  if (rawPhone && !phone) warnings.push(`Numéro inexploitable, conservé tel quel : « ${rawPhone} ».`);

  const email = pick(r, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    warnings.push(`Email de forme inhabituelle : « ${email} ».`);
  }

  const rawSector = pick(r, "sector")?.toLowerCase();
  const sector: Sector = (SECTORS.find((s) => s === rawSector) ?? "autre") as Sector;
  if (rawSector && sector === "autre" && rawSector !== "autre") {
    warnings.push(`Secteur « ${rawSector} » inconnu → « autre ». Valeurs : ${SECTORS.join(", ")}.`);
  }

  // Identifiant stable : même entreprise = même fiche, donc mise à jour.
  const seed = (email ?? company).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = `api-${seed}`.slice(0, 60);

  const website = pick(r, "website");

  const prospect: Prospect = {
    ...prospectDefaults,
    id,
    company,
    name: pick(r, "name") ?? "",
    email,
    phone: phone ?? rawPhone,
    city: pick(r, "city") ?? "",
    sector,
    linkedin: pick(r, "linkedin"),
    notes: pick(r, "notes") ?? "",
    // ⚠ Le stade n'est JAMAIS pris de l'extérieur : un système tiers n'a pas
    // à décider qu'un prospect est signé. On entre au début du pipeline.
    stage: "prospect",
    monthlyValue: numOr(r.monthlyValue) ?? 0,
    setupValue: numOr(r.setupValue) ?? 0,
    deepAudit: {
      ...prospectDefaults.deepAudit,
      websiteState: website ?? "",
      missedCallsPerWeek: numOr(r.missedCallsPerWeek),
      avgTicket: numOr(r.avgTicket),
      googleRating: numOr(r.googleRating),
      googleReviews: numOr(r.googleReviews),
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as Prospect;

  // Le score d'audit reflète ce qu'on sait vraiment, dès l'entrée.
  prospect.auditScore = auditCompleteness(prospect);

  if (!prospect.email && !prospect.phone) {
    warnings.push("Ni email ni téléphone : la fiche entre, mais aucune action automatique n'est possible.");
  }

  return { ok: true, prospect, warnings };
}

export interface BatchResult {
  accepted: Prospect[];
  rejected: { index: number; error: string }[];
  warnings: { index: number; company?: string; warnings: string[] }[];
  summary: string;
}

/** Normalise un lot. Une ligne fautive n'empêche jamais les autres d'entrer. */
export function normalizeBatch(rows: unknown[], now: Date = new Date()): BatchResult {
  const accepted: Prospect[] = [];
  const rejected: { index: number; error: string }[] = [];
  const warnings: { index: number; company?: string; warnings: string[] }[] = [];

  rows.forEach((row, index) => {
    const r = normalizeIncoming(row, now);
    if (!r.ok || !r.prospect) {
      rejected.push({ index, error: r.error ?? "entrée invalide" });
      return;
    }
    accepted.push(r.prospect);
    if (r.warnings.length) warnings.push({ index, company: r.prospect.company, warnings: r.warnings });
  });

  // Doublons DANS le lot : le dernier gagne, mais on le signale.
  const seen = new Map<string, number>();
  for (const [i, p] of accepted.entries()) {
    if (seen.has(p.id)) {
      warnings.push({ index: i, company: p.company, warnings: [`Doublon dans le lot — fusionné avec l'entrée ${seen.get(p.id)}.`] });
    }
    seen.set(p.id, i);
  }
  const deduped = [...new Map(accepted.map((p) => [p.id, p])).values()];

  return {
    accepted: deduped,
    rejected,
    warnings,
    summary:
      `${deduped.length} fiche(s) acceptée(s)` +
      (rejected.length ? `, ${rejected.length} refusée(s)` : "") +
      (accepted.length !== deduped.length ? `, ${accepted.length - deduped.length} doublon(s) fusionné(s)` : "") +
      ".",
  };
}
