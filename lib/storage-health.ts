/**
 * ─────────────────────────────────────────────────────────────────────
 * SANTÉ DU STOCKAGE LOCAL — la panne silencieuse qui perd une journée.
 *
 * Tout le CRM vit dans `localStorage` (local-first, zéro dépendance). Or
 * `localStorage` a un quota — environ 5 Mo par origine, parfois moins. Et
 * le Cerveau y écrit le TEXTE INTÉGRAL des PDF importés : quelques audits
 * de cinquante pages suffisent à s'en approcher.
 *
 * Ce qui se passait au dépassement : `setItem` lève `QuotaExceededError`,
 * l'écriture échoue, et RIEN ne le dit. L'opérateur continue sa journée —
 * il saisit des fiches, note des appels, avance des étapes — puis ferme
 * l'onglet. Tout ce qui a suivi la première écriture ratée n'existe plus.
 * C'est la pire forme de panne : elle ne ressemble pas à une panne.
 *
 * Ce module mesure, qualifie, et nomme le plus gros consommateur — parce
 * que « stockage plein » sans « c'est le Cerveau » n'aide personne.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Quota retenu pour le calcul. Prudent : certains navigateurs donnent moins. */
export const QUOTA_BYTES = 5 * 1024 * 1024;

export type StorageLevel = "ok" | "surveiller" | "critique" | "sature";

export interface StorageHealth {
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  level: StorageLevel;
  /** La clé la plus lourde, et son poids — pour savoir QUOI alléger. */
  heaviest?: { key: string; bytes: number; label: string };
  /** Message destiné à l'opérateur. Vide quand tout va bien. */
  message: string;
}

/** Nom lisible des grosses familles de données. */
const LABELS: Record<string, string> = {
  notes: "le Cerveau (documents importés)",
  prospects: "les fiches prospects",
  campaigns: "les campagnes",
  drafts: "les brouillons",
  standardLog: "le journal du standard",
  meetings: "les rendez-vous",
  customScripts: "les scripts personnalisés",
};

/**
 * Poids d'une chaîne en octets, sans TextEncoder.
 *
 * `localStorage` stocke de l'UTF-16 : deux octets par unité de code. C'est
 * ce que compte le navigateur pour son quota, PAS la longueur UTF-8 — un
 * texte français plein d'accents pèse donc plus qu'on ne croit.
 */
export function utf16Bytes(s: string): number {
  return s.length * 2;
}

function level(pct: number): StorageLevel {
  if (pct >= 100) return "sature";
  if (pct >= 90) return "critique";
  if (pct >= 70) return "surveiller";
  return "ok";
}

/**
 * Analyse le contenu persisté. Prend le JSON brut plutôt que de lire
 * `localStorage` lui-même : testable, et utilisable côté serveur.
 */
export function analyseStorage(rawByKey: Record<string, string>, quota = QUOTA_BYTES): StorageHealth {
  let used = 0;
  for (const [k, v] of Object.entries(rawByKey)) used += utf16Bytes(k) + utf16Bytes(v);

  // Le plus gros poste se cherche DANS l'état persisté, pas dans les clés
  // du navigateur : tout le store tient sous une seule clé.
  let heaviest: StorageHealth["heaviest"];
  for (const raw of Object.values(rawByKey)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const state = (parsed as { state?: Record<string, unknown> })?.state ?? (parsed as Record<string, unknown>);
    if (!state || typeof state !== "object") continue;
    for (const [k, v] of Object.entries(state)) {
      if (!Array.isArray(v)) continue;
      const bytes = utf16Bytes(JSON.stringify(v));
      if (!heaviest || bytes > heaviest.bytes) {
        heaviest = { key: k, bytes, label: LABELS[k] ?? k };
      }
    }
  }

  const usedPct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  const lvl = level(usedPct);

  const gros = heaviest ? ` Le plus lourd : ${heaviest.label} (${Math.round(heaviest.bytes / 1024)} Ko).` : "";
  const message =
    lvl === "sature"
      ? `Stockage SATURÉ (${usedPct} %). Plus rien ne s'enregistre — ce que tu saisis maintenant sera perdu en fermant l'onglet.${gros} Active la synchronisation Supabase, ou allège.`
      : lvl === "critique"
        ? `Stockage à ${usedPct} %. L'enregistrement va échouer sous peu, et il échouera en silence.${gros} Active la synchronisation, ou allège maintenant.`
        : lvl === "surveiller"
          ? `Stockage à ${usedPct} %.${gros} Rien d'urgent, mais c'est le moment d'activer la synchronisation Supabase.`
          : "";

  return { usedBytes: used, quotaBytes: quota, usedPct, level: lvl, heaviest, message };
}

/** Lecture réelle du navigateur. Renvoie null hors navigateur ou si l'accès est bloqué. */
export function readStorageHealth(prefix = "alpha-"): StorageHealth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      raw[k] = localStorage.getItem(k) ?? "";
    }
    return analyseStorage(raw);
  } catch {
    // Navigation privée, stockage désactivé : on ne casse pas la page.
    return null;
  }
}

/** Une erreur de quota, quel que soit le navigateur qui la lève. */
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  // Chrome/Safari : QuotaExceededError · Firefox : NS_ERROR_DOM_QUOTA_REACHED
  // (code 22 ou 1014 selon les versions — le nom seul ne suffit pas).
  const code = (e as unknown as { code?: number }).code;
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}
