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

export const OFFER_LABELS: Record<EagleyeOffer, string> = {
  "alpha-sales-os": "Alpha Sales OS — l'OS de vente intelligent",
  callflow: "ScintIA Callflow — l'accueil & relance IA au téléphone",
  "visibilite-growth": "Visibilité / Growth — offre personnalisée",
};

const OFFER_PITCH: Record<EagleyeOffer, string> = {
  "alpha-sales-os": "« Vous avez des leads. Le vrai enjeu n'est pas d'en avoir plus — c'est de n'en perdre aucun. »",
  callflow: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place, 24/7. »",
  "visibilite-growth": "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
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

export function matchOffer(sig: OfferSignals): OfferMatch {
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
  const order: EagleyeOffer[] = ["callflow", "visibilite-growth", "alpha-sales-os"];
  let primary: EagleyeOffer = "alpha-sales-os";
  let best = -1;
  for (const o of order) {
    if (scores[o] > best) { best = scores[o]; primary = o; }
  }
  // Aucun signal du tout → défaut neutre = Alpha Sales OS (l'offre maison).
  if (best <= 0) primary = "alpha-sales-os";

  return { primary, label: OFFER_LABELS[primary], scores, reasons, pitch: OFFER_PITCH[primary] };
}
