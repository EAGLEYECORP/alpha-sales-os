/**
 * ─────────────────────────────────────────────────────────────────────
 * LE REGISTRE DES ENTREPRISES — croiser une fiche Maps avec l'officiel.
 *
 * ── CE QUE ÇA APPORTE, ET QUI MANQUAIT ──
 *
 * `verticalForText` DEVINE le métier à partir des mots d'une enseigne :
 * « Carrosserie des Lilas » → garage. Ça marche souvent, et ça se trompe en
 * silence sur « Les Ateliers du Rhône » ou « Maison Bernard ».
 *
 * Le code APE, lui, est ATTRIBUÉ. Il ne se devine pas, il se lit. Croiser une
 * fiche relevée sur une carte avec le répertoire officiel remplace une
 * supposition par un fait — et permet de cibler un métier ENTIER (tous les
 * couvreurs d'un département) au lieu d'espérer que l'enseigne le dise.
 *
 * ── L'API À UTILISER ──
 *
 * `recherche-entreprises.api.gouv.fr` : gratuite, ouverte, SANS clé. Elle
 * cherche par nom et par adresse et rend le code d'activité. C'est la bonne
 * porte pour ce besoin — l'API Sirene de l'INSEE donne davantage mais exige
 * un compte et un abonnement.
 *
 * ⚠ Ce module ne l'appelle PAS. Même doctrine que tout le sourcing : la
 * collecte reste dehors, l'app reçoit du texte et croise. Ici c'est aussi ce
 * qui évite qu'un import de 1 000 fiches déclenche 1 000 requêtes depuis le
 * navigateur d'un opérateur.
 *
 * ── ⚠ CE FICHIER A UNE DATE DE PÉREMPTION ──
 *
 * La table ci-dessous est en **NAF rév. 2**, la nomenclature en vigueur
 * aujourd'hui. La **NAF 2025** (décret n° 2025-736) devient la référence au
 * **1ᵉʳ janvier 2027** : environ 3 % des entreprises changent de code, et la
 * structure bouge. Pendant 2026, le répertoire Sirene affiche les DEUX.
 *
 * Sans cette note, la table se serait mise à rendre « métier inconnu » sur une
 * partie du fichier, sans que rien ne le signale. `nomenclaturePerimee()`
 * existe pour que ça se voie.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Date à laquelle la NAF 2025 devient la nomenclature de référence. */
export const BASCULE_NAF_2025 = "2027-01-01";

/**
 * Le croisement se fait-il encore sur une nomenclature à jour ?
 *
 * Rendu au lieu d'être supposé : le jour où ça bascule, la file de sourcing
 * doit le dire à l'écran plutôt que de perdre silencieusement des verticales.
 */
export function nomenclaturePerimee(maintenant = new Date()): boolean {
  return maintenant.toISOString().slice(0, 10) >= BASCULE_NAF_2025;
}

/**
 * Code APE (NAF rév. 2) → verticale du playbook.
 *
 * Les clés sont des PRÉFIXES : « 45.20 » attrape 45.20A comme 45.20B, parce
 * que la sous-classe distingue le poids lourd du véhicule léger et que notre
 * playbook ne fait pas cette différence.
 *
 * ⚠ Cette table décide du script qu'entendra un vrai prospect. Une entrée
 * approximative vaut moins qu'une entrée absente : un métier non reconnu
 * remonte comme « à qualifier », un métier MAL reconnu envoie le mauvais
 * argument avec assurance.
 */
export const NAF_VERTICALE: { prefixe: string; verticale: string; libelle: string }[] = [
  // ── Automobile ──
  { prefixe: "45.20", verticale: "garage-carrosserie", libelle: "Entretien et réparation de véhicules" },
  { prefixe: "45.11", verticale: "garage-carrosserie", libelle: "Commerce de voitures et véhicules légers" },
  { prefixe: "45.40", verticale: "garage-carrosserie", libelle: "Commerce et réparation de motocycles" },

  // ── Bâtiment ──
  { prefixe: "43.91", verticale: "artisan-batiment", libelle: "Travaux de couverture" },
  { prefixe: "43.22", verticale: "artisan-batiment", libelle: "Plomberie, chauffage, conditionnement d'air" },
  { prefixe: "43.21", verticale: "artisan-batiment", libelle: "Installation électrique" },
  { prefixe: "43.32", verticale: "artisan-batiment", libelle: "Travaux de menuiserie" },
  { prefixe: "43.34", verticale: "artisan-batiment", libelle: "Travaux de peinture et vitrerie" },
  { prefixe: "43.33", verticale: "artisan-batiment", libelle: "Travaux de revêtement des sols et des murs" },
  { prefixe: "43.29", verticale: "artisan-batiment", libelle: "Autres travaux d'installation" },
  { prefixe: "43.99", verticale: "artisan-batiment", libelle: "Autres travaux de construction spécialisés" },
  { prefixe: "41.20", verticale: "artisan-batiment", libelle: "Construction de bâtiments" },

  // ── Restauration ──
  { prefixe: "56.10", verticale: "restauration", libelle: "Restaurants et services de restauration mobile" },
  { prefixe: "56.21", verticale: "restauration", libelle: "Traiteurs" },
  { prefixe: "56.30", verticale: "bar-pub", libelle: "Débits de boissons" },

  // ── Santé ──
  { prefixe: "86.23", verticale: "sante-cabinet", libelle: "Pratique dentaire" },
  { prefixe: "86.21", verticale: "sante-cabinet", libelle: "Activité des médecins généralistes" },
  { prefixe: "86.22", verticale: "sante-cabinet", libelle: "Activité des médecins spécialistes" },
  { prefixe: "86.90", verticale: "sante-cabinet", libelle: "Autres activités pour la santé humaine" },

  // ── Immobilier ──
  { prefixe: "68.31", verticale: "immobilier", libelle: "Agences immobilières" },
  { prefixe: "68.32", verticale: "immobilier", libelle: "Administration d'immeubles (syndic, gestion)" },

  // ── Formation ──
  { prefixe: "85.53", verticale: "auto-ecole", libelle: "Enseignement de la conduite" },

  // ── Relation client ──
  { prefixe: "82.20", verticale: "centre-appels", libelle: "Activités de centres d'appels" },
];

/**
 * ⚠ 86.90 couvre les ambulances ET les laboratoires ET les infirmiers.
 *
 * La sous-classe compte ici, contrairement au reste de la table : 86.90A est
 * l'ambulance, et notre playbook a une verticale dédiée. On la traite à part
 * plutôt que d'élargir tout le préfixe.
 */
const SOUS_CLASSES: Record<string, string> = {
  "86.90A": "ambulance",
};

/** Normalise un code APE : « 4520A », « 45.20 A », « 45.20a » → « 45.20A ». */
export function normaliserNaf(code: string | undefined): string {
  const c = (code ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (c.length < 4) return "";
  return `${c.slice(0, 2)}.${c.slice(2, 4)}${c.slice(4, 5)}`;
}

export interface MetierOfficiel {
  /** Code normalisé. */
  naf: string;
  verticale: string | null;
  /** Libellé de l'activité, tel qu'il aide à comprendre un refus. */
  libelle: string | null;
}

/**
 * Le métier OFFICIEL derrière un code APE.
 *
 * Rend `verticale: null` quand le code n'est pas dans notre table — ce n'est
 * pas un échec, c'est un métier qu'on ne sait pas servir. Un code inconnu
 * remonté comme « à qualifier » vaut mieux qu'un rattachement approximatif.
 */
export function metierDepuisNaf(code: string | undefined): MetierOfficiel {
  const naf = normaliserNaf(code);
  if (!naf) return { naf: "", verticale: null, libelle: null };

  const sousClasse = SOUS_CLASSES[naf];
  if (sousClasse) return { naf, verticale: sousClasse, libelle: "Ambulances" };

  const hit = NAF_VERTICALE.find((n) => naf.startsWith(n.prefixe));
  return { naf, verticale: hit?.verticale ?? null, libelle: hit?.libelle ?? null };
}

/** Tous les codes qui correspondent à une verticale — pour cibler un métier entier. */
export function nafPourVerticale(verticale: string): string[] {
  const codes = NAF_VERTICALE.filter((n) => n.verticale === verticale).map((n) => n.prefixe);
  const sous = Object.entries(SOUS_CLASSES).filter(([, v]) => v === verticale).map(([k]) => k);
  return [...codes, ...sous];
}

// ── L'APPARIEMENT ──────────────────────────────────────────────────────

/**
 * Formes juridiques et mentions à retirer avant de comparer deux noms.
 *
 * Une carte affiche « Carrosserie des Lilas » ; le registre affiche
 * « CARROSSERIE DES LILAS SARL ». Comparer brut fait échouer un appariement
 * pourtant évident — et un appariement raté renvoie la fiche à la
 * qualification manuelle, ce qui annule tout l'intérêt du croisement.
 */
const FORMES_JURIDIQUES =
  /\b(sarl|sas|sasu|eurl|sa|snc|sci|scp|scm|selarl|selas|eirl|ei|gie|scop|sem|earl|gaec|micro-?entreprise|auto-?entrepreneur)\b/gi;

/** Mots qui n'aident pas à distinguer deux entreprises du même métier. */
const MOTS_VIDES = /\b(le|la|les|de|du|des|et|aux?|chez|entreprise|societe|ets|etablissements?)\b/gi;

/**
 * Nom réduit à ce qui identifie vraiment l'entreprise.
 *
 * Volontairement agressif : accents, ponctuation, forme juridique et mots
 * vides sautent. Ce qui reste, ce sont les mots qui portent l'identité.
 */
export function normaliserNom(nom: string | undefined): string {
  return (nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(FORMES_JURIDIQUES, " ")
    .replace(MOTS_VIDES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Code postal extrait d'une adresse libre. */
export function codePostal(adresse: string | undefined): string {
  return (adresse ?? "").match(/\b(\d{5})\b/)?.[1] ?? "";
}

export interface CandidatRegistre {
  /** Raison sociale ou nom commercial, tel que rendu par l'API. */
  nom?: string;
  siren?: string;
  siret?: string;
  naf?: string;
  adresse?: string;
  codePostal?: string;
}

export type Confiance = "sure" | "probable" | "douteuse" | "aucune";

export interface Appariement {
  candidat: CandidatRegistre | null;
  confiance: Confiance;
  /** Ce qui a fait pencher — vérifiable, pas un score opaque. */
  pourquoi: string[];
  /** Ce qui doit faire hésiter avant d'écrire le SIREN sur la fiche. */
  reserves: string[];
}

/**
 * Apparie une fiche relevée avec les candidats du registre.
 *
 * ⚠ LE RISQUE DE CET APPARIEMENT N'EST PAS DE RATER, C'EST DE SE TROMPER.
 *
 * Rater renvoie la fiche à la qualification manuelle : coût, une minute.
 * Se tromper colle un SIREN et un métier officiel FAUX sur une fiche, avec
 * l'autorité de l'officiel — et l'erreur devient invisible, parce que plus
 * personne ne remet en cause un code APE.
 *
 * D'où un appariement conservateur : sans code postal identique, rien n'est
 * jamais « sûr », et deux candidats également plausibles rendent « douteuse »
 * plutôt que de trancher au hasard.
 */
export function apparier(
  fiche: { entreprise?: string; adresse?: string; ville?: string },
  candidats: CandidatRegistre[]
): Appariement {
  const nomFiche = normaliserNom(fiche.entreprise);
  const cpFiche = codePostal(fiche.adresse) || codePostal(fiche.ville);

  if (!nomFiche) {
    return { candidat: null, confiance: "aucune", pourquoi: [], reserves: ["fiche sans nom d'entreprise"] };
  }
  if (!candidats.length) {
    return { candidat: null, confiance: "aucune", pourquoi: [], reserves: ["aucun candidat au registre"] };
  }

  const notes = candidats.map((c) => {
    const nomC = normaliserNom(c.nom);
    const cpC = (c.codePostal ?? codePostal(c.adresse)).trim();
    const memeCp = !!cpFiche && cpFiche === cpC;

    let score = 0;
    const pourquoi: string[] = [];

    if (nomC && nomC === nomFiche) {
      score += 60;
      pourquoi.push(`nom identique une fois normalisé (« ${nomFiche} »)`);
    } else if (nomC && (nomC.includes(nomFiche) || nomFiche.includes(nomC))) {
      score += 35;
      pourquoi.push(`un nom contient l'autre (« ${nomFiche} » / « ${nomC} »)`);
    } else {
      // Recouvrement de mots : « carrosserie lilas » vs « lilas carrosserie ».
      const a = new Set(nomFiche.split(" "));
      const b = new Set(nomC.split(" "));
      const communs = [...a].filter((m) => b.has(m) && m.length > 2);
      if (communs.length >= 2) {
        score += 25;
        pourquoi.push(`${communs.length} mots communs : ${communs.join(", ")}`);
      }
    }

    if (memeCp) {
      score += 30;
      pourquoi.push(`même code postal (${cpFiche})`);
    }

    return { candidat: c, score, memeCp, pourquoi };
  });

  notes.sort((a, b) => b.score - a.score);
  const meilleur = notes[0];
  const second = notes[1];
  const reserves: string[] = [];

  if (meilleur.score < 25) {
    return {
      candidat: null,
      confiance: "aucune",
      pourquoi: [],
      reserves: ["aucun candidat ne ressemble assez — à qualifier à la main"],
    };
  }

  // Deux candidats aussi plausibles : on ne tranche PAS. Un mauvais SIREN est
  // pire qu'un SIREN absent, parce qu'il ne se remet plus en question.
  if (second && meilleur.score - second.score < 15) {
    reserves.push(
      `${notes.filter((n) => meilleur.score - n.score < 15).length} candidats également plausibles — le registre ne tranche pas, un humain doit regarder`
    );
    return { candidat: null, confiance: "douteuse", pourquoi: meilleur.pourquoi, reserves };
  }

  if (!cpFiche) reserves.push("aucun code postal sur la fiche — l'appariement repose sur le seul nom");
  else if (!meilleur.memeCp) reserves.push("code postal différent du registre : établissement déménagé, ou homonyme");

  const confiance: Confiance =
    meilleur.score >= 85 && meilleur.memeCp ? "sure" : meilleur.score >= 50 ? "probable" : "douteuse";

  return { candidat: meilleur.candidat, confiance, pourquoi: meilleur.pourquoi, reserves };
}

/**
 * Le croisement doit-il ÉCRIRE sur la fiche ?
 *
 * Seul « sure » écrit sans demander. Le reste se propose et se relit — parce
 * qu'un code APE faux porte l'autorité de l'officiel, et que plus personne ne
 * le remet en cause une fois écrit.
 */
export const ECRIT_SANS_DEMANDER: Confiance[] = ["sure"];

/** L'URL de recherche, pour que l'opérateur aille vérifier lui-même. */
export function urlRecherche(nom: string, cp?: string): string {
  const q = [nom, cp].filter(Boolean).join(" ");
  return `https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(q)}`;
}
