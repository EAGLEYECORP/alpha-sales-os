
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
export const PACK_SETUP_HT = 10_000;
export const PACK_MONTHLY_HT = 1_000;

/** Comment l'offre se paie. */
export type CadenceOffre =
  /** Un paiement, une fois. */
  | "unique"
  /** Abonnement mensuel. */
  | "mensuel"
  /** Pas de prix affiché : cadrage puis devis. */
  | "devis";

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
    cta: { label: "Lancer l'essai", href: "/compte?offre=essai" },
    capacites: ["alpha-voice"],
  },
  {
    id: "solo",
    nom: "Solo",
    cadence: "mensuel",
    prixHT: 79,
    sousTitre: "Un closer. Tout le cœur du système, sans la voix.",
    inclus: [
      "Pipeline, Aujourd'hui, À décider",
      "Débrief terrain à la voix (dictée)",
      "Audits cadeaux illimités",
      "Boîte d'envoi + brouillons Gmail",
    ],
    // ⚠ La dictée du débrief n'est PAS Alpha Voice : elle transcrit ce que TU
    // dis après un rendez-vous. Aucun appel n'est composé, donc aucun plafond.
    voixIncluse: false,
    appelsInclus: null,
    auDela: null,
    priceEnv: "STRIPE_PRICE_SOLO",
    cta: { label: "Prendre Solo", href: "/compte?offre=solo" },
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
    cta: { label: "Prendre Pro", href: "/compte?offre=pro" },
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
    cta: { label: "Lancer la campagne", href: "/compte?offre=voix-1000" },
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
];

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
