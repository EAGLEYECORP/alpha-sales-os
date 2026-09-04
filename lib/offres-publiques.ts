
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
