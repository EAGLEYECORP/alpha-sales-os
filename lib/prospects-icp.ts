/**
 * ─────────────────────────────────────────────────────────────────────
 * Prospects ICP Alpha Voice — consolidés depuis les feuilles de prospection
 * réelles de Zakaria (Google Sheets, juillet 2026) :
 *   · la feuille « artisans Lyon 6 & 7 », en deux listes A/B ;
 *   · la feuille « contacts Lyon 6 enrichis », classés fit Fort → Faible.
 *
 * ⚠ Ces deux feuilles portaient dans leur NOM la marque du revendeur avec qui
 * l'accord est mort le 02/09/2026. On désigne donc ici leur CONTENU (ce qui
 * identifie réellement une liste) et plus leur intitulé de fichier — les
 * fichiers, eux, sont chez Zakaria et ce module n'en dépend pas : le CSV
 * ci-dessous est figé, il ne relit aucune feuille.
 *
 * ICP = le cœur de cible d'Alpha Voice : un métier où le TÉLÉPHONE est
 * le premier point de contact et où personne n'est dédié à le prendre —
 * l'artisan sous un capot, le moniteur en leçon, la praticienne en cabine,
 * la régie qui croule sous les appels locataires. L'appel manqué y part
 * droit chez le concurrent.
 *
 * Filtrage appliqué (honnête) : ne sont RETENUS que les prospects encore
 * vivants et joignables. Sont ÉCARTÉS ceux dont la feuille dit clairement
 * qu'ils sont morts — fermé définitivement, départ en retraite, numéro non
 * attribué, « ne fait plus que de l'achat-revente », ou déjà équipés d'IA.
 * Écartés aussi les doublons du CRM existant (Les Clés d'Alexia).
 *
 * Le métier est répété dans `notes` : c'est ce que lit `verticalForProspect`
 * pour rattacher la fiche à la bonne verticale du playbook (garage, auto-
 * école, immobilier…) malgré le petit enum `Sector`. L'accroche terrain de
 * la feuille devient le premier `problems[]` — elle nourrit l'audit cadeau.
 *
 * Chargé depuis Réglages → « Prospects ICP (Alpha Voice) ». Import fusionnant
 * (ajoute / met à jour), il n'efface rien.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Format CSV (délimiteur `;`, champs entre guillemets) directement digéré
 * par `csvToProspects`. En-têtes mappés par `HEADER_MAP` de lib/csv.ts.
 */
/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE CSV N'EST PLUS DANS CE FICHIER — MÊME CORRECTIF QUE `pipeline-juillet`.
 *
 * Il portait une vingtaine d'entreprises lyonnaises RÉELLES avec leur
 * téléphone (dont des mobiles en 06/07, donc des lignes de personnes), leur
 * métier et des notes de prospection. Le dépôt étant public sur GitHub, ces
 * lignes étaient publiées sur internet sans base légale.
 *
 * Le fichier vit maintenant dans `donnees-privees/`, ignoré par git. Ce qui
 * reste ici : la façon de le lire, et le compte. Absent ⇒ chaîne vide, jamais
 * une exception : sur une machine sans le fichier, l'import ICP ne rend
 * simplement rien.
 * ─────────────────────────────────────────────────────────────────────
 */
function chargerCsv(): string {
  try {
    // Résolution À L'EXÉCUTION : un import statique casserait le build partout
    // où le fichier privé n'existe pas, c'est-à-dire partout sauf ici.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("node:path") as typeof import("node:path");
    return readFileSync(join(process.cwd(), "donnees-privees/prospects-icp.csv"), "utf8");
  } catch {
    return "";
  }
}

export const PROSPECTS_ICP_CSV = chargerCsv();

/** Nombre de fiches ICP embarquées (pour l'UI). */
/**
 * ⚠ `Math.max(0, …)` : sur une chaîne vide, `"".trim().split("\n")` rend
 * `[""]` — donc `length - 1` vaut 0, ce qui est juste par accident. Le
 * `max` rend l'intention explicite plutôt que de dépendre d'un cas limite
 * de `split`, et protège si la chaîne devient un jour `"\n"`.
 */
export const PROSPECTS_ICP_COUNT = PROSPECTS_ICP_CSV.trim()
  ? PROSPECTS_ICP_CSV.trim().split("\n").length - 1
  : 0;
