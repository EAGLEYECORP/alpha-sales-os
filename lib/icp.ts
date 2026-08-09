/**
 * ─────────────────────────────────────────────────────────────────────
 * ICP par offre — « le client parfait » déduit de CE que le compte vend.
 *
 * Principe white-label : l'ICP n'est pas codé en dur (garages lyonnais).
 * Il se DÉDUIT de l'offre du compte. Chez EAGLEYE qui vend Alpha Sales OS,
 * l'ICP = agences / forces de vente. Chez un revendeur qui vend autre
 * chose, c'est SON client parfait à lui.
 *
 * Deux niveaux :
 *   • deriveICP() — déterministe, hors-ligne, sans clé. Un squelette
 *     cohérent + une inférence par mots-clés de l'offre. Toujours dispo.
 *   • /api/icp — l'IA affine ce squelette avec l'identité + la doctrine.
 *     Repli sur deriveICP si aucune clé.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface OfferInput {
  agencyName?: string;
  whatYouSell?: string;
  valueProp?: string;
  city?: string;
}

export interface ICP {
  /** Nom en une ligne du client idéal. */
  label: string;
  /** Qui signe (rôle / niveau). */
  buyer: string;
  /** Secteur(s) cible. */
  sector: string;
  /** Taille d'entreprise visée. */
  companySize: string;
  /** Zone géographique. */
  geo: string;
  /** Douleurs structurelles que l'offre soulage. */
  pains: string[];
  /** Signaux d'achat à guetter (déclencheurs). */
  triggers: string[];
  /** Canaux pour les atteindre. */
  channels: string[];
  /** Qui EXCLURE (faux positifs coûteux). */
  disqualifiers: string[];
  /** L'angle d'ouverture — la première phrase qui accroche. */
  angle: string;
  /** Vrai si l'IA a affiné ; faux = squelette déterministe. */
  refined: boolean;
}

const has = (s: string | undefined, ...needles: string[]) => {
  const t = (s ?? "").toLowerCase();
  return needles.some((n) => t.includes(n));
};

/**
 * Squelette déterministe. On infère la FAMILLE d'ICP depuis les mots de
 * l'offre, puis on remplit un cadre solide que l'IA (ou l'humain) affine.
 */
export function deriveICP(offer: OfferInput): ICP {
  const sells = offer.whatYouSell ?? "";
  const vp = offer.valueProp ?? "";
  const both = `${sells} ${vp}`;
  const geo = offer.city?.trim() ? `${offer.city.trim()} puis élargissement` : "local d'abord, puis national";

  // Famille 1 — outil / logiciel de vente (le cas EAGLEYE : vendre Alpha Sales OS).
  if (has(both, "alpha sales", "os de vente", "crm", "logiciel", "saas", "outil", "prospection", "outreach", "commercial")) {
    return {
      label: "Force de vente qui perd des leads faute de suivi",
      buyer: "Dirigeant / directeur commercial / closer indépendant / patron d'agence",
      sector: "Agences (web, marketing, immo), sociétés de services B2B, forces de vente externalisées",
      companySize: "1-50 salariés (TPE/PME avec au moins un commercial)",
      geo,
      pains: [
        "Des leads qui tombent entre les mailles — aucun suivi systématique",
        "Le closing dépend d'une personne, rien n'est outillé ni reproductible",
        "Pas de visibilité chiffrée sur le pipe (ni CAC, ni taux de passage)",
        "Trop de temps perdu en tâches d'outreach manuel",
      ],
      triggers: [
        "Recrute un commercial (hiring sales)",
        "Se plaint publiquement de son CRM / de sa prospection",
        "Lance une nouvelle offre ou un nouveau marché",
        "Croissance récente = besoin de structurer la vente",
      ],
      channels: ["Email personnalisé + relance", "LinkedIn (invitation → message)", "Prescripteurs (agences, experts-comptables)", "Démo vocale live"],
      disqualifiers: [
        "Zéro commercial et aucune intention de vendre activement",
        "Déjà équipé d'un OS complet et satisfait",
        "Cherche un outil gratuit à tout prix (mauvais payeur)",
      ],
      angle: "« Vous avez des leads. Le problème n'est pas d'en avoir plus — c'est de n'en perdre aucun. »",
      refined: false,
    };
  }

  // Famille 2 — service aux commerces de proximité (le cas d'un revendeur closer).
  if (has(both, "commerce", "proximité", "local", "rdv", "rendez-vous", "artisan", "restaurant", "garage", "terrain")) {
    return {
      label: "Commerce local sans machine à rendez-vous",
      buyer: "Gérant / patron du commerce (il décide et il signe)",
      sector: "Commerces de proximité : garages, artisans, restauration, beauté/spa, immobilier local, auto-écoles",
      companySize: "1-10 salariés (TPE indépendantes)",
      geo,
      pains: [
        "Un agenda vide ou irrégulier — pas de flux de RDV",
        "Aucune présence en ligne qui convertit",
        "Des appels/demandes manqués, jamais rappelés",
        "Le bouche-à-oreille comme seule acquisition",
      ],
      triggers: [
        "Note Google faible ou peu d'avis récents",
        "Site absent ou daté",
        "Ouverture récente / reprise de fonds",
        "Publie qu'il cherche des clients",
      ],
      channels: ["Appel terrain + passage physique", "Email local + audit cadeau", "SMS", "Prescripteurs de quartier"],
      disqualifiers: [
        "Déjà plein, liste d'attente (pas de douleur)",
        "Sur le départ / cessation",
        "Aucun budget et aucune marge",
      ],
      angle: "« On ne vous vend pas une base de prospects — on vous remplit l'agenda. »",
      refined: false,
    };
  }

  // Famille par défaut — offre B2B générique : cadre neutre, l'IA affinera.
  const brand = offer.agencyName?.trim() || "l'offre";
  return {
    label: `Client B2B pour ${brand}`,
    buyer: "Décideur (fondateur / dirigeant / responsable du budget concerné)",
    sector: sells.trim() ? `Secteurs pertinents pour : ${sells.trim()}` : "À préciser selon l'offre",
    companySize: "TPE/PME (1-50 salariés)",
    geo,
    pains: [
      vp.trim() ? `Le problème que résout : ${vp.trim()}` : "La douleur centrale que l'offre soulage",
      "Perte de temps / d'argent sur le statu quo",
      "Solution actuelle inadaptée ou absente",
    ],
    triggers: ["Signal de croissance ou de tension", "Changement récent (recrutement, financement, nouveau marché)", "Insatisfaction exprimée publiquement"],
    channels: ["Email personnalisé + relance", "LinkedIn", "Prescripteurs", "Démo"],
    disqualifiers: ["Aucun budget", "Pas le bon interlocuteur", "Aucune douleur réelle"],
    angle: vp.trim() ? `« ${vp.trim()} »` : "L'accroche qui nomme SA douleur, pas ton produit.",
    refined: false,
  };
}

/** Prompt système pour l'affinage IA — l'IA renvoie un ICP JSON strict. */
export function icpSystemPrompt(): string {
  return [
    "Tu es un stratège d'acquisition B2B. À partir de l'offre d'un compte, tu produis SON client parfait (ICP).",
    "Réponds UNIQUEMENT en JSON strict, sans texte autour, avec EXACTEMENT ces clés :",
    '{"label":string,"buyer":string,"sector":string,"companySize":string,"geo":string,"pains":string[],"triggers":string[],"channels":string[],"disqualifiers":string[],"angle":string}',
    "Règles : concret et actionnable, jamais générique ; pains/triggers/channels/disqualifiers = 3 à 5 items courts ;",
    "angle = une phrase d'ouverture qui nomme la douleur du client, pas le produit ; français ; parle AU NOM du compte.",
  ].join("\n");
}

/** Construit le message utilisateur pour l'IA à partir de l'offre. */
export function icpUserPrompt(offer: OfferInput): string {
  const lines = [
    `Agence : ${offer.agencyName?.trim() || "(non renseignée)"}`,
    `Ce qu'elle vend : ${offer.whatYouSell?.trim() || "(non renseigné)"}`,
    `Proposition de valeur : ${offer.valueProp?.trim() || "(non renseignée)"}`,
    `Ville / zone : ${offer.city?.trim() || "(non renseignée)"}`,
  ];
  return `Déduis le client parfait (ICP) pour cette offre :\n${lines.join("\n")}`;
}

/** Normalise la sortie IA (partielle/sale) en ICP complet, en comblant via le squelette. */
export function mergeICP(offer: OfferInput, ai: Partial<ICP> | null): ICP {
  const base = deriveICP(offer);
  if (!ai) return base;
  const arr = (v: unknown, fb: string[]) => (Array.isArray(v) && v.length ? v.filter((x) => typeof x === "string" && x.trim()) : fb);
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
  return {
    label: str(ai.label, base.label),
    buyer: str(ai.buyer, base.buyer),
    sector: str(ai.sector, base.sector),
    companySize: str(ai.companySize, base.companySize),
    geo: str(ai.geo, base.geo),
    pains: arr(ai.pains, base.pains),
    triggers: arr(ai.triggers, base.triggers),
    channels: arr(ai.channels, base.channels),
    disqualifiers: arr(ai.disqualifiers, base.disqualifiers),
    angle: str(ai.angle, base.angle),
    refined: true,
  };
}
