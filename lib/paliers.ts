/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PALIERS — 0 → 100 k → 1 M → 3,5 M → 10 M, et ce qu'on fait CHAQUE JOUR.
 *
 * Deux vérités qui gouvernent ce module :
 *
 * 1. À chaque palier, UNE SEULE chose bloque. Travailler autre chose que la
 *    contrainte du moment, c'est s'agiter. Le blueprint ne liste donc pas
 *    « tout ce qu'il faut faire » : il nomme le goulot, et la porte de sortie
 *    mesurable qui fait passer au palier suivant.
 *
 * 2. ⚠ DOUBLER LA VALEUR CHAQUE JOUR EST ARITHMÉTIQUEMENT IMPOSSIBLE.
 *    2^30 = 1 073 741 824. Partir de 1 € et doubler quotidiennement donnerait
 *    un milliard en un mois. Aucune entreprise n'a jamais fait ça, et vendre
 *    l'idée à quelqu'un le fait abandonner au jour 6 quand la courbe casse.
 *
 *    Ce qui EST gagnable, et qui mène réellement à 10 M :
 *      · +1 %/jour composé  = ×37,8 sur un an
 *      · +2 %/jour composé  = ×1 377 sur un an
 *    Le « doublement » se joue sur le LEVIER, pas sur le chiffre d'affaires :
 *    on double le rendement d'une même heure de travail (un audit qui part
 *    tout seul, un script qui convertit deux fois mieux, un prescripteur qui
 *    vend à notre place). C'est ça, la barre à tenir tous les jours.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Gate {
  /** Ce qui prouve, chiffres en main, que le palier est franchi. */
  label: string;
  /** Comment on le mesure — jamais « au feeling ». */
  measure: string;
}

export interface Palier {
  id: string;
  /** Bornes de CA cumulé encaissé (€). */
  fromEur: number;
  toEur: number;
  name: string;
  /** LA contrainte unique de ce palier. */
  constraint: string;
  /** Pourquoi c'est elle, et pas autre chose. */
  why: string;
  /** Ce qu'on fait — court, ordonné, chaque ligne est actionnable. */
  checklist: string[];
  /** Ce qu'on NE fait PAS à ce palier (le piège classique). */
  dontYet: string[];
  /** Les portes de sortie mesurables. */
  gates: Gate[];
  /** Les actions du jour, à ce palier. */
  daily: string[];
}

export const PALIERS: Palier[] = [
  {
    id: "p0",
    fromEur: 0,
    toEur: 100_000,
    name: "0 → 100 k€ — Prouver qu'on sait vendre",
    constraint: "Trouver des clients qui PAIENT, à la main.",
    why:
      "À ce stade il n'y a rien à optimiser : il n'y a pas encore de machine, il y a toi. " +
      "Le seul risque mortel est d'automatiser une vente qu'on ne sait pas encore faire soi-même. " +
      "Dix clients payants valent mille inscrits.",
    checklist: [
      "Une offre écrite, avec un prix affiché, qu'on peut envoyer en une page",
      "10 clients payants — pas des tests, pas des gratuits : des virements encaissés",
      "Un audit-cadeau qui fait décrocher (la pièce écrite qui ouvre la conversation)",
      "Le cadrage obligatoire systématisé : jamais de devis sans avoir regardé le cas",
      "Un canal d'acquisition qui marche, UN SEUL, répété jusqu'à l'écœurement",
      "Les 3 premiers témoignages clients, écrits et signés",
    ],
    dontYet: [
      "Recruter un commercial — tu ne sais pas encore lui dire quoi faire",
      "Refondre le produit — vends ce qui existe",
      "Ouvrir un deuxième canal avant que le premier soit rentable",
    ],
    gates: [
      { label: "10 clients payants", measure: "Paiements encaissés (statut « payé ») sur 10 fiches distinctes" },
      { label: "Un canal reproductible", measure: "≥ 30 % des clients viennent du même canal" },
      { label: "Marge saine", measure: "Coût d'acquisition < 25 % du panier moyen" },
    ],
    daily: [
      "20 nouveaux prospects qualifiés dans le pipe (ICP strict, pas du volume mou)",
      "5 audits envoyés — la pièce écrite, c'est ce qui fait monter le taux",
      "3 conversations réelles avec un décideur",
      "1 relance sur chaque prospect dont la fenêtre est ouverte aujourd'hui",
    ],
  },
  {
    id: "p1",
    fromEur: 100_000,
    toEur: 1_000_000,
    name: "100 k → 1 M€ — Rendre la vente reproductible",
    constraint: "Sortir la vente de ta tête pour la mettre dans un système.",
    why:
      "Tu sais vendre, mais toi seul. Tant que le closing dépend de ta présence, le chiffre " +
      "plafonne à ton nombre d'heures. C'est ici que la machine prend le relais — et pas avant, " +
      "parce qu'on n'automatise bien que ce qu'on a déjà fait cent fois à la main.",
    checklist: [
      "Le script de vente écrit, testé, avec ses objections et leurs réponses",
      "Le deep-dive automatique à l'import : chaque fiche arrive auditée",
      "Les campagnes sortantes qui tournent seules dans la fenêtre horaire",
      "Le master rappel qui dit quoi faire, pour qui, aujourd'hui",
      "Un closer formé, capable de tenir un rendez-vous sans toi",
      "Le suivi de livraison + le témoignage systématisé à la satisfaction maximale",
      "Les prescripteurs rémunérés : 10 personnes qui vendent à ta place",
    ],
    dontYet: [
      "Multiplier les offres — une offre qui marche vaut mieux que trois qui hésitent",
      "Attaquer un nouveau marché géographique avant de saturer le premier",
    ],
    gates: [
      { label: "Le closer signe sans toi", measure: "≥ 3 deals fermés par quelqu'un d'autre que le fondateur" },
      { label: "Machine autonome", measure: "≥ 50 % des rendez-vous obtenus sans intervention manuelle" },
      { label: "Récurrence installée", measure: "MRR ≥ 20 % du CA total" },
    ],
    daily: [
      "La file d'appels part en entier (plafond quotidien atteint, pas la moitié)",
      "Chaque prospect qui a répondu est repris par un humain dans l'heure",
      "1 amélioration mesurable du script, fondée sur une transcription réelle",
      "1 prescripteur contacté ou relancé",
    ],
  },
  {
    id: "p2",
    fromEur: 1_000_000,
    toEur: 3_500_000,
    name: "1 M → 3,5 M€ — Faire tenir la livraison",
    constraint: "Livrer sans se noyer : la qualité doit survivre au volume.",
    why:
      "À ce palier, ce n'est plus la vente qui bloque, c'est la LIVRAISON. Les entreprises qui " +
      "meurent ici ne meurent pas faute de clients : elles meurent d'en avoir trop mal servi. " +
      "Un client mécontent à 1 M€ coûte plus cher que dix prospects perdus à 100 k€.",
    checklist: [
      "Un processus de livraison documenté, exécutable par quelqu'un d'autre que toi",
      "Le suivi de satisfaction mesuré, pas supposé",
      "Le white-label opérationnel : d'autres vendent sous leur marque",
      "Les upsells structurés (brique par brique, avec le moment déclencheur)",
      "Une équipe : au moins un closer, un opérateur de livraison, un support",
      "La trésorerie pilotée : encaissements avant dépenses, jamais l'inverse",
    ],
    dontYet: ["Lever des fonds pour compenser un problème de livraison — ça l'aggrave"],
    gates: [
      { label: "Livraison sans le fondateur", measure: "≥ 80 % des livraisons faites sans ton intervention" },
      { label: "Rétention prouvée", measure: "Taux de résiliation mensuel < 3 %" },
      { label: "Satisfaction mesurée", measure: "Score moyen ≥ 80/100 sur les 20 dernières livraisons" },
    ],
    daily: [
      "Zéro livraison en retard — le tableau est vert ou on traite le rouge en premier",
      "1 client existant contacté pour un upsell ou un témoignage",
      "Les indicateurs de la veille lus avant toute action nouvelle",
    ],
  },
  {
    id: "p3",
    fromEur: 3_500_000,
    toEur: 10_000_000,
    name: "3,5 M → 10 M€ — Multiplier par les autres",
    constraint: "Faire croître sans que ta présence soit le facteur limitant.",
    why:
      "Tu ne peux plus être dans la boucle. La croissance vient désormais des revendeurs " +
      "white-label, des comptes du portefeuille et des marchés que d'autres ouvrent pour toi. " +
      "Ton travail devient : recruter, former, et retirer les obstacles.",
    checklist: [
      "Un portefeuille de comptes white-label actifs, chacun avec son propre pipe",
      "Un programme de partenaires avec sa grille de commission et son onboarding",
      "Les opportunités non-clients activées (subventions, labels, CII)",
      "Une direction commerciale qui n'est pas toi",
      "Des indicateurs consolidés par compte, lus chaque semaine",
      "La valeur vie client maximisée : upsells, renouvellements, quarterly",
    ],
    dontYet: ["Tout faire soi-même « parce que ça ira plus vite » — c'est le plafond de verre"],
    gates: [
      { label: "Croissance déléguée", measure: "≥ 50 % du CA généré par des comptes/partenaires, pas par toi" },
      { label: "Valeur d'actif", measure: "ARR × multiple sectoriel ≥ 10 M€" },
      { label: "Indépendance", measure: "L'entreprise tourne 30 jours sans toi, chiffres à l'appui" },
    ],
    daily: [
      "1 conversation avec un partenaire ou un compte du portefeuille",
      "Les blocages remontés par l'équipe sont levés le jour même",
      "1 décision prise sur un chiffre, pas sur une impression",
    ],
  },
];

/** Le palier courant d'après le CA cumulé encaissé. */
export function palierFor(cumulativeEur: number): Palier {
  return PALIERS.find((p) => cumulativeEur >= p.fromEur && cumulativeEur < p.toEur) ?? PALIERS[PALIERS.length - 1];
}

/** Progression dans le palier courant (0-100). */
export function palierProgress(cumulativeEur: number): number {
  const p = palierFor(cumulativeEur);
  const span = p.toEur - p.fromEur;
  return Math.max(0, Math.min(100, Math.round(((cumulativeEur - p.fromEur) / span) * 100)));
}

// ── LE MOTEUR QUOTIDIEN : le levier, pas le chiffre d'affaires ──

export interface LeverageInput {
  /** Heures réellement travaillées sur la vente aujourd'hui. */
  hours: number;
  /** Prospects touchés (appels + emails + visites). */
  touches: number;
  /** Conversations réelles avec un décideur. */
  conversations: number;
  /** Rendez-vous obtenus. */
  meetings: number;
  /** € encaissés aujourd'hui. */
  cashEur: number;
  /** Touches produites SANS intervention humaine (la machine). */
  automatedTouches: number;
}

export interface LeverageScore {
  /** Touches par heure — le rendement brut. */
  touchesPerHour: number;
  /** % des touches produites par la machine : c'est ÇA qu'on double. */
  automationPct: number;
  /** Conversations obtenues pour 100 touches. */
  contactRate: number;
  /** Rendez-vous obtenus pour 100 conversations. */
  meetingRate: number;
  /** € encaissés par heure travaillée. */
  eurPerHour: number;
  /** Score composite 0-100 — la barre du jour. */
  score: number;
  /** Ce qui limite le score aujourd'hui, en une phrase. */
  bottleneck: string;
}

export function leverageScore(i: LeverageInput): LeverageScore {
  const hours = Math.max(0.1, i.hours);
  const touchesPerHour = i.touches / hours;
  const automationPct = i.touches > 0 ? Math.round((i.automatedTouches / i.touches) * 100) : 0;
  const contactRate = i.touches > 0 ? Math.round((i.conversations / i.touches) * 100) : 0;
  const meetingRate = i.conversations > 0 ? Math.round((i.meetings / i.conversations) * 100) : 0;
  const eurPerHour = i.cashEur / hours;

  // Le score récompense le LEVIER (automatisation, taux) plus que le volume brut :
  // 200 appels manuels sans réponse valent moins que 50 appels ciblés qui décrochent.
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(25, touchesPerHour * 1.5) +
          Math.min(25, automationPct * 0.25) +
          Math.min(25, contactRate * 1.2) +
          Math.min(25, meetingRate * 0.8)
      )
    )
  );

  const bottleneck =
    automationPct < 40
      ? "Trop de travail manuel : la machine doit produire au moins 40 % des touches."
      : contactRate < 10
        ? "Le ciblage ou l'accroche ne prennent pas : moins de 10 % des touches deviennent une conversation."
        : meetingRate < 25
          ? "Les conversations ne se transforment pas en rendez-vous : c'est le script qu'il faut reprendre."
          : touchesPerHour < 10
            ? "Le volume est trop bas pour le temps investi — augmente la file."
            : "Rien ne bloque franchement : consolide et augmente le volume.";

  return { touchesPerHour, automationPct, contactRate, meetingRate, eurPerHour, score, bottleneck };
}

/**
 * Projection HONNÊTE : combien de jours pour atteindre un objectif à un
 * rythme de croissance quotidien donné.
 *
 * On expose la vérité arithmétique plutôt qu'un slogan : +1 %/jour mène
 * réellement à ×37,8 en un an. C'est déjà spectaculaire, et c'est tenable.
 */
export function daysToTarget(currentEur: number, targetEur: number, dailyGrowthPct: number): number | null {
  if (currentEur <= 0 || targetEur <= currentEur || dailyGrowthPct <= 0) return null;
  const r = 1 + dailyGrowthPct / 100;
  return Math.ceil(Math.log(targetEur / currentEur) / Math.log(r));
}

/** Le facteur de multiplication sur un an à ce rythme quotidien. */
export function yearlyMultiple(dailyGrowthPct: number): number {
  return Math.pow(1 + dailyGrowthPct / 100, 365);
}

/**
 * La vérité sur le « doublement quotidien », à afficher là où la promesse
 * serait tentante. On ne motive pas quelqu'un avec un chiffre faux.
 */
export const DOUBLING_TRUTH =
  "Doubler le chiffre d'affaires chaque jour est arithmétiquement impossible : 2^30 = 1,07 milliard. " +
  "Ce qui se double, c'est le LEVIER — le rendement d'une même heure de travail. " +
  "+1 %/jour composé donne ×37,8 en un an ; +2 %/jour donne ×1 377. C'est ça, la barre tenable.";
