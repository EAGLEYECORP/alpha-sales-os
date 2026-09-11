import type { Prospect, Sector } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SECTEURS QU'UN ÉCRAN PROPOSE QUAND IL REGARDE TES PROPRES FICHES.
 *
 * ⚠ CE QUI A MOTIVÉ CE MODULE, le 11/09/2026. La même liste en dur était
 * recopiée dans QUATRE écrans — pipeline, tableau de bord, campagnes, intel —
 * et les quatre oubliaient `"autre"`. Or le marché actuel est la maîtrise
 * d'ouvrage, et les huit fiches de démonstration sont TOUTES en `"autre"`.
 * Conséquence mesurée, jamais signalée par personne :
 *  · le filtre du pipeline ne pouvait atteindre AUCUNE fiche du marché actuel
 *    (choisir un secteur les faisait toutes disparaître, sans option pour les
 *    retrouver) ;
 *  · la répartition par secteur du tableau de bord — sur l'écran d'accueil —
 *    comptait zéro partout, et la carte de chaleur des obstacles était vide.
 * Rien ne tombait. Les écrans avaient l'air de fonctionner.
 *
 * ⚠⚠ ON NE REMPLACE PAS UNE LISTE EN DUR PAR UNE AUTRE LISTE EN DUR.
 * Une liste écrite à la main redevient fausse au prochain changement de
 * marché — c'est exactement ce qui vient de se produire, en silence, pendant
 * que le reste du dépôt migrait vers la maîtrise d'ouvrage. Les écrans
 * DÉRIVENT donc les secteurs des fiches présentes :
 *  · les secteurs du marché d'avant disparaissent d'eux-mêmes chez nous,
 *    parce qu'il n'existe plus une seule fiche qui les porte ;
 *  · ils reviennent seuls chez un opérateur qui en a — on ne lui retire pas
 *    un filtre sur ses propres données pour régler NOTRE problème ;
 *  · un secteur ajouté demain au type apparaît sans qu'on touche à un écran.
 *
 * ⚠ Ce module ne touche PAS `lib/templates.ts` (`SECTOR_ANGLES`) ni les écrans
 * de campagne et d'intel. Là, le secteur ne filtre pas : il CHOISIT un angle
 * d'accroche parmi ceux qui sont écrits. Retirer une option y retirerait la
 * capacité de viser ce secteur, pas un libellé périmé. Les deux questions se
 * ressemblent et n'ont pas la même réponse.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'ordre d'affichage. Il est FIXE et ne suit pas l'ordre des fiches : une
 * liste déroulante dont les entrées changent de place à chaque import est
 * inutilisable, et on cliquerait à côté.
 */
export const ORDRE_SECTEURS: readonly Sector[] = [
  // Le marché en cours d'abord : c'est celui qu'on cherche le plus souvent.
  "maitrise-ouvrage",
  "restaurant",
  "pub",
  "ambulance",
  "artisan",
  "autre",
];

export const LIBELLE_SECTEUR: Record<Sector, string> = {
  "maitrise-ouvrage": "Maîtrise d'ouvrage",
  restaurant: "Restaurants",
  pub: "Pubs & bars",
  ambulance: "Ambulances",
  artisan: "Artisans",
  autre: "Autres",
};

/**
 * Comment NOMMER LE GROUPE dans une phrase — « je travaille avec des … ».
 *
 * ⚠⚠ C'ÉTAIT UNE CONCATÉNATION, ET ELLE A CASSÉ LE JOUR OÙ UN SECTEUR A ÉTÉ
 * AJOUTÉ. Le message LinkedIn d'une fiche écrivait
 * `p.sector === "autre" ? "entreprises" : p.sector + "s"`. Ça marchait tant
 * que les identifiants étaient des noms communs au singulier (« artisan » →
 * « artisans »). Avec « maitrise-ouvrage », le message proposé devenait :
 * « je travaille avec des **maitrise-ouvrages** du coin ».
 *
 * Ce n'est pas un libellé d'écran qu'on corrige au prochain passage : c'est un
 * VRAI MESSAGE SORTANT, proposé tel quel sur la fiche. Un identifiant
 * technique ne se met pas au pluriel — il se traduit.
 */
export const GROUPE_SECTEUR: Record<Sector, string> = {
  "maitrise-ouvrage": "maîtres d'ouvrage",
  restaurant: "restaurants",
  pub: "bars et pubs",
  ambulance: "sociétés d'ambulances",
  artisan: "artisans",
  // Le fourre-tout n'a pas de nom de métier : on dit ce qu'on sait, pas plus.
  autre: "entreprises",
};

/**
 * Les secteurs réellement portés par des fiches, dans l'ordre d'affichage.
 *
 * Rend `[]` sur une liste vide, et c'est voulu : aucune fiche, donc rien à
 * narrower. Proposer un filtre qui ne peut rien sélectionner est le défaut
 * qu'on vient de corriger, pas celui qu'on veut réintroduire à l'envers.
 */
export function secteursPresents(prospects: Pick<Prospect, "sector">[]): Sector[] {
  const vus = new Set<Sector>();
  for (const p of prospects) {
    // Une fiche importée peut porter n'importe quoi malgré le type : un CSV
    // n'est pas typé. On ne propose que ce que l'app sait afficher.
    if (p.sector && ORDRE_SECTEURS.includes(p.sector)) vus.add(p.sector);
  }
  return ORDRE_SECTEURS.filter((s) => vus.has(s));
}
