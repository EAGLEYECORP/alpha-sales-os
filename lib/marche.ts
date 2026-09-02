/**
 * ─────────────────────────────────────────────────────────────────────
 * RELEVÉ DE MARCHÉ — ce que les autres font payer, et à quel point on le sait.
 *
 * La règle « un peu moins que le marché » était incalculable : aucun relevé
 * n'existait dans ce dépôt. Voici le premier.
 *
 * ⚠⚠ NIVEAU DE PREUVE — la même discipline que `lib/references.ts`.
 *
 * Ces chiffres viennent d'articles de COMPARAISON (blogs spécialisés,
 * comparateurs), pas des pages de tarifs officielles des éditeurs. C'est une
 * source SECONDAIRE : elle date, elle simplifie, et elle se trompe parfois sur
 * les paliers. Chaque ligne porte donc sa fiabilité, et rien ici ne doit finir
 * dans un devis sans être revérifié à la source le jour même.
 *
 * Ce que ce relevé permet malgré tout : savoir de quel ORDRE DE GRANDEUR on
 * est loin. Et sur ce point, il est sans ambiguïté.
 *
 * Relevé le 26 août 2026.
 * ─────────────────────────────────────────────────────────────────────
 */

/** D'où vient le chiffre — ça change ce qu'on a le droit d'en faire. */
export type FiabilitePrix =
  /** Page de tarifs de l'éditeur, lue directement. */
  | "source-primaire"
  /** Article de comparaison ou comparateur. Date et simplifie. */
  | "secondaire"
  /** Fourchette agrégée sur plusieurs articles. Ordre de grandeur seulement. */
  | "fourchette";

export interface RelevePrix {
  id: string;
  /** Le concurrent ou la catégorie. */
  acteur: string;
  /** Ce qui est comparé : la même chose que nous, ou pas tout à fait. */
  quoi: string;
  /** Prix bas et haut observés, en euros HT par mois (ou par unité indiquée). */
  basEur: number;
  hautEur: number;
  unite: string;
  fiabilite: FiabilitePrix;
  source: string;
  releveLe: string;
  /** Ce que la comparaison ne dit PAS — c'est souvent l'essentiel. */
  reserve: string;
}

export const RELEVE_LE = "2026-08-26";

/**
 * ── PLATEFORMES D'AGENT VOCAL (développeur, à la minute) ──
 *
 * ⚠ Ce sont des prix de VENTE de plateformes, pas des coûts de revient. Vapi
 * et Retell sont « BYOK » : le client apporte ses propres clés et paie EN PLUS
 * la téléphonie, le STT, le LLM et la TTS. C'est pour ça que le tarif affiché
 * (0,05 $/min) et le coût réel (0,14–0,15 $/min) n'ont rien à voir.
 */
export const MARCHE_VOIX: RelevePrix[] = [
  {
    id: "vapi",
    acteur: "Vapi",
    quoi: "Plateforme d'agent vocal, tarif plateforme seul (BYOK)",
    basEur: 0.046,
    hautEur: 0.046,
    unite: "€/min de conversation",
    fiabilite: "secondaire",
    source: "medium.com/@automation.labs — comparatif Vapi/Retell/Bland 2026",
    releveLe: RELEVE_LE,
    reserve: "0,05 $/min affichés. La téléphonie, le STT, le LLM et la TTS sont EN PLUS et à la charge du client.",
  },
  {
    id: "byok-tout-compris",
    acteur: "Vapi / Retell, tout compris",
    quoi: "Ce que le client paie RÉELLEMENT une fois tout branché",
    basEur: 0.129,
    hautEur: 0.304,
    unite: "€/min de conversation",
    fiabilite: "secondaire",
    source: "medium.com/@automation.labs — 0,14–0,33 $/min selon les fournisseurs choisis",
    releveLe: RELEVE_LE,
    reserve:
      "Le client construit tout lui-même : script, intégration CRM, conformité, numéros, sourcing. " +
      "C'est une API, pas un service — la comparaison de prix est donc trompeuse à notre avantage ET à notre désavantage.",
  },
  {
    id: "bland",
    acteur: "Bland",
    quoi: "Plateforme tout-inclus (pas de BYOK)",
    basEur: 0.101,
    hautEur: 0.129,
    unite: "€/min de conversation",
    fiabilite: "secondaire",
    source: "medium.com/@automation.labs — 0,11–0,14 $/min",
    releveLe: RELEVE_LE,
    reserve: "Le comparable le plus proche de notre modèle : tout inclus, facturé à la minute.",
  },
  {
    id: "marche-global-voix",
    acteur: "Marché des agents vocaux",
    quoi: "Fourchette all-in, toutes plateformes",
    basEur: 0.11,
    hautEur: 0.414,
    unite: "€/min de conversation",
    fiabilite: "fourchette",
    source: "yesworkflow.com, klariqo.com, callsphere.ai — 0,12 à 0,45 $/min all-in",
    releveLe: RELEVE_LE,
    reserve: "Agrégé sur plusieurs articles. Ordre de grandeur, pas un tarif opposable.",
  },
];

/**
 * ── SOLUTIONS FRANÇAISES CLÉS EN MAIN ──
 *
 * C'est le VRAI comparable de notre offre : un service, pas une API. Un
 * prospect lyonnais ne compare pas Alpha Voice à Vapi — il le compare à son
 * télésecrétariat actuel et aux offres françaises d'accueil IA.
 */
export const MARCHE_FRANCE: RelevePrix[] = [
  {
    id: "agent-vocal-fr-basique",
    acteur: "Assistant vocal IA (France)",
    quoi: "Offre d'entrée, accueil simple",
    basEur: 29,
    hautEur: 99,
    unite: "€/mois",
    fiabilite: "secondaire",
    source: "nerolia-ai.fr — guide agent vocal IA 2026",
    releveLe: RELEVE_LE,
    reserve: "Accueil basique. Ne fait pas de sortant, pas de CRM, pas de campagne.",
  },
  {
    id: "secretaire-ia-fr",
    acteur: "Secrétaire téléphonique IA (France)",
    quoi: "Accueil IA complet",
    basEur: 200,
    hautEur: 300,
    unite: "€/mois",
    fiabilite: "secondaire",
    source: "nerolia-ai.fr — « à partir de 200 €/mois », offres complètes PBX/SIP/RGPD « dès 300 €/mois »",
    releveLe: RELEVE_LE,
    reserve: "Entrant surtout. Notre offre fait entrant ET sortant, ce qui n'est pas le même produit.",
  },
  {
    id: "telesecretariat-humain",
    acteur: "Télésecrétariat externalisé (humain)",
    quoi: "Permanence téléphonique, opérateurs humains",
    basEur: 80,
    hautEur: 400,
    unite: "€/mois",
    fiabilite: "secondaire",
    source: "agaphone.com, locklead.fr, appels-manques.fr — 80–300 € affichés, 200–400 € en facture réelle",
    releveLe: RELEVE_LE,
    reserve:
      "+30 à +50 % le soir et le week-end. C'est le concurrent RÉEL de la marche Alpha Voice, " +
      "et c'est à lui qu'un artisan compare — pas à une plateforme américaine.",
  },
  {
    id: "mise-en-service-fr",
    acteur: "Télésecrétariat — frais de mise en service",
    quoi: "Ce que le marché facture pour démarrer",
    basEur: 100,
    hautEur: 300,
    unite: "€ une fois",
    fiabilite: "secondaire",
    source: "locklead.fr, agaphone.com",
    releveLe: RELEVE_LE,
    reserve: "C'est le comparable direct de notre palier d'essai.",
  },
];

/** ── CRM ET OUTREACH — le comparable des briques logicielles ── */
export const MARCHE_LOGICIEL: RelevePrix[] = [
  {
    id: "pipedrive",
    acteur: "Pipedrive",
    quoi: "CRM commercial",
    basEur: 14,
    hautEur: 79,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "comparatifs CRM PME France 2026",
    releveLe: RELEVE_LE,
    reserve: "Par utilisateur. Pour un solo, c'est le prix d'une seule licence.",
  },
  {
    id: "axonaut",
    acteur: "Axonaut",
    quoi: "CRM + facturation + compta, FORFAIT (pas par utilisateur)",
    basEur: 50,
    hautEur: 100,
    unite: "€/mois pour 1 à 20 personnes",
    fiabilite: "secondaire",
    source: "comparateur-efacturation.fr, mondevisfacile.fr",
    releveLe: RELEVE_LE,
    reserve: "Le comparable le plus dur pour nous : forfait, français, et il fait la facturation en plus.",
  },
  {
    id: "sellsy",
    acteur: "Sellsy",
    quoi: "CRM commercial français",
    basEur: 29,
    hautEur: 39,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "comparatifs CRM PME France 2026",
    releveLe: RELEVE_LE,
    reserve: "",
  },
  {
    id: "apollo",
    acteur: "Apollo.io",
    quoi: "Base de contacts + séquences outbound",
    basEur: 45,
    hautEur: 137,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "hackingdemand.com, enginy.ai — 49 à 119 $ en annuel, 65 à 149 $ en mensuel",
    releveLe: RELEVE_LE,
    reserve: "Inclut une base de données de contacts que nous n'avons pas.",
  },
  {
    id: "lemlist",
    acteur: "Lemlist",
    quoi: "Séquences email + LinkedIn",
    basEur: 54,
    hautEur: 146,
    unite: "€/siège/mois",
    fiabilite: "secondaire",
    source: "astragtm.io, emelia.io — 59 à 159 $/siège",
    releveLe: RELEVE_LE,
    reserve: "Le comparable direct de notre brique « Campagnes ».",
  },
];

/** ── FRAIS D'INSTALLATION — le comparable du pack et du setup client ── */
export const MARCHE_SETUP: RelevePrix[] = [
  {
    id: "setup-typique",
    acteur: "Agences d'automatisation IA",
    quoi: "Frais d'installation courants",
    basEur: 1_840,
    hautEur: 11_040,
    unite: "€ une fois",
    fiabilite: "fourchette",
    source: "taskip.net, digitalapplied.com — 2 000 à 12 000 $ selon le périmètre",
    releveLe: RELEVE_LE,
    reserve: "Périmètres très variables. C'est la fourchette la plus large du relevé.",
  },
  {
    id: "setup-integre",
    acteur: "Implémentation sur mesure",
    quoi: "Installation branchée au CRM, à la téléphonie et aux règles métier",
    basEur: 4_600,
    hautEur: 23_000,
    unite: "€ une fois",
    fiabilite: "fourchette",
    source: "technovapartners.com, ssntpl.com — 5 000 à 25 000 $+",
    releveLe: RELEVE_LE,
    reserve:
      "C'est EXACTEMENT notre périmètre de pack complet : CRM + téléphonie + conformité. " +
      "La fourchette basse suppose peu d'intégrations.",
  },
  {
    id: "licence-agence",
    acteur: "Modèle « licence d'agent »",
    quoi: "Setup élevé + abonnement de maintenance",
    basEur: 18_400,
    hautEur: 18_400,
    unite: "€ setup, puis ~1 840 €/mois",
    fiabilite: "secondaire",
    source: "digitalapplied.com — 20 000 $ de setup + 2 000 $/mois",
    releveLe: RELEVE_LE,
    reserve: "Positionnement haut de gamme. Montre qu'un setup à cinq chiffres existe et se vend.",
  },
];

export const TOUS_RELEVES: RelevePrix[] = [
  ...MARCHE_VOIX,
  ...MARCHE_FRANCE,
  ...MARCHE_LOGICIEL,
  ...MARCHE_SETUP,
];

export type Position = "sous-marche" | "dans-marche" | "au-dessus" | "hors-marche";

export interface Comparaison {
  notreOffre: string;
  notrePrix: number;
  unite: string;
  reference: RelevePrix;
  /** Combien de fois le haut de la fourchette marché notre prix représente. */
  ratioHaut: number;
  position: Position;
  phrase: string;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Où se situe un de nos prix face à un relevé.
 *
 * ⚠ « Hors marché » n'est pas une condamnation : un produit qui fait autre
 * chose a le droit de coûter autre chose. C'est un signal qu'il faudra
 * JUSTIFIER la différence en rendez-vous, pas la subir.
 */
export function comparer(notreOffre: string, notrePrix: number, reference: RelevePrix): Comparaison {
  const ratioHaut = reference.hautEur > 0 ? arrondi(notrePrix / reference.hautEur) : 0;

  let position: Position;
  if (notrePrix < reference.basEur) position = "sous-marche";
  else if (notrePrix <= reference.hautEur) position = "dans-marche";
  else if (ratioHaut <= 2) position = "au-dessus";
  else position = "hors-marche";

  const fourchette = `${reference.basEur}–${reference.hautEur} ${reference.unite}`;
  const phrase =
    position === "dans-marche"
      ? `${notreOffre} à ${notrePrix} : DANS la fourchette de ${reference.acteur} (${fourchette}).`
      : position === "sous-marche"
        ? `${notreOffre} à ${notrePrix} : SOUS ${reference.acteur} (${fourchette}). De la place pour monter — ou un signal qu'on se sous-vend.`
        : position === "au-dessus"
          ? `${notreOffre} à ${notrePrix} : au-dessus de ${reference.acteur} (${fourchette}), ×${ratioHaut} le haut de fourchette. Défendable, mais il faut savoir pourquoi.`
          : `${notreOffre} à ${notrePrix} : ×${ratioHaut} le haut de fourchette de ${reference.acteur} (${fourchette}). ` +
            `À ce niveau, l'écart ne se justifie plus par le confort : il faut un argument que le prospect achète, ou baisser.`;

  return { notreOffre, notrePrix, unite: reference.unite, reference, ratioHaut, position, phrase };
}

/**
 * La règle « un peu moins que le marché », rendue calculable.
 *
 * `sous` = de combien on veut être sous le haut de la fourchette. 10 % par
 * défaut : assez pour que ça se voie sur une page de tarifs, pas assez pour
 * qu'on ait l'air d'un discounter.
 */
export function prixConseille(reference: RelevePrix, sous = 0.1): number {
  return Math.round(reference.hautEur * (1 - sous));
}

/** Ce qu'un relevé secondaire ne permet PAS de faire. */
export const RESERVE_GLOBALE =
  "Relevé du 26 août 2026, sources SECONDAIRES (articles de comparaison), pas les pages de tarifs des éditeurs. " +
  "Ça donne l'ordre de grandeur, pas un tarif opposable : avant de citer un concurrent en rendez-vous, " +
  "rouvre sa page de tarifs le jour même.";
