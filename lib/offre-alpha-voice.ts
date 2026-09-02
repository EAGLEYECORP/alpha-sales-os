
/**
 * ─────────────────────────────────────────────────────────────────────
 * L'OFFRE ALPHA VOICE — construite sur l'équation de valeur.
 *
 * ⚠ CE MODULE NE CONTIENT AUCUNE PREUVE SOCIALE, ET C'EST DÉLIBÉRÉ.
 *
 * Zéro vente à ce jour. La méthode qu'on applique ici repose normalement sur
 * des témoignages, des « 101 histoires de réussite » et des captures de
 * résultats. On n'en a pas — et en fabriquer serait la seule façon de perdre
 * un client pour de bon. CLAUDE.md le pose : zéro vente = zéro preuve sociale
 * disponible, et l'appliquer quand même fabrique de la preuve inventée.
 *
 * Ce qui reste, et qui suffit :
 *  · les chiffres DU PROSPECT (`computeLosses`, lib/argumentaire.ts) — c'est
 *    lui qui les donne, on ne fait que les multiplier devant lui ;
 *  · notre coût de revient MESURÉ (`lib/voice-costs.ts`), qui rend une
 *    garantie chiffrable au lieu d'être une bravade ;
 *  · une démonstration en direct : l'agent existe, il décroche, on l'appelle
 *    pendant le rendez-vous. Une démo qui marche vaut dix témoignages.
 *
 * ── L'ÉQUATION ──
 *
 *   Valeur = (Résultat rêvé × Probabilité perçue) ÷ (Délai × Effort)
 *
 * Les quatre leviers, et ce qu'on fait à chacun. Un pitch qui ne travaille
 * que le premier (« vous allez gagner plus ») ne déplace rien : c'est le
 * dénominateur qui bloque la vente chez un artisan — il n'a pas le temps, et
 * il a déjà été déçu par un outil qu'il n'a jamais fini d'installer.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface LevierValeur {
  /** Le levier de l'équation. */
  levier: "resultat" | "probabilite" | "delai" | "effort";
  /** Ce que le prospect vit aujourd'hui. */
  aujourdhui: string;
  /** Ce que l'offre en fait. */
  action: string;
  /** La phrase à dire, telle quelle. */
  phrase: string;
}

export const EQUATION: LevierValeur[] = [
  {
    levier: "resultat",
    aujourdhui: "Des appels manqués qu'il ne compte pas, donc une perte qu'il ne voit pas.",
    action: "On chiffre la perte AVEC SES chiffres, devant lui, au lieu de promettre un gain.",
    phrase:
      "« Sur une semaine normale, combien d'appels vous n'arrivez pas à prendre ? » — puis on multiplie par son panier, devant lui.",
  },
  {
    levier: "probabilite",
    aujourdhui: "Il a déjà entendu « l'IA va tout changer » et il n'y croit pas.",
    action: "On ne promet rien : on fait sonner l'agent pendant le rendez-vous.",
    phrase: "« Donnez-moi votre numéro, je vous le fais appeler maintenant. Vous jugerez vous-même. »",
  },
  {
    levier: "delai",
    aujourdhui: "Tout outil qu'on lui a vendu a demandé des semaines avant de servir.",
    action: "Le numéro sonne le jour de l'installation. Pas de migration, pas de portabilité.",
    phrase: "« Votre numéro actuel ne bouge pas. On se met dessus, et ça répond dès le premier jour. »",
  },
  {
    levier: "effort",
    aujourdhui: "Il n'a ni le temps ni l'envie d'apprendre un logiciel de plus.",
    action: "Zéro logiciel à apprendre : il reçoit un SMS avec le RDV. C'est tout.",
    phrase: "« Vous n'avez rien à ouvrir. Vous recevez un SMS : qui a appelé, pourquoi, et le créneau pris. »",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PILE — chaque objection réelle devient une ligne de l'offre.
 *
 * ⚠ Les objections ne sont pas inventées : ce sont celles que le produit sait
 * déjà détecter (`deepAudit.missedCallsPerWeek`, `currentProcess`) et celles
 * remontées en juillet 2026 (`lib/knowledge-seed.ts` — 132 appels, 6 RDV,
 * 0 gagné). « Trop cher pour mon volume » et « ça va sonner robot » sont les
 * deux qui reviennent le plus.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface LigneOffre {
  probleme: string;
  solution: string;
  /**
   * Ce que ça nous coûte VRAIMENT à produire. Sert à décider quoi offrir :
   * un bonus qui coûte cher n'est pas un bonus, c'est une remise déguisée.
   */
  coutPourNous: "nul" | "faible" | "reel";
  /** Inclus dans l'offre de base, ou bonus nommé ? */
  role: "coeur" | "bonus";
}

export const PILE: LigneOffre[] = [
  {
    probleme: "Je rate des appels quand je suis sous un capot ou sur un chantier.",
    solution: "L'agent décroche à votre place, tout de suite, sans sonnerie dans le vide.",
    coutPourNous: "reel",
    role: "coeur",
  },
  {
    probleme: "Le soir, le week-end, entre midi et deux — personne ne répond.",
    solution: "Il répond 24/7. Les heures où vous êtes fermé sont celles où vos concurrents le sont aussi.",
    coutPourNous: "nul",
    role: "coeur",
  },
  {
    probleme: "Je rappelle trop tard, le client a déjà appelé ailleurs.",
    solution:
      "Il rappelle lui-même celui qui n'a pas décroché — au bon moment, jamais au déjeuner, jamais le week-end, " +
      "et il s'arrête dès que la personne répond.",
    coutPourNous: "faible",
    role: "coeur",
  },
  {
    probleme: "Un répondeur, j'en ai un. Il ne prend pas de rendez-vous.",
    solution: "Lui pose les questions, note la demande, et place le créneau. Vous recevez le rendez-vous, pas un message.",
    coutPourNous: "nul",
    role: "coeur",
  },
  {
    probleme: "Je ne sais même pas combien j'en rate.",
    solution: "Le relevé de vos appels manqués sur 30 jours, avec ce que ça représente à votre panier.",
    coutPourNous: "nul",
    role: "bonus",
  },
  {
    probleme: "Une secrétaire, c'est trop cher pour mon volume.",
    solution: "Comparez au mois, pas à l'heure : il ne prend ni congés, ni pause, ni préavis.",
    coutPourNous: "nul",
    role: "coeur",
  },
  {
    probleme: "Je ne veux pas apprendre un logiciel de plus.",
    solution: "Il n'y a rien à ouvrir. Un SMS par appel capté : qui, pourquoi, quel créneau.",
    coutPourNous: "nul",
    role: "coeur",
  },
  {
    probleme: "J'ai peur que ça sonne robot et que ça fasse fuir mes clients.",
    solution:
      "Écoutez-le maintenant, pendant qu'on est ensemble. Et il annonce toujours qu'il est une IA — " +
      "c'est la loi, et c'est ce qui fait qu'on ne vous reproche jamais de l'avoir caché.",
    coutPourNous: "nul",
    role: "coeur",
  },
  {
    probleme: "Et si je veux arrêter ?",
    solution: "Sans engagement. Vous coupez, votre numéro reste le vôtre — il n'a jamais bougé.",
    coutPourNous: "nul",
    role: "coeur",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA GARANTIE — le seul levier qui remplace la preuve sociale.
 *
 * Un témoignage dit « ça a marché pour lui ». Une garantie dit « si ça ne
 * marche pas pour VOUS, ça ne vous coûte rien ». La seconde n'exige aucun
 * client passé — c'est exactement ce qu'il nous faut à zéro vente.
 *
 * ⚠ ET ON PEUT LA CHIFFRER, ce qui la rend décidable au lieu d'être une
 * bravade. Notre coût de conversation est MESURÉ : 0,0563 €/min
 * (`lib/voice-costs.ts`, relevé du 27/08/2026).
 * ─────────────────────────────────────────────────────────────────────
 */
export interface Garantie {
  nom: string;
  promesse: string;
  /** Ce qu'elle nous coûte si le client l'active. */
  coutSiActivee: string;
  /** Ce qu'elle NE couvre pas — dit avant, jamais découvert après. */
  limite: string;
}

/**
 * ⚠ LE COÛT DE LA GARANTIE A DÉMÉNAGÉ — `lib/offre-alpha-voice-cout.ts`.
 *
 * Il se calcule depuis `lib/voice-costs`, qui porte NOS MARGES. Ce module-ci
 * est atteint par le navigateur (argumentaire → master-panel), et
 * `_next/static/**` est exclu du middleware : notre coût de revient serait
 * parti dans un chunk téléchargeable par le prospect à qui on vend.
 *
 * Trouvé par `tests/vitrine-fuite.test.ts`, pas par relecture — c'est la
 * deuxième fois de la session que ce test attrape exactement cette faute.
 */

export const GARANTIES: Garantie[] = [
  {
    /**
     * ⚠ C'EST CELLE-CI QU'ON OFFRE — décidé le 02/09/2026, parmi les trois.
     *
     * Les deux autres ne coûtent rien et ne lèvent rien : « sans engagement »
     * est une condition normale, le relevé offert est un aimant. Seule
     * celle-ci répond à la question que le prospect ne pose pas à voix haute :
     * « et si ça ne marche pas chez moi ? » — la question qu'un témoignage
     * aurait traitée, et qu'on ne peut pas traiter autrement à zéro vente.
     *
     * ⚠⚠ ET SON VRAI COÛT N'EST PAS CELUI QU'ON CROIT. `coutGarantiePremierRdv`
     * chiffre les MINUTES : quelques euros. Ce n'est pas le poste qui compte.
     * Ce qu'on risque vraiment, c'est le temps d'installation — fait à la
     * main, par une personne. Une garantie activée coûte une demi-journée, pas
     * 8 €. C'est ce qui la borne : elle est offrable parce qu'on en offre PEU
     * à la fois, pas parce qu'elle serait gratuite.
     */
    nom: "Le setup ne se paie qu'au premier rendez-vous",
    promesse:
      "On installe, l'agent tourne, et vous ne payez l'installation que le jour où il vous a pris un premier " +
      "rendez-vous. Après 30 jours de ligne active, s'il n'en a pris aucun, vous ne payez pas l'installation.",
    coutSiActivee:
      "Les minutes brûlées (quelques euros, `coutGarantiePremierRdv`) PLUS le temps d'installation, qui est le " +
      "vrai poste. C'est pourquoi elle va de pair avec la rareté : peu d'installations à la fois.",
    limite:
      "Trois bords, dits à l'oral, jamais découverts sur la facture. (1) Elle porte sur le SETUP, pas sur " +
      "l'abonnement du mois écoulé : les minutes ont été payées à l'opérateur. (2) Elle suppose 30 jours de " +
      "LIGNE ACTIVE — couper au bout de trois jours ne la déclenche pas. (3) Elle porte sur un rendez-vous PRIS, " +
      "pas sur un rendez-vous honoré : qui vient et qui signe, ça ne dépend plus de nous.",
  },
  {
    nom: "Sans engagement, coupure à tout moment",
    promesse: "Vous arrêtez quand vous voulez. Votre numéro n'a jamais bougé, vous le récupérez tel quel.",
    coutSiActivee: "Nul — le numéro reste chez lui par construction, on ne fait jamais de portabilité.",
    limite: "Le mois entamé reste dû. C'est un abonnement, pas une consigne.",
  },
  {
    nom: "Le relevé des appels manqués, même si vous ne prenez rien",
    promesse: "On vous laisse le compte de ce que vous ratez, chiffré à votre panier. Vous en faites ce que vous voulez.",
    coutSiActivee: "Nul : le document est généré par l'app (`renderRecoveryDoc`).",
    limite:
      "Ce n'est pas un audit de votre entreprise, c'est le relevé de vos appels : ne pas le vendre pour autre " +
      "chose que ce qu'il est.",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RARETÉ — et pourquoi la nôtre est VRAIE.
 *
 * ⚠ La rareté fabriquée (« plus que 3 places ! ») est un mensonge qui se
 * vérifie en rappelant la semaine suivante. Elle grille le vendeur pour de
 * bon, et un artisan lyonnais parle à ses confrères.
 *
 * La nôtre est une contrainte réelle : l'installation se fait à la main, par
 * une seule personne. Le nombre de clients qu'on peut démarrer dans un mois
 * est borné par le temps de Zakaria, pas par une décision marketing. On le
 * dit tel quel — c'est plus crédible ET c'est vrai.
 * ─────────────────────────────────────────────────────────────────────
 */
export const RARETE = {
  fait: "L'installation se fait à la main, par une seule personne.",
  phrase:
    "« Je fais les installations moi-même, donc j'en prends peu à la fois. Si on se lance, on cale la date " +
    "maintenant — sinon ce sera le mois suivant. »",
  interdit:
    "Ne JAMAIS annoncer un nombre de places qu'on n'a pas compté. Un chiffre inventé se vérifie au coup de fil suivant.",
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ANCRAGE DU PRIX — contre quoi il se compare.
 *
 * ⚠ ON N'ANCRE PAS SUR UN CONCURRENT QU'ON N'A PAS RELEVÉ. On ancre sur deux
 * choses que le prospect connaît déjà : ce qu'il perd (ses chiffres) et ce
 * que coûterait quelqu'un pour décrocher (un salaire, qu'il sait estimer).
 * ─────────────────────────────────────────────────────────────────────
 */
export const ANCRAGES = [
  {
    contre: "Ce qu'il perd",
    dire: "On chiffre devant lui : appels manqués × panier × taux de transformation. C'est SON chiffre, pas le nôtre.",
    ordre: "Se calcule sur la fiche (`computeLosses`). Aucun montant écrit ici : il dépend de lui.",
  },
  {
    contre: "Quelqu'un qui décroche",
    dire: "Un mi-temps au SMIC chargé, ce n'est pas le salaire net : c'est le coût employeur, les congés, l'absence.",
    ordre: "Ne pas citer de montant qu'on n'a pas vérifié le jour même. Le laisser l'estimer lui-même : il le sait mieux.",
  },
  {
    contre: "Ne rien faire",
    dire: "L'option qu'il choisit aujourd'hui par défaut. Elle a un prix, et c'est celui qu'on vient de calculer.",
    ordre: "C'est la comparaison la plus forte et la seule qui ne demande aucune donnée extérieure.",
  },
] as const;

/**
 * L'ordre du rendez-vous. Ce n'est pas un script à lire : c'est la SUITE, et
 * elle compte plus que les mots.
 *
 * ⚠ Le prix arrive en 5. Jamais avant la démonstration — c'est une règle dure
 * du dépôt (`vital-signs`, `master-rappel`) : un prix donné avant que la
 * valeur soit vue devient le seul sujet de la conversation.
 */
export const DEROULE: { etape: number; titre: string; but: string }[] = [
  { etape: 1, titre: "Sa semaine", but: "Combien d'appels il rate. C'est LUI qui donne le chiffre." },
  { etape: 2, titre: "Le calcul", but: "Multiplier devant lui. Se taire. Le laisser réagir au montant." },
  { etape: 3, titre: "L'écoute", but: "Faire sonner l'agent, maintenant. C'est la démonstration, pas une promesse." },
  { etape: 4, titre: "La pile", but: "Répondre aux objections qu'il n'a pas encore posées, une par une." },
  { etape: 5, titre: "Le prix + la garantie", but: "Le prix ne se dit JAMAIS sans la garantie qui l'accompagne." },
  { etape: 6, titre: "La date", but: "Pas « je vous envoie un devis » : une date d'installation, décidée maintenant." },
];
