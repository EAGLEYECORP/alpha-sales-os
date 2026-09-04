
/**
 * ─────────────────────────────────────────────────────────────────────
 * LES OFFRES PUBLIQUES — la SEULE source de ce qu'on vend.
 *
 * ⚠ IL Y AVAIT TROIS GRILLES DE PRIX INCOMPATIBLES DANS LE PRODUIT.
 *
 *   · `site/index.html` .... Solo 79 € · Pro 149 € (« Alpha Voice inclus »)
 *   · `lib/stripe.ts` ...... solo 79 € · pro 149 €  ← le seul qui encaisse
 *   · `lib/bricks.ts` ...... Alpha Voice 364 €/mois pour 1 000 appels
 *
 * Le site vendait donc à 149 € ce que le catalogue facturait 364 €. Et
 * l'offre Pro annonçait « Alpha Voice inclus » SANS AUCUN PLAFOND D'APPELS.
 *
 * Ce que ça coûte, mesuré (`lib/voice-costs.ts`) :
 *
 *     1 000 appels →  ~96 €   il reste 53 € pour TOUT le reste du produit
 *     2 000 appels → ~135 €   il reste 14 €
 *     3 000 appels → ~174 €   PERTE SÈCHE
 *
 * Un seul client sérieux qui prend l'offre au mot fait perdre de l'argent.
 * C'est le défaut le plus grave du produit, et il est commercial, pas
 * technique : le code marchait parfaitement.
 *
 * ── LA RÈGLE QUI EN DÉCOULE, ET QUI EST TESTÉE ──
 *
 * TOUTE offre qui inclut la voix DOIT porter un plafond d'appels et dire ce
 * qui se passe au-delà. `validerOffres` refuse le contraire. Ce n'est pas une
 * précaution de style : c'est la seule chose qui empêche de remettre en ligne
 * une offre à perte.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠ LES PRIX PUBLICS VIVENT ICI, PAS DANS `lib/bricks.ts`. Le sens de la
 * dépendance n'est pas un détail de rangement.
 *
 * `bricks` et `voice-costs` sont des modules SERVEUR : ils portent le coût de
 * revient de chaque fournisseur et la marge de chaque brique. Un test de fuite
 * (`tests/vitrine-fuite.test.ts`) interdit qu'un composant client les atteigne
 * — et il a mordu quand ce fichier les importait : la grille de coûts serait
 * partie dans le bundle navigateur, lisible dans les devtools par n'importe
 * quel prospect.
 *
 * Ce qui est PUBLIC est donc déclaré ici, et `bricks` le réimporte. Un test
 * vérifie que les deux disent la même chose : la source unique reste unique,
 * elle a simplement changé de côté.
 */
export const ESSAI_CALLS = 100;
export const ESSAI_HT = 290;
export const OUTBOUND_UNIT_CALLS = 1000;
export const OUTBOUND_UNIT_HT = 364;
/**
 * Le setup du sortant.
 *
 * ⚠ Il manquait ici, et c'est ce qui a laissé une DEUXIÈME SOURCE vivre trois
 * mois. `OUTBOUND_UNIT_HT` était bien remonté, mais pas son setup : `bricks`
 * l'écrivait en dur, et `segments` le recopiait à la main dans une phrase de
 * vente (« 3 500 € installation + 364 €/mois »). Le premier des deux nombres
 * changeait, le second restait — et c'est celui qu'un prospect lit.
 *
 * Le module ne pouvait pas être dérivé de `bricks` : `bricks` est SERVEUR, il
 * porte tout le catalogue et nos marges, et `tests/vitrine-fuite` refuse
 * qu'il descende dans le navigateur. La correction n'était donc pas
 * « importer bricks » mais « faire remonter le prix PUBLIC ici », exactement
 * comme pour Alpha Voice. C'est fait.
 */
export const OUTBOUND_SETUP_HT = 3500;
export const PACK_SETUP_HT = 10_000;
export const PACK_MONTHLY_HT = 1_000;

/**
 * ── L'OFFRE BUSINESS — 10 000 € ÉTALÉS, PUIS L'ABONNEMENT ──
 *
 * Le pack existait déjà au même prix, payable d'un coup. Ce qui change n'est
 * pas le montant, c'est le MOMENT : 10 000 € à signer d'un trait est le
 * blocage qui fait dire « on en reparle au prochain trimestre ».
 *
 * ⚠ L'ACOMPTE COUVRE LE TRAVAIL DÉJÀ FAIT, ce n'est pas une marque de sérieux.
 * L'installation est livrée EN ENTIER, à la main, avant la première
 * mensualité. Un client qui s'arrête au quatrième mois laisse une demi-journée
 * de travail et un paramétrage en production contre une fraction du prix.
 * Descendre l'acompte, c'est augmenter cette exposition — et c'est la première
 * chose qu'on essaiera de négocier.
 *
 * ⚠ LES 500 € D'ÉCART SONT DITS, PAS CACHÉS. 2 500 + 10 × 800 = 10 500 €,
 * soit 5 % de plus que le paiement comptant. C'est le prix du risque
 * d'impayé que NOUS portons pendant dix mois, et il se dit comme ça. Un écart
 * qu'on découvre sur la facture coûte plus cher que l'écart lui-même.
 *
 * ⚠⚠ Ce sont des DÉCISIONS, pas des mesures : zéro client a signé ce plan.
 */
export const PACK_ACOMPTE_HT = 2_500;
export const PACK_MENSUALITES = 10;
export const PACK_MENSUALITE_HT = 800;

/**
 * ── LES LIFETIME DEALS ──
 *
 * Ce qu'un lifetime EST vraiment : on échange tout le revenu futur d'un client
 * contre de l'argent maintenant. À 0 € de chiffre d'affaires, c'est un
 * arbitrage défendable — la trésorerie d'aujourd'hui vaut plus que
 * l'abonnement de 2029. Mais c'est un arbitrage, pas une promotion.
 *
 * ⚠ CE QU'IL COUVRE, ET POURQUOI PAS PLUS. Le LOGICIEL est à vie : son coût
 * marginal est nul, l'hébergement est mutualisé (`margeOffre` le dit déjà pour
 * les offres sans appels). La CONSOMMATION ne l'est pas : chaque minute coûte
 * 0,0563 €, pour toujours. Un lifetime « tout compris » à 2 000 € avec 500
 * minutes par mois s'équilibre vers six ans et devient une perte ensuite —
 * sans plafond, et sans possibilité de revenir en arrière. D'où le crédit
 * BORNÉ : c'est exactement la règle que `validerOffres` impose déjà à toute
 * offre qui inclut la voix.
 *
 * ⚠ « BASÉ SUR LA DEMANDE » = LES PALIERS MONTENT QUAND ILS SE REMPLISSENT
 * RÉELLEMENT. La rareté est un FAIT ici — l'installation se fait à la main,
 * par une seule personne — jamais un compteur inventé. Un palier qui n'avance
 * pas quand il devrait se vérifie au coup de fil suivant, et le prix entier
 * perd sa crédibilité avec lui.
 *
 * ⚠⚠ LE PLAFOND À NE PAS OUBLIER : chaque lifetime vendu est un client qui ne
 * paiera plus jamais d'abonnement. À 1 900 €, l'abonnement Essentiel rapporte
 * la même somme en treize mois. En vendre beaucoup revient à plafonner son
 * propre revenu récurrent, définitivement. C'est pour ça qu'il y a un nombre
 * total, et pas seulement des paliers de prix.
 */
export interface PalierLifetime {
  /** Rang du palier, pour l'afficher (« les 10 premiers »). */
  rang: number;
  prixHT: number;
  /** Nombre de places à ce prix. */
  places: number;
}

export const LIFETIME_PALIERS: PalierLifetime[] = [
  { rang: 1, prixHT: 1_900, places: 10 },
  { rang: 2, prixHT: 2_900, places: 20 },
  { rang: 3, prixHT: 3_900, places: 30 },
];

/**
 * Le total, toutes places confondues. Au-delà, on ne vend plus de lifetime :
 * on vend de l'abonnement. Sans ce nombre, « basé sur la demande » veut dire
 * « jusqu'à ce qu'il n'y ait plus rien à vendre ».
 */
export const LIFETIME_PLACES_TOTAL = LIFETIME_PALIERS.reduce((n, p) => n + p.places, 0);

/** Le crédit d'appels compris dans un lifetime. Borné, comme toute offre voix. */
export const LIFETIME_APPELS_INCLUS = 1_200;

/**
 * Le palier en cours, d'après le nombre de lifetimes DÉJÀ VENDUS.
 *
 * ⚠ Rend `null` quand tout est vendu — et ce `null` est le message : il n'y a
 * plus de lifetime, il reste l'abonnement. Rendre le dernier palier « pour
 * dépanner » ferait mentir la rareté qu'on annonce.
 */
export function palierLifetime(vendus: number): PalierLifetime | null {
  let reste = Math.max(0, Math.floor(vendus));
  for (const p of LIFETIME_PALIERS) {
    if (reste < p.places) return p;
    reste -= p.places;
  }
  return null;
}

/**
 * ── TARIFS ALPHA VOICE — DÉCIDÉS LE 02/09/2026 ──
 *
 * La grille précédente (990 € + cinq paliers 59/115/169/219/319) était celle
 * de l'ancien revendeur. Elle n'a jamais été la nôtre. Voici ce qui la
 * remplace, et POURQUOI — parce qu'un prix sans raison se renégocie au
 * premier client qui pousse.
 *
 * ── 1. DEUX PALIERS AU LIEU DE CINQ ──
 *
 * Cinq paliers, c'est un MENU : l'artisan compare les paliers entre eux au
 * lieu de comparer au chiffre qu'il perd. On lui fait choisir un forfait
 * téléphonique alors qu'on doit lui faire choisir entre « je récupère ces
 * appels » et « je continue à les perdre ».
 *
 * ── 2. LE PLANCHER MONTE DE 59 € À 149 € ──
 *
 * Trois raisons, dans cet ordre :
 *  a) 59 €/mois NE COUVRAIT PAS le socle fixe (~57 €/mois de plateforme).
 *     Le premier palier était une perte déguisée en offre d'appel.
 *  b) Un prix aussi bas se lit comme un gadget par quelqu'un qui compare
 *     mentalement à une secrétaire. Trop bas ABÎME la probabilité perçue —
 *     c'est le deuxième terme de l'équation de valeur, pas un détail.
 *  c) La valeur récupérée se compte en MILLIERS d'euros par mois chez une
 *     cible type (8 appels manqués/semaine × 350 € de panier × 30 %). À
 *     149 €, on facture environ 5 % de ce qu'on lui fait récupérer.
 *
 * ── 3. LA MARGE, SUR NOTRE COÛT MESURÉ (0,0563 €/min) ──
 *
 *   Essentiel  500 min → coût 28,15 €  · prix 149 € · marge ~81 %
 *   Intensif  1500 min → coût 84,46 €  · prix 349 € · marge ~76 %
 *
 * UN client Essentiel couvre désormais le socle fixe à lui seul. C'était le
 * défaut le plus concret de l'ancienne grille.
 *
 * ── 4. AU-DELÀ DU FORFAIT : 0,20 €/min ──
 *
 * Pas de palier suivant à vendre, pas de coupure de service. À 0,0563 € de
 * coût, la minute supplémentaire reste rentable (marge ~72 %), et le client
 * n'est jamais bloqué un mardi parce qu'il a eu une bonne semaine.
 *
 * ⚠ DESCENDU DE 0,25 À 0,20 LE 04/09/2026. DÉCISION commerciale, pas un
 * recalcul : aucun client n'a jamais payé une minute de dépassement, donc rien
 * ne dit que 0,25 freinait quoi que ce soit. La marge passe de 77,5 % à 71,9 %.
 *
 * ⚠⚠ CE QUE CE CHANGEMENT FAIT VRAIMENT, ET QUI NE SAUTE PAS AUX YEUX : il
 * supprime la dernière raison de monter en palier. Comparé au prix moyen d'une
 * minute INCLUSE dans chaque forfait :
 *
 *                       minute incluse    à 0,25 €     à 0,20 €
 *   Essentiel  149/500     0,298 €         −16 %        −33 %
 *   Intensif   349/1500    0,233 €         **+7 %**     −14 %
 *
 * À 0,25 €, dépasser coûtait 7 % de PLUS que la minute d'Intensif : un client
 * d'Essentiel qui débordait avait un intérêt arithmétique à passer au palier
 * supérieur, et ça se démontrait en une ligne. À 0,20 €, dépasser est moins
 * cher que les DEUX forfaits au prorata — il n'existe plus aucun argument
 * chiffré pour faire monter qui que ce soit. On vend alors un abonnement bas
 * avec un dépassement confortable, ce qui est un modèle défendable, mais ce
 * n'est plus le même : la croissance ne vient plus des paliers.
 *
 * C'est cohérent avec « pas de palier à revendre, pas de coupure », et ça
 * retire l'argument « vous m'avez laissé déborder ». Mais si un client dépasse
 * SYSTÉMATIQUEMENT, ce n'est plus la minute qu'il faut regarder, c'est le
 * forfait — et cette conversation-là n'a plus de levier chiffré.
 *
 * ⚠ CE QUI EST MESURÉ ICI ET CE QUI NE L'EST PAS. Le coût à la minute est
 * relevé (27/08/2026). Le SETUP à 990 € et les deux prix mensuels sont des
 * DÉCISIONS — aucune vente ne les a encore validés. Le premier client qui
 * refuse en disant pourquoi vaudra plus que ce raisonnement.
 *
 * (Ces prix vivaient dans `lib/pipeline-juillet.ts`, un module qui porte de
 * VRAIES fiches prospects et qu'aucun composant client ne doit atteindre. Ce
 * qui est PUBLIC vit ici, et l'autre le réimporte.)
 */
export const ALPHA_VOICE_SETUP_HT = 990;

/** Le prix de la minute au-delà du forfait. Coût mesuré : 0,0563 €/min. */
export const ALPHA_VOICE_MINUTE_SUP_HT = 0.2;

export interface PalierAlphaVoice {
  minutes: number;
  prixHT: number;
  /** Ordre de grandeur en appels — ce que le client comprend. */
  appels: string;
  /** Le nom qu'on prononce. Un palier sans nom se dit « le petit ». */
  nom: string;
}

export const ALPHA_VOICE_PALIERS: PalierAlphaVoice[] = [
  { nom: "Essentiel", minutes: 500, prixHT: 149, appels: "~200 appels" },
  { nom: "Intensif", minutes: 1500, prixHT: 349, appels: "~600 appels" },
];

/** Comment l'offre se paie. */
export type CadenceOffre =
  /** Un paiement, une fois. */
  | "unique"
  /** Abonnement mensuel. */
  | "mensuel"
  /** Pas de prix affiché : cadrage puis devis. */
  | "devis"
  /**
   * Une installation ÉTALÉE, puis un abonnement qui prend le relais.
   *
   * ⚠ Cette cadence a été ajoutée parce que les trois autres mentaient sur
   * l'offre Business. « mensuel » aurait affiché la mensualité comme si
   * c'était le prix (800 € au lieu de 10 000 €) ; « unique » aurait annoncé
   * 10 000 € payables d'un coup, ce qui est précisément le blocage qu'on
   * cherche à retirer ; « devis » aurait caché un prix qu'on a décidé
   * d'afficher. Un modèle de paiement qui n'entre dans aucune case existante
   * doit avoir sa case, sinon c'est l'affichage qui s'arrange.
   */
  | "echelonne";

/**
 * Le plan de paiement d'une offre échelonnée.
 *
 * ⚠ L'ACOMPTE N'EST PAS UNE FORMALITÉ, ET IL N'EST PAS NÉGOCIABLE À LA BAISSE.
 *
 * L'installation est livrée EN ENTIER, à la main, avant la première
 * mensualité. Un client qui s'arrête au quatrième mois laisse une demi-journée
 * de travail déjà faite et un paramétrage déjà en production, contre une
 * fraction du prix. L'acompte est ce qui couvre ce travail au moment où il est
 * fait — pas une marque de sérieux, une couverture de risque.
 */
export interface PlanPaiement {
  /** Encaissé à la signature, AVANT que l'installation commence. */
  acompteHT: number;
  /** Nombre de mensualités qui suivent l'acompte. */
  mensualites: number;
  mensualiteHT: number;
  /** L'abonnement qui prend le relais après la dernière mensualité. */
  abonnementHT: number;
}

export interface OffrePublique {
  id: string;
  nom: string;
  cadence: CadenceOffre;
  /** Prix HT. `null` UNIQUEMENT pour la cadence « devis ». */
  prixHT: number | null;
  sousTitre: string;
  inclus: string[];
  /** La voix est-elle comprise dans l'offre ? */
  voixIncluse: boolean;
  /**
   * Appels inclus par période. OBLIGATOIRE dès que `voixIncluse` est vrai.
   * `null` sur une offre sans voix.
   */
  appelsInclus: number | null;
  /** Ce qui se passe au-delà du plafond. Obligatoire avec un plafond. */
  auDela: string | null;
  /**
   * Variable d'environnement portant l'ID de prix Stripe.
   * `null` = pas encaissable en ligne (l'offre doit alors mener au cadrage).
   */
  priceEnv: string | null;
  /** L'action, telle qu'elle s'affiche sur le site. */
  cta: { label: string; href: string };
  /** Le plan de paiement. OBLIGATOIRE sur la cadence « echelonne ». */
  plan?: PlanPaiement;
  /**
   * Les capacités (`lib/public-catalogue.ts`) que l'achat débloque.
   *
   * ⚠ C'est ce champ qui fait exister l'ONBOARDING. Sans lui, `parcours()`
   * retombe sur « tout est acheté » et sert au client la liste complète des
   * étapes — y compris celles de briques qu'il n'a pas prises. Un parcours qui
   * annonce du retard sur ce qu'on n'a pas vendu fait douter dès le jour un,
   * et c'est exactement le moment où un client neuf ne doit pas douter.
   */
  capacites: string[];
}

/**
 * Le plafond d'appels de l'offre Pro.
 *
 * ⚠ CHIFFRE À VALIDER, mais son EXISTENCE ne se négocie pas.
 *
 * 200 appels/mois coûtent ~19 € de consommation marginale (le fixe de 57 €
 * étant mutualisé sur tous les clients). À 149 €, le client de plus est très
 * largement rentable. C'est ce plafond qui permet de garder « la voix
 * incluse » comme accroche sans vendre à perte.
 *
 * Le monter demande de remonter le prix : au-delà de ~600 appels, l'offre à
 * 149 € redevient serrée.
 */
export const PRO_APPELS_INCLUS = 200;

const CADRAGE = {
  label: "Réserver le cadrage",
  href: "mailto:contact@eagleyecorp.fr?subject=D%C3%A9mo%20ALPHA%20SALES%20OS",
};

export const OFFRES: OffrePublique[] = [
  {
    id: "essai",
    nom: "Essai terrain",
    cadence: "unique",
    prixHT: ESSAI_HT,
    sousTitre: `Mise en route d'Alpha Voice + ${ESSAI_CALLS} appels réels. Une fois.`,
    inclus: [
      "Script d'appel écrit avec toi",
      "Configuration téléphonie et voix",
      `${ESSAI_CALLS} appels réellement composés`,
      "Écoute et débrief des premiers appels",
    ],
    voixIncluse: true,
    appelsInclus: ESSAI_CALLS,
    auDela: `Au-delà de ${ESSAI_CALLS} appels, on bascule sur la grille mensuelle (${OUTBOUND_UNIT_HT} € HT le millier).`,
    // Déduit du premier mois : c'est une porte, pas un péage.
    priceEnv: "STRIPE_PRICE_ESSAI",
    cta: { label: "Lancer l'essai", href: "/souscrire?offre=essai" },
    capacites: ["alpha-voice"],
  },
  {
    id: "solo",
    nom: "Solo",
    cadence: "mensuel",
    prixHT: 79,
    /**
     * ⚠ CE SOUS-TITRE DISAIT « TOUT LE CŒUR DU SYSTÈME », ET LE CŒUR EST
     * DEVENU GRATUIT LE 02/09/2026.
     *
     * Trois des quatre capacités de cette offre — `crm`, `closer`, `pilotage` —
     * sont depuis ce jour-là ouvertes à n'importe quel compte, sans limite de
     * durée. L'offre continuait de les vendre 79 €/mois, et le premier acheteur
     * l'aurait découvert en créant un deuxième compte : il découvre qu'il paie
     * ce qu'on donne. C'est la façon la plus rapide de perdre un client, et
     * elle ne se voit dans aucune relecture d'écran.
     *
     * Ce qui reste réellement payant ici : les AUDITS automatiques et la boîte
     * d'envoi. Le texte le dit maintenant, et il dit aussi que le reste est
     * gratuit — le taire serait la même faute avec un autre mot.
     *
     * ⚠⚠ La question COMMERCIALE reste ouverte et n'est pas tranchée ici :
     * cette offre a-t-elle encore un sens à 79 € face à un socle gratuit ?
     * C'est un arbitrage, pas une correction de bug. Un test refuse désormais
     * le seul cas indéfendable — une offre payante qui n'ouvrirait QUE des
     * briques gratuites.
     */
    sousTitre: "Les audits automatiques et la boîte d'envoi. Le CRM, lui, est gratuit.",
    inclus: [
      "Audits cadeaux automatiques",
      "Boîte d'envoi + brouillons Gmail",
      "Inclus gratuitement de toute façon : pipeline, Aujourd'hui, À décider, débrief à la voix",
    ],
    // ⚠ La dictée du débrief n'est PAS Alpha Voice : elle transcrit ce que TU
    // dis après un rendez-vous. Aucun appel n'est composé, donc aucun plafond.
    voixIncluse: false,
    appelsInclus: null,
    auDela: null,
    priceEnv: "STRIPE_PRICE_SOLO",
    cta: { label: "Prendre Solo", href: "/souscrire?offre=solo" },
    capacites: ["crm", "closer", "audits", "pilotage"],
  },
  {
    id: "pro",
    nom: "Pro",
    cadence: "mensuel",
    prixHT: 149,
    sousTitre: `La machine complète — la voix incluse, ${PRO_APPELS_INCLUS} appels par mois.`,
    inclus: [
      "Tout Solo, plus :",
      `Alpha Voice — ${PRO_APPELS_INCLUS} appels/mois inclus`,
      "Récap urgent par SMS",
      "Pilote automatique (n8n)",
    ],
    voixIncluse: true,
    appelsInclus: PRO_APPELS_INCLUS,
    auDela: `Au-delà de ${PRO_APPELS_INCLUS} appels/mois : ${OUTBOUND_UNIT_HT} € HT par millier supplémentaire, sans engagement.`,
    priceEnv: "STRIPE_PRICE_PRO",
    cta: { label: "Prendre Pro", href: "/souscrire?offre=pro" },
    capacites: ["crm", "closer", "audits", "pilotage", "alpha-voice", "campagnes", "tracking"],
  },
  {
    id: "voix-1000",
    nom: "Alpha Voice — 1 000 appels",
    cadence: "mensuel",
    prixHT: OUTBOUND_UNIT_HT,
    sousTitre: "Le palier de campagne : on prouve que ça convertit.",
    inclus: [
      `${OUTBOUND_UNIT_CALLS} appels composés par mois`,
      "Entrant ET sortant, 24/7",
      "Transcription et résultat dans le CRM",
      "Cadence et plafond légal respectés",
    ],
    voixIncluse: true,
    appelsInclus: OUTBOUND_UNIT_CALLS,
    auDela: `Chaque millier supplémentaire : ${OUTBOUND_UNIT_HT} € HT. Le 4ᵉ millier est offert.`,
    priceEnv: "STRIPE_PRICE_VOIX_1000",
    cta: { label: "Lancer la campagne", href: "/souscrire?offre=voix-1000" },
    capacites: ["alpha-voice", "crm", "pilotage"],
  },
  {
    id: "os-complet",
    nom: "Alpha Sales OS — complet",
    cadence: "devis",
    prixHT: null,
    sousTitre: "Tout l'écosystème, installé chez toi et à ton nom.",
    inclus: [
      "Les dix briques, installées et paramétrées",
      "Marque blanche, multi-utilisateurs",
      "Formation terrain et accompagnement",
      "Support prioritaire",
    ],
    voixIncluse: true,
    // Le volume se fixe au cadrage — mais il se fixe, et c'est écrit.
    appelsInclus: OUTBOUND_UNIT_CALLS,
    auDela: "Volume d'appels arrêté au cadrage, puis facturé à la grille.",
    priceEnv: null,
    cta: CADRAGE,
    // Tout : c'est la définition du pack complet.
    capacites: ["alpha-voice", "campagnes", "cerveau", "crm", "audits", "tracking", "alpha-live", "closer", "agent-alpha", "pilotage"],
  },
  {
    id: "business",
    nom: "Business",
    cadence: "echelonne",
    /**
     * Le prix AFFICHÉ reste 10 000 € : c'est ce que vaut l'installation, et
     * c'est ce qui ancre. Le plan dit comment il se paie — l'inverse
     * (afficher 800 €/mois) ferait croire à un abonnement à 800 €, puis
     * découvrir 10 000 € au contrat. C'est le genre d'écart qui tue une
     * signature au dernier mètre.
     */
    prixHT: PACK_SETUP_HT,
    sousTitre: "L'installation complète, étalée. Puis l'abonnement prend le relais.",
    inclus: [
      "Les dix briques installées et paramétrées, à ton nom",
      `${PACK_ACOMPTE_HT} € HT à la signature, puis ${PACK_MENSUALITES} × ${PACK_MENSUALITE_HT} € HT`,
      `Puis ${PACK_MONTHLY_HT} € HT/mois d'abonnement, à partir du mois ${PACK_MENSUALITES + 1}`,
      "Marque blanche, multi-utilisateurs, formation terrain",
    ],
    voixIncluse: true,
    appelsInclus: OUTBOUND_UNIT_CALLS,
    auDela: `Au-delà, ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} € HT la minute — sans coupure.`,
    priceEnv: "STRIPE_PRICE_BUSINESS",
    cta: { label: "Parler du Business", href: "/souscrire?offre=business" },
    capacites: ["alpha-voice", "campagnes", "cerveau", "crm", "audits", "tracking", "alpha-live", "closer", "agent-alpha", "pilotage"],
    plan: {
      acompteHT: PACK_ACOMPTE_HT,
      mensualites: PACK_MENSUALITES,
      mensualiteHT: PACK_MENSUALITE_HT,
      abonnementHT: PACK_MONTHLY_HT,
    },
  },
  {
    id: "lifetime",
    nom: "Lifetime",
    cadence: "unique",
    /**
     * Le prix du PREMIER palier. Il monte quand les places se remplissent —
     * réellement, pas au compteur (voir `palierLifetime`). Afficher ici le
     * palier courant demanderait de connaître le nombre de ventes, que ce
     * module public n'a pas le droit de lire ; c'est l'écran qui le fait.
     */
    prixHT: LIFETIME_PALIERS[0].prixHT,
    sousTitre: "Le logiciel à vie, payé une fois. La consommation reste à l'usage.",
    inclus: [
      "Les dix briques, à vie, sans abonnement",
      `${LIFETIME_APPELS_INCLUS} appels compris, une fois pour toutes`,
      "Toutes les mises à jour",
      `${LIFETIME_PLACES_TOTAL} places au total, puis l'offre ferme`,
    ],
    voixIncluse: true,
    appelsInclus: LIFETIME_APPELS_INCLUS,
    /**
     * ⚠ CE PLAFOND EST CE QUI REND LE LIFETIME VIABLE. Le logiciel ne coûte
     * rien à servir ; les minutes coûtent 0,0563 € chacune, pour toujours.
     * « À vie » sur la consommation serait une dette ouverte sans terme.
     */
    auDela: `Au-delà des appels compris, ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} € HT la minute. Le logiciel, lui, reste à vie.`,
    priceEnv: "STRIPE_PRICE_LIFETIME",
    cta: { label: "Prendre une place", href: "/souscrire?offre=lifetime" },
    capacites: ["alpha-voice", "campagnes", "cerveau", "crm", "audits", "tracking", "alpha-live", "closer", "agent-alpha", "pilotage"],
  },
];

/**
 * ⚠ LES CTA POINTENT VERS `/souscrire`, PAS VERS `/compte`.
 *
 * Ils visaient `/compte?offre=…` — une route de l'application, donc DERRIÈRE
 * `SITE_PASSWORD`. Vérifié en démarrant le serveur avec la variable posée :
 * chaque bouton d'achat rendait `307 → /gate`. Un inconnu qui voulait payer
 * tombait sur le mot de passe de notre outil interne. `/compte` reste la page
 * du client une fois CONNECTÉ ; l'entrée, elle, doit être publique.
 */
export const offreParId = (id: string): OffrePublique | undefined => OFFRES.find((o) => o.id === id);

/** Prix affichés au public — sert au test qui verrouille la vitrine. */
export const PRIX_PUBLICS: number[] = OFFRES.map((o) => o.prixHT).filter((p): p is number => p !== null);

export interface ErreurOffre {
  offreId: string;
  champ: string;
  probleme: string;
}

/**
 * Les règles dures d'une grille publique.
 *
 * Elles ne portent PAS sur le goût : chacune correspond à une façon connue de
 * perdre de l'argent ou de mentir au client.
 */
export function validerOffres(offres: OffrePublique[] = OFFRES): ErreurOffre[] {
  const erreurs: ErreurOffre[] = [];
  const vus = new Set<string>();

  for (const o of offres) {
    if (vus.has(o.id)) erreurs.push({ offreId: o.id, champ: "id", probleme: "identifiant en double" });
    vus.add(o.id);

    // ── LA RÈGLE QUI COMPTE ──
    if (o.voixIncluse && (o.appelsInclus === null || o.appelsInclus <= 0)) {
      erreurs.push({
        offreId: o.id,
        champ: "appelsInclus",
        probleme:
          "la voix est incluse sans plafond d'appels — c'est exactement l'offre qui était en ligne à 149 €/mois, " +
          "et qui devient une perte sèche dès 3 000 appels.",
      });
    }
    if (o.appelsInclus !== null && !o.auDela?.trim()) {
      erreurs.push({
        offreId: o.id,
        champ: "auDela",
        probleme: "un plafond sans suite écrite est un piège : le client découvre la limite au moment où elle le bloque.",
      });
    }

    // ── Un prix affiché doit pouvoir être payé ──
    if (o.cadence === "devis" && o.prixHT !== null) {
      erreurs.push({ offreId: o.id, champ: "prixHT", probleme: "cadence « devis » mais un prix est affiché" });
    }
    if (o.cadence !== "devis" && (o.prixHT === null || o.prixHT <= 0)) {
      erreurs.push({ offreId: o.id, champ: "prixHT", probleme: "prix manquant sur une offre qui n'est pas sur devis" });
    }
    /**
     * ⚠ UNE CADENCE ÉCHELONNÉE SANS PLAN EST UN PRIX SANS ÉCHÉANCIER — donc
     * une conversation qui se termine par « on vous enverra le détail ». Et
     * un plan qui encaisse MOINS que le prix affiché n'est pas un étalement,
     * c'est une remise déguisée : on la fait exprès ou on ne la fait pas.
     */
    if (o.cadence === "echelonne") {
      if (!o.plan) {
        erreurs.push({
          offreId: o.id,
          champ: "plan",
          probleme: "cadence « echelonne » sans plan de paiement : le prix est affiché sans dire comment il se paie.",
        });
      } else {
        const total = o.plan.acompteHT + o.plan.mensualites * o.plan.mensualiteHT;
        if (o.prixHT !== null && total < o.prixHT) {
          erreurs.push({
            offreId: o.id,
            champ: "plan",
            probleme: `le plan encaisse ${total} € pour un prix affiché de ${o.prixHT} € : c'est une remise, pas un étalement.`,
          });
        }
        if (o.plan.acompteHT <= 0) {
          erreurs.push({
            offreId: o.id,
            champ: "plan",
            probleme: "acompte nul : l'installation est livrée en entier avant la première mensualité, rien ne couvre ce travail.",
          });
        }
      }
    }
    if (o.cadence !== "devis" && !o.priceEnv) {
      erreurs.push({
        offreId: o.id,
        champ: "priceEnv",
        probleme:
          "prix affiché sans moyen d'encaisser : le visiteur clique « payer » et tombe dans le vide, " +
          "au moment exact où il voulait payer.",
      });
    }
    if (!o.inclus.length) {
      erreurs.push({ offreId: o.id, champ: "inclus", probleme: "aucun contenu listé — invendable" });
    }
    if (!o.capacites.length) {
      erreurs.push({
        offreId: o.id,
        champ: "capacites",
        probleme:
          "aucune capacité débloquée : le client paie et ne reçoit aucun parcours de mise en route. " +
          "`parcours()` retomberait sur « tout est acheté » et lui annoncerait du retard sur ce qu'il n'a pas pris.",
      });
    }
    if (o.voixIncluse && !o.capacites.includes("alpha-voice")) {
      erreurs.push({
        offreId: o.id,
        champ: "capacites",
        probleme: "la voix est vendue mais la capacité « alpha-voice » n'est pas débloquée — le client paie pour un écran fermé.",
      });
    }
  }

  return erreurs;
}

/** Le pack complet, pour l'affichage « sur devis » — l'ancre reste connue. */
export const PACK = { setupHT: PACK_SETUP_HT, mensuelHT: PACK_MONTHLY_HT };

/**
 * ⚠ `margeOffre` n'est PAS ici : elle vit dans `lib/offres-marge.ts`.
 * Elle a besoin du modèle de coûts, donc elle est serveur. Ce fichier-ci doit
 * rester atteignable depuis un composant client — c'est lui qui affiche les
 * prix, et il ne doit rien savoir de nos marges.
 */
