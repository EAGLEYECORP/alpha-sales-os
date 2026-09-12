
/**
 * ─────────────────────────────────────────────────────────────────────
 * PRIX À LA CARTE — chaque brique d'Alpha Sales OS a son prix.
 *
 * Deux raisons d'exister :
 *   1. Un client peut n'avoir besoin QUE d'une brique (un revendeur veut Alpha
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
// Les prix PUBLICS viennent de `lib/offres-publiques.ts` : c'est le module
// que le navigateur a le droit d'atteindre, donc c'est lui qui les porte.
// Les réimporter garantit qu'il n'existe qu'un seul nombre.
export { OUTBOUND_UNIT_CALLS, OUTBOUND_UNIT_HT, PACK_SETUP_HT, PACK_MONTHLY_HT } from "./offres-publiques";
import { ALPHA_VOICE_SETUP_HT, OUTBOUND_SETUP_HT, OUTBOUND_UNIT_CALLS, OUTBOUND_UNIT_HT, PACK_SETUP_HT, PACK_MONTHLY_HT } from "./offres-publiques";

export interface OutboundTier {
  calls: number;
  monthlyHT: number;
  /** Prix ramené au millier d'appels — ce qui rend la remise lisible. */
  perThousandHT: number;
  note?: string;
}

export const OUTBOUND_TIERS: OutboundTier[] = [
  { calls: OUTBOUND_UNIT_CALLS, monthlyHT: OUTBOUND_UNIT_HT, perThousandHT: OUTBOUND_UNIT_HT, note: "Le palier d'entrée : on prouve que ça convertit." },
  { calls: 2 * OUTBOUND_UNIT_CALLS, monthlyHT: 2 * OUTBOUND_UNIT_HT, perThousandHT: OUTBOUND_UNIT_HT },
  { calls: 3 * OUTBOUND_UNIT_CALLS, monthlyHT: 3 * OUTBOUND_UNIT_HT, perThousandHT: OUTBOUND_UNIT_HT },
  {
    calls: 4 * OUTBOUND_UNIT_CALLS,
    // « Le 4e millier est offert » n'est pas une remise ronde qu'on choisit :
    // c'est le prix de TROIS milliers. L'écrire ainsi rend la promesse
    // vérifiable d'un coup d'œil, et empêche 1 092 € de survivre au jour où
    // l'unité change.
    monthlyHT: 3 * OUTBOUND_UNIT_HT,
    perThousandHT: Math.round((3 * OUTBOUND_UNIT_HT) / 4),
    note: "Palier de montée en charge : le 4e millier est offert. À ouvrir SEULEMENT une fois le ciblage et la conversation réglés.",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE PALIER D'ESSAI A ÉTÉ RETIRÉ LE 04/09/2026 — et il faut dire pourquoi,
 * parce que le trou qu'il bouchait était réel.
 *
 * Ce qu'il était : 290 € HT pour la mise en route d'Alpha Voice + 100 appels
 * réels, déductibles du premier mois. Il existait parce que la grille sautait
 * de RIEN à 364 €/millier : 100 appels se facturaient au millier entamé, soit
 * le prix d'un mois entier pour un test. Personne ne dit oui à ça après une
 * démo, et le palier était la bonne réponse à ce moment-là.
 *
 * DEUX CHOSES ONT CHANGÉ, et chacune suffirait :
 *
 *  1. **Le trou est comblé par un vrai produit.** Alpha Voice Essentiel —
 *     200 appels, 149 €/mois — EST le produit sous le millier. On n'a plus
 *     besoin d'une marche jetable pour franchir un escalier qui a désormais
 *     une première marche.
 *
 *  2. **La garantie fait le travail, et mieux.** « L'installation ne se paie
 *     qu'au premier rendez-vous pris » renverse le risque SANS encaisser
 *     d'avance. À côté d'elle, un palier à 290 € vend une seconde fois, moins
 *     cher, ce que l'installation Alpha Voice vend déjà — deux prix pour la même
 *     chose sur le même devis, et c'est le client qui a raison de le relever.
 *
 * ⚠ `prixEssai()` était un EXPORT MORT : aucun composant, aucune route ne
 * l'appelait — seuls ses tests le tenaient en vie. C'est le défaut récurrent
 * du dépôt (un mécanisme juste branché nulle part), et il a rendu ce retrait
 * indolore. Ne pas le relire comme une preuve que le retrait était sans
 * conséquence : c'est une preuve qu'il n'était déjà plus vendu.
 * ─────────────────────────────────────────────────────────────────────
 */

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
    note:
      c < OUTBOUND_UNIT_CALLS
        ? // Sous le millier, CETTE grille est le mauvais produit : elle
          // facture un millier entamé pour un volume qui tient dans un
          // forfait. On renvoie vers le palier qui existe, au lieu de
          // facturer 364 € un test — c'est ce prix-là qui tuait les débuts.
          `Sous ${OUTBOUND_UNIT_CALLS} appels, cette grille n'est pas le bon produit : prends le palier Alpha Voice Essentiel (${ALPHA_VOICE_SETUP_HT} € HT d'installation, puis 149 €/mois pour ~200 appels).`
        : c % OUTBOUND_UNIT_CALLS !== 0
          ? `Facturé au millier entamé (${thousands} × ${OUTBOUND_UNIT_HT} € HT).`
          : undefined,
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
    setupHT: OUTBOUND_SETUP_HT,
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
    /**
     * ⚠⚠ 140 € → 120 €/mois. ELLE BAISSE, ET C'EST LA LIGNE QUI PROUVE QUE LE
     * RELEVÉ N'A PAS ÉTÉ FAIT POUR JUSTIFIER UNE HAUSSE.
     *
     * C'est la seule brique du catalogue qui sortait AU-DESSUS de sa bande :
     * la chauffe et la délivrabilité se facturent à la BOÎTE (MailReach 19,50
     * à 25 $, lemwarm 24 à 29 $), soit 90 à 133 € pour cinq boîtes. Nous
     * étions à 140 €, donc dehors — sur la brique la plus facile à comparer
     * qui soit, puisque le client peut ouvrir les deux pages côte à côte.
     *
     * 120 € nous remet dans la bande haute. Un prix hors bande sur un produit
     * trivialement comparable ne coûte pas une objection : il coûte la
     * crédibilité de TOUTE la grille, y compris des lignes qui sont justes.
     */
    monthlyHT: 120,
    why: "Un email en spam est un deal perdu sans jamais le savoir. Cette brique rend visible ce qui, sinon, disparaît en silence.",
    unlocks: ["/tracking", "/deliverability"],
  },
  {
    id: "alpha-live",
    label: "Alpha Live",
    what:
      "Le souffleur en direct PENDANT le rendez-vous : il écoute, reconnaît l'objection au moment où elle sort, " +
      "et affiche la réponse et la preuve sur ton écran — sans que l'interlocuteur voie quoi que ce soit.",
    setupHT: 1800,
    monthlyHT: 180,
    why:
      "C'est la seule brique qui agit PENDANT la vente, pas avant ni après. Une objection mal traitée coûte le deal " +
      "entier, et personne ne s'en souvient assez précisément le soir pour la corriger. Là, la réponse arrive dans la " +
      "seconde — et un commercial junior tient une conversation de senior dès sa première semaine.",
    unlocks: ["/closer", "/overlay"],
    /**
     * ⚠ LE `passThrough` ANNONÇAIT « minutes de transcription facturées au
     * réel », ET RIEN NE LES FACTURE. L'écoute se fait par le moteur du
     * navigateur (`window.SpeechRecognition`) : le composant n'appelle aucune
     * de nos API. Annoncer un coût variable qui n'arrive jamais n'est pas une
     * prudence — c'est un motif de refus qu'on se donne à soi-même, sur la
     * seule ligne du devis que le client relit deux fois.
     *
     * ⚠ Le PRIX d'installation, lui, reste : il paie une demi-journée de
     * paramétrage réelle. Rien à voir avec le socle gratuit de notre SaaS —
     * `crm`, `closer`, `cerveau` et `pilotage` y sont gratuits ET tarifés ici
     * depuis toujours, parce que ce catalogue-ci vend une INSTALLATION.
     */
  },
  {
    id: "closer",
    label: "Closer OS & débrief",
    what: "La préparation avant le rendez-vous et le débrief après : tournée, objectif d'étape, ce qui a marché, ce qui a coûté.",
    setupHT: 1500,
    /**
     * ⚠ 140 € → 190 €/mois. Nous étions à 2 € au-dessus du plancher observé
     * (138 €, soit Sybill Pro à 5 sièges) : au plancher, donc.
     * 190 € = Ringover Empower (39 €/siège) × 5 — le comparable français le
     * plus proche de ce que fait le Closer OS. Le haut de bande est à ~495 €.
     *
     * ⚠ Conviction plus faible que sur l'Agent : ici on se déplace du plancher
     * vers le bas de la bande, pas d'un hors-jeu vers le terrain. Si un seul
     * de ces deux prix doit être remis en cause, c'est celui-ci.
     */
    monthlyHT: 190,
    why:
      "Le closing se joue sur trois phrases. Les préparer avant et les corriger après est ce qui les rend " +
      "reproductibles — sinon chaque rendez-vous repart de l'intuition du jour.",
    unlocks: ["/closer", "/debrief"],
  },
  {
    id: "agent-alpha",
    label: "Agent ALPHA",
    what: "Le copilote conversationnel qui voit tout le pipeline : il prépare la journée, analyse un deal, écrit le message, et dit quoi faire ensuite.",
    setupHT: 2200,
    /**
     * ⚠⚠ 220 € → 490 €/mois LE 12/09/2026, ET C'EST LE PLUS GROS ÉCART DU
     * CATALOGUE. Relevé, pas deviné (`lib/marche.ts` → `MARCHE_AGENT`).
     *
     * Cette brique joue dans la catégorie « AI SDR », et cette catégorie
     * facture PAR COMPTE — donc la comparaison est directe, sans hypothèse de
     * sièges. Fourchette observée : 250 à 2 500 $/mois. Le concurrent le moins
     * cher qui publie vraiment ses prix (Regie.ai) impose 10 sièges à 180 $,
     * soit ~1 650 €/mois plancher. 11x se négocie autour de 5 000 $/mois.
     *
     * À 220 €, nous étions SOUS le plancher de la catégorie entière. Le
     * problème n'est pas la marge perdue, il est pire : un prix huit fois
     * sous le moins cher ne se lit pas « bonne affaire », il se lit « ce
     * n'est pas le même produit ». On se disqualifiait à l'affichage.
     *
     * 490 € est une DÉCISION : le tiers bas de la fourchette, toujours de
     * très loin le moins cher, sans être une aberration. Aucune vente ne l'a
     * validé — le premier client qui refuse en disant pourquoi vaudra plus
     * que ce raisonnement.
     */
    monthlyHT: 490,
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

/**
 * ⚠ LE PACK ÉTAIT DÉCLARÉ ICI UNE SECONDE FOIS — les deux plus gros nombres
 * du catalogue (10 000 € et 1 000 €/mois, l'ANCRE de toute négociation).
 *
 * L'en-tête de `offres-publiques` promettait déjà « bricks le réimporte », et
 * le test qui l'exige ne couvrait que `OUTBOUND_UNIT_HT` et le palier d'essai : la
 * garde s'arrêtait juste avant l'endroit où le doublon vivait encore. Les
 * valeurs coïncidaient, donc rien ne se voyait — `tests/marche.test.ts` lit la
 * version `offres-publiques`, tout le reste du produit lit celle-ci. Changer
 * l'ancre d'un côté aurait laissé l'autre annoncer l'ancien prix, sans échec.
 *
 * Ils sont maintenant réimportés (ligne 56). Rien à déclarer ici.
 */

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

// ── LA VUE PUBLIQUE VIT AILLEURS, ET C'EST VOULU ──────────────────────
//
// Il a existé ici un `publicBricks()` qui rendait le catalogue sans ses
// montants. C'était inutile : la fonction lisait `BRICKS`, donc la page
// publique qui l'importait embarquait le catalogue ENTIER dans son bundle —
// prix compris, lisibles en trois secondes de devtools. Retirer une donnée
// de l'affichage ne la retire pas du navigateur.
//
// La vue publique est donc un MODULE SÉPARÉ, sans aucun import d'ici :
// `lib/public-catalogue.ts`. La cohérence entre les deux est garantie par
// `tests/vitrine-fuite.test.ts`, qui tourne côté serveur et peut charger les
// deux sans rien exposer.
