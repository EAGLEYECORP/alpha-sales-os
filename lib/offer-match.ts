/**
 * ─────────────────────────────────────────────────────────────────────
 * Routeur d'offre — après l'audit, QUELLE offre EAGLEYE proposer.
 *
 * La consigne terrain de Zakaria : on audite un prospect, puis on voit si
 * on l'aide avec…
 *   • ALPHA SALES OS   — l'OS de vente intelligent (leads à gérer, closing
 *                        à structurer, pipeline à outiller) ;
 *   • SCINTIA CALLFLOW — l'accueil/relance IA au téléphone (appels manqués,
 *                        métiers dépendants du téléphone) ;
 *   • VISIBILITÉ / GROWTH — offre personnalisée quand le trou est d'être vu
 *                        (pas de site, faible présence, peu d'avis).
 *
 * On score chaque offre sur les VRAIS signaux de la fiche (DeepAudit), on
 * classe, et on renvoie l'offre primaire + le pourquoi + l'accroche.
 * Déterministe, sans clé, sans réseau.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EagleyeOffer = "alpha-sales-os" | "callflow" | "visibilite-growth";

export interface OfferSignals {
  sector?: string;
  missedCallsPerWeek?: number;
  googleRating?: number;
  googleReviews?: number;
  websiteState?: string;
  socialState?: string;
  /** € one-shot / récurrent — proxy « il y a du deal à outiller ». */
  monthlyValue?: number;
  avgTicket?: number;
}

export interface OfferMatch {
  primary: EagleyeOffer;
  label: string;
  scores: Record<EagleyeOffer, number>;
  reasons: Record<EagleyeOffer, string[]>;
  /** Accroche d'ouverture pour l'offre primaire. */
  pitch: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UNE OFFRE EST, EN UN SEUL ENDROIT.
 *
 * Le libellé, l'accroche écrite et ce qui se DIT au téléphone vivent
 * ensemble. Les trois se lisent au même moment sur la même fiche : séparés,
 * ils divergent, et le prospect entend une offre pendant qu'il lit l'autre.
 *
 * ⚠ LA RAISON D'ÊTRE DES DEUX DERNIERS CHAMPS. Le script d'appel sortant
 * annonçait « proposer un audit de leur accueil téléphonique » — l'angle
 * Callflow — QUEL QUE SOIT le routage. Un prospect routé vers la visibilité
 * s'entendait donc proposer autre chose que ce qu'on avait décidé de lui
 * vendre. Pire : quand le brief du deep-dive accompagnait l'appel, il portait
 * « Offre pertinente : Visibilité / Growth » pendant que le rôle disait
 * Callflow. Deux offres contradictoires dans le même prompt.
 *
 * `benefice` est ce que l'agent annonce APRÈS la divulgation, et `question`
 * est la seule question — FERMÉE — qu'il pose avant de se taire. Elles sont
 * écrites pour être PRONONCÉES : courtes, sans jargon, sans chiffre — la
 * règle « jamais de prix au téléphone » ne se négocie pas.
 *
 * ⚠ `raisonAppel` a été SUPPRIMÉ le 28/08/2026, pas mis de côté. Il portait
 * l'ouverture en diagnostic (« comprendre comment vous suivez vos demandes »)
 * que `benefice` remplace. Le garder « au cas où » aurait laissé un champ que
 * plus rien ne lit, avec un commentaire affirmant qu'il sert — et ce dépôt
 * paie déjà assez cher les mécanismes câblés nulle part.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface OffreCommerciale {
  label: string;
  /** Accroche écrite (fiche, email, deck). */
  pitch: string;
  /**
   * ── LE BÉNÉFICE, ET RIEN D'AUTRE (doctrine du 28/08/2026) ──
   *
   * ⚠ CE QUI A CHANGÉ, ET POURQUOI. L'appel ouvrait en DIAGNOSTIC :
   * « je voudrais comprendre comment vous suivez vos demandes aujourd'hui ».
   * C'est une bonne question de découverte — dans un rendez-vous. À froid,
   * elle demande au prospect de faire un effort d'introspection sur son
   * propre désordre, avant même de savoir ce qu'il a à y gagner. Il n'a
   * aucune raison de le fournir à un inconnu qui vient de se présenter comme
   * une IA.
   *
   * On dit donc d'abord le RÉSULTAT qu'il veut, et on lui demande s'il le
   * veut. C'est une question FERMÉE : oui ou non. Un oui ouvre le rendez-vous,
   * un non raccroche. Aucun des deux ne demande à l'agent d'improviser — et
   * c'est exactement la contrainte que s'impose une IA qui démarche.
   *
   * Le bénéfice se dit dans les mots du client, jamais dans les nôtres :
   * `auditBenefice` refuse le jargon (voir plus bas). « Ton calendrier se
   * remplit tout seul » est un bénéfice ; « automatisation de la prise de
   * rendez-vous » est une fiche produit.
   */
  benefice: string;
  /** La question FERMÉE qui suit le bénéfice. Oui → RDV. Non → on raccroche. */
  question: string;
  /**
   * Ce qu'on répond au OUI, avant de proposer le créneau. Une phrase.
   * Jamais un COMMENT : le comment est le sujet du rendez-vous.
   */
  miseEnPlace: string;
  /**
   * Ce qui SE PERD sur ce canal — la question qui fait chiffrer la fuite.
   * Elle suit toujours l'ouverture : d'abord ce qui se passe, ensuite combien.
   */
  perte: string;
  /** Ce que deviennent ceux qu'on perd. La question qui fait constater le coût. */
  consequence: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE JARGON QUI TUE UN APPEL À FROID.
 *
 * Un bénéfice se dit dans les mots du client. Dès qu'on prononce un mot de
 * NOTRE métier, on demande au prospect de traduire — et un artisan qui doit
 * traduire raccroche. « Automatisation de la relance » n'est pas un bénéfice,
 * c'est la description de notre travail.
 *
 * ⚠ CE QUI SE VÉRIFIE ICI, ET CE QUI NE SE VÉRIFIE PAS. Cette garde porte sur
 * les CHAMPS du catalogue (`benefice`, `question`), jamais sur le script
 * assemblé. La raison est dure : l'article 50 EXIGE que la première phrase
 * dise « intelligence artificielle ». Passer le script entier ici ferait
 * refuser tout appel conforme — la garde du bénéfice et l'obligation légale
 * se contrediraient, et c'est la légale qui perdrait, parce que c'est celle
 * qu'on serait tenté d'assouplir.
 *
 * On interdit le NOM abstrait, pas l'effet. « Votre agenda se remplit tout
 * seul » est autorisé et recherché ; « automatisation » ne l'est pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export const JARGON_INTERDIT: { mot: string; pattern: RegExp; pourquoi: string }[] = [
  // ⚠ Pas de `\b` en fin de motif après une lettre accentuée : « é » n'est pas
  // un caractère de mot ASCII et la limite ne matche jamais. Ce dépôt a déjà
  // payé ce bug une fois (`intéressé\b`, mort-né).
  { mot: "IA / intelligence artificielle", pattern: /\b(?:i\.?a\.?|intelligence artificielle)\b/i, pourquoi: "La divulgation légale l'a déjà dit une fois. Le répéter dans l'argumentaire vend la technique, pas le résultat." },
  { mot: "agent vocal", pattern: /agents? vocal/i, pourquoi: "Le client n'achète pas un agent, il achète un agenda plein." },
  { mot: "automatisation", pattern: /automatisation|automatis[ée]/i, pourquoi: "C'est le nom de NOTRE travail. Le sien, c'est « je n'ai plus à y penser »." },
  { mot: "workflow / process", pattern: /workflow|process(?:us)?\b/i, pourquoi: "Vocabulaire de consultant. Il fait reculer un artisan." },
  { mot: "CRM / pipeline", pattern: /\bcrm\b|\bpipelines?\b/i, pourquoi: "Un outil, pas un bénéfice. Il n'a jamais voulu de CRM." },
  { mot: "solution / plateforme / SaaS", pattern: /\bsolutions?\b|plateformes?|\bsaas\b/i, pourquoi: "Mots vides. Ils ne décrivent aucun résultat et sonnent comme tous les autres appels de la journée." },
  { mot: "intégration / API", pattern: /int[ée]gration|\bapi\b/i, pourquoi: "Le comment. Il est le sujet du rendez-vous, jamais de l'appel." },
  { mot: "digitalisation / transformation", pattern: /digitalisation|transformation digitale/i, pourquoi: "Le mot que tout le monde lui a déjà servi. Il ne veut rien dire pour lui." },
  { mot: "optimiser / booster", pattern: /optimis|boost/i, pourquoi: "Verbes de brochure. Ils promettent « mieux » sans dire quoi." },
  { mot: "innovant / révolutionnaire", pattern: /innovant|r[ée]volutionnaire|disrupti/i, pourquoi: "Invérifiable, et zéro vente à ce jour ne permet de l'affirmer." },
];

export interface VerdictBenefice {
  ok: boolean;
  /** Les mots trouvés, avec la raison de leur interdiction. */
  trouves: { mot: string; pourquoi: string }[];
}

/**
 * Le texte est-il un BÉNÉFICE, ou une fiche produit ?
 *
 * Rend le verdict et les mots fautifs. Pur : aucune correction automatique —
 * réécrire à la place de l'opérateur produirait une phrase que personne
 * n'assume, et c'est lui qui la fera prononcer à de vraies personnes.
 */
export function auditBenefice(texte: string): VerdictBenefice {
  const trouves = JARGON_INTERDIT.filter((j) => j.pattern.test(texte)).map((j) => ({
    mot: j.mot,
    pourquoi: j.pourquoi,
  }));
  return { ok: trouves.length === 0, trouves };
}

export const OFFRES: Record<EagleyeOffer, OffreCommerciale> = {
  "alpha-sales-os": {
    label: "Alpha Sales OS — l'OS de vente intelligent",
    pitch: "« Vous avez des leads. Le vrai enjeu n'est pas d'en avoir plus — c'est de n'en perdre aucun. »",
    benefice:
      "vous ne perdez plus une seule demande : chaque personne qui vous contacte est suivie, relancée et " +
      "recontactée au bon moment, sans que vous ayez à y penser",
    question:
      "Vous aimeriez ne plus jamais perdre une demande parce que personne n'a eu le temps de la relancer ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    perte: "Sur dix personnes qui vous contactent, combien vont jusqu'au devis ?",
    consequence: "Et celles qui s'arrêtent en route — vous savez pourquoi, ou ça se perd sans qu'on le sache ?",
  },
  callflow: {
    label: "ScintIA Callflow — l'accueil & relance IA au téléphone",
    pitch: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place, 24/7. »",
    benefice:
      "votre agenda se remplit tout seul pendant que vous vous occupez de votre métier et de vos clients : " +
      "on décroche à votre place, on note ce qu'il faut, et vous ne rappelez que les gens qui comptent",
    question:
      "Vous aimeriez que votre agenda se remplisse tout seul pendant que vous vous concentrez sur votre " +
      "métier et vos clients ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    // Ces deux-là existaient déjà, mot pour mot, dans `buildArgumentaire` :
    // elles sont remontées ici pour que les trois offres se lisent au même
    // endroit — rien n'a été réécrit.
    perte: "Sur une semaine normale, combien d'appels vous n'arrivez pas à prendre ?",
    consequence: "Et ceux qui ne rappellent pas — vous pensez qu'ils font quoi ?",
  },
  "visibilite-growth": {
    label: "Visibilité / Growth — offre personnalisée",
    pitch: "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
    benefice:
      "les gens qui cherchent votre métier près de chez vous tombent sur vous, pas sur le concurrent d'à côté, " +
      "et vous arrêtez de dépendre du bouche-à-oreille",
    question:
      "Vous aimeriez que les gens qui cherchent votre métier dans le secteur tombent sur vous plutôt que sur " +
      "le concurrent ?",
    miseEnPlace: "C'est exactement ce qu'on met en place.",
    perte: "Quelqu'un qui cherche votre métier dans le secteur, sans vous connaître : il vous trouve ?",
    consequence: "Et ceux qui ne vous trouvent pas — ils prennent qui, à votre avis ?",
  },
};

/**
 * ⚠ CES DEUX TABLES SONT DÉRIVÉES, PAS RECOPIÉES. Elles gardent leur nom
 * parce que des écrans les importent déjà ; ce qui change, c'est qu'il n'existe
 * plus qu'une seule saisie derrière.
 */
export const OFFER_LABELS: Record<EagleyeOffer, string> = {
  "alpha-sales-os": OFFRES["alpha-sales-os"].label,
  callflow: OFFRES.callflow.label,
  "visibilite-growth": OFFRES["visibilite-growth"].label,
};

const OFFER_PITCH: Record<EagleyeOffer, string> = {
  "alpha-sales-os": OFFRES["alpha-sales-os"].pitch,
  callflow: OFFRES.callflow.pitch,
  "visibilite-growth": OFFRES["visibilite-growth"].pitch,
};

// Métiers très dépendants du téléphone (accueil, prise de RDV, urgence).
const PHONE_HEAVY = ["garage", "carrosserie", "auto", "conduite", "école", "ambulance", "santé", "médical", "chirurgie", "dentaire", "immobilier", "agence", "taxi", "vtc", "restaurant", "coiffure", "beauté", "spa", "plomb", "artisan", "serrur", "bâtiment", "maître", "oeuvre", "œuvre"];
// Métiers avec une vraie fonction commerciale / cycle de vente B2B.
const SALES_HEAVY = ["agence", "conseil", "avocat", "juri", "b2b", "service", "saas", "logiciel", "marketing", "immobilier", "courtier", "assur", "compt", "maître", "oeuvre", "œuvre", "promoteur", "construction"];

const hit = (s: string | undefined, needles: string[]) => {
  const t = (s ?? "").toLowerCase();
  return needles.some((n) => t.includes(n));
};

/** Site absent / obsolète → trou de visibilité. */
function weakWebsite(state?: string): boolean {
  const t = (state ?? "").toLowerCase().trim();
  if (!t || t === "aucun" || t === "aucune" || t === "non") return true;
  return t.includes("obsol") || t.includes("2014") || t.includes("vieux") || t.includes("datant");
}

function weakSocial(state?: string): boolean {
  const t = (state ?? "").toLowerCase().trim();
  return !t || t === "aucun" || t === "aucune" || t.includes("faible") || t.includes("inactif") || t.includes("abandon");
}

/**
 * @param allowed  Offres autorisées pour le compte courant (lib/accounts.ts).
 *   Un compte mono-offre (ScintIA = callflow seul) ne doit JAMAIS se voir
 *   proposer autre chose, même si l'audit pointe ailleurs. Absent/vide = les
 *   trois (compte maître). Un `allowed` d'une seule offre force cette offre.
 */
export function matchOffer(sig: OfferSignals, allowed?: EagleyeOffer[]): OfferMatch {
  const scores: Record<EagleyeOffer, number> = { "alpha-sales-os": 0, callflow: 0, "visibilite-growth": 0 };
  const reasons: Record<EagleyeOffer, string[]> = { "alpha-sales-os": [], callflow: [], "visibilite-growth": [] };

  // ── Callflow : appels manqués + métier téléphone ──
  const missed = sig.missedCallsPerWeek ?? 0;
  if (missed >= 5) { scores.callflow += 3; reasons.callflow.push(`${missed} appels manqués/semaine — autant de clients perdus`); }
  else if (missed >= 2) { scores.callflow += 2; reasons.callflow.push(`${missed} appels manqués/semaine`); }
  if (hit(sig.sector, PHONE_HEAVY)) { scores.callflow += 2; reasons.callflow.push("métier très dépendant du téléphone"); }

  // ── Alpha Sales OS : fonction commerciale + deals à outiller ──
  if (hit(sig.sector, SALES_HEAVY)) { scores["alpha-sales-os"] += 2; reasons["alpha-sales-os"].push("cycle de vente / leads à structurer"); }
  const value = Math.max(sig.monthlyValue ?? 0, sig.avgTicket ?? 0);
  if (value >= 3000) { scores["alpha-sales-os"] += 2; reasons["alpha-sales-os"].push("panier/valeur élevé — le closing mérite un OS"); }
  else if (value >= 800) { scores["alpha-sales-os"] += 1; reasons["alpha-sales-os"].push("valeur de deal significative"); }

  // ── Visibilité / Growth : invisible en ligne ──
  // Donnée ABSENTE (undefined) ≠ signal : on ne score que ce qui est mesuré.
  if (sig.websiteState !== undefined && weakWebsite(sig.websiteState)) { scores["visibilite-growth"] += 3; reasons["visibilite-growth"].push("site absent ou obsolète"); }
  if (sig.googleRating !== undefined && sig.googleRating < 4) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push(`note Google faible (${sig.googleRating}/5)`); }
  if (sig.googleReviews !== undefined && sig.googleReviews < 10) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push("peu d'avis Google — faible preuve sociale"); }
  if (sig.socialState !== undefined && weakSocial(sig.socialState)) { scores["visibilite-growth"] += 1; reasons["visibilite-growth"].push("réseaux sociaux inexistants ou inactifs"); }

  // Classement. Départage stable : callflow > visibilité > alpha (le plus
  // « proximité » d'abord, cohérent avec le pipe Scintia), à score égal.
  // On ne classe QUE parmi les offres autorisées du compte.
  const fullOrder: EagleyeOffer[] = ["callflow", "visibilite-growth", "alpha-sales-os"];
  const permitted = allowed && allowed.length ? allowed : fullOrder;
  const order = fullOrder.filter((o) => permitted.includes(o));
  // Repli défensif : un `allowed` vide après filtre → on garde tout.
  const ranking = order.length ? order : fullOrder;

  let primary: EagleyeOffer = ranking[0];
  let best = -1;
  for (const o of ranking) {
    if (scores[o] > best) { best = scores[o]; primary = o; }
  }
  // Aucun signal → défaut = 1re offre autorisée (Alpha Sales OS pour le maître,
  // callflow pour un compte Callflow-seul : jamais une offre interdite).
  if (best <= 0) primary = ranking.includes("alpha-sales-os") ? "alpha-sales-os" : ranking[0];

  return { primary, label: OFFER_LABELS[primary], scores, reasons, pitch: OFFER_PITCH[primary] };
}
