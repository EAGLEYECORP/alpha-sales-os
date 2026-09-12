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
  /**
   * ⚠⚠ LE PRIX EST-IL PAR SIÈGE ? C'EST LE PIÈGE N°1 DE TOUT CE MODULE, et il
   * était invisible tant que personne ne rapprochait les briques du marché.
   *
   * Le SaaS de vente facture par UTILISATEUR. Notre catalogue facture par
   * COMPTE : la même somme fait face à un artisan seul et à une équipe de
   * vingt. Passer « 190 €/mois » et « 14–79 €/utilisateur » dans le même
   * `comparer()` rend « ×2,4 le haut de fourchette, HORS MARCHÉ » — une phrase
   * fausse, produite par un calcul juste sur deux grandeurs qui n'ont pas la
   * même unité.
   *
   * Le drapeau est optionnel et vaut `false` par défaut : un relevé au forfait
   * (Axonaut), à la minute ou à l'installation ne se multiplie pas.
   */
  parSiege?: boolean;
  /**
   * La brique du catalogue que ce relevé sert à SITUER. Optionnel : beaucoup
   * de relevés existent pour situer une OFFRE (voir `lib/positionnement.ts`),
   * pas une brique.
   */
  brickId?: string;
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
    reserve:
      "⚠⚠ DEUX ANCRAGES OPPOSÉS SUR LE MÊME CHIFFRE, ET C'EST L'ICP QUI TRANCHE — pas nous. " +
      "Face à CE relevé (100–300 €), notre installation à 1 490 € est ×5 au-dessus. Face au relevé " +
      "des agences d'automatisation (`setup-typique`, 1 840–11 040 €), elle est SOUS le plancher. " +
      "Les deux étaient déjà dans ce fichier, ils se contredisaient d'un facteur 15, et personne ne " +
      "les avait réconciliés : le setup vivait entre les deux sans raison écrite. " +
      "La réconciliation est que le comparable suit l'ACHETEUR. Un artisan compare à son " +
      "télésecrétariat — c'était le marché d'avant. Un maître d'ouvrage professionnel, notre cible " +
      "depuis le 09/09/2026, compare à une agence d'automatisation. L'ancrage applicable a changé " +
      "avec l'ICP, et le prix n'avait pas suivi. Ce relevé-ci reste vrai et cesse d'être le nôtre.",
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
    parSiege: true,
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
    parSiege: true,
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
    parSiege: true,
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
    parSiege: true,
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

/**
 * ─────────────────────────────────────────────────────────────────────
 * RELEVÉ DU 12/09/2026 — LES CATÉGORIES QUI MANQUAIENT.
 *
 * ⚠⚠ CE QUE LE RELEVÉ D'AOÛT NE COUVRAIT PAS, ET CE QUE ÇA COÛTAIT. Il tenait
 * la voix, le CRM, l'outreach et l'installation. Quatre briques du catalogue
 * n'avaient AUCUN comparable : l'Agent ALPHA, Alpha Live, le Closer OS et le
 * tracking. Leurs prix ne venaient donc d'aucune mesure (le ×4 ne mord pas sur
 * du logiciel), d'aucun relevé (il n'existait pas) et d'aucune vente (il n'y
 * en a aucune). Trois ancrages possibles, zéro utilisé — et le plus gros écart
 * du catalogue était là : l'Agent à 220 €/mois dans une catégorie qui commence
 * à 250 $.
 *
 * ⚠ MÊME NIVEAU DE PREUVE QU'EN AOÛT, ET PAS MEILLEUR. Le proxy sortant de
 * l'environnement autorise la RECHERCHE et refuse la RÉCUPÉRATION de page
 * (`EGRESS_BLOCKED`, vérifié sur deux domaines). Aucune page tarifaire
 * d'éditeur n'a été ouverte : tout est `secondaire` ou `fourchette`.
 * `source-primaire` reste vide dans tout ce fichier, et c'est la vérité.
 *
 * Conversion USD→EUR : 0,92, le même taux que `lib/voice-costs.ts`. Il est
 * RECOPIÉ ici et pas importé, délibérément : `voice-costs` porte nos marges et
 * `tests/vitrine-fuite.test.ts` le tient hors du bundle client, alors que ce
 * module-ci n'a aucune raison de devenir serveur. Un taux de change public
 * n'est pas un secret — mais la recopie est notée pour qu'on sache qu'elle
 * existe, et les montants sont écrits DÉJÀ CONVERTIS avec le montant d'origine
 * dans la source.
 * ─────────────────────────────────────────────────────────────────────
 */
export const RELEVE_SEPT = "2026-09-12";

/** ── AI SDR : la catégorie de l'Agent ALPHA. Facturée par COMPTE. ── */
export const MARCHE_AGENT: RelevePrix[] = [
  {
    id: "ai-sdr-categorie",
    acteur: "Catégorie « AI SDR »",
    quoi: "Agent autonome qui prospecte, écrit et relance seul",
    basEur: 230,
    hautEur: 2_300,
    unite: "€/mois par compte",
    fiabilite: "fourchette",
    source: "cleanlist.ai — index de prix AI SDR 2026 : 250 à 2 500 $/mois",
    releveLe: RELEVE_SEPT,
    brickId: "agent-alpha",
    reserve:
      "Une fourchette de catégorie dit où est le terrain de jeu, pas où viser. " +
      "L'amplitude ×10 vient de ce que la moitié de ces produits sont vendus sur devis.",
  },
  {
    id: "regie-ai",
    acteur: "Regie.ai",
    quoi: "Le seul du lot qui publie vraiment ses prix",
    basEur: 1_656,
    hautEur: 2_295,
    unite: "€/mois par compte, au minimum de sièges imposé",
    fiabilite: "secondaire",
    source: "altitudebiz.dev — 180 $/siège avec 10 sièges minimum, ou 499 $/siège avec 5 minimum",
    releveLe: RELEVE_SEPT,
    brickId: "agent-alpha",
    reserve:
      "Publié PAR SIÈGE : converti en prix de compte au minimum imposé, sinon la comparaison ment. " +
      "C'est le plancher réel d'entrée dans la catégorie, pas un prix d'appel.",
  },
  {
    id: "artisan-ai",
    acteur: "Artisan",
    quoi: "Agent SDR, sur devis",
    basEur: 258,
    hautEur: 4_600,
    unite: "€/mois par compte",
    fiabilite: "fourchette",
    source: "formanorden.com — 280 à 5 000 $/mois rapportés par des tiers",
    releveLe: RELEVE_SEPT,
    brickId: "agent-alpha",
    reserve: "Amplitude ×18 : personne ne connaît le vrai prix, l'éditeur ne publie rien.",
  },
];

/** ── COPILOTE D'APPEL ET DÉBRIEF : Alpha Live et le Closer OS. Par SIÈGE. ── */
export const MARCHE_COPILOTE: RelevePrix[] = [
  {
    id: "clari-copilot",
    acteur: "Clari Copilot (ex-Wingman)",
    quoi: "Cartes de réponse EN DIRECT pendant l'appel",
    basEur: 55,
    hautEur: 147,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "agenticsalescall.com — 60 à 160 $/utilisateur/mois en autonome",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "alpha-live",
    reserve: "Le seul du lot à souffler vraiment pendant l'appel, comme nous. Le comparable le plus juste d'Alpha Live.",
  },
  {
    id: "sybill",
    acteur: "Sybill",
    quoi: "Résumés d'appel, remplissage CRM, relances",
    basEur: 28,
    hautEur: 83,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "tldv.io — Pro 30 $, Business 90 $/utilisateur/mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "closer",
    reserve: "Travaille APRÈS l'appel, pas pendant. C'est le comparable du Closer OS, pas d'Alpha Live.",
  },
  {
    id: "ringover-empower",
    acteur: "Ringover Empower",
    quoi: "Analyse d'appels et coaching, français",
    basEur: 39,
    hautEur: 99,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "ringover.com/blog/modjo-vs-gong — 39 à 99 €/licence/mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "closer",
    reserve:
      "⚠ Chiffre publié par Ringover sur son propre produit : partie prenante. " +
      "C'est aussi le comparable FRANÇAIS le plus proche du Closer OS, donc celui qu'un prospect d'ici citera.",
  },
];

/** ── DÉLIVRABILITÉ : le tracking. Facturé à la BOÎTE, jamais au siège. ── */
export const MARCHE_DELIVRABILITE: RelevePrix[] = [
  {
    id: "mailreach",
    acteur: "MailReach",
    quoi: "Chauffe et score de délivrabilité",
    basEur: 18,
    hautEur: 23,
    unite: "€/boîte/mois",
    fiabilite: "secondaire",
    source: "coldemailkit.com — 19,50 à 25 $/boîte/mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "tracking",
    reserve: "19,50 $ n'est atteint qu'au-delà de 50 boîtes ; le prix courant est 25 $. « Par siège » vaut ici « par boîte ».",
  },
  {
    id: "lemwarm",
    acteur: "lemwarm",
    quoi: "Chauffe de boîte, autonome",
    basEur: 22,
    hautEur: 27,
    unite: "€/boîte/mois",
    fiabilite: "secondaire",
    source: "mailflowauthority.com — 24 $ en annuel, 29 $ au mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "tracking",
    reserve: "C'est la brique la plus facile à comparer du catalogue : le prospect ouvre les deux pages côte à côte.",
  },
];

/** ── AUDIT DE SITE : la brique Audits. Au COMPTE, comme nous. ── */
export const MARCHE_AUDIT: RelevePrix[] = [
  {
    id: "semrush",
    acteur: "Semrush",
    quoi: "Audit de site, mots-clés, position",
    basEur: 129,
    hautEur: 230,
    unite: "€/mois par compte",
    fiabilite: "secondaire",
    source: "finom.co — Pro 139,95 $, Guru 249,95 $/mois",
    releveLe: RELEVE_SEPT,
    brickId: "audits",
    reserve: "Périmètre bien plus large que le nôtre (backlinks, contenu). Nous auditons pour VENDRE, eux pour référencer.",
  },
  {
    id: "ahrefs",
    acteur: "Ahrefs",
    quoi: "Audit de site et backlinks",
    basEur: 108,
    hautEur: 208,
    unite: "€/mois par compte",
    fiabilite: "secondaire",
    source: "nugg.ad — Lite 108 €, Standard 208 €/mois",
    releveLe: RELEVE_SEPT,
    brickId: "audits",
    reserve:
      "Un abonnement Ahrefs s'utilise à la main, sur un site à la fois. Notre brique audite CHAQUE " +
      "prospect à l'import et rend un document prêt à envoyer : même prix, deux usages qui n'ont rien à voir.",
  },
];

/** ── ENABLEMENT : le comparable du Cerveau. Par SIÈGE. ── */
export const MARCHE_ENABLEMENT: RelevePrix[] = [
  {
    id: "guru",
    acteur: "Guru",
    quoi: "Base de connaissance d'équipe",
    basEur: 14,
    hautEur: 14,
    unite: "€/utilisateur/mois",
    fiabilite: "secondaire",
    source: "dock.us — 15 $/utilisateur/mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "cerveau",
    reserve: "Base de connaissance seule : ne réinjecte rien dans les messages, contrairement au Cerveau.",
  },
  {
    id: "seismic-highspot",
    acteur: "Seismic / Highspot",
    quoi: "Plateformes d'enablement, prix négociés",
    basEur: 28,
    hautEur: 74,
    unite: "€/utilisateur/mois",
    fiabilite: "fourchette",
    source: "whatisbest.com, b2bsalestools.com — 30 à 80 $/utilisateur/mois",
    releveLe: RELEVE_SEPT,
    parSiege: true,
    brickId: "cerveau",
    reserve: "Aucun des deux ne publie ses prix : fourchettes rapportées par des tiers sur des contrats négociés.",
  },
];

export const TOUS_RELEVES: RelevePrix[] = [
  ...MARCHE_VOIX,
  ...MARCHE_FRANCE,
  ...MARCHE_LOGICIEL,
  ...MARCHE_SETUP,
  ...MARCHE_AGENT,
  ...MARCHE_COPILOTE,
  ...MARCHE_DELIVRABILITE,
  ...MARCHE_AUDIT,
  ...MARCHE_ENABLEMENT,
];

/**
 * ⚠⚠ COMBIEN DE SIÈGES NOTRE PRIX PAR COMPTE COUVRE — UNE DÉCISION, PAS UNE
 * MESURE, et c'est le chiffre dont dépend la moitié des comparaisons.
 *
 * Notre catalogue ignore la notion de siège. Le marché de la vente facture par
 * siège presque partout. Pour rapprocher les deux il faut poser un nombre —
 * et ce nombre décide du verdict. À 5, un artisan seul paie cinq fois trop
 * cher et une équipe de vingt paie quatre fois trop peu.
 *
 * ⚠ LE RELEVÉ NE CORRIGE PAS CE DÉFAUT, IL LE REND VISIBLE. Tant que le
 * catalogue n'a pas de dimension « siège », la grille est juste pour une seule
 * taille d'équipe et fausse pour toutes les autres. C'est le vrai chantier de
 * tarification, et il est plus grand que n'importe quel montant écrit ici.
 *
 * 5 vient de nos propres segments (`lib/segments.ts` parle d'équipes de 3 à 50
 * commerciaux) et d'aucune vente — il n'y en a aucune.
 */
export const SIEGES_REFERENCE = 5;

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
 * ─────────────────────────────────────────────────────────────────────
 * COMPARER UN PRIX PAR COMPTE À UN RELEVÉ PAR SIÈGE.
 *
 * ⚠⚠ SANS CETTE FONCTION, `comparer()` MENT SUR LA MOITIÉ DU CATALOGUE — et il
 * ment avec une phrase parfaitement construite, ce qui est le pire cas.
 * Mesuré : notre CRM à 190 €/mois confronté au relevé Pipedrive (14–79
 * €/UTILISATEUR/mois) rend « ×2,4 le haut de fourchette, HORS MARCHÉ ». Le
 * calcul est juste, les deux nombres ne sont pas la même grandeur, et la
 * conclusion est fausse dans le sens qui coûte cher : elle pousse à BAISSER un
 * prix qui est en réalité au milieu de sa bande.
 *
 * On ramène donc le relevé par siège au prix d'un COMPTE, en le disant dans la
 * phrase — tout le résultat dépend de `SIEGES_REFERENCE`, qui est une décision.
 * ─────────────────────────────────────────────────────────────────────
 */
export function comparerParCompte(notreOffre: string, notrePrixCompte: number, reference: RelevePrix): Comparaison {
  if (!reference.parSiege) return comparer(notreOffre, notrePrixCompte, reference);

  const ramene: RelevePrix = {
    ...reference,
    basEur: Math.round(reference.basEur * SIEGES_REFERENCE),
    hautEur: Math.round(reference.hautEur * SIEGES_REFERENCE),
    unite: `€/mois pour ${SIEGES_REFERENCE} sièges`,
    reserve:
      `Relevé par siège, ramené à ${SIEGES_REFERENCE} sièges — une HYPOTHÈSE, pas une mesure : ` +
      `le verdict change entièrement avec la taille de l'équipe. ` + reference.reserve,
  };
  return comparer(notreOffre, notrePrixCompte, ramene);
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
