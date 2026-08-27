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
 * `raisonAppel` est la phrase que l'agent dit APRÈS la divulgation, et
 * `question` est la seule question qu'il pose avant d'écouter. Elles sont
 * écrites pour être PRONONCÉES : courtes, sans jargon, sans chiffre — la
 * règle « jamais de prix au téléphone » ne se négocie pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface OffreCommerciale {
  label: string;
  /** Accroche écrite (fiche, email, deck). */
  pitch: string;
  /** Pourquoi on appelle, en UNE phrase dite à voix haute. */
  raisonAppel: string;
  /** La seule question posée avant d'écouter. */
  question: string;
}

export const OFFRES: Record<EagleyeOffer, OffreCommerciale> = {
  "alpha-sales-os": {
    label: "Alpha Sales OS — l'OS de vente intelligent",
    pitch: "« Vous avez des leads. Le vrai enjeu n'est pas d'en avoir plus — c'est de n'en perdre aucun. »",
    raisonAppel:
      "comprendre comment vous suivez vos demandes aujourd'hui, parce que la plupart des affaires se perdent entre le premier contact et la relance, pas au moment de vendre",
    question: "Quand quelqu'un vous contacte aujourd'hui, qu'est-ce qui se passe ensuite, concrètement ?",
  },
  callflow: {
    label: "ScintIA Callflow — l'accueil & relance IA au téléphone",
    pitch: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place, 24/7. »",
    raisonAppel:
      "comprendre ce qui se passe chez vous quand le téléphone sonne et que personne ne peut décrocher",
    question: "Dans une semaine normale, il vous arrive de ne pas pouvoir répondre ? À peu près combien de fois ?",
  },
  "visibilite-growth": {
    label: "Visibilité / Growth — offre personnalisée",
    pitch: "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
    raisonAppel:
      "comprendre comment vos clients vous trouvent aujourd'hui, parce que de l'extérieur on vous voit assez peu",
    question: "Vos nouveaux clients, ils viennent d'où en ce moment — bouche-à-oreille, recherche, autre chose ?",
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
