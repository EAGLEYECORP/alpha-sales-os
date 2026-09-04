import { prospectDefaults } from "./seed";
import { champsReconnus, lireTableau, type Lecture } from "./tabulaire";
import type { Prospect, Sector } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PERMIS DE CONSTRUIRE COMME SIGNAL COMMERCIAL.
 *
 * ── POURQUOI CE MODULE EXISTE ──
 *
 * L'avatar visé pour l'offre VIP est le MAÎTRE D'OUVRAGE avec un permis actif.
 * Le permis est un signal public, daté et vérifiable — c'est exactement ce qui
 * manque partout ailleurs dans le sourcing : il ne dit pas seulement QUI, il
 * dit OÙ EN EST l'affaire, au mois près.
 *
 * ── LE PIÈGE, ET C'EST LUI QUI JUSTIFIE TOUT LE FICHIER ──
 *
 * « Maître d'ouvrage » n'est pas un métier, c'est un RÔLE juridique : c'est
 * celui qui commande les travaux. Le mot recouvre donc, dans le même fichier
 * d'open data :
 *
 *  · un promoteur qui construit 48 logements POUR LES VENDRE — il a un
 *    problème de vente, daté, chiffrable, et il vaut une offre à 10 k€ ;
 *  · un bailleur social qui construit pour ATTRIBUER — il n'a rien à vendre ;
 *  · une commune qui construit une école — marché public, pas de vente ;
 *  · un couple qui construit sa maison — il n'a rien à vendre non plus, et il
 *    représente le GROS du volume des permis.
 *
 * Trier « les maîtres d'ouvrage » sans faire cette distinction revient à
 * prospecter des particuliers avec un OS de vente à 10 000 €. Ce module ne
 * fait donc pas un score : il pose d'abord une question binaire — **est-ce que
 * cette personne devra VENDRE ce qu'elle construit ?** — et tout ce qui répond
 * non sort par une exclusion sèche que le score ne rattrape pas.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ──
 *
 * Il ne va chercher aucune donnée. La collecte reste dehors (open data
 * Sitadel / Grand Lyon, relevé à la main, feuille de calcul), conformément à
 * la troisième colonne : l'humain relève, la feuille transporte, Alpha trie.
 *
 * Il ne produit AUCUN euro. Le nombre de logements dit la taille de
 * l'opération, pas ce que le prospect va nous payer, et un « CA potentiel »
 * affiché sur une fiche serait une invention qui se retournerait au premier
 * rendez-vous.
 *
 * ⚠ **Tous les seuils de ce fichier sont des DÉCISIONS, pas des mesures.**
 * Zéro permis n'a encore été converti. Le jour où il y en a dix, ce sont les
 * seuils qui bougent, à la main, et ça se verra dans un diff.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ce qu'une ligne d'open data « permis de construire » expose réellement.
 *
 * Tout est optionnel : les exports diffèrent d'une collectivité à l'autre, et
 * une colonne manquante n'est pas une ligne fausse — c'est un angle mort qu'on
 * doit pouvoir NOMMER au lieu de le combler.
 */
export interface PermisConstruire {
  /** Numéro de l'arrêté (PC 069 383 24 A0123). Sert de clé de dédup. */
  numero?: string;
  /** Le demandeur tel qu'écrit sur l'arrêté : c'est LUI, le maître d'ouvrage. */
  demandeur?: string;
  /** Date de la décision (arrêté). C'est elle qui fait courir les 3 ans. */
  dateDecision?: string;
  /** Déclaration d'ouverture de chantier (DOC), si l'export la porte. */
  dateOuvertureChantier?: string;
  /** Déclaration attestant l'achèvement (DAACT). Si elle existe, c'est fini. */
  dateAchevement?: string;
  /** Nombre de logements créés. Absent ou 0 = ce n'est pas du logement. */
  logements?: number;
  surfacePlancher?: number;
  commune?: string;
  adresse?: string;
  /** Nombre de prorogations obtenues : chacune décale la péremption d'un an. */
  prorogations?: number;
}

export type TypeMaitreOuvrage =
  | "promoteur"
  | "constructeur-maisons"
  | "bailleur-social"
  | "public"
  | "particulier"
  | "entreprise"
  | "inconnu";

export type PhasePermis =
  | "recours"
  | "commercialisation"
  | "lancement-bloque"
  | "chantier"
  | "acheve"
  | "perime"
  | "inconnue";

export interface LecturePermis {
  typeMoa: TypeMaitreOuvrage;
  /** Devra-t-il VENDRE ce qu'il construit ? La question qui commande tout. */
  problemeDeVente: boolean;
  phase: PhasePermis;
  /** Mois écoulés depuis l'arrêté. `null` si la date manque. */
  moisDepuisDecision: number | null;
  /** 0–100. Ordonne la file, ne décide jamais seul. */
  score: number;
  retenu: boolean;
  /** L'angle daté, en clair — ce qui se dit dans le premier message. */
  fenetre: string;
  pourquoi: string[];
  manque: string[];
  risques: string[];
}

/**
 * Durée de validité d'un permis, en mois.
 *
 * Article R. 424-17 du code de l'urbanisme : trois ans à compter de la
 * notification de l'arrêté, prorogeables deux fois un an. Ce n'est pas un
 * réglage produit, c'est la loi — d'où la constante nommée et le commentaire.
 */
export const VALIDITE_MOIS = 36;
/** Chaque prorogation ajoute douze mois, dans la limite de deux. */
export const PROROGATION_MOIS = 12;
export const PROROGATIONS_MAX = 2;

/**
 * Fenêtre de recours des tiers : deux mois à compter du premier jour
 * d'affichage continu du panneau. Tant qu'elle court, un promoteur sérieux ne
 * lance pas sa commercialisation à plein régime — le contacter n'est pas une
 * erreur, mais l'angle n'est pas le même.
 */
export const RECOURS_MOIS = 2;

/**
 * SCCV : société civile de construction-vente. Sa raison d'être LÉGALE est de
 * construire pour vendre — c'est le marqueur le plus fiable du fichier, et il
 * ne dépend d'aucune liste de marques à maintenir.
 */
const PROMOTEUR =
  /\b(sccv|scicv)\b|promotion immobili|promoteur|am[ée]nageur|\bvefa\b|programme immobilier/i;

/** Constructeur de maisons individuelles : il vend, lui aussi. */
const CONSTRUCTEUR_MAISONS =
  /\b(cmi)\b|constructeur de maisons|maisons? (individuelles?|d'?en france|de france|familiales)/i;

/**
 * Bailleur social : il construit pour ATTRIBUER, jamais pour vendre.
 *
 * ⚠ « habitat » seul est volontairement absent : beaucoup de promoteurs privés
 * s'appellent « X Habitat ». On ne retient que des formes juridiques et des
 * sigles qui n'appartiennent qu'au logement social, plus une poignée de noms
 * lyonnais qui ne portent aucun de ces sigles.
 *
 * ⚠⚠ CETTE LIGNE EST LA PLUS FRAGILE DU FICHIER, et un test l'a prouvé avant
 * même le premier import : elle s'écrivait « grandlyon habitat » et laissait
 * donc passer « GRAND LYON HABITAT », qui est l'orthographe réelle. Un
 * bailleur social passé au travers ne ressemble à rien — il ressort comme un
 * beau prospect de 60 logements. La liste est forcément incomplète : c'est
 * pour ça qu'un « inconnu » n'est pas un refus, que le champ `manque` existe,
 * et que le résumé de lot compte ce qui a été écarté.
 */
const BAILLEUR_SOCIAL =
  /\b(opac|oph|hlm|esh|opha?c)\b|office public de l'?habitat|habitations? à loyer mod[ée]r|logement social|\bsemcoda\b|grand ?lyon habitat|(est|lyon) m[ée]tropole habitat/i;

/** Personne publique : commande publique, pas de fonction commerciale. */
const PUBLIC =
  /\b(commune|ville) d[eu']|m[ée]tropole de|d[ée]partement d|conseil (r[ée]gional|d[ée]partemental)|\bccas\b|\bsytral\b|\bchu\b|h[oô]pital|centre hospitalier|rectorat|acad[ée]mie de|universit[ée]|\bsncf\b|\bsdis\b|syndicat (mixte|intercommunal)/i;

/** Une personne physique : « M. et Mme Dupont ». */
const PARTICULIER = /^\s*(m\.|mme|mr|monsieur|madame|m et mme|m\. et mme|consorts)\b/i;

/** Une forme de société, quelle qu'elle soit. */
const FORME_SOCIETE = /\b(sas|sasu|sarl|eurl|sa|snc|sci|sccv|scic|scop|gie|sem|spl)\b/i;

/**
 * Le nombre de logements sous lequel l'offre VIP n'est pas proportionnée.
 *
 * DÉCISION, pas mesure : une opération de trois lots se vend par le
 * bouche-à-oreille et un panneau, et 10 000 € d'OS de vente y représentent une
 * part indécente du budget de commercialisation. On ne l'exclut pas — on
 * l'écarte du score et on dit pourquoi.
 */
export const LOGEMENTS_MIN = 6;

/** Sous ce score, la ligne ne mérite pas le temps d'un message écrit à la main. */
export const SCORE_MIN_PERMIS = 55;

/** Mois pleins entre deux dates. `null` si la date est illisible. */
function moisEcoules(depuis: string | undefined, now: Date): number | null {
  const t = Date.parse((depuis ?? "").trim());
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const mois =
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) - (now.getDate() < d.getDate() ? 1 : 0);
  return mois;
}

/**
 * Qui est le demandeur ?
 *
 * L'ordre des tests n'est pas cosmétique : « SCCV Les Jardins » contient
 * `sci`-adjacent et une forme de société ; « OPAC du Rhône » contiendrait
 * `public` par « office ». Le plus SPÉCIFIQUE gagne, du plus étroit au plus
 * large, et le fourre-tout `entreprise` ne se prononce qu'en dernier.
 */
export function typeDeMaitreOuvrage(demandeur?: string): TypeMaitreOuvrage {
  const d = (demandeur ?? "").trim();
  if (!d) return "inconnu";
  if (BAILLEUR_SOCIAL.test(d)) return "bailleur-social";
  if (PROMOTEUR.test(d)) return "promoteur";
  if (CONSTRUCTEUR_MAISONS.test(d)) return "constructeur-maisons";
  if (PUBLIC.test(d)) return "public";
  if (PARTICULIER.test(d)) return "particulier";
  if (FORME_SOCIETE.test(d)) return "entreprise";
  return "inconnu";
}

/**
 * Ce maître d'ouvrage devra-t-il vendre ?
 *
 * ⚠ `entreprise` et `inconnu` répondent OUI, et c'est délibéré : une SAS qui
 * dépose un permis pour trente logements est un promoteur qui ne s'est pas
 * nommé comme tel. Répondre non par prudence supprimerait la moitié des vraies
 * cibles ; répondre oui les laisse passer avec un `manque` explicite, et c'est
 * l'humain qui tranche sur un fichier de vingt lignes.
 */
export function devraVendre(type: TypeMaitreOuvrage): boolean {
  return type === "promoteur" || type === "constructeur-maisons" || type === "entreprise" || type === "inconnu";
}

/** Fin de validité, prorogations comprises (plafonnées à deux). */
export function peremptionMois(prorogations = 0): number {
  const p = Math.max(0, Math.min(PROROGATIONS_MAX, Math.floor(prorogations)));
  return VALIDITE_MOIS + p * PROROGATION_MOIS;
}

export function phaseDuPermis(p: PermisConstruire, now = new Date()): PhasePermis {
  // Une déclaration d'achèvement clôt le sujet : il n'y a plus rien à vendre
  // qui ne soit déjà vendu. Elle prime sur tout le reste, y compris les dates.
  if ((p.dateAchevement ?? "").trim()) return "acheve";

  const m = moisEcoules(p.dateDecision, now);
  // Le chantier ouvert prime sur la péremption : les trois ans ne courent plus
  // une fois les travaux commencés (c'est l'interruption qui devient le risque).
  if ((p.dateOuvertureChantier ?? "").trim()) return "chantier";
  if (m === null) return "inconnue";
  if (m > peremptionMois(p.prorogations)) return "perime";
  if (m < RECOURS_MOIS) return "recours";
  if (m <= 12) return "commercialisation";
  return "lancement-bloque";
}

/** La phrase datée qu'on peut réellement dire, par phase. */
const FENETRE: Record<PhasePermis, string> = {
  recours:
    "Arrêté tout frais : le délai de recours des tiers court encore. Trop tôt pour parler commercialisation à plein régime, juste à l'heure pour se faire connaître avant le lancement.",
  commercialisation:
    "Permis purgé, chantier pas ouvert : c'est la fenêtre de pré-commercialisation. C'est là que le nombre de réservations conditionne le financement de l'opération — donc là que le sujet est le plus vif.",
  "lancement-bloque":
    "Permis obtenu il y a plus d'un an, aucun chantier déclaré. Soit la pré-commercialisation n'atteint pas le seuil qui débloque le financement, soit l'opération est à l'arrêt. La question se pose telle quelle, elle ne se devine pas.",
  chantier:
    "Chantier ouvert : une partie des lots est vendue, il reste presque toujours la queue de programme — les derniers lots sont les plus longs à écouler.",
  acheve: "Opération achevée : plus rien à commercialiser sur ce permis.",
  perime: "Permis au-delà de sa durée de validité : il n'y a plus d'opération derrière cette ligne.",
  inconnue: "Aucune date d'arrêté lisible : impossible de situer l'opération dans le temps.",
};

/**
 * Lit UNE ligne de permis.
 *
 * Déterministe, sans réseau, sans clé : un fichier de mille lignes se trie en
 * une fraction de seconde, et le verdict est le même deux jours de suite.
 */
export function lirePermis(p: PermisConstruire, now = new Date()): LecturePermis {
  const pourquoi: string[] = [];
  const manque: string[] = [];
  const risques: string[] = [];
  const exclusions: string[] = [];

  const demandeur = (p.demandeur ?? "").trim();
  const typeMoa = typeDeMaitreOuvrage(demandeur);
  const problemeDeVente = devraVendre(typeMoa);
  const phase = phaseDuPermis(p, now);
  const moisDepuisDecision = moisEcoules(p.dateDecision, now);
  const logements = Number.isFinite(p.logements) ? Number(p.logements) : null;

  // ── LES EXCLUSIONS SÈCHES ──
  // Elles ne se rattrapent pas au score. C'est la leçon du ciblage LinkedIn :
  // un barème qui laisse passer ce qu'on a décidé d'exclure est décoratif.
  if (!problemeDeVente) {
    const raison: Record<string, string> = {
      "bailleur-social": "bailleur social : il attribue des logements, il n'en vend pas — il n'y a pas de fonction commerciale à équiper",
      public: "personne publique : commande et marchés publics, pas de vente",
      particulier: "personne physique : elle construit pour elle, elle n'a rien à vendre",
    };
    exclusions.push(raison[typeMoa] ?? "ce maître d'ouvrage n'a rien à vendre");
  }
  if (phase === "acheve" || phase === "perime") {
    exclusions.push(FENETRE[phase]);
  }
  if (!demandeur) {
    exclusions.push("aucun demandeur nommé — il n'y a personne à contacter derrière cette ligne");
  }

  let score = 0;

  // ── La phase : c'est elle qui porte l'urgence, donc le plus gros poids. ──
  if (phase === "commercialisation") {
    score += 40;
    pourquoi.push("en pré-commercialisation — la fenêtre où le sujet est le plus vif");
  } else if (phase === "lancement-bloque") {
    /**
     * Le signal le plus fort du fichier, et le plus ambigu : un promoteur qui
     * n'ouvre pas son chantier un an après l'arrêté est très souvent bloqué
     * sur ses réservations — c'est-à-dire exactement notre sujet. Mais il peut
     * aussi avoir abandonné. On le met haut ET on écrit l'ambiguïté, au lieu
     * de choisir en silence.
     */
    score += 35;
    pourquoi.push("permis de plus d'un an sans chantier déclaré — signal fort de commercialisation qui traîne");
    risques.push("peut aussi vouloir dire que l'opération est abandonnée : à vérifier avant d'écrire");
  } else if (phase === "recours") {
    score += 25;
    pourquoi.push("arrêté récent — se faire connaître avant le lancement commercial");
  } else if (phase === "chantier") {
    score += 15;
    pourquoi.push("chantier ouvert — reste la queue de programme");
  } else {
    manque.push("date d'arrêté absente ou illisible : l'opération n'est pas situable dans le temps");
  }

  // ── La taille : elle décide si l'offre VIP est proportionnée. ──
  if (logements === null) {
    manque.push("nombre de logements absent : impossible de dire si l'opération justifie l'offre");
  } else if (logements >= 50) {
    score += 30;
    pourquoi.push(`${logements} logements — opération d'envergure`);
  } else if (logements >= 20) {
    score += 25;
    pourquoi.push(`${logements} logements`);
  } else if (logements >= LOGEMENTS_MIN) {
    score += 15;
    pourquoi.push(`${logements} logements`);
  } else {
    risques.push(
      `${logements} logement(s) : sous ${LOGEMENTS_MIN}, un OS de vente à 10 k€ n'est pas proportionné au budget de commercialisation`
    );
  }

  // ── Le type : un promoteur nommé vaut mieux qu'une société muette. ──
  if (typeMoa === "promoteur" || typeMoa === "constructeur-maisons") {
    score += 20;
    pourquoi.push(typeMoa === "promoteur" ? "promoteur identifié" : "constructeur de maisons identifié");
  } else if (typeMoa === "entreprise") {
    score += 5;
    manque.push(`« ${demandeur} » : société sans marqueur de promotion — vérifier qu'elle construit bien pour vendre`);
  } else if (typeMoa === "inconnu" && demandeur) {
    manque.push(`« ${demandeur} » : demandeur non classé — vérifier à la main`);
  }

  // ── Le lieu : l'ancrage local se dit dans le message, il n'est pas décoratif. ──
  if ((p.commune ?? "").trim()) {
    score += 10;
    pourquoi.push(`localisé — ${p.commune!.trim()}`);
  } else {
    manque.push("commune absente : le message perdra son ancrage local");
  }

  score = Math.max(0, Math.min(100, score));
  risques.push(...exclusions);

  return {
    typeMoa,
    problemeDeVente,
    phase,
    moisDepuisDecision,
    score,
    retenu: exclusions.length === 0 && score >= SCORE_MIN_PERMIS,
    fenetre: FENETRE[phase],
    pourquoi,
    manque,
    risques,
  };
}

export interface LotPermis {
  /**
   * ⚠ Le champ s'appelle `ciblage`, comme dans le sourcing LinkedIn et le
   * sourcing terrain, alors que « lecture » décrirait mieux ce qu'il contient.
   * C'est délibéré : les trois lots alimentent le MÊME panneau de collage, et
   * deux noms pour la même chose obligeraient l'écran à savoir de quel import
   * il vient — c'est-à-dire à porter la connaissance métier que ces modules
   * existent pour lui épargner.
   */
  retenus: { permis: PermisConstruire; ciblage: LecturePermis }[];
  ecartes: { permis: PermisConstruire; ciblage: LecturePermis }[];
  /** Ce qu'il faut lire AVANT d'écrire le premier message. */
  resume: string[];
}

/**
 * Trie un fichier entier et dit ce qu'il vaut.
 *
 * Le résumé n'est pas décoratif : « 400 permis importés » ne veut rien dire,
 * « 400 permis dont 312 de particuliers et 11 exploitables » est une décision.
 */
export function trierPermis(lignes: PermisConstruire[], now = new Date()): LotPermis {
  const lus = lignes.map((permis) => ({ permis, ciblage: lirePermis(permis, now) }));
  const retenus = lus.filter((l) => l.ciblage.retenu).sort((a, b) => b.ciblage.score - a.ciblage.score);
  const ecartes = lus.filter((l) => !l.ciblage.retenu);

  const resume: string[] = [];
  resume.push(`${lignes.length} permis examiné(s) — ${retenus.length} retenu(s), ${ecartes.length} écarté(s).`);

  const sansVente = ecartes.filter((e) => !e.ciblage.problemeDeVente).length;
  if (sansVente) {
    resume.push(
      `${sansVente} écarté(s) parce que le maître d'ouvrage n'a rien à vendre (particuliers, bailleurs sociaux, personnes publiques). C'est le gros du volume d'un export de permis, c'est normal.`
    );
  }

  const bloques = retenus.filter((r) => r.ciblage.phase === "lancement-bloque").length;
  if (bloques) {
    resume.push(
      `${bloques} permis de plus d'un an sans chantier : le signal le plus fort du lot, et le plus ambigu — vérifier que l'opération est vivante avant d'écrire.`
    );
  }

  const aVerifier = retenus.filter((r) => r.ciblage.typeMoa === "entreprise" || r.ciblage.typeMoa === "inconnu").length;
  if (aVerifier) {
    resume.push(`${aVerifier} retenu(s) dont la nature n'est pas certaine — à lever à la main avant le message.`);
  }

  if (lignes.length && retenus.length === 0) {
    resume.push("Aucun permis retenu : l'export ne contient pas d'opération de vente, ou les colonnes utiles manquent.");
  }

  return { retenus, ecartes, resume };
}

// ── L'ENTRÉE PAR TABLEUR ───────────────────────────────────────────────
//
// Même lecteur mutualisé que le sourcing terrain (`lib/tabulaire.ts`) : les
// exports d'open data urbanisme ne nomment pas deux fois les colonnes pareil,
// et un deuxième parseur maison finirait par diverger du premier.

const ALIAS: Record<string, keyof PermisConstruire> = {
  numero: "numero", numdossier: "numero", numeropermis: "numero", dossier: "numero",
  reference: "numero", ref: "numero", idpermis: "numero",
  demandeur: "demandeur", petitionnaire: "demandeur", maitredouvrage: "demandeur",
  moa: "demandeur", beneficiaire: "demandeur", titulaire: "demandeur",
  nomdemandeur: "demandeur", raisonsociale: "demandeur",
  datedecision: "dateDecision", dateautorisation: "dateDecision", datearrete: "dateDecision",
  dateaccord: "dateDecision", datedelivrance: "dateDecision", dateoctroi: "dateDecision",
  dateouverturechantier: "dateOuvertureChantier", datedoc: "dateOuvertureChantier",
  doc: "dateOuvertureChantier", ouverturechantier: "dateOuvertureChantier",
  dateachevement: "dateAchevement", datedaact: "dateAchevement", daact: "dateAchevement",
  achevement: "dateAchevement",
  logements: "logements", nblogements: "logements", nombrelogements: "logements",
  nblogementscrees: "logements", logementscrees: "logements", nblgtcree: "logements",
  surface: "surfacePlancher", surfaceplancher: "surfacePlancher", sdp: "surfacePlancher",
  shon: "surfacePlancher",
  commune: "commune", ville: "commune", localite: "commune", nomcommune: "commune",
  adresse: "adresse", adressecomplete: "adresse", rue: "adresse", localisation: "adresse",
  prorogations: "prorogations", prorogation: "prorogations", nbprorogations: "prorogations",
};

export const COLONNES_PERMIS = champsReconnus(ALIAS);

export interface ParsePermis extends Lecture<PermisConstruire> {
  permis: PermisConstruire[];
}

/**
 * `lireTableau` rend des chaînes ; `PermisConstruire` porte deux nombres.
 * La conversion se fait ICI et une seule fois, sinon chaque lecteur
 * réinterpréterait « 48 logements » à sa façon.
 */
function nombreOuUndefined(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parserPermis(texte: string): ParsePermis {
  const lu = lireTableau<PermisConstruire>(texte, ALIAS);
  const permis = (lu.entrees as PermisConstruire[]).map((p) => ({
    ...p,
    logements: nombreOuUndefined(p.logements),
    surfacePlancher: nombreOuUndefined(p.surfacePlancher),
    prorogations: nombreOuUndefined(p.prorogations),
  }));
  return { ...lu, entrees: permis, permis };
}

/**
 * Un permis retenu devient un prospect.
 *
 * ⚠ `stage` reste « prospect » : un maître d'ouvrage relevé dans un fichier
 * d'open data n'a rien demandé. L'avancer ferait mentir toutes les prévisions.
 *
 * ⚠ Le canal par défaut est LinkedIn, pas le téléphone : un export de permis
 * ne porte AUCUN numéro, et un directeur de programmes ne se joint pas au
 * standard. Mettre « tel » ferait entrer ces fiches dans la file d'appels, où
 * elles resteraient sans numéro jusqu'à ce que quelqu'un s'en aperçoive.
 */
export function permisVersProspect(p: PermisConstruire, l: LecturePermis, now = new Date()): Prospect {
  const iso = now.toISOString();
  const demandeur = (p.demandeur ?? "").trim() || "Maître d'ouvrage sans nom";

  // Identifiant stable sur le NUMÉRO d'arrêté quand il existe : c'est lui qui
  // définit l'unicité d'une opération. À défaut, le demandeur — deux permis du
  // même promoteur se rejoignent alors sur une seule fiche, ce qui est le bon
  // comportement : c'est la même personne qu'on va contacter une seule fois.
  const graine = (p.numero ?? demandeur).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    ...prospectDefaults,
    id: `pc-${graine}`.slice(0, 60),
    company: demandeur,
    name: "",
    sector: "autre" as Sector,
    city: (p.commune ?? "").trim(),
    stage: "prospect",
    preferredChannel: "linkedin",
    notes: notesDepuisPermis(p, l),
    tags: ["permis-construire", "maitrise-ouvrage", l.phase],
    createdAt: iso,
    updatedAt: iso,
  } as Prospect;
}

/**
 * Les notes portent des FAITS datés, pas de la doctrine recopiée.
 *
 * C'est le corollaire de la quatrième règle d'écran : mille fiches qui
 * recopient chacune le paragraphe expliquant ce qu'est la pré-commercialisation
 * pèsent la moitié du quota localStorage pour zéro information. L'explication
 * vit dans ce fichier ; la fiche ne garde que ce qui ne se recalcule pas.
 */
function notesDepuisPermis(p: PermisConstruire, l: LecturePermis): string {
  const lignes: string[] = [];
  if (p.numero) lignes.push(`Permis : ${p.numero.trim()}`);
  if (p.dateDecision) lignes.push(`Arrêté : ${p.dateDecision.trim()}`);
  if (p.logements !== undefined) lignes.push(`Logements : ${p.logements}`);
  if (p.surfacePlancher !== undefined) lignes.push(`Surface de plancher : ${p.surfacePlancher} m²`);
  if (p.adresse) lignes.push(`Adresse : ${p.adresse.trim()}`);
  lignes.push(`Phase : ${l.phase}`);
  return lignes.join("\n");
}

export interface ImportPermis {
  parse: ParsePermis;
  retenus: { permis: PermisConstruire; ciblage: LecturePermis; prospect: Prospect }[];
  ecartes: { permis: PermisConstruire; ciblage: LecturePermis }[];
  resume: string[];
}

/** Le parcours complet : texte → permis → tri → fiches contactables. */
export function importerPermis(texte: string, now = new Date()): ImportPermis {
  const parse = parserPermis(texte);
  const lot = trierPermis(parse.permis, now);

  const retenus = lot.retenus.map(({ permis, ciblage }) => ({
    permis,
    ciblage,
    prospect: permisVersProspect(permis, ciblage, now),
  }));

  const resume = [...lot.resume];
  if (parse.rejets.length) {
    resume.push(`${parse.rejets.length} ligne(s) illisibles — voir le détail avant de conclure que le lot est mauvais.`);
  }

  return { parse, retenus, ecartes: lot.ecartes, resume };
}

/**
 * Ce tableau est-il un export de PERMIS, ou un relevé d'annuaire ordinaire ?
 *
 * Même doctrine que `ressembleAuTerrain` : le format se DÉTECTE, il ne se
 * choisit pas dans un menu — une case à cocher au moment exact où on colle
 * 400 lignes est une case qu'on oublie.
 *
 * Le seuil est DEUX marqueurs, pas un : « commune » et « adresse » se trouvent
 * dans n'importe quel export d'entreprises, et router à tort un relevé terrain
 * vers le tri permis écarterait toutes les fiches — c'est-à-dire l'inverse du
 * service rendu.
 */
export function ressembleAuPermis(texte: string): boolean {
  const entete = (texte ?? "").split(/\r?\n/)[0] ?? "";
  if (!entete.trim() || entete.trimStart().startsWith("{") || entete.trimStart().startsWith("[")) return false;

  const marqueurs = [
    /\b(numeropermis|numdossier|idpermis)\b/i,
    /\b(demandeur|petitionnaire|maitredouvrage|moa)\b/i,
    /\b(datedecision|dateautorisation|datearrete|datedelivrance)\b/i,
    /\b(logements|nblogements|nombrelogements|logementscrees|nblgtcree)\b/i,
    /\b(surfaceplancher|sdp|shon)\b/i,
    /\b(datedoc|daact|dateachevement|ouverturechantier)\b/i,
  ];
  return marqueurs.filter((re) => re.test(entete)).length >= 2;
}
