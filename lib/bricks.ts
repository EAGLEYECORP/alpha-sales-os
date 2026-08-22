import { SETUP_FEE } from "./pricing";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PRIX À LA CARTE — chaque brique d'Alpha Sales OS a son prix.
 *
 * Deux raisons d'exister :
 *   1. Un client peut n'avoir besoin QUE d'une brique (ScintIA veut Alpha
 *      Voice, pas le CRM). Refuser de vendre à la carte, c'est refuser
 *      l'argent qui est sur la table aujourd'hui.
 *   2. L'ANCRAGE. La somme des briques dépasse largement le pack à
 *      10 000 € : dès qu'un client en veut trois, le pack devient
 *      arithmétiquement évident. On ne pousse pas le pack en insistant —
 *      on le pousse en montrant l'addition.
 *
 * ⚠ Cloisonnement : un client ne voit QUE les briques qu'il a prises
 * (`unlocks` = les routes ouvertes). Nous voyons tout. C'est une règle de
 * PRODUIT (ce qui s'affiche), pas de sécurité — le vrai cloisonnement des
 * données reste la RLS + le JWT (lib/tenant.ts).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Brick {
  id: string;
  label: string;
  /** Ce que ça fait, en une phrase que le client comprend. */
  what: string;
  /** Installation / paramétrage, € HT. */
  setupHT: number;
  /** Abonnement mensuel, € HT. */
  monthlyHT: number;
  /** Pourquoi ça vaut ce prix — l'argument, pas la feature. */
  why: string;
  /** Routes de l'app ouvertes par cette brique. */
  unlocks: string[];
  /** Coûts externes à la charge du client (on ne les cache pas). */
  passThrough?: string;
}

/**
 * ── ALPHA VOICE SORTANT — tarification au VOLUME D'APPELS ──
 *
 * L'abonnement sortant se paie au millier d'appels, **sans engagement**.
 * Unité de base : 1 000 appels = 364 € HT/mois.
 *
 * Le palier 4 000 est volontairement cassé : il coûte le prix de 3 000
 * (le 4e millier est offert). Ce n'est pas une remise de volume gratuite —
 * c'est le palier de MONTÉE EN CHARGE, celui qu'on ouvre une fois que le
 * ciblage et la conversation sont optimisés. Tant que ça ne convertit pas,
 * multiplier les appels ne fait que brûler du fichier plus vite : le volume
 * n'a de valeur qu'après le réglage.
 */
export const OUTBOUND_UNIT_CALLS = 1000;
export const OUTBOUND_UNIT_HT = 364;

export interface OutboundTier {
  calls: number;
  monthlyHT: number;
  /** Prix ramené au millier d'appels — ce qui rend la remise lisible. */
  perThousandHT: number;
  note?: string;
}

export const OUTBOUND_TIERS: OutboundTier[] = [
  { calls: 1000, monthlyHT: 364, perThousandHT: 364, note: "Le palier d'entrée : on prouve que ça convertit." },
  { calls: 2000, monthlyHT: 728, perThousandHT: 364 },
  { calls: 3000, monthlyHT: 1092, perThousandHT: 364 },
  {
    calls: 4000,
    monthlyHT: 1092,
    perThousandHT: 273,
    note: "Palier de montée en charge : le 4e millier est offert. À ouvrir SEULEMENT une fois le ciblage et la conversation réglés.",
  },
];

export interface OutboundQuote {
  calls: number;
  monthlyHT: number;
  perThousandHT: number;
  /** Le palier appliqué, si le volume tombe pile dessus. */
  tier?: OutboundTier;
  note?: string;
}

/**
 * Le prix mensuel du sortant pour un volume d'appels.
 *
 * Sous 4 000 : multiples du millier (364 €). À 4 000 : 1 092 € (4e millier
 * offert). Au-delà : on repart du palier 4 000 et chaque millier
 * supplémentaire est facturé à l'unité — la courbe reste monotone, jamais
 * un volume plus grand ne coûte moins cher qu'un volume plus petit.
 */
export function outboundPrice(calls: number): OutboundQuote {
  const c = Math.max(0, Math.ceil(calls));
  if (c === 0) return { calls: 0, monthlyHT: 0, perThousandHT: 0 };

  const exact = OUTBOUND_TIERS.find((t) => t.calls === c);
  if (exact) {
    return { calls: c, monthlyHT: exact.monthlyHT, perThousandHT: exact.perThousandHT, tier: exact, note: exact.note };
  }

  const thousands = Math.ceil(c / OUTBOUND_UNIT_CALLS);
  const top = OUTBOUND_TIERS[OUTBOUND_TIERS.length - 1];
  const monthlyHT =
    c > top.calls
      ? top.monthlyHT + (thousands - top.calls / OUTBOUND_UNIT_CALLS) * OUTBOUND_UNIT_HT
      : thousands * OUTBOUND_UNIT_HT;

  return {
    calls: c,
    monthlyHT,
    perThousandHT: Math.round(monthlyHT / (c / OUTBOUND_UNIT_CALLS)),
    note: c % OUTBOUND_UNIT_CALLS !== 0 ? `Facturé au millier entamé (${thousands} × ${OUTBOUND_UNIT_HT} € HT).` : undefined,
  };
}

/**
 * Le catalogue. Les prix sont calibrés pour que l'addition de 3 briques
 * dépasse le pack — c'est volontaire et c'est le moteur de l'upsell.
 */
export const BRICKS: Brick[] = [
  {
    id: "alpha-voice",
    label: "Alpha Voice",
    what: "L'agent vocal IA qui décroche, qualifie, relance et passe la main — entrant et sortant, 24/7.",
    setupHT: 3500,
    // Palier d'entrée du sortant : 1 000 appels/mois. Au-delà, voir
    // OUTBOUND_TIERS — le prix suit le volume, sans engagement.
    monthlyHT: OUTBOUND_UNIT_HT,
    why:
      "C'est la brique la plus lourde à installer : téléphonie SIP, reconnaissance vocale, synthèse, " +
      "modèle conversationnel et conformité article 50. Une fois posée, elle travaille toutes les nuits et tous les week-ends.",
    unlocks: ["/voice", "/appels", "/controle"],
    passThrough: "Consommation téléphonie + minutes STT/TTS facturées au réel (opérateur et fournisseurs).",
  },
  {
    id: "campagnes",
    label: "Campagnes & outreach",
    what: "Séquences email/LinkedIn personnalisées à grande échelle, avec relances et suivi des réponses.",
    setupHT: 2500,
    monthlyHT: 290,
    why: "Le volume ne vaut rien sans personnalisation ; la personnalisation ne tient pas sans machine. C'est cette brique qui tient les deux.",
    unlocks: ["/campaigns", "/outbox", "/linkedin"],
  },
  {
    id: "cerveau",
    label: "Le Cerveau (RAG)",
    what: "La mémoire de l'entreprise : documents, audits, échanges — retrouvés et réinjectés dans chaque message.",
    setupHT: 2500,
    monthlyHT: 240,
    why: "Chaque échange enrichit le contexte. Plus le temps passe, plus les réponses sont justes — c'est la seule brique dont la valeur augmente toute seule.",
    unlocks: ["/cerveau", "/agent"],
  },
  {
    id: "crm",
    label: "CRM & Pipeline",
    what: "Le pipeline, les fiches prospects, le master rappel : quoi faire, pour qui, maintenant.",
    setupHT: 2000,
    monthlyHT: 190,
    why: "Sans pipeline outillé, le closing dépend d'une personne et d'une mémoire. Avec, il devient reproductible.",
    unlocks: ["/pipeline", "/prospects", "/aujourdhui"],
  },
  {
    id: "audits",
    label: "Audits automatisés",
    what: "Le deep-dive de chaque prospect à l'import, et l'audit écrit prêt à envoyer.",
    setupHT: 1800,
    monthlyHT: 150,
    why: "La pièce écrite est ce qui fait décrocher : là où un audit part, le taux de rendez-vous monte ; sans elle, il reste à zéro.",
    unlocks: ["/audits"],
  },
  {
    id: "tracking",
    label: "Tracking & délivrabilité",
    what: "Ouvertures, clics, réponses, et la configuration DNS qui évite le dossier spam.",
    setupHT: 1500,
    monthlyHT: 140,
    why: "Un email en spam est un deal perdu sans jamais le savoir. Cette brique rend visible ce qui, sinon, disparaît en silence.",
    unlocks: ["/tracking", "/deliverability"],
  },
  {
    id: "closer",
    label: "Closer OS & Alpha Live",
    what: "L'assistance en direct pendant le rendez-vous : objections, angles, preuves, au moment où tu en as besoin.",
    setupHT: 1500,
    monthlyHT: 140,
    why: "Le closing se joue sur trois phrases. Les avoir sous les yeux au bon moment vaut plus qu'une formation.",
    unlocks: ["/closer", "/debrief"],
  },
  {
    id: "agent-alpha",
    label: "Agent ALPHA",
    what: "Le copilote conversationnel qui voit tout le pipeline : il prépare la journée, analyse un deal, écrit le message, et dit quoi faire ensuite.",
    setupHT: 2200,
    monthlyHT: 220,
    why:
      "Les autres briques produisent de la donnée ; celle-ci la lit à ta place. C'est la différence entre « avoir un CRM » et " +
      "« ouvrir l'app le matin et savoir quoi faire » — et c'est la seule brique qui remplace une conversation avec un directeur commercial.",
    unlocks: ["/agent", "/aujourdhui", "/decisions"],
    passThrough: "Jetons du modèle facturés au réel — comptés et plafonnés par compte (voir /kpis).",
  },
  {
    id: "pilotage",
    label: "Salle de contrôle & KPIs",
    what: "Tout ce qui tourne en un écran, et les chiffres qui disent où ça bloque.",
    setupHT: 1200,
    monthlyHT: 120,
    why: "On ne corrige pas ce qu'on ne voit pas. C'est la brique qui transforme l'activité en décisions.",
    unlocks: ["/controle", "/kpis", "/milestones"],
  },
];

export const getBrick = (id: string): Brick | undefined => BRICKS.find((b) => b.id === id);

/** Prix du pack complet (tout, installé) — l'ancre. */
export const PACK_SETUP_HT = SETUP_FEE; // 10 000 €
/** Abonnement du pack complet. */
export const PACK_MONTHLY_HT = 1000;

export interface BrickQuote {
  bricks: Brick[];
  setupHT: number;
  monthlyHT: number;
  /** Prix du pack, pour comparaison. */
  packSetupHT: number;
  packMonthlyHT: number;
  /** Économie (€) qu'apporterait le pack sur l'installation. Négatif = la carte reste moins chère. */
  packSavesSetup: number;
  packSavesMonthly: number;
  /** Faut-il recommander le pack ? */
  recommendPack: boolean;
  /** La phrase à dire — factuelle, sans forcer. */
  recommendation: string;
  /** Première année, tout compris (installation + 12 mois). */
  firstYearHT: number;
}

/**
 * Le devis d'une sélection de briques, avec la comparaison au pack.
 *
 * L'argument n'est jamais « prenez le pack » : c'est l'addition qui parle.
 * Si la carte reste moins chère, on le dit — vendre un pack inutile se paie
 * au renouvellement.
 */
export function quoteBricks(ids: string[]): BrickQuote {
  const bricks = ids.map(getBrick).filter((b): b is Brick => Boolean(b));
  const setupHT = bricks.reduce((s, b) => s + b.setupHT, 0);
  const monthlyHT = bricks.reduce((s, b) => s + b.monthlyHT, 0);
  const packSavesSetup = setupHT - PACK_SETUP_HT;
  const packSavesMonthly = monthlyHT - PACK_MONTHLY_HT;

  // On ne recommande le pack que s'il est RÉELLEMENT plus avantageux.
  // À partir de 3 briques, l'écart avec le pack devient assez faible pour que
  // le client ait intérêt à le savoir (2 000 € = le prix d'UNE brique de plus).
  const recommendPack = packSavesSetup > 0 || (bricks.length >= 3 && packSavesSetup >= -2000);

  const recommendation = recommendPack
    ? packSavesSetup > 0
      ? `Avec ${bricks.length} briques, l'installation atteint ${setupHT.toLocaleString("fr-FR")} € — le pack complet est à ${PACK_SETUP_HT.toLocaleString("fr-FR")} €. ` +
        `Vous économisez ${packSavesSetup.toLocaleString("fr-FR")} € ET vous prenez tout le reste.`
      : `Vous êtes à ${setupHT.toLocaleString("fr-FR")} € pour ${bricks.length} briques. Pour ${(PACK_SETUP_HT - setupHT).toLocaleString("fr-FR")} € de plus, le pack ouvre TOUT le reste — c'est le seul moment où ça se décide sans surcoût de reprise.`
    : bricks.length === 0
      ? "Aucune brique sélectionnée."
      : `${bricks.length === 1 ? "Cette brique répond" : "Ces briques répondent"} à votre besoin actuel. Le pack complet n'est pas justifié aujourd'hui — on l'ouvrira quand un deuxième besoin apparaîtra.`;

  return {
    bricks,
    setupHT,
    monthlyHT,
    packSetupHT: PACK_SETUP_HT,
    packMonthlyHT: PACK_MONTHLY_HT,
    packSavesSetup,
    packSavesMonthly,
    recommendPack,
    recommendation,
    firstYearHT: setupHT + monthlyHT * 12,
  };
}

/** Les routes visibles pour un client selon ses briques (cloisonnement produit). */
export function unlockedRoutes(ids: string[]): string[] {
  const set = new Set<string>();
  for (const b of ids.map(getBrick)) for (const r of b?.unlocks ?? []) set.add(r);
  return [...set].sort();
}

const eur = (n: number) => `${n.toLocaleString("fr-FR")} € HT`;

/**
 * Le devis rédigé, prêt à envoyer. Volontairement court : un devis long se
 * lit en diagonale, un devis d'une page se signe.
 */
export function quoteText(
  q: BrickQuote,
  client: string,
  // L'émetteur n'est pas toujours EAGLEYE : un revendeur white-label envoie SON
  // devis, avec SON contact. Le figer ici, c'est envoyer nos coordonnées à
  // travers son deal.
  opts: { validityDays?: number; issuer?: string } = {}
): string {
  const lines: string[] = [
    `DEVIS — ${client}`,
    opts.issuer?.trim() || "EAGLEYE CORP · Lyon · contact@eagleyecorp.fr",
    `Date : ${new Date().toLocaleDateString("fr-FR")} · Validité : ${opts.validityDays ?? 15} jours`,
    "",
    "PRESTATIONS",
  ];
  for (const b of q.bricks) {
    lines.push(
      `• ${b.label} — ${eur(b.setupHT)} d'installation, puis ${eur(b.monthlyHT)}/mois`,
      `  ${b.what}`,
      ...(b.passThrough ? [`  À votre charge : ${b.passThrough}`] : [])
    );
  }
  lines.push(
    "",
    `TOTAL INSTALLATION : ${eur(q.setupHT)}`,
    `ABONNEMENT : ${eur(q.monthlyHT)}/mois`,
    `Première année : ${eur(q.firstYearHT)}`,
    ""
  );
  if (q.recommendPack) {
    lines.push(
      "OPTION — PACK COMPLET",
      `${eur(q.packSetupHT)} d'installation, ${eur(q.packMonthlyHT)}/mois : toutes les briques, sans exception.`,
      q.recommendation,
      ""
    );
  }
  lines.push(
    "CE QUE NOUS FAISONS",
    "• Installation et paramétrage complets — vous n'avez rien de technique à faire.",
    "• Formation de vos équipes à la prise en main.",
    "• Un interlocuteur unique, joignable, du début à la fin.",
    "",
    "VOS DROITS",
    "• Aucun engagement de durée sur l'abonnement : vous arrêtez quand vous voulez.",
    "• Vos données et vos accès restent les vôtres.",
    "• Si une brique ne vous sert pas, on vous le dit et on la retire.",
    "",
    "Bon pour accord — date, nom, signature :"
  );
  return lines.join("\n");
}
