
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
/**
 * ⚠ `ESSAI_CALLS` (100) et `ESSAI_HT` (290) VIVAIENT ICI. Retirés le
 * 04/09/2026 avec le palier qu'ils portaient — voir le bloc « LE PALIER
 * D'ESSAI A ÉTÉ RETIRÉ » dans `lib/bricks.ts` pour le raisonnement complet.
 * Les laisser en place aurait garanti qu'une session suivante les recâble :
 * une constante exportée finit toujours par retrouver un lecteur.
 */
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
 * ── L'OFFRE OMNICANALE — la boîte de réception unique, à leur marque ──
 *
 * Ce qu'elle règle, et qu'aucune autre offre ne réglait : un maître d'ouvrage
 * en commercialisation reçoit des demandes d'acquéreurs par le portail
 * d'annonces, par le formulaire de son site, par WhatsApp et par téléphone —
 * quatre files qui ne se parlent pas, dont aucune ne dit qui a déjà été
 * rappelé. Ce n'est pas un problème d'appels manqués, c'est un problème de
 * FILE UNIQUE.
 *
 * Ce qu'on installe : une boîte de réception partagée (Chatwoot, auto-hébergée
 * et à LEUR marque) où toutes les demandes arrivent, plus **Alpha Voice
 * inclus** pour la file téléphonique.
 *
 * ⚠ « ALPHA VOICE OFFERT » A UN BORD, ET IL EST OBLIGATOIRE. `validerOffres`
 * refuse déjà toute offre qui inclut la voix sans plafond d'appels — c'est la
 * règle née du jour où « Alpha Voice inclus » était annoncé sans limite et
 * passait en perte sèche vers 2 200 appels. « Offert » veut donc dire : le
 * SETUP de 990 € est offert, et le forfait Essentiel est compris. Au-delà, la
 * minute se facture à la grille, comme partout ailleurs.
 *
 * ⚠⚠ CE QUE ÇA NOUS COÛTE VRAIMENT, ET CE N'EST PAS LA MARGE AFFICHÉE.
 * Le coût marginal est faible (~63 €/mois : hébergement + 500 min de voix,
 * marge ~89 %). Le coût RÉEL est humain : une instance Chatwoot par client,
 * c'est une application Rails avec sa base, son cache, son SMTP, son domaine,
 * ses sauvegardes et ses mises à jour de sécurité — à faire pour CHACUN.
 * C'est le même mur que les identifiants par locataire, en plus lourd. Cette
 * offre ne se vend pas à vingt clients avant que ce soit industrialisé, et la
 * rareté qu'on annonce ailleurs est ici un fait technique, pas un argument.
 */
export const OMNICANAL_SETUP_HT = 2_500;
export const OMNICANAL_MENSUEL_HT = 590;
/** Ce que « Alpha Voice offert » comprend : le forfait Essentiel, borné. */
export const OMNICANAL_APPELS_INCLUS = 200;

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

/**
 * ⚠ REPRICÉ LE 04/09/2026, ET LE MOTIF EST UNE INCOHÉRENCE, PAS UNE ENVIE.
 *
 * Les paliers étaient 1 900 / 2 900 / 3 900 pour 60 places. Ancrés sur Alpha
 * Voice seul (149 €/mois), ils tenaient. Face à l'offre omnicanale à
 * 590 €/mois, 1 900 € représente **3,2 mois** — payés une fois, pour toujours.
 * Un lifetime moins cher qu'un trimestre de l'offre phare n'est pas une offre
 * de lancement : c'est une fuite, et elle plafonne le récurrent définitivement.
 *
 * Ré-ancrés sur l'offre phare : le premier palier vaut ~8 mois d'omnicanal.
 * Et 20 places au lieu de 60 — « exclusif » et « soixante » ne vont pas
 * ensemble, et la rareté ici est un fait (une instance par client, installée à
 * la main), pas un compteur.
 */
export const LIFETIME_PALIERS: PalierLifetime[] = [
  { rang: 1, prixHT: 4_900, places: 5 },
  { rang: 2, prixHT: 6_900, places: 7 },
  { rang: 3, prixHT: 8_900, places: 8 },
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
  /**
   * Les frais d'INSTALLATION, une fois, en plus de `prixHT`.
   *
   * ⚠ CE MONTANT N'EXISTAIT QUE DANS LA PROSE. `sousTitre` disait « 990 € HT
   * d'installation » et rien d'autre ne le savait : impossible de le
   * totaliser, de le comparer, ou d'asseoir une commission dessus. Le prix
   * le plus élevé de plusieurs offres n'était pas une donnée, c'était une
   * phrase.
   *
   * `null` = pas d'installation facturée (le lifetime, qui EST le paiement
   * unique) ou installation sur devis (`os-complet`). `0` n'existe pas ici :
   * il se lirait comme « installation gratuite », ce qui est une promesse
   * commerciale, pas une absence de prix.
   */
  setupHT: number | null;
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
  /**
   * ── LA GRILLE A ÉTÉ REFAITE LE 04/09/2026, ET LE MOTIF N'EST PAS ESTHÉTIQUE ──
   *
   * Il y avait SEPT offres, dont trois héritées du revendeur disparu :
   *   · « Essai terrain » 290 € · « Solo » 79 €/mois · « Pro » 149 €/mois
   *
   * Elles ne se contentaient pas d'être nombreuses, elles étaient FAUSSES :
   * Solo facturait 79 €/mois un périmètre devenu GRATUIT le 02/09 (crm,
   * closer, pilotage), et Pro chevauchait Alpha Voice au même prix sans être
   * la même chose. Un prospect qui compare sept lignes ne choisit pas : il
   * remet à plus tard.
   *
   * ⚠ ET LE VRAI DÉFAUT, QUI N'ÉTAIT PAS LE NOMBRE : cette grille a été
   * construite pour des ARTISANS — un garage, un couvreur, une auto-école.
   * L'ICP est devenu le MAÎTRE D'OUVRAGE, qui pilote un programme à plusieurs
   * millions. À ce niveau-là, 79 €/mois ne se lit pas comme une bonne affaire,
   * ça se lit comme un gadget — c'est le deuxième terme de l'équation de
   * valeur, la probabilité perçue, et un prix trop bas l'abîme.
   *
   * La grille tient maintenant en une échelle : le socle gratuit, la voix pour
   * qui n'a qu'un problème de téléphone, l'omnicanale pour qui reçoit de
   * partout, l'OS complet, et le lifetime pour les premiers.
   *
   * ⚠⚠ TOUS CES PRIX SONT DES DÉCISIONS. Zéro vente les a validés. Le coût à
   * la minute est le seul chiffre mesuré de ce fichier.
   */
  {
    id: "voix-essentiel",
    nom: "Alpha Voice — Essentiel",
    cadence: "mensuel",
    prixHT: ALPHA_VOICE_PALIERS[0].prixHT,
    setupHT: ALPHA_VOICE_SETUP_HT,
    sousTitre: `${ALPHA_VOICE_SETUP_HT} € HT d'installation, puis l'abonnement. L'accueil qui décroche à votre place.`,
    inclus: [
      `${ALPHA_VOICE_SETUP_HT} € HT d'installation (script, téléphonie, voix)`,
      `${ALPHA_VOICE_PALIERS[0].minutes} minutes par mois — environ ${ALPHA_VOICE_PALIERS[0].appels.replace("~", "")}`,
      "L'agent annonce qu'il est une IA, dès la première phrase",
      "Le résumé de chaque appel dans votre CRM",
    ],
    voixIncluse: true,
    appelsInclus: 200,
    auDela: `Au-delà, ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} € HT la minute — sans coupure, sans palier à revendre.`,
    priceEnv: "STRIPE_PRICE_VOIX_ESSENTIEL",
    cta: { label: "Prendre Essentiel", href: "/souscrire?offre=voix-essentiel" },
    capacites: ["alpha-voice"],
  },
  {
    id: "voix-intensif",
    nom: "Alpha Voice — Intensif",
    cadence: "mensuel",
    prixHT: ALPHA_VOICE_PALIERS[1].prixHT,
    setupHT: ALPHA_VOICE_SETUP_HT,
    sousTitre: "Le même accueil, pour un volume d'appels qui ne redescend pas.",
    inclus: [
      `${ALPHA_VOICE_SETUP_HT} € HT d'installation`,
      `${ALPHA_VOICE_PALIERS[1].minutes} minutes par mois — environ ${ALPHA_VOICE_PALIERS[1].appels.replace("~", "")}`,
      "Tout ce que contient Essentiel",
    ],
    voixIncluse: true,
    appelsInclus: 600,
    auDela: `Au-delà, ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} € HT la minute.`,
    priceEnv: "STRIPE_PRICE_VOIX_INTENSIF",
    cta: { label: "Prendre Intensif", href: "/souscrire?offre=voix-intensif" },
    capacites: ["alpha-voice"],
  },
  {
    /**
     * L'offre pensée POUR le maître d'ouvrage : quatre files de demandes qui
     * ne se parlent pas (portail, formulaire, WhatsApp, téléphone) et aucune
     * qui dise qui a déjà été rappelé.
     *
     * ⚠ « Alpha Voice offert » est BORNÉ, et `validerOffres` l'impose : le
     * setup de 990 € est offert, le forfait Essentiel est compris, et la
     * minute au-delà se facture à la grille. « Offert sans limite » est
     * exactement la formule qui a déjà mis une offre en perte.
     */
    id: "omnicanal",
    nom: "Réponse omnicanale",
    cadence: "mensuel",
    prixHT: OMNICANAL_MENSUEL_HT,
    // ⚠ L'installation Alpha Voice (990 €) est OFFERTE dans cette offre : le
    // setup facturé est celui de l'omnicanale seule, pas la somme des deux.
    setupHT: OMNICANAL_SETUP_HT,
    sousTitre: `${OMNICANAL_SETUP_HT} € HT d'installation, puis l'abonnement. Toutes vos demandes dans une seule file, à votre marque.`,
    inclus: [
      `${OMNICANAL_SETUP_HT} € HT d'installation : boîte de réception à VOTRE marque, canaux branchés`,
      "Email, formulaire de site, WhatsApp, réseaux — une file unique, qui dit qui a déjà répondu",
      `**Alpha Voice inclus** : installation offerte (${ALPHA_VOICE_SETUP_HT} € HT) et ${OMNICANAL_APPELS_INCLUS} appels par mois compris`,
      "Réponses enregistrées, attribution, historique par contact",
    ],
    voixIncluse: true,
    appelsInclus: OMNICANAL_APPELS_INCLUS,
    auDela: `Au-delà des ${OMNICANAL_APPELS_INCLUS} appels compris, ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} € HT la minute. La boîte de réception, elle, n'a pas de plafond.`,
    priceEnv: "STRIPE_PRICE_OMNICANAL",
    cta: { label: "Parler de l'omnicanal", href: "/souscrire?offre=omnicanal" },
    capacites: ["alpha-voice", "crm", "closer", "tracking"],
  },

  {
    id: "voix-1000",
    nom: "Alpha Voice — 1 000 appels",
    cadence: "mensuel",
    prixHT: OUTBOUND_UNIT_HT,
    setupHT: OUTBOUND_SETUP_HT,
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
    // Sur devis : le périmètre se fixe au cadrage, l'installation aussi.
    setupHT: null,
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
    /**
     * ⚠ `null`, ET CE N'EST PAS UN OUBLI. Sur Business, l'installation N'EST
     * PAS un supplément : elle EST le prix affiché (10 000 € étalés). Y
     * remettre `PACK_SETUP_HT` ferait compter la même somme deux fois — dans
     * un total, dans une commission, dans une prévision.
     */
    setupHT: null,
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
    // Le lifetime EST le paiement unique : aucune installation en plus.
    setupHT: null,
    sousTitre: "Le logiciel à vie, payé une fois. La consommation reste à l'usage.",
    inclus: [
      "Le CRM, le closer, le Cerveau, le pilotage, le suivi et les audits — à vie, sans abonnement",
      `Alpha Voice avec ${LIFETIME_APPELS_INCLUS} appels compris, une fois pour toutes`,
      "Toutes les mises à jour",
      `${LIFETIME_PLACES_TOTAL} places au total, puis l'offre ferme`,
      "Les campagnes, l'agent autonome et Alpha Live restent sur abonnement — ils consomment à chaque usage",
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
    /**
     * ⚠ LE LIFETIME PORTAIT LES DIX BRIQUES, ET ÇA TUAIT L'OFFRE BUSINESS.
     *
     * Le même périmètre exactement, à 4 900 € une fois d'un côté, à 10 000 €
     * PUIS 1 000 €/mois de l'autre. Aucun acheteur rationnel ne prend le
     * second : la grille se cannibalisait elle-même, et ça ne se voyait dans
     * aucun test — les deux offres étaient valides séparément.
     *
     * ⚠⚠ ET LE DANGER RÉEL N'ÉTAIT PAS COMMERCIAL, IL ÉTAIT COMPTABLE. Deux
     * briques dépensent NOTRE argent à chaque usage, pour toujours :
     *  · `campagnes`  → envoie par NOTRE SMTP, sur NOTRE domaine (réputation) ;
     *  · `agent-alpha`→ brûle NOS jetons IA à chaque tour.
     * `appelsInclus` plafonne les minutes — le reste n'avait AUCUN plafond. On
     * a écrit « un lifetime sans plafond d'appels est une dette ouverte sans
     * terme » et on a vendu à vie trois autres compteurs qui tournent.
     *
     * Le lifetime porte donc ce dont le coût marginal est proche de zéro, plus
     * une voix BORNÉE. Les trois consommatrices restent sur abonnement, et
     * c'est ce qui laisse Business exister.
     */
    // `alpha-live` y revient : elle ne consomme rien, donc rien ne s'oppose à
    // ce qu'elle soit portée à vie — et l'omettre laisserait croire qu'on la
    // retient, alors que le socle gratuit l'ouvre déjà à tout le monde.
    capacites: ["alpha-voice", "cerveau", "crm", "audits", "tracking", "closer", "pilotage", "alpha-live"],
  },
];

/**
 * Les briques qu'on ne vend JAMAIS à vie : chaque usage nous coûte de l'argent
 * ou de la réputation, indéfiniment. `tests/offres-publiques.test.ts` interdit
 * qu'une offre de cadence « unique » en porte une.
 *
 * ⚠⚠ `alpha-live` EN A ÉTÉ RETIRÉE LE 12/09/2026, ET ELLE N'AURAIT JAMAIS DÛ
 * Y FIGURER. Elle y était sur la foi d'un « même mécanique que l'agent » —
 * une ANALOGIE, jamais une mesure. Le composant n'appelle aucune de nos API :
 * il écoute par le moteur du navigateur. Nous ne dépensons rien.
 *
 * Ce que cette entrée fausse COÛTAIT, et c'est le point : cette liste est
 * exécutable. Elle interdisait au lifetime de porter la brique, donc on
 * retenait une capacité pour éviter une dépense qui n'existe pas. Une erreur
 * de raisonnement rangée dans une constante devient une règle de vente.
 */
export const BRIQUES_CONSOMMATRICES: readonly string[] = ["campagnes", "agent-alpha"];

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
