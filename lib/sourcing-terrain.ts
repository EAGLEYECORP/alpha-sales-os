import { toE164 } from "./voice-script";
import { verticalById, verticalForText, type VerticalPlaybook } from "./playbook";
import { HIGH_DEMAND_PER_WEEK } from "./ladder";
import { metierDepuisNaf, nomenclaturePerimee } from "./registre-entreprises";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCING TERRAIN — trouver les entreprises qui CROULENT sous les demandes.
 *
 * ── CE QUI CHANGE PAR RAPPORT AU CIBLAGE LINKEDIN ──
 *
 * Sur LinkedIn, l'unité est une PERSONNE et la question est « ce profil
 * mérite-t-il une de mes invitations ». Ici l'unité est une ENTREPRISE et la
 * question est tout autre : **est-ce que le téléphone y sonne beaucoup, et
 * est-ce qu'il tombe dans le vide ?**
 *
 * C'est le déclencheur exact de la marche 2 de l'ESCALIER (Callflow). Une
 * entreprise sans demandes n'a pas ce problème, quel que soit son métier.
 *
 * ── LE SIGNAL QUI VAUT TOUS LES AUTRES ──
 *
 * Les avis Google publics. Pas la note — le TEXTE. « Impossible de les
 * joindre », « ne répondent jamais au téléphone », « j'ai appelé trois fois »
 * : c'est le prospect qui décrit lui-même notre douleur, publiquement, avant
 * qu'on l'appelle. Aucun autre signal n'est aussi direct, et il est gratuit.
 *
 * Un volume d'avis élevé dit la DEMANDE ; une plainte d'injoignabilité dit que
 * cette demande se perd. Les deux ensemble font un prospect prioritaire.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ──
 *
 * Il ne collecte rien. Pas de requête, pas de navigateur, pas de scraping
 * d'annuaire. Il reçoit ce que l'opérateur a relevé et il TRIE. Même doctrine
 * que le sourcing LinkedIn, et pour la même raison : la collecte reste dehors,
 * remplaçable, hors du produit vendu.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'une fiche d'annuaire ou une carte donne réellement. Tout optionnel. */
export interface FicheTerrain {
  entreprise?: string;
  secteur?: string;
  ville?: string;
  adresse?: string;
  telephone?: string;
  siteWeb?: string;
  /** Nombre d'avis Google — le meilleur indicateur public de VOLUME de demande. */
  avis?: string;
  /** Note Google sur 5. */
  note?: string;
  /** Horaires affichés, en texte libre. */
  horaires?: string;
  /**
   * Extraits d'avis relevés à la main. C'est le champ le plus précieux du lot :
   * une phrase de client mécontent vaut mieux que dix estimations.
   */
  extraitsAvis?: string;
  /** Effectif affiché, si la source en donne un. */
  taille?: string;
  /**
   * Code APE issu du registre des entreprises, quand la fiche a été croisée.
   * Il ne se DEVINE pas : il est attribué. C'est pour ça qu'il prime sur la
   * détection par mots-clés de l'enseigne.
   */
  naf?: string;
  /** SIREN, quand l'appariement au registre est sûr. */
  siren?: string;
}

export type ForceSignal = "fort" | "moyen" | "faible";

export interface SignalDemande {
  id: string;
  label: string;
  force: ForceSignal;
  /** Le fait constaté, vérifiable sur la fiche. */
  fait: string;
}

export interface CiblageTerrain {
  retenu: boolean;
  /** 0–100. Ordonne la file d'appels ; ne décide jamais seul. */
  score: number;
  /** Numéro normalisé E.164, ou null s'il est inexploitable. */
  telephone: string | null;
  verticaleId: string | null;
  verticaleLabel: string | null;
  /** Les signaux de demande trouvés, du plus fort au plus faible. */
  signaux: SignalDemande[];
  /** Ce qui manque pour trancher — une lacune n'est pas un refus. */
  manque: string[];
  /** Les exclusions sèches. Le score ne les rattrape pas. */
  exclusions: string[];
  /** Le miroir du playbook : ce qu'on montre au prospect, pas ce qu'on vend. */
  miroir: string | null;
}

/**
 * Les plaintes d'injoignabilité, telles qu'elles s'écrivent vraiment dans un
 * avis Google français.
 *
 * ⚠ La liste est volontairement LARGE côté formulations et ÉTROITE côté sens :
 * on cherche « je n'ai pas pu les joindre », pas « mauvais accueil ». Un
 * élargissement au mécontentement général ferait remonter des prospects dont
 * le problème n'est pas le nôtre — et le premier appel se casserait sur un
 * argument hors sujet.
 */
const PLAINTE_INJOIGNABLE = [
  /impossible (de |à )?(les |le |la )?joindre/i,
  /jamais (personne |)(ne |)r[ée]pond/i,
  /ne r[ée]pond(ent|) (jamais|pas) (au |)t[ée]l[ée]phone/i,
  /r[ée]pondeur/i,
  /j'?ai appel[ée] (plusieurs fois|\d+ fois|trois fois|deux fois|10 fois)/i,
  /aucun retour (d'|)appel/i,
  /personne (au bout du fil|ne d[ée]croche)/i,
  /injoignable/i,
  /pas moyen de les avoir/i,
  /(rappel|rappell)[ée]e? jamais/i,
  /message (laiss[ée]|sur r[ée]pondeur).{0,30}(jamais|aucun|sans) (r[ée]ponse|retour)/i,
];

/** Ce qui dit qu'il y a DÉJÀ un standard : notre offre n'a plus d'objet. */
const DEJA_EQUIPE = [
  /centre d'?appels? interne/i,
  /standard t[ée]l[ée]phonique/i,
  /secr[ée]tariat externalis[ée]/i,
  /perm[ae]nence t[ée]l[ée]phonique/i,
  /call ?center/i,
];

/**
 * Les enseignes nationales et franchises à standard central.
 *
 * On ne vend pas un accueil téléphonique à une succursale : la décision ne s'y
 * prend pas, et le téléphone y est déjà mutualisé. C'est une exclusion sèche,
 * pas un malus — la fiche a beau cocher tous les autres signaux, l'appel est
 * perdu d'avance.
 */
const ENSEIGNE_NATIONALE =
  /\b(norauto|feu vert|midas|speedy|ad auto|point s|carglass|mondial pare-?brise|leroy merlin|castorama|bricomarch|weldom|orpi|century ?21|laforet|foncia|nexity|guy hoquet|iad france|stephane plaza|ecf|cer\b|dekra|carrefour|leclerc|intermarch|super ?u|lidl|mcdonald|burger king|subway|domino'?s|pizza hut|la mie c[âa]line|paul\b|brioche dor[ée]e)/i;

/** Un entier lu dans du texte libre (« 128 avis », « 4,6/5 »). */
function nombre(v?: string): number | null {
  if (!v) return null;
  const m = v.replace(/ |\s/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Le volume d'avis à partir duquel on parle de « beaucoup de demandes ».
 *
 * ⚠ C'est un PROXY, pas une mesure. Les avis mesurent les clients qui ont pris
 * la peine d'écrire, pas les appels reçus. Le rapport entre les deux dépend du
 * métier — un garage et un restaurant n'ont pas le même taux d'avis pour le
 * même volume d'affaires. À corriger dès qu'on aura une campagne mesurée.
 */
export const AVIS_DEMANDE_ELEVEE = 80;
export const AVIS_DEMANDE_MOYENNE = 30;

/** En dessous, l'entreprise est trop petite ou trop récente pour avoir la douleur. */
export const AVIS_MINIMUM = 8;

/** Le seuil de rétention. Sous ce score, l'appel coûte plus qu'il ne rapporte. */
export const SCORE_MIN_TERRAIN = 45;

/** Une fermeture le midi ou le week-end = des appels qui tombent dans le vide. */
function trouDansLesHoraires(horaires?: string): string | null {
  const h = (horaires ?? "").toLowerCase();
  if (!h.trim()) return null;
  if (/ferm[ée].{0,20}(samedi|dimanche|week-?end)/.test(h)) return "fermé le week-end";
  /**
   * La coupure du midi se lit à la REPRISE, pas à un tiret.
   *
   * La première version exigeait un séparateur (« 12h00 – 14h00 »). Or Google
   * affiche « 09:00–12:00, 14:00–18:00 » : la fermeture et la réouverture sont
   * deux plages distinctes, séparées par une virgule ou une espace. Le motif
   * cherche donc une fin à 12 h suivie de près par une reprise à 14 h.
   */
  if (/1[23][h:]\d{2}[^\d]{1,12}1[45][h:]\d{2}/.test(h) || /ferm[ée].{0,15}midi/.test(h)) {
    return "fermé sur la pause déjeuner";
  }
  if (/sur rendez-?vous (uniquement|seulement)/.test(h)) return "reçoit uniquement sur rendez-vous";
  return null;
}

/**
 * Qualifie UNE entreprise pour l'appel.
 *
 * Déterministe, sans clé, sans réseau : ça tourne sur un lot de 1 000 en une
 * fraction de seconde, et ça rend le même verdict deux jours de suite. Un tri
 * qui change d'avis n'est pas un tri.
 */
export function qualifierTerrain(f: FicheTerrain): CiblageTerrain {
  const signaux: SignalDemande[] = [];
  const manque: string[] = [];
  const exclusions: string[] = [];

  const texte = [f.entreprise, f.secteur, f.adresse].filter(Boolean).join(" ");
  const avis = f.extraitsAvis ?? "";

  /**
   * ⚠ LE CODE APE PRIME SUR L'ENSEIGNE.
   *
   * `verticalForText` devine à partir des mots : « Carrosserie des Lilas » →
   * garage. Ça marche souvent, et ça se trompe en silence sur « Les Ateliers
   * du Rhône » ou « Maison Bernard ». Le code APE, lui, est ATTRIBUÉ — il ne
   * se devine pas, il se lit.
   *
   * Quand la fiche a été croisée avec le registre, on remplace donc une
   * supposition par un fait. Sans croisement, on retombe sur les mots-clés :
   * c'est moins bon, et c'est mieux que rien.
   */
  const officiel = metierDepuisNaf(f.naf);
  const verticale: VerticalPlaybook | null = officiel.verticale
    ? (verticalForText(officiel.verticale) ?? verticalById(officiel.verticale) ?? verticalForText(texte))
    : verticalForText(texte);

  // ── LES EXCLUSIONS SÈCHES ──
  const telephone = f.telephone ? toE164(f.telephone) : null;
  if (!f.telephone?.trim()) {
    exclusions.push("aucun téléphone — c'est une liste d'APPELS, la fiche n'y a pas sa place");
  } else if (!telephone) {
    exclusions.push(`numéro inexploitable (« ${f.telephone.trim()} ») — ni composable, ni corrigeable à l'aveugle`);
  }
  if (ENSEIGNE_NATIONALE.test(texte)) {
    exclusions.push("enseigne nationale ou franchise — le téléphone est mutualisé et la décision ne se prend pas ici");
  }
  const equipe = DEJA_EQUIPE.find((re) => re.test(avis) || re.test(texte));
  if (equipe) {
    exclusions.push("dispose déjà d'un standard ou d'un secrétariat externalisé — notre offre n'a plus d'objet");
  }

  let score = 0;

  // ── LE SIGNAL ROI : le client dit lui-même qu'on ne les joint pas ──
  const plainte = PLAINTE_INJOIGNABLE.some((re) => re.test(avis));
  if (plainte) {
    score += 45;
    signaux.push({
      id: "plainte-injoignable",
      label: "Un client se plaint publiquement de ne pas les joindre",
      force: "fort",
      fait: "Un avis décrit exactement la douleur qu'on vend. C'est LEUR phrase, pas notre estimation — utilisable en question, jamais en reproche.",
    });
  } else if (!avis.trim()) {
    manque.push("aucun extrait d'avis relevé — c'est le signal le plus fort et il est gratuit à collecter");
  }

  // ── LE VOLUME DE DEMANDE ──
  const nAvis = nombre(f.avis);
  if (nAvis === null) {
    manque.push("nombre d'avis inconnu — sans lui, « beaucoup de demandes » est une supposition");
  } else if (nAvis >= AVIS_DEMANDE_ELEVEE) {
    score += 30;
    signaux.push({
      id: "volume-eleve",
      label: "Volume de demandes élevé",
      force: "fort",
      fait: `${nAvis} avis Google — un flux client soutenu, donc un téléphone qui sonne souvent.`,
    });
  } else if (nAvis >= AVIS_DEMANDE_MOYENNE) {
    score += 18;
    signaux.push({
      id: "volume-moyen",
      label: "Volume de demandes correct",
      force: "moyen",
      fait: `${nAvis} avis Google.`,
    });
  } else if (nAvis < AVIS_MINIMUM) {
    // Pas une exclusion : une entreprise récente peut crouler sous les appels
    // sans avoir d'avis. Mais on n'en a AUCUNE preuve, donc elle passe après.
    score -= 15;
    manque.push(`${nAvis} avis seulement — trop petite ou trop récente pour qu'on voie la demande`);
  }

  // ── LA NOTE : elle sert à CADRER l'angle, pas à disqualifier ──
  const note = nombre(f.note);
  if (note !== null && note >= 4.3 && (nAvis ?? 0) >= AVIS_DEMANDE_MOYENNE) {
    score += 10;
    signaux.push({
      id: "bonne-note",
      label: "Excellente réputation",
      force: "moyen",
      // Le cadrage « on protège, on ne répare pas » du playbook terrain :
      // il fonctionne surtout chez les excellents, pas malgré eux.
      fait: `${note}/5 sur ${nAvis} avis — cette note ne parle que des clients qui les ont EUS au téléphone.`,
    });
  }

  // ── LE TROU HORAIRE : des appels qui tombent dans le vide, par construction ──
  const trou = trouDansLesHoraires(f.horaires);
  if (trou) {
    score += 12;
    signaux.push({
      id: "trou-horaire",
      label: "Créneau où personne ne peut décrocher",
      force: "moyen",
      fait: `${trou} — les appels de ces heures-là ne sont pas manqués par hasard, ils sont perdus par construction.`,
    });
  } else if (!f.horaires?.trim()) {
    manque.push("horaires inconnus");
  }

  // ── LA VERTICALE : sait-on lui parler ? ──
  if (verticale) {
    // Un métier CONFIRMÉ par le registre pèse plus qu'un métier deviné : le
    // script sera juste, et l'ouverture ne se cassera pas sur un contresens.
    score += officiel.verticale ? 28 : 20;
    signaux.push({
      id: "verticale",
      label: officiel.verticale
        ? `Verticale ${verticale.label} — confirmée au registre (${officiel.naf})`
        : `Verticale ${verticale.label}`,
      force: officiel.verticale ? "fort" : "moyen",
      fait: officiel.libelle
        ? `Code APE ${officiel.naf} — ${officiel.libelle}. Métier attribué, pas déduit de l'enseigne.`
        : verticale.criterion,
    });
  } else if (f.naf && !officiel.verticale) {
    // Un code lu mais hors de notre table : ce n'est pas un échec de lecture,
    // c'est un métier qu'on ne sait pas servir. Le dire évite de le recroiser.
    manque.push(
      `code APE ${officiel.naf} hors de nos verticales — métier réel, mais sans playbook chez nous`
    );
  } else {
    manque.push("métier non reconnu — le script sera générique, donc plus faible");
  }

  // ── L'ABSENCE DE SITE : la marche 1 de l'escalier, en prime ──
  if (f.siteWeb !== undefined && !f.siteWeb.trim()) {
    score += 8;
    signaux.push({
      id: "sans-site",
      label: "Aucun site web",
      force: "faible",
      fait: "Ouvre aussi la marche « visibilité » de l'escalier — mais elle ne se sert JAMAIS au premier appel.",
    });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    retenu: exclusions.length === 0 && score >= SCORE_MIN_TERRAIN,
    score,
    telephone,
    verticaleId: verticale?.id ?? null,
    verticaleLabel: verticale?.label ?? null,
    signaux: signaux.sort((a, b) => poids(b.force) - poids(a.force)),
    manque,
    exclusions,
    miroir: verticale?.mirror ?? null,
  };
}

const poids = (f: ForceSignal) => (f === "fort" ? 3 : f === "moyen" ? 2 : 1);

export interface LotTerrain {
  retenus: { fiche: FicheTerrain; ciblage: CiblageTerrain }[];
  ecartes: { fiche: FicheTerrain; ciblage: CiblageTerrain }[];
  /** Ce qu'il faut lire AVANT de lancer les appels. */
  resume: string[];
}

/**
 * Trie un lot et dit ce qu'il vaut.
 *
 * Importer 1 000 lignes ne veut rien dire. Savoir que 340 sont appelables, dont
 * 60 avec une plainte d'injoignabilité publique, si : ces 60-là se traitent en
 * premier, parce que l'ouverture est déjà écrite par leur propre client.
 */
export function trierTerrain(fiches: FicheTerrain[]): LotTerrain {
  const juges = fiches.map((fiche) => ({ fiche, ciblage: qualifierTerrain(fiche) }));
  const retenus = juges.filter((j) => j.ciblage.retenu).sort((a, b) => b.ciblage.score - a.ciblage.score);
  const ecartes = juges.filter((j) => !j.ciblage.retenu);

  const resume: string[] = [];
  resume.push(`${fiches.length} fiche(s) examinée(s) — ${retenus.length} appelable(s), ${ecartes.length} écartée(s).`);

  const plaintes = retenus.filter((r) => r.ciblage.signaux.some((s) => s.id === "plainte-injoignable")).length;
  if (plaintes) {
    resume.push(
      `${plaintes} avec une plainte publique d'injoignabilité — À APPELER EN PREMIER : leur propre client a déjà écrit ton ouverture.`
    );
  }

  /**
   * ⚠ On compte sur `telephone === null`, PAS sur le texte des exclusions.
   *
   * La première version cherchait « téléphone » ou « numéro » dans les motifs
   * de refus — et attrapait au passage l'exclusion « enseigne nationale : le
   * téléphone est mutualisé ». Elle annonçait deux numéros manquants là où il
   * n'y en avait qu'un. Compter des faits en lisant de la prose finit toujours
   * comme ça.
   */
  const sansTel = juges.filter((j) => j.ciblage.telephone === null).length;
  if (sansTel) resume.push(`${sansTel} sans numéro exploitable — à recollecter, pas à jeter.`);

  const sansAvis = juges.filter((j) => j.ciblage.manque.some((m) => /extrait d'avis/.test(m))).length;
  if (sansAvis > fiches.length / 2 && fiches.length > 0) {
    resume.push(
      `${sansAvis} fiches sans extrait d'avis. C'est le signal le PLUS fort et il est gratuit : relever une phrase par fiche change le tri.`
    );
  }

  /**
   * ⚠ L'alerte qui évite une panne SILENCIEUSE en janvier 2027.
   *
   * La table NAF est en rév. 2. Le jour de la bascule vers la NAF 2025, les
   * codes changent et la table se mettrait à rendre « métier inconnu » sur une
   * partie du fichier — sans que rien ne le signale, parce qu'un métier non
   * reconnu est un cas NORMAL du tri.
   */
  if (nomenclaturePerimee() && fiches.some((f) => f.naf)) {
    resume.push(
      "⚠ La nomenclature NAF 2025 est en vigueur mais la table de correspondance est restée en rév. 2 : les métiers confirmés au registre sont à revérifier."
    );
  }

  const doublons = compterDoublons(retenus.map((r) => r.ciblage.telephone));
  if (doublons) resume.push(`${doublons} numéro(s) en double — la fusion évitera d'appeler deux fois la même entreprise.`);

  return { retenus, ecartes, resume };
}

function compterDoublons(tels: (string | null)[]): number {
  const vus = new Set<string>();
  let n = 0;
  for (const t of tels) {
    if (!t) continue;
    if (vus.has(t)) n++;
    else vus.add(t);
  }
  return n;
}

export interface PlanAppels {
  /** Fiches réellement appelables. */
  cibles: number;
  /** Tentatives composées au total, en tenant compte des décrochés. */
  tentatives: number;
  /** Prospects joints, à ce taux de décroché. */
  joints: number;
  /** Jamais joints après toutes les tentatives. */
  jamaisJoints: number;
  /** Détail par tour d'appel. */
  tours: { tour: number; composes: number; joints: number }[];
  alertes: string[];
}

/**
 * Le plan d'appels d'un lot — combien de tentatives, pour combien de contacts.
 *
 * ⚠ `tauxDecrocheParTentative` est une HYPOTHÈSE, jamais une mesure : aucune
 * campagne n'a encore tourné ici. Le paramètre est explicite pour que personne
 * ne prenne le résultat pour une prévision.
 */
export function planifierAppels(
  cibles: number,
  tentativesMax = 4,
  tauxDecrocheParTentative = 0.2
): PlanAppels {
  const n = Math.max(0, Math.floor(cibles));
  const taux = Math.max(0, Math.min(1, tauxDecrocheParTentative));
  const tours: PlanAppels["tours"] = [];
  const alertes: string[] = [];

  let restants = n;
  let tentatives = 0;
  let joints = 0;

  for (let t = 1; t <= Math.max(1, tentativesMax); t++) {
    if (restants <= 0) break;
    const composes = restants;
    const d = Math.round(composes * taux);
    tours.push({ tour: t, composes, joints: d });
    tentatives += composes;
    joints += d;
    restants = composes - d;
  }

  /**
   * ⚠ LE POINT JURIDIQUE, ET IL N'EST PAS COSMÉTIQUE.
   *
   * Le décret n° 2022-1313 plafonne le démarchage téléphonique à QUATRE
   * sollicitations par consommateur sur 30 jours glissants. Il vise le B2C —
   * mais un artisan en nom propre sur sa ligne personnelle est exactement la
   * zone grise où ce plafond s'applique.
   *
   * Or la cadence Callflow exigée par ScintIA est de CINQ rappels sur 2 jours
   * (`CALLFLOW_RECALL_OFFSETS_H`), soit six contacts. Sur une cible qui bascule
   * en B2C, c'est hors des clous — et c'est nous qui portons le risque.
   */
  if (tentativesMax > 4) {
    alertes.push(
      `${tentativesMax} tentatives : au-delà de 4 sollicitations sur 30 jours, le démarchage est hors des clous dès qu'un contact est un particulier ou un artisan en nom propre. Le décret vise le B2C, mais c'est toi qui portes le risque sur une liste mêlée.`
    );
  }
  if (n > 0 && joints === 0) {
    alertes.push("Aucun contact attendu à ce taux — vérifie l'hypothèse avant de composer 1 000 numéros.");
  }

  return { cibles: n, tentatives, joints, jamaisJoints: restants, tours, alertes };
}

/**
 * Où trouver 1 000 numéros, par ordre de rendement réel.
 *
 * Aucune de ces sources n'est branchée automatiquement : elles se relèvent à
 * la main ou s'exportent. C'est plus lent qu'un scraper et ça reste le bon
 * choix — une liste relevée à la main porte les extraits d'avis, et c'est eux
 * qui font la différence au téléphone.
 */
export interface SourceTerrain {
  nom: string;
  quoi: string;
  /** Ce qu'on en tire, honnêtement. */
  rendement: string;
  /** Les extraits d'avis y sont-ils disponibles ? C'est le critère qui compte. */
  avisDisponibles: boolean;
}

export const SOURCES_TERRAIN: SourceTerrain[] = [
  {
    nom: "Google Maps / Fiches d'établissement",
    quoi: "Recherche par métier + ville. Nom, téléphone, site, horaires, note et avis.",
    rendement: "La meilleure source : c'est la SEULE qui donne les extraits d'avis, donc le signal fort.",
    avisDisponibles: true,
  },
  {
    nom: "Pages Jaunes",
    quoi: "Annuaire professionnel par activité et zone.",
    rendement: "Bon volume de numéros, avis rares. À croiser avec Maps pour le signal.",
    avisDisponibles: false,
  },
  {
    nom: "Annuaire des CCI / chambres de métiers",
    quoi: "Entreprises inscrites par secteur et département.",
    rendement: "Fiable sur l'existence et le métier, pauvre sur la demande.",
    avisDisponibles: false,
  },
  {
    nom: "Fédérations et syndicats de métier",
    quoi: "Listes d'adhérents (CAPEB, FFB, UMIH, CNPA…).",
    rendement: "Volume moyen, mais des entreprises structurées et joignables.",
    avisDisponibles: false,
  },
  {
    nom: "Base SIRENE (INSEE, ouverte)",
    quoi: "Toutes les entreprises françaises par code NAF et commune.",
    rendement: "Exhaustive et gratuite, mais SANS téléphone : sert à cadrer le volume du marché, pas à appeler.",
    avisDisponibles: false,
  },
];

/** Le gabarit à copier dans un tableur — la première ligne, rien de plus. */
export const ENTETE_TERRAIN =
  "entreprise;secteur;ville;telephone;siteWeb;avis;note;horaires;extraitsAvis;naf;siren";

/** Rappel du seuil de l'escalier, pour l'écran : au-delà, Callflow se déclenche. */
export const SEUIL_DEMANDE_ESCALIER = HIGH_DEMAND_PER_WEEK;
