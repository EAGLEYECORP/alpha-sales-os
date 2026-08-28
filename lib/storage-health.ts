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

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PROJECTION — savoir AVANT de coller mille lignes, pas après.
 *
 * `analyseStorage` constate. Il ne sert à rien à l'instant qui compte : celui
 * où l'opérateur s'apprête à importer un lot. Le mur se découvrait donc en le
 * percutant, et une écriture qui rate ne ressemble pas à une panne — l'app
 * continue d'afficher les fiches, elles disparaissent en fermant l'onglet.
 *
 * ⚠ La projection est une ESTIMATION et le dit. Elle multiplie un poids
 * moyen par le nombre de fiches ; la fusion des doublons et la compression
 * du navigateur la rendent pessimiste. On préfère cette erreur-là.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface ProjectionImport {
  /** Octets UTF-16 que ce lot ajouterait, estimés. */
  ajoutBytes: number;
  /** Pourcentage du quota APRÈS import. */
  pctApres: number;
  niveauApres: StorageLevel;
  /** Vrai quand l'import ferait franchir le seuil critique. */
  alerte: boolean;
  /** Ce qui s'affiche, réserve comprise. */
  phrase: string;
}

/** Au-delà, on ne laisse pas coller sans prévenir. */
export const SEUIL_ALERTE_PCT = 80;

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE FICHE NE PÈSE PAS SON POIDS D'IMPORT. ELLE PÈSE SA VIE.
 *
 * ⚠ MESURÉ, ET C'EST LE DÉFAUT QUE CETTE CONSTANTE CORRIGE.
 *
 * La projection ne comptait que le poids des fiches COLLÉES. Or chaque appel,
 * chaque email et chaque note ajoutent un événement à la timeline. Mesure sur
 * 2 500 fiches d'import Places :
 *
 *     à l'import (0 touche) ........ 4 803 Ko ...  94 %  → « ok »
 *     après 1 appel ................ 5 436 Ko ... 106 %  ⛔
 *     cadence complète (4 appels) .. 7 348 Ko ... 144 %  ⛔
 *     + 1 email + 1 note ........... 8 623 Ko ... 168 %  ⛔
 *
 * Autrement dit : l'opérateur collait 2 500 fiches, recevait un feu vert à
 * 94 %, et l'application cessait d'enregistrer AU PREMIER APPEL. L'écran
 * continue d'afficher les fiches ; elles disparaissent en fermant l'onglet.
 *
 * Le mur était donc juste et il regardait au mauvais endroit : il projetait
 * l'IMPORT, pas la VIE de la fiche. Une fiche qu'on n'appelle jamais ne coûte
 * rien — et n'a aucune raison d'être importée.
 *
 * `TOUCHES_PROJETEES` est le nombre d'événements qu'une fiche accumule avant
 * d'être tranchée : la cadence complète (4 appels, plafond légal sans SIREN)
 * plus un email et une note. C'est le scénario NORMAL, pas le pire.
 * ─────────────────────────────────────────────────────────────────────
 */
export const TOUCHES_PROJETEES = 6;

/** Poids moyen d'un événement de timeline, mesuré (UTF-16 compris). */
export const OCTETS_PAR_EVENEMENT = 260;

export function projeterImport(
  sante: StorageHealth | null,
  fiches: { length: number },
  octetsParFiche: number,
  /**
   * Projeter aussi la VIE de la fiche (timeline). Défaut : oui.
   *
   * ⚠ Passer `false` reproduit l'ancien calcul — celui qui donnait un feu vert
   * à 94 % avant de tomber au premier appel. Ne sert qu'aux tests qui
   * comparent les deux.
   */
  avecVie = true
): ProjectionImport {
  const n = Math.max(0, fiches.length);
  // ×2 : localStorage compte en UTF-16, pas en octets JSON.
  const fichesBytes = n * Math.max(0, octetsParFiche) * 2;
  const vieBytes = avecVie ? n * TOUCHES_PROJETEES * OCTETS_PAR_EVENEMENT : 0;
  const ajoutBytes = fichesBytes + vieBytes;

  if (!sante) {
    return {
      ajoutBytes,
      pctApres: 0,
      niveauApres: "ok",
      alerte: false,
      phrase: `~${Math.round(ajoutBytes / 1024)} Ko ajoutés (estimation). Impossible de mesurer le stockage de ce navigateur — navigation privée, ou stockage désactivé.`,
    };
  }

  const apres = sante.usedBytes + ajoutBytes;
  const pctApres = sante.quotaBytes > 0 ? Math.round((apres / sante.quotaBytes) * 100) : 0;
  const niveauApres = level(pctApres);
  const alerte = pctApres >= SEUIL_ALERTE_PCT;

  const combien = ajoutBytes >= 1024 * 1024
    ? `${(ajoutBytes / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.round(ajoutBytes / 1024)} Ko`;

  // Ce que la timeline ajoutera, dit séparément : sinon l'opérateur compare le
  // chiffre annoncé au poids de son CSV et croit la projection fausse.
  const detailVie =
    vieBytes > 0
      ? ` Dont ~${Math.round(vieBytes / 1024)} Ko d'historique : chaque appel, email et note ajoute une ligne à la timeline (${TOUCHES_PROJETEES} par fiche, cadence complète).`
      : "";

  const phrase = alerte
    ? `⚠ Ce lot ajoute ~${combien} : le stockage passerait de ${sante.usedPct} % à ~${pctApres} % du quota du navigateur.${detailVie} ` +
      (pctApres >= 100
        ? "Au-delà de 100 %, plus rien ne s'enregistre — et ça échoue EN SILENCE, l'écran continue d'afficher les fiches jusqu'à ce que tu fermes l'onglet. Active la synchronisation Supabase AVANT de coller ce lot."
        : "Active la synchronisation Supabase avant, ou importe par lots plus petits. Estimation pessimiste : les doublons fusionnés ne comptent pas.")
    : `~${combien} ajoutés · stockage ${sante.usedPct} % → ~${pctApres} % du quota. Estimation.${detailVie}`;

  return { ajoutBytes, pctApres, niveauApres, alerte, phrase };
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
