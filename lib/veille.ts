import { NUWACOM_THRESHOLD_HT } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA VEILLE, ET CE QU'ELLE SERT À TRANCHER.
 *
 * Zakaria, 13/09/2026 : « notre avantage, c'est d'être en veille sur ce qui
 * se passe, de connecter ça au besoin métier de notre ICP, de comprendre leur
 * opérationnel de l'intérieur sans les déranger, et d'arriver avec un truc
 * déjà ficelé. »
 *
 * C'est la position, et elle n'était nulle part dans le code.
 *
 * ══ ⚠⚠ LE DÉFAUT QUE CE MODULE RÉPARE ══
 *
 * La règle de sous-traitance existe DEUX fois, et une seule mord :
 *
 *  · **le PRIX** — `NUWACOM_THRESHOLD_HT` (40 000 €), exécutable, lu par le
 *    calculateur d'offres ;
 *  · **la FAISABILITÉ** — « si un open-source ou nous-mêmes pouvons le faire
 *    vite → on le fait nous ; si trop lourd → leur plateforme ». Écrite dans
 *    une CHAÎNE de `lib/accounts-commercial.ts`, donc invisible pour le code.
 *
 * Exactement le défaut payé par `forbidden` (`lib/playbook.ts`) et par
 * `structuralPain` : une règle juste, en prose, que rien ne pose.
 *
 * Et les deux critères se CONTREDISENT. Un chantier à 60 k qu'un outil libre
 * règle en une semaine : le prix l'envoie chez Nuwacom à 15 %, la faisabilité
 * dit de le garder à 100 %. Sur un seul dossier, l'écart est de 51 000 €.
 *
 * ══ ON NE TRANCHE PAS EN SILENCE, ON NOMME LE CONFLIT ══
 *
 * Précédent direct dans ce dépôt : `lib/opportunites.ts` sépare `fit`
 * (« ce programme nous va-t-il ? ») de `bloquant` (« avons-nous le DROIT
 * d'entrer ? ») — deux questions qui se lisaient comme une seule. Même
 * traitement ici :
 *
 *  · **peut-on le FAIRE ?** — une question de capacité. Non ⇒ Nuwacom, quel
 *    que soit le montant. Aucun prix ne rend faisable ce qu'on ne sait pas
 *    livrer.
 *  · **doit-on le PRENDRE ?** — une question de taille et de risque. C'est là
 *    que les 40 k parlent.
 *
 * Quand les deux se contredisent, le module rend `arbitrage-humain` et DIT
 * pourquoi. Un routage automatique aurait choisi le critère le plus facile à
 * coder — le prix — et aurait sous-traité à 15 % des dossiers qu'on sait
 * faire à 100 %.
 * ─────────────────────────────────────────────────────────────────────
 */

/** D'où vient une capacité qu'on pourrait déployer. */
export type OrigineCapacite =
  /** Brique libre, installable telle quelle. Le meilleur levier. */
  | "open-source"
  /** Déjà dans Alpha : on le sait faire, c'est écrit et testé. */
  | "maison"
  /** Service tiers à brancher : rapide, mais il consomme et il dépend. */
  | "service-tiers"
  /** À construire. Le plus cher, et celui qu'on surestime le moins mal. */
  | "a-construire";

/**
 * Ce qu'on sait faire, et en combien de temps.
 *
 * ⚠ `effortJours` est une ESTIMATION, et le champ le dit dans son nom de type.
 * Ce dépôt refuse les chiffres qui se font passer pour des mesures : aucune
 * de ces durées n'a été constatée sur une livraison réelle. Le premier
 * chantier qui déborde vaudra plus que toute cette table.
 */
export interface Capacite {
  id: string;
  /** Ce que ça fait, décrit par sa FONCTION — jamais par un nom de produit. */
  fonction: string;
  origine: OrigineCapacite;
  /** Estimation de mise en œuvre, en jours-homme. Fourchette, jamais un point. */
  effortJours: { bas: number; haut: number };
  /** Le besoin métier que ça sert, côté ICP. */
  besoin: string;
  /**
   * Niveau de preuve, même vocabulaire que `lib/references.ts`.
   * `mesure-maison` exige qu'on l'ait VRAIMENT livré une fois.
   */
  preuve: "mesure-maison" | "praticien" | "non-verifie";
}

/**
 * Au-delà de ce nombre de jours-homme, « on le fait vite » devient faux.
 *
 * ⚠ DÉCISION, PAS UNE MESURE. 10 jours = deux semaines pleines d'une seule
 * personne, sachant que l'installation se fait à la main et par une seule
 * personne (c'est la rareté que l'offre annonce). Au-delà, on ne « fait pas
 * vite » : on ouvre un chantier, avec le risque de livraison qui va avec.
 */
export const EFFORT_RAPIDE_MAX_JOURS = 10;

export type Routage = "eagleye" | "nuwacom" | "arbitrage-humain";

export interface VerdictRoutage {
  routage: Routage;
  /** Sait-on le livrer rapidement ? */
  faisableViteParNous: boolean;
  /** Le montant dépasse-t-il le seuil de sous-traitance ? */
  auDessusDuSeuil: boolean;
  /** Pourquoi. Nommé, jamais un verdict nu. */
  motif: string;
}

/**
 * Le routage d'un dossier — les DEUX questions, jamais une seule.
 *
 * @param devisHT Le montant estimé du chantier.
 * @param capacites Les capacités qu'on mobiliserait. Vide = on ne sait pas
 *   faire, et c'est une réponse, pas un manque de données.
 */
export function routerDossier(devisHT: number, capacites: Capacite[]): VerdictRoutage {
  const auDessusDuSeuil = devisHT > NUWACOM_THRESHOLD_HT;

  /**
   * ⚠ L'effort se CUMULE sur la borne HAUTE. Additionner les bornes basses
   * donnerait le meilleur des cas sur chaque brique en même temps — le biais
   * qui fait déborder tous les chantiers. Et une seule capacité « à
   * construire » suffit à sortir du régime rapide, même courte : ce n'est pas
   * sa durée qui coûte, c'est son incertitude.
   */
  const effortTotal = capacites.reduce((s, c) => s + c.effortJours.haut, 0);
  const aDuNeuf = capacites.some((c) => c.origine === "a-construire");
  const faisableViteParNous =
    capacites.length > 0 && !aDuNeuf && effortTotal <= EFFORT_RAPIDE_MAX_JOURS;

  // ── 1. Peut-on le FAIRE ? Non ⇒ Nuwacom, quel que soit le montant. ──
  if (!faisableViteParNous && !auDessusDuSeuil) {
    return {
      routage: "nuwacom",
      faisableViteParNous,
      auDessusDuSeuil,
      motif:
        capacites.length === 0
          ? "Aucune capacité identifiée : on ne sait pas le livrer. Le montant n'y change rien — aucun prix ne rend faisable ce qu'on ne sait pas faire."
          : `Estimé à ${effortTotal} jours-homme${aDuNeuf ? " dont du neuf à construire" : ""} : au-delà de ${EFFORT_RAPIDE_MAX_JOURS} jours, « on le fait vite » est faux. C'est un chantier, avec son risque de livraison.`,
    };
  }

  // ── 2. Les deux critères se contredisent : on NOMME, on ne tranche pas. ──
  if (faisableViteParNous && auDessusDuSeuil) {
    return {
      routage: "arbitrage-humain",
      faisableViteParNous,
      auDessusDuSeuil,
      motif:
        `Les deux règles se contredisent : ${effortTotal} jours-homme (on sait le faire vite, donc 100 % pour nous) ` +
        `mais ${Math.round(devisHT).toLocaleString("fr-FR")} € > ${NUWACOM_THRESHOLD_HT.toLocaleString("fr-FR")} € ` +
        `(le seuil dit de sous-traiter à 15 %). L'écart est de ` +
        `${Math.round(devisHT * 0.85).toLocaleString("fr-FR")} € sur ce seul dossier. ` +
        `À trancher à la main : ce qui manque n'est pas un calcul, c'est de savoir si on a la CAPACITÉ de porter ` +
        `un chantier de cette taille en plus du reste.`,
    };
  }

  // ── 3. Faisable vite ET sous le seuil : c'est pour nous. ──
  if (faisableViteParNous) {
    return {
      routage: "eagleye",
      faisableViteParNous,
      auDessusDuSeuil,
      motif: `${effortTotal} jours-homme et sous le seuil : c'est le meilleur levier — 100 % pour nous.`,
    };
  }

  // ── 4. Ni faisable vite, ni sous le seuil. ──
  return {
    routage: "nuwacom",
    faisableViteParNous,
    auDessusDuSeuil,
    motif: `Trop lourd (${effortTotal} jours-homme) ET au-dessus du seuil : plateforme Nuwacom, 15 % puis 100 % de la maintenance.`,
  };
}

/**
 * ⚠ LA TABLE EST VIDE, ET C'EST L'ÉTAT HONNÊTE.
 *
 * Une veille se remplit en regardant ce qui sort, pas en écrivant de mémoire
 * ce qu'on croit savoir. La pré-remplir avec des capacités plausibles
 * fabriquerait exactement ce que ce dépôt refuse partout : des entrées qui ont
 * l'air mesurées et qui sont devinées — et elles serviraient à router de vrais
 * dossiers vers un compte plutôt qu'un autre.
 *
 * Chaque entrée ajoutée doit porter son `preuve`. `mesure-maison` n'est
 * légitime qu'après une livraison RÉELLE ; tout le reste est `non-verifie`
 * jusqu'à preuve du contraire.
 */
export const CAPACITES: Capacite[] = [];

/** Les capacités qui servent un besoin donné. */
export function capacitesPour(besoin: string, table: Capacite[] = CAPACITES): Capacite[] {
  const q = besoin.trim().toLowerCase();
  if (!q) return [];
  return table.filter((c) => c.besoin.toLowerCase().includes(q) || c.fonction.toLowerCase().includes(q));
}
