import { attemptsFromEvents } from "./master-rappel";
import { verticalById } from "./playbook";
import { AVIS_DEMANDE_ELEVEE, NOTE_EXCELLENTE } from "./sourcing-terrain";
import type { Prospect } from "./types";
import { aDecroche } from "./call-cadence";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CALIBRATION — l'arc de retour qui referme la boucle.
 *
 * Jusqu'ici le flux terrain allait dans UN SEUL SENS :
 *
 *   sourcing → qualification (poids devinés) → file d'appels → appel
 *   → résultat consigné → … et plus rien.
 *
 * Le résultat d'appel était écrit, lu par la cadence, puis oublié. AUCUN
 * module ne relisait les résultats pour corriger le tri. Le score de
 * `qualifierTerrain` reposait donc sur des poids posés à la main (plainte 45,
 * volume 30, note 10…) que rien ne pouvait jamais démentir, et le plan
 * d'appels sur un décroché à 20 % « jamais mesuré ici ».
 *
 * Ce module fait le chemin inverse : il relit la timeline et rend des
 * MESURES. Il ne réécrit rien tout seul.
 *
 * ⚠ TROIS RÈGLES DURES, sinon ce fichier fabrique de la fausse science.
 *
 *  1. ZÉRO APPEL → ZÉRO CHIFFRE. Pas de 0 %, pas de « n/a » qui se lit comme
 *     un taux : `source: "aucune"` et `valeur: null`. Même discipline que
 *     `entonnoir` (lib/linkedin-plan.ts).
 *  2. JAMAIS UN TAUX NU. Chaque taux sort avec son dénominateur et son
 *     intervalle de Wilson à 95 %. « 20 % » sur 10 appels, c'est en réalité
 *     « entre 6 % et 51 % » — soit rien du tout.
 *  3. ON NE RETOUCHE PAS LES POIDS TOUT SEULS. Sur 40 appels, un
 *     auto-ajustement apprendrait le bruit et le graverait dans le tri. Le
 *     module rend un ÉCART MESURÉ et un verdict ; changer la constante reste
 *     un geste humain, et il se voit dans un diff.
 * ─────────────────────────────────────────────────────────────────────
 */

/** D'où sort un taux : d'une mesure, ou de nulle part. Il n'y a pas de milieu. */
export type SourceTaux = "mesure" | "aucune";

export interface Taux {
  source: SourceTaux;
  /** null quand rien n'a été mesuré. JAMAIS 0 par défaut — 0 est un résultat. */
  valeur: number | null;
  succes: number;
  n: number;
  /** Bornes de Wilson à 95 %. null si aucune mesure. */
  bas: number | null;
  haut: number | null;
  /** n sous le seuil : le taux existe mais ne doit piloter aucune décision. */
  fragile: boolean;
  /** Ce qui s'affiche. Jamais un pourcentage seul. */
  phrase: string;
}

/**
 * En dessous, un taux se regarde, il ne se suit pas.
 *
 * 30 n'a rien de magique : c'est le point où l'intervalle de Wilson autour de
 * 20 % descend sous ±15 points. Au-dessus, on commence à distinguer un taux
 * d'un autre ; en dessous, non.
 */
export const ECHANTILLON_MIN = 30;

/** Sous ce nombre d'appelés dans un bras, on ne compare même pas. */
export const ECHANTILLON_MIN_BRAS = 12;

/** 1,96 — l'écart-type normal à 95 %. */
const Z = 1.96;

/**
 * Un pourcentage à une décimale, écrit EN FRANÇAIS.
 *
 * ⚠ `${Math.round(x * 1000) / 10} %` rendait « 66.7 % » — séparateur anglais,
 * dans une application dont l'interface est intégralement en français, sur des
 * chiffres montrés à l'opérateur et repris dans les captures produit. Constaté
 * à l'écran (salle de contrôle, panneau des paliers).
 *
 * Exporté, et c'est le point important : ce formatage existait en double, ici
 * et dans `lib/paliers-campagne.ts`. Deux écritures du même nombre finissent
 * toujours par diverger d'une décimale ou d'une espace, et l'écran donne alors
 * deux valeurs pour la même mesure.
 */
export const pct = (x: number) =>
  `${(Math.round(x * 1000) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

/** Le taux « rien mesuré ». Le seul objet qu'on a le droit de rendre à vide. */
function aucunTaux(quoi: string): Taux {
  return {
    source: "aucune",
    valeur: null,
    succes: 0,
    n: 0,
    bas: null,
    haut: null,
    fragile: true,
    phrase: `${quoi} : aucune mesure — rien n'a encore été appelé.`,
  };
}

/**
 * Intervalle de Wilson — et pas l'intervalle « normal » qu'on voit partout.
 *
 * L'approximation normale (p ± 1,96·√(p(1-p)/n)) rend des bornes négatives
 * sur les petits échantillons et une largeur NULLE quand p vaut 0 ou 1 : sur
 * 8 appels sans décroché elle affirmerait « 0 % ± 0 », ce qui est faux et
 * dangereux. Wilson reste borné dans [0,1] et garde une largeur honnête aux
 * extrêmes — c'est exactement le régime dans lequel on va vivre les premières
 * semaines.
 */
export function tauxMesure(succes: number, n: number, quoi: string): Taux {
  if (n <= 0) return aucunTaux(quoi);
  const s = Math.max(0, Math.min(n, succes));
  const p = s / n;
  const d = 1 + (Z * Z) / n;
  const centre = (p + (Z * Z) / (2 * n)) / d;
  const marge = (Z / d) * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n));
  const bas = Math.max(0, centre - marge);
  const haut = Math.min(1, centre + marge);
  const fragile = n < ECHANTILLON_MIN;

  return {
    source: "mesure",
    valeur: p,
    succes: s,
    n,
    bas,
    haut,
    fragile,
    phrase: `${quoi} : ${pct(p)} (${s}/${n}, fourchette réelle ${pct(bas)}–${pct(haut)})${
      fragile ? ` — trop peu d'appels pour décider quoi que ce soit (il en faut ${ECHANTILLON_MIN}).` : "."
    }`,
  };
}

/**
 * Un RDV obtenu ne se déduit pas du stage — il se lit dans la timeline.
 *
 * Le stage bouge pour dix raisons (import, correction à la main, autre canal).
 * Seul l'événement écrit par `RESULTATS_MANUELS.rdv` prouve qu'un RDV est sorti
 * de CET appel. Le motif est testé contre la table des résultats manuels :
 * changer la phrase là-bas sans changer le motif ici casse le test.
 *
 * ⚠ Un appel automatique ne pose jamais de RDV : quand l'agent obtient une
 * réponse, la doctrine lui fait passer la main. Ce taux mesure donc le closer
 * humain, pas Alpha Voice.
 */
export const MARQUE_RDV = /rdv (?:obtenu|pos[ée])/i;

export interface CritereTri {
  id: string;
  label: string;
  /** Le poids appliqué aujourd'hui dans `qualifierTerrain`. */
  poidsActuel: number;
  /** L'hypothèse que ce poids incarne — c'est ELLE qu'on met à l'épreuve. */
  hypothese: string;
  present: (p: Prospect) => boolean;
}

/**
 * Les critères testables — c'est-à-dire ceux qui SURVIVENT à l'import.
 *
 * `qualifierTerrain` en connaît davantage, mais un critère qui n'est pas
 * réécrit dans la fiche (tags, deepAudit) est irrécupérable une fois le lot
 * importé : on ne peut pas le confronter au résultat. Cette liste est donc la
 * mesure de ce qu'on garde, pas de ce qu'on calcule.
 */
export const CRITERES_TRI: CritereTri[] = [
  {
    id: "plainte-injoignable",
    label: "Plainte publique « impossible de les joindre »",
    poidsActuel: 45,
    hypothese: "Un client qui écrit la douleur en avis rend la vente plus facile.",
    present: (p) => (p.tags ?? []).includes("injoignable"),
  },
  {
    id: "volume-eleve",
    label: `Volume élevé (≥ ${AVIS_DEMANDE_ELEVEE} avis)`,
    poidsActuel: 30,
    hypothese: "Beaucoup d'avis = beaucoup d'appels reçus = de la demande qui se perd.",
    present: (p) => (p.deepAudit?.googleReviews ?? 0) >= AVIS_DEMANDE_ELEVEE,
  },
  {
    id: "verticale",
    label: "Métier couvert par un playbook",
    poidsActuel: 20,
    hypothese: "Un script écrit pour le métier ouvre mieux qu'un script générique.",
    present: (p) => (p.tags ?? []).some((t) => Boolean(verticalById(t))),
  },
  {
    id: "trou-horaire",
    label: "Créneau où personne ne peut décrocher",
    poidsActuel: 12,
    hypothese: "Une fermeture le midi ou le week-end perd des appels par construction.",
    present: (p) => Boolean((p.deepAudit?.currentProcess ?? "").trim()),
  },
  {
    id: "bonne-note",
    label: `Excellente réputation (≥ ${NOTE_EXCELLENTE}/5)`,
    poidsActuel: 10,
    hypothese: "Le cadrage « on protège ce que vous avez construit » porte chez les excellents.",
    present: (p) => (p.deepAudit?.googleRating ?? 0) >= NOTE_EXCELLENTE,
  },
  {
    id: "sans-site",
    label: "Aucun site web",
    poidsActuel: 8,
    hypothese: "L'absence de site ouvre la marche « visibilité » de l'escalier.",
    present: (p) => /^aucun$/i.test((p.deepAudit?.websiteState ?? "").trim()),
  },
];

/** L'axe sur lequel on juge un critère. Ils ne mesurent PAS la même chose. */
export type AxeSucces = "decroche" | "rdv";

export type Verdict = "confirme" | "infirme" | "indecis" | "insuffisant";

export interface EcartCritere {
  critere: CritereTri;
  axe: AxeSucces;
  avec: Taux;
  sans: Taux;
  /** Rapport des deux taux. null si l'un des deux est absent ou nul. */
  lift: number | null;
  verdict: Verdict;
  phrase: string;
}

/**
 * Deux bras, un verdict — et un verdict PRUDENT.
 *
 * On ne conclut que si les deux intervalles de Wilson sont DISJOINTS. C'est
 * plus sévère qu'un test de comparaison de proportions : des intervalles qui
 * se chevauchent un peu peuvent quand même différer significativement, donc on
 * ratera de vrais écarts. C'est le sens de l'erreur qu'on choisit : ici, dire
 * « confirmé » à tort coûte plus cher que dire « indécis » trop souvent, parce
 * qu'un faux confirmé va durcir un poids et orienter des milliers d'appels.
 */
function comparer(critere: CritereTri, axe: AxeSucces, avec: Taux, sans: Taux): EcartCritere {
  const nom = axe === "rdv" ? "RDV" : "décroché";
  let verdict: Verdict = "indecis";
  let phrase: string;

  if (avec.n < ECHANTILLON_MIN_BRAS || sans.n < ECHANTILLON_MIN_BRAS) {
    verdict = "insuffisant";
    phrase = `${critere.label} — pas assez d'appels pour juger (${avec.n} avec / ${sans.n} sans, il en faut ${ECHANTILLON_MIN_BRAS} de chaque). Le poids de ${critere.poidsActuel} reste une hypothèse.`;
  } else if (avec.bas !== null && sans.haut !== null && avec.bas > sans.haut) {
    verdict = "confirme";
    phrase = `${critere.label} — CONFIRMÉ sur le ${nom} : ${pct(avec.valeur ?? 0)} avec contre ${pct(sans.valeur ?? 0)} sans, fourchettes disjointes. Le poids de ${critere.poidsActuel} est mérité, voire sous-évalué.`;
  } else if (sans.bas !== null && avec.haut !== null && sans.bas > avec.haut) {
    verdict = "infirme";
    phrase = `${critere.label} — INFIRMÉ sur le ${nom} : ${pct(avec.valeur ?? 0)} avec contre ${pct(sans.valeur ?? 0)} sans. Le signal joue à l'ENVERS. Le poids de ${critere.poidsActuel} coûte des appels ; à revoir dans lib/sourcing-terrain.ts.`;
  } else {
    phrase = `${critere.label} — aucun écart démontrable sur le ${nom} (${pct(avec.valeur ?? 0)} vs ${pct(sans.valeur ?? 0)}, fourchettes qui se recouvrent). Ni preuve ni réfutation : ${critere.hypothese.toLowerCase().replace(/\.$/, "")} reste à démontrer.`;
  }

  const lift = avec.valeur !== null && sans.valeur ? avec.valeur / sans.valeur : null;
  return { critere, axe, avec, sans, lift, verdict, phrase };
}

/** L'état d'un prospect une fois ses appels relus. */
interface Vecu {
  composes: number;
  joint: boolean;
  rdv: boolean;
  opposition: boolean;
}

function relire(p: Prospect): Vecu {
  const attempts = attemptsFromEvents(p);
  const rdv = (p.events ?? []).some((e) => e.kind === "appel" && MARQUE_RDV.test(e.summary ?? ""));
  return {
    composes: attempts.length,
    // `aDecroche` : « interesse » est aussi un décroché (lib/call-cadence).
    joint: attempts.some((a) => aDecroche(a.outcome)),
    rdv,
    opposition: attempts.some((a) => a.outcome === "opposition"),
  };
}

export interface TourMesure {
  tour: number;
  composes: number;
  joints: number;
  taux: Taux;
}

export interface Calibration {
  /** Prospects ayant reçu au moins un appel. */
  appeles: number;
  /** Tentatives composées, toutes fiches confondues. */
  composes: number;
  /** Prospects ayant décroché au moins une fois. */
  joints: number;
  rdv: number;
  oppositions: number;
  /** Le taux qui remplace l'hypothèse de `planifierAppels`. */
  decrocheParTentative: Taux;
  decrocheParProspect: Taux;
  /** Conditionnel : parmi ceux qui ont décroché. C'est le taux du closer. */
  rdvParJoint: Taux;
  parTour: TourMesure[];
  ecarts: EcartCritere[];
  /** Ce qu'on a le droit d'affirmer, en français. */
  lecture: string[];
  /** Ce qui manque pour pouvoir conclure. */
  manque: string[];
}

/**
 * Relit toute la base et rend ce qui est MESURÉ.
 *
 * Déterministe et sans réseau : deux appels sur la même base rendent le même
 * verdict. Un tableau de bord qui change d'avis n'est pas un tableau de bord.
 */
export function calibrer(prospects: Prospect[], axe: AxeSucces = "decroche"): Calibration {
  const vecus = prospects.map((p) => ({ p, v: relire(p) }));
  const appeles = vecus.filter(({ v }) => v.composes > 0);

  const composes = appeles.reduce((s, { v }) => s + v.composes, 0);
  const joints = appeles.filter(({ v }) => v.joint).length;
  const rdv = appeles.filter(({ v }) => v.rdv).length;
  const oppositions = appeles.filter(({ v }) => v.opposition).length;

  // ── Par tour : la vraie question posée à `planifierAppels` ──
  // Son modèle suppose un taux CONSTANT d'un tour à l'autre. C'est une
  // hypothèse forte : en pratique le 1er tour ramasse les faciles et les
  // suivants s'épuisent. Le découpage par tour est ce qui permettra de le
  // dire — ou de le démentir.
  const maxTours = appeles.reduce((m, { v }) => Math.max(m, v.composes), 0);
  const parTour: TourMesure[] = [];
  for (let t = 1; t <= maxTours; t++) {
    let c = 0;
    let j = 0;
    for (const { p } of appeles) {
      const a = attemptsFromEvents(p)[t - 1];
      if (!a) continue;
      c++;
      if (aDecroche(a.outcome)) j++;
    }
    parTour.push({ tour: t, composes: c, joints: j, taux: tauxMesure(j, c, `Décroché au tour ${t}`) });
  }

  const decrocheParTentative = tauxMesure(joints, composes, "Décroché par tentative composée");
  const decrocheParProspect = tauxMesure(joints, appeles.length, "Prospects joints au moins une fois");
  const rdvParJoint = tauxMesure(rdv, joints, "RDV parmi ceux qui ont décroché");

  // ── Les écarts par critère ──
  // Le dénominateur est le PROSPECT appelé, pas la tentative : un critère
  // s'attache à une fiche, pas à un coup de fil. Compter les tentatives
  // donnerait plus de poids à ceux qu'on a rappelés cinq fois — c'est-à-dire
  // précisément à ceux qui ne décrochent pas.
  const ecarts = CRITERES_TRI.map((c) => {
    const avecL = appeles.filter(({ p }) => c.present(p));
    const sansL = appeles.filter(({ p }) => !c.present(p));
    const gagne = (v: Vecu) => (axe === "rdv" ? v.rdv : v.joint);
    return comparer(
      c,
      axe,
      tauxMesure(avecL.filter(({ v }) => gagne(v)).length, avecL.length, `${c.label} — avec`),
      tauxMesure(sansL.filter(({ v }) => gagne(v)).length, sansL.length, `${c.label} — sans`)
    );
  });

  // ── La lecture : ce qu'on a le droit de dire ──
  const lecture: string[] = [];
  const manque: string[] = [];

  if (appeles.length === 0) {
    lecture.push(
      "Aucun appel consigné. Rien n'est calibré : le score de tri et le plan d'appels reposent entièrement sur des hypothèses posées à la main."
    );
    manque.push(
      `${ECHANTILLON_MIN} appels composés pour obtenir un premier taux de décroché utilisable.`,
      `${ECHANTILLON_MIN_BRAS} fiches avec ET ${ECHANTILLON_MIN_BRAS} sans, sur un même critère, pour commencer à départager les poids du tri.`
    );
    return {
      appeles: 0,
      composes: 0,
      joints: 0,
      rdv: 0,
      oppositions: 0,
      decrocheParTentative: aucunTaux("Décroché par tentative composée"),
      decrocheParProspect: aucunTaux("Prospects joints au moins une fois"),
      rdvParJoint: aucunTaux("RDV parmi ceux qui ont décroché"),
      parTour: [],
      ecarts,
      lecture,
      manque,
    };
  }

  lecture.push(decrocheParTentative.phrase);
  if (joints > 0) lecture.push(rdvParJoint.phrase);

  if (decrocheParTentative.fragile) {
    manque.push(
      `${ECHANTILLON_MIN - composes} tentative(s) de plus pour que le taux de décroché pilote le plan au lieu de l'hypothèse à 20 %.`
    );
  }

  /**
   * Le décroché qui s'effondre d'un tour à l'autre invalide le modèle
   * géométrique du plan (`planifierAppels` suppose un taux CONSTANT).
   *
   * Le critère est le même que pour les critères de tri : on ne parle que si
   * les deux fourchettes de Wilson sont DISJOINTES. Un seuil en points (« plus
   * de 10 d'écart ») aurait crié sur 20 % contre 8 % mesurés sur 12 appels,
   * c'est-à-dire sur du bruit.
   */
  const t1 = parTour[0]?.taux;
  const t2 = parTour[1]?.taux;
  if (t1?.valeur != null && t2?.valeur != null && t1.bas !== null && t2.haut !== null && t1.bas > t2.haut) {
    lecture.push(
      `Le décroché n'est pas constant d'un tour à l'autre (${pct(t1.valeur)} au 1er, ${pct(t2.valeur)} au 2e, fourchettes disjointes). Le plan d'appels suppose un taux stable : sa projection est donc OPTIMISTE sur les derniers tours.`
    );
  }

  const confirmes = ecarts.filter((e) => e.verdict === "confirme");
  const infirmes = ecarts.filter((e) => e.verdict === "infirme");
  const insuffisants = ecarts.filter((e) => e.verdict === "insuffisant");

  for (const e of [...infirmes, ...confirmes]) lecture.push(e.phrase);
  if (infirmes.length) {
    manque.push(
      `${infirmes.length} poids du tri jouent à l'envers — la correction est un geste humain dans lib/sourcing-terrain.ts, elle ne se fait pas toute seule.`
    );
  }
  if (insuffisants.length === ecarts.length) {
    manque.push(
      "Aucun critère n'a encore deux bras assez fournis : appeler un lot MÉLANGÉ (avec et sans plainte) est ce qui rend la comparaison possible. N'appeler que les meilleurs scores empêche définitivement de savoir si le score est bon."
    );
  }

  if (oppositions > 0) {
    lecture.push(
      `${oppositions} opposition(s) enregistrée(s) — ces fiches sont hors campagne définitivement, et elles ne comptent pas comme un échec de ciblage.`
    );
  }

  return {
    appeles: appeles.length,
    composes,
    joints,
    rdv,
    oppositions,
    decrocheParTentative,
    decrocheParProspect,
    rdvParJoint,
    parTour,
    ecarts,
    lecture,
    manque,
  };
}

export interface TauxPlan {
  taux: number;
  source: SourceTaux;
  phrase: string;
}

/**
 * Le taux à donner à `planifierAppels` — mesuré si on peut, hypothèse sinon.
 *
 * C'est ICI que la boucle se referme concrètement : la première campagne
 * remplace la supposition par un chiffre, et le plan de la suivante en hérite
 * sans que personne n'ait à toucher au code.
 *
 * La bascule exige `!fragile` : un taux sur 12 appels ne vaut pas mieux que
 * l'hypothèse, il a juste l'air plus sérieux — c'est exactement le piège.
 */
export function tauxPourPlan(cal: Calibration, hypothese: number): TauxPlan {
  const t = cal.decrocheParTentative;
  if (t.source === "mesure" && !t.fragile && t.valeur !== null) {
    return {
      taux: t.valeur,
      source: "mesure",
      phrase: `décroché MESURÉ à ${pct(t.valeur)} sur ${t.n} tentatives réelles (fourchette ${pct(t.bas ?? 0)}–${pct(t.haut ?? 0)}).`,
    };
  }
  const dejaFait = t.n > 0 ? ` ${t.n} tentative(s) consignée(s) pour l'instant, il en faut ${ECHANTILLON_MIN}.` : "";
  return {
    taux: hypothese,
    source: "aucune",
    phrase: `hypothèse de décroché à ${pct(hypothese)}, jamais mesurée ici.${dejaFait}`,
  };
}
