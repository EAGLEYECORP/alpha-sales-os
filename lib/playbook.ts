import type { Prospect, Sector } from "./types";
import { citer } from "./citation";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PLAYBOOK TERRAIN — la mémoire de ce qui marche VRAIMENT.
 *
 * Ce fichier n'est pas de la théorie : il est extrait des documents
 * réels produits sur le terrain (listes d'appels immo & auto-écoles,
 * deep-dives carrosserie, audits d'accueil téléphonique, emails de
 * suivi). C'est le corpus qui « entraîne » l'IA de l'OS — pas par
 * fine-tuning (16 documents n'entraînent aucun modèle), mais par
 * INJECTION : ces invariants entrent dans le prompt système, donc
 * l'agent cesse de produire du générique et rejoue la méthode maison.
 *
 * Règle de mise à jour : après chaque RDV réel, ce qui a marché entre
 * ici (une phrase, une objection, un angle). Le playbook est le seul
 * endroit où la connaissance terrain se capitalise — pas dans les
 * notes d'une fiche, qui meurent avec le prospect.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les invariants — vrais quelle que soit la verticale. Issus du terrain. */
export const DOCTRINE_TERRAIN: { rule: string; why: string }[] = [
  {
    rule: "La phrase de barrage ne se rejoue JAMAIS au décideur.",
    why: "Elle est faite pour être transmise par l'accueil. Rejouée au patron, elle close avant d'avoir ouvert : il répond un « non merci » propre sans avoir rien ressenti. Au décideur : permission → ciblage → diagnostic.",
  },
  {
    rule: "Permission cash, en premier : « 30 secondes, et si c'est pas pour vous, vous me le dites et je raccroche. »",
    why: "L'appel à froid assumé désarme. Demander la permission rend la suite volontaire.",
  },
  {
    rule: "Le ciblage se dit en CRITÈRE, jamais en volume.",
    why: "« Je travaille avec les métiers où le téléphone EST le chiffre d'affaires » fonctionne. « J'appelle toutes les agences de Lyon » annule l'effet en une phrase : on montre qu'on a choisi un critère, pas qu'on fait du nombre.",
  },
  {
    rule: "L'observation se pose en QUESTION, jamais en affirmation.",
    why: "« Vous fermez le week-end, c'est bien ça ? » fait énoncer sa propre douleur au prospect. « J'ai vu que vous fermez le week-end » sonne fliqué.",
  },
  {
    rule: "Interdits à froid : les € perdus, la note Google, le détail des fonctionnalités.",
    why: "Les chiffres d'audit à froid sont présomptueux et déclenchent un débat sur la méthode au lieu de la douleur. La note, même mauvaise, se prend comme une attaque. Chaque fonctionnalité en plus fait basculer du ressenti vers la comparaison — et on perd.",
  },
  {
    rule: "Poser deux questions de diagnostic, puis SE TAIRE.",
    why: "Le silence fait le travail. C'est lui qui fait apparaître le problème dans la bouche du prospect.",
  },
  {
    rule: "Compter ses AFFIRMATIONS et les réduire au minimum humainement possible. Tout le reste est question.",
    why: "Un prospect ne croit presque rien de ce que TU dis, et presque tout de ce que LUI dit. Une affirmation offre une prise : elle se conteste. Une question n'en offre aucune — au pire il en refuse la prémisse. Ce n'est donc pas une question de politesse ni de rythme : chaque affirmation supprimée est une objection qui ne naîtra pas. [SOURCE EXTERNE — praticien, non vérifiée chez nous : A. Hormozi]",
  },
  {
    rule: "Hors questions, il ne reste que trois choses permises : féliciter le prospect de la conclusion qu'il vient de tirer, répondre à une question logistique, ou servir UNE affirmation suivie d'une ANALOGIE.",
    why: "Décrire ce qu'on fait se retourne systématiquement : soit ça sonne comme du travail qu'on fait pour lui — auquel cas il s'en fiche des détails, il veut juste que ce soit réglé — soit ça sonne comme du travail qu'il devra faire, et il n'en veut pas. L'analogie saute par-dessus : elle est plus courte à dire, plus facile à comprendre, et elle le laisse conclure lui-même. C'est pour ça qu'une liste de fonctionnalités convainc moins qu'une image. [SOURCE EXTERNE — praticien, non vérifiée chez nous : A. Hormozi]",
  },
  {
    rule: "Le miroir : montrer le client qui part chez le concurrent, pas le produit.",
    why: "« Celui qui tombe sur le répondeur ne laisse pas de message — il appelle le suivant. Vous ne saurez jamais qu'il a appelé. » La perte invisible est plus forte que le gain promis.",
  },
  {
    rule: "UNE seule capacité à la bascule.",
    why: "Une capacité se ressent ; trois se comparent. Le reste se montre en RDV, ça ne se raconte pas au téléphone.",
  },
  {
    rule: "CTA en choix fermé, jamais ouvert : « fin de semaine ou début de la prochaine ? »",
    why: "Ne jamais raccrocher sans un créneau. Un « je vous rappelle » n'est pas un next step.",
  },
  {
    rule: "Le coup du méta — au moment exact du « là je n'ai pas le temps ».",
    why: "Retourner l'appel à froid en démonstration : « avec l'agent, vous ne l'auriez même pas su, vous auriez reçu un SMS et vous décidiez tranquillement. » Le sourire dans la voix, sinon ça passe pour un reproche.",
  },
  {
    rule: "La carte forte se garde pour le signal d'intérêt.",
    why: "L'argument qui transforme un « pas mal » en « quand est-ce qu'on se voit » (l'acompte, le paiement immédiat) se sort APRÈS un signal — question, silence intéressé. Balancé trop tôt, il noie le diagnostic.",
  },
  {
    rule: "Tout chiffre € est diagnostique, jamais audité — et on le dit.",
    why: "« Estimations, à valider avec vos vrais chiffres. Même divisé par deux, ça reste supérieur au coût. » L'honnêteté sur l'incertitude rend le chiffre crédible au lieu de le fragiliser.",
  },
  {
    rule: "Chaque donnée d'audit porte son niveau de confiance : confirmé / estimé / à lever sur place.",
    why: "Un audit qui distingue ce qu'il sait de ce qu'il suppose se fait respecter. Et le commercial sait exactement quoi vérifier en ouverture de RDV.",
  },
  {
    rule: "Framing réputation : on ne répare pas, on protège.",
    why: "« Votre 5,0 c'est de l'or — mais il ne parle que des clients qui vous ont eu au téléphone. Ceux qui sont tombés dans le vide n'ont pas laissé d'avis. » Fonctionne même (surtout) chez les excellents.",
  },
  {
    rule: "Relire les noms avant d'envoyer.",
    why: "Un prénom faux dans la ligne de salutation détruit tout le travail d'audit qui précède. Vérification humaine obligatoire — c'est le point où l'automatisation coûte plus qu'elle ne rapporte.",
  },
];

export interface OpenerStep {
  label: string;
  line: string;
  note?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * « CE PROSPECT RATE DES APPELS » — la famille de formulations, pas une phrase.
 *
 * Deux verticales interdisent cette affirmation (maîtrise d'ouvrage, équipe
 * terrain) : chez elles, la perte n'est pas l'appel qui sonne dans le vide,
 * c'est le contact déjà rencontré que personne n'a rappelé. Le dire quand même
 * ne rate pas seulement la cible — ça prouve qu'on n'a pas compris le métier,
 * et l'appel est fini.
 *
 * ⚠ LE MOTIF A ÉTÉ ÉCRIT DEUX FOIS, ET LA PREMIÈRE VERSION NE MORDAIT PAS.
 *
 * Elle citait la formulation exacte qui vivait dans le catalogue
 * (« appels vous n'arrivez pas à prendre ») à côté d'une branche générique sur
 * « manqué / raté / perdu ». Or la violation réelle ne contenait AUCUN de ces
 * trois mots. Le garde ne tenait donc que par une citation littérale —
 * exactement le défaut qu'il existe pour corriger. Mesuré par mutation.
 *
 * ⚠⚠ ET IL ÉTAIT ÉCRIT DEUX FOIS, une par verticale. Deux copies d'une même
 * règle finissent toujours par diverger, et c'est celle qu'on ne relit pas qui
 * cesse de mordre.
 *
 * La version ci-dessous s'ancre sur l'IDÉE : le mot « appel » à proximité
 * d'une notion de non-prise, dans les deux sens de lecture. Elle reste bornée
 * à la MÊME phrase (`[^.?!]`) — sans ça, un texte qui parle d'appels dans une
 * phrase et de quelqu'un qui ne prend pas dans la suivante déclencherait un
 * faux positif, et un garde qu'il faut faire taire est un garde qu'on retire.
 * ─────────────────────────────────────────────────────────────────────
 */
const MOTIF_APPELS_NON_PRIS = new RegExp(
  [
    // « appels manqués / ratés / perdus / non aboutis / qui sonnent dans le vide »
    /\bappels?\b[^.?!]{0,60}(?:manqu|rat[ée]|perdus?|non abouti|sans réponse|dans le vide|vous ne prenez pas|n'arrivez pas à (?:les )?prendre|personne ne (?:les )?prend)/,
    // « vous ratez / perdez / manquez des appels »
    /(?:ratez|perdez|manquez|ne prenez pas)[^.?!]{0,40}\bappels?\b/,
    /**
     * ⚠ CETTE TROISIÈME BRANCHE A ÉTÉ AJOUTÉE APRÈS UNE MUTATION QUI A
     * SURVÉCU, et c'est la formulation qui vivait RÉELLEMENT sur la vitrine :
     *
     *     « Un client qui n'obtient pas de réponse appelle le suivant dans les
     *       cinq minutes. »
     *
     * Aucun mot d'appel au sens de NOM — « appelle » est un verbe — et ni
     * « manqué », ni « raté », ni « perdu ». Les deux branches précédentes la
     * laissaient passer intacte, alors que c'est exactement l'affirmation que
     * la verticale interdit : le prospect perd des gens parce qu'il ne répond
     * pas assez vite.
     *
     * Deuxième fois que ce motif est corrigé par mutation plutôt que par
     * relecture. La leçon tient en une ligne : un garde par motif n'attrape
     * que ce qu'on a déjà vu, et il faut le rouvrir chaque fois qu'on
     * rencontre une tournure neuve.
     */
    /(?:n'obtient|sans|jamais de|pas de) r[ée]ponse[^.?!]{0,50}(?:appelle|contacte|part|va voir)/,
    /(?:appelle|contacte|va voir)\s+(?:le|un|les)\s+(?:suivant|concurrent|autre)/,
  ]
    .map((r) => r.source)
    .join("|"),
  "i"
);

/** Un interdit d'appel à froid : la règle pour l'humain, le motif pour la machine. */
export interface InterditFroid {
  /** La phrase telle qu'elle se lit — elle doit dire POURQUOI, pas seulement quoi. */
  regle: string;
  /**
   * La forme refusée dans un script assemblé. Absent quand l'interdit relève
   * du jugement et non de la formulation.
   */
  motif?: RegExp;
}

export interface VerticalPlaybook {
  id: string;
  label: string;
  /**
   * D'où vient ce playbook.
   *
   * ⚠ L'en-tête de ce fichier promet « pas de la théorie : extrait des
   * documents réels produits sur le terrain ». Ajouter une verticale écrite au
   * bureau sans le dire transformerait cette promesse en mensonge, et la
   * session suivante servirait un script inventé en croyant rejouer une
   * méthode éprouvée. C'est exactement la distinction que `lib/references.ts`
   * impose déjà aux sources extérieures : le niveau de preuve voyage avec le
   * contenu, il ne se déduit pas.
   *
   * `"doctrine"` = écrit à partir des invariants, ZÉRO appel derrière. Lu par
   * le ciblage LinkedIn, qui en fait un risque affiché.
   *
   * Absent = non déclaré. Les verticales historiques ne portent rien : je ne
   * peux pas certifier a posteriori lesquelles ont vraiment été jouées au
   * téléphone, et les marquer « terrain » en bloc serait inventer la preuve
   * que ce champ existe pour protéger.
   */
  preuve?: "terrain" | "doctrine";
  /**
   * Quelle OFFRE cette verticale sert.
   *
   * ⚠ Ce champ existe parce qu'une hypothèse tacite vient de devenir fausse.
   * `approcheEcrite` décidait d'enrichir le message avec l'observation de
   * métier du playbook sur le seul test `offre === "alpha-voice"` — et c'était
   * juste tant que les neuf verticales parlaient toutes du téléphone qui tombe
   * dans le vide. Un test le vérifiait d'ailleurs explicitement.
   *
   * La maîtrise d'ouvrage casse ça : elle sert l'OS de vente, pas Alpha Voice.
   * Laissée sans ce champ, son critère (« le rythme des réservations
   * conditionne le lancement de l'opération ») aurait été servi comme
   * observation dans un message d'audit téléphonique — soit exactement le
   * défaut que `approcheEcrite` a déjà été écrit pour corriger une fois.
   *
   * Absent = `alpha-voice`, l'hypothèse historique. Elle n'est pas laissée à
   * la confiance : un test refuse une verticale sans `offre` dont le critère
   * ne parle pas du téléphone.
   */
  offre?: EagleyeOffer;
  /** Secteurs de l'app couverts par cette verticale. */
  sectors: Sector[];
  /** Le critère de ciblage — ce qui fait qu'on l'appelle LUI. */
  criterion: string;
  /** La douleur structurelle : pourquoi le téléphone tombe dans le vide. */
  structuralPain: string;
  opener: OpenerStep[];
  /** Questions de diagnostic — poser, puis se taire. */
  diagnostic: string[];
  mirror: string;
  /**
   * ─────────────────────────────────────────────────────────────────────
   * CE QU'ON NE DIT PAS À FROID, en plus des interdits généraux.
   *
   * ⚠ C'ÉTAIT UN `string[]`, DONC DE LA PROSE QUE PERSONNE NE POUVAIT
   * VÉRIFIER — et la contradiction est arrivée exactement là où on
   * l'attendait.
   *
   * La verticale `maitrise-ouvrage` interdit « vous ratez des appels ».
   * `OFFRES["alpha-voice"].perte` demandait « combien d'appels vous n'arrivez
   * pas à prendre ». `buildVoiceScript` injecte les DEUX dans le même prompt :
   * l'interdit et sa violation, à trois lignes d'écart. Rien n'a bronché,
   * parce qu'un interdit écrit en français n'a jamais rencontré le script.
   *
   * Chaque entrée porte donc, dans le MÊME objet :
   *  · `regle` — la phrase lue par l'humain, qui explique POURQUOI ;
   *  · `motif` — optionnel, la forme que la machine sait refuser.
   *
   * ⚠⚠ UNE SEULE ENTRÉE, DEUX LECTEURS. Ranger les motifs dans un second
   * tableau à côté aurait recréé le défaut qu'on corrige : deux listes, une
   * qui dérive, et c'est toujours celle qui n'est pas testée qui reste juste
   * en apparence.
   *
   * ⚠ `motif` est ABSENT quand l'interdit ne se réduit pas à une forme
   * (« citer son permis à froid » est un jugement de situation, pas une
   * chaîne). Ne JAMAIS en fabriquer un approximatif pour faire du chiffre :
   * un motif trop large refuse des scripts corrects, et on l'assouplira
   * jusqu'à ce qu'il ne serve plus à rien. `tests/playbook-interdits.test.ts`
   * compte ceux qui sont exécutables et refuse que le total tombe à zéro.
   * ─────────────────────────────────────────────────────────────────────
   */
  forbidden: InterditFroid[];
  objections: { q: string; a: string }[];
  /**
   * Paramètres de chiffrage de la fuite (ordre de grandeur, à valider).
   *
   * ⚠ OPTIONNEL, et ce n'est pas une commodité. Ces quatre nombres décrivent
   * une fuite d'APPELS ENTRANTS : ils n'ont aucun sens pour une verticale qui
   * ne perd pas d'appels. La première version de la maîtrise d'ouvrage les
   * mettait à zéro « pour ne rien inventer » — et le prompt système annonçait
   * alors à l'IA « ordre de grandeur de la fuite : ≈ 0 €/mois », c'est-à-dire
   * un chiffre FAUX au lieu d'un blanc. Zéro donnée doit rendre zéro chiffre,
   * pas le chiffre zéro : l'angle mort se dit, il ne se remplit pas.
   */
  leak?: { callsPerMonth: number; missRate: number; avgTicket: number; convertRate: number };
}

export const VERTICALS: VerticalPlaybook[] = [
  {
    id: "immobilier",
    label: "Immobilier — transaction & gestion",
    // Verticales « métier » : rattachées par mots-clés de la fiche, pas
    // par le secteur générique de l'app (voir verticalForProspect).
    sectors: [],
    criterion: "Les métiers où le premier qui décroche prend l'affaire : le mandat va à la première agence qui répond.",
    structuralPain:
      "Les vendeurs et acquéreurs appellent le soir, le midi et le week-end — exactement quand l'agence est fermée ou en visite. Un vendeur qui veut faire estimer appelle trois agences ; les deux qui n'ont pas décroché ne sauront jamais qu'elles sont passées à côté.",
    opener: [
      {
        label: "Barrage",
        line: "Bonjour, je cherche à joindre le directeur ou la directrice de l'agence. C'est pour lui proposer un rendez-vous de quinze minutes où on l'aide à ne plus perdre de mandats le soir et le week-end. Il/elle est là ce matin ?",
        note: "Transmissible en 10 secondes. Ne JAMAIS la rejouer au décideur.",
      },
      { label: "Permission", line: "Je vous appelle à froid, je fais très court : trente secondes, et si c'est pas pour vous, vous me le dites et je raccroche. Ça marche ?" },
      {
        label: "Ciblage",
        line: "Je n'appelle pas au hasard : je travaille avec les métiers où le premier qui décroche prend l'affaire. L'immobilier, c'est le cas typique. Et chez vous, si j'ai bien vu, vous fermez le week-end, c'est bien ça ?",
        note: "L'observation en question, jamais en affirmation.",
      },
      { label: "Bascule", line: "On installe un accueil qui décroche à toute heure, prend la demande — vente, estimation, visite — et vous en envoie le résumé par SMS. Vous récupérez les mandats que vous perdez sans le savoir." },
      { label: "CTA", line: "Quinze minutes en visio pour vous montrer sur votre secteur — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: ["Vos appels acquéreurs et vendeurs le soir, le midi, le week-end — ils tombent où ?"],
    mirror:
      "Un vendeur qui veut faire estimer appelle trois agences. La première qui décroche prend le mandat. Les deux autres ne sauront jamais qu'elles sont passées à côté.",
    forbidden: [
      { regle: "Le lien de paiement / l'acompte : ça ne parle pas à une agence, ça fait du bruit." },
      { regle: "Le détail du transfert conditionnel et de la prise de RDV automatique — ça se montre en visio." },
    ],
    objections: [
      { q: "J'ai déjà une assistante / un standard.", a: "Elle ne prend qu'un appel à la fois — c'est physique. Trois personnes qui appellent en même temps, deux tombent dans le vide. Elle n'est pas remplacée, elle arrête juste de rater des appels." },
      { q: "Mes agents rappellent toujours.", a: "Le rappel, c'est demain. Le mandat, c'est aujourd'hui, au premier qui décroche. Vous voulez être le rappel ou le premier ?" },
      { q: "On n'a pas tant d'appels manqués.", a: "C'est ce qu'on croit tous — jusqu'à les compter. Je vous propose un test : on mesure une semaine, et on regarde ensemble." },
      { q: "Envoyez-moi un mail.", a: "Avec plaisir, je vous l'envoie en sortant. Mais un mail se perd — laissez-moi 15 minutes, et si ça vous parle pas vous jetez. On dit fin de semaine ?" },
      { q: "Ça coûte combien ?", a: "Des frais d'installation, puis un abonnement dimensionné à votre volume d'appels. C'est exactement ce qu'on cale en 15 minutes — je préfère un chiffre juste qu'un chiffre au hasard." },
    ],
    leak: { callsPerMonth: 220, missRate: 0.25, avgTicket: 4500, convertRate: 0.08 },
  },
  {
    /**
     * ── MAÎTRISE D'OUVRAGE — la cible de l'offre VIP, et la seule verticale
     * de ce fichier qui ne parle PAS d'appels manqués. ──
     *
     * Trois défauts mesurés avant d'écrire cette entrée, tous sur cette cible :
     *  · « Permis de construire accordé — 48 logements » tombait sur la
     *    verticale AUTO-ÉCOLE, par le mot « permis » ;
     *  · « Promoteur immobilier » tombait sur « Immobilier — transaction &
     *    gestion », donc on lui servait « ne plus perdre de mandats le
     *    week-end » — un promoteur ne prend pas de mandat ;
     *  · « Maître d'ouvrage » et « aménageur » ne tombaient nulle part : −30
     *    au score de ciblage LinkedIn et message générique.
     *
     * ⚠ Et surtout : ce n'est pas le même PRODUIT. Toutes les verticales
     * au-dessus vendent Alpha Voice — le téléphone qui tombe dans le vide.
     * Ici on vend l'OS de vente à un maître d'ouvrage qui a des lots à écouler
     * et un cycle de 12 à 24 mois. Servir « vous ratez des appels » à un
     * directeur de programmes, c'est se disqualifier en une phrase, exactement
     * comme pour les équipes terrain.
     */
    id: "maitrise-ouvrage",
    label: "Maîtrise d'ouvrage — promotion & aménagement",
    preuve: "doctrine",
    offre: "alpha-sales-os",
    /**
     * ⚠ C'ÉTAIT `[]`, ET ÇA LAISSAIT UN TROU. `verticalForProspect` cherche
     * TAG, puis texte, puis SECTEUR. Une fiche de maîtrise d'ouvrage importée
     * par CSV n'a pas de tag de verticale et ses notes ne contiennent aucun
     * mot-clé d'ici : elle tombait donc sur `verticalForSector("autre")`,
     * c'est-à-dire la verticale GÉNÉRIQUE. Le script du marché en cours
     * existait, il était juste inatteignable par le seul chemin dont dispose
     * un import plat.
     */
    sectors: ["maitrise-ouvrage"],
    criterion:
      "Les maîtres d'ouvrage qui construisent pour VENDRE — promoteurs, aménageurs, constructeurs. Chez eux, le rythme des réservations conditionne le lancement de l'opération.",
    structuralPain:
      "Un programme se commercialise sur douze à vingt-quatre mois, avec des centaines de contacts acquéreurs, une ou deux personnes dédiées et parfois plusieurs agences en co-exclusivité. Le suivi vit dans des tableurs qui ne se parlent pas : personne ne peut dire, un mardi matin, quels contacts intéressés n'ont pas été rappelés depuis trois semaines. Ce ne sont pas des appels manqués, ce sont des acquéreurs déjà chauds qu'on laisse refroidir.",
    opener: [
      {
        label: "Barrage",
        line: "Bonjour, je cherche la personne qui suit la commercialisation des programmes. C'est au sujet des contacts acquéreurs qui restent sans relance entre deux points hebdo.",
        note: "On nomme SA perte, pas notre outil. Ne JAMAIS la rejouer au décideur.",
      },
      { label: "Permission", line: "Je vous appelle à froid, trente secondes : si ce n'est pas pour vous, vous me le dites et je raccroche. Ça marche ?" },
      {
        label: "Ciblage",
        line: "Je n'appelle pas au hasard : je travaille avec les maîtres d'ouvrage qui ont un programme en cours de commercialisation. Vous en avez un en ce moment, c'est bien ça ?",
        note: "L'observation en question, jamais en affirmation — même quand le permis est public.",
      },
      {
        /**
         * ⚠ Cette ligne énumérait trois capacités (« sa date, son niveau
         * d'intérêt, sa prochaine relance ») — c'est-à-dire un descriptif de
         * fonctionnalités, exactement ce que la règle de l'analogie interdit.
         * Réécrite en UNE affirmation + UNE analogie prise dans SON métier.
         */
        label: "Bascule",
        line: "On installe le système qui tient la liste des acquéreurs à votre place. C'est le même principe qu'un planning de chantier : on ne le regarde pas pour savoir ce qui est fait, on le regarde pour voir ce qui a pris du retard.",
        note: "Une affirmation, une analogie, zéro fonctionnalité. Le détail se montre en visio.",
      },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur votre programme en cours — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Un acquéreur qui a visité il y a trois semaines et qui n'a pas été rappelé — comment vous le sauriez, aujourd'hui ?",
      "Le suivi des contacts sur le programme, il vit où exactement ?",
      "Entre vous et les agences qui commercialisent, qui a la liste à jour ?",
    ],
    mirror:
      "Ce ne sont pas les acquéreurs que vous n'avez jamais rencontrés qui vous coûtent le plus cher. Ce sont ceux qui sont venus, qui étaient intéressés, et que personne n'a rappelés — ils achètent le programme d'en face, et vous ne saurez jamais que vous les aviez eus.",
    forbidden: [
      {
        regle: "« Vous ratez des appels » : faux ici, et ça prouve qu'on n'a pas compris le métier.",
        /**
         * ⚠ LE MOTIF VISE LA FAMILLE, PAS LA CITATION.
         *
         * Chercher « vous ratez des appels » à la lettre n'aurait rien
         * attrapé : la violation réelle était formulée « combien d'appels
         * vous n'arrivez pas à prendre ». Un garde qui n'attrape que la
         * recopie exacte laisse passer la seule chose qui arrive vraiment —
         * une reformulation de bonne foi.
         */
        motif: MOTIF_APPELS_NON_PRIS,
      },
      { regle: "Citer son permis, son adresse ou son nombre de lots à froid : la donnée est publique, mais l'annoncer sonne fliqué. Elle sert à CHOISIR qui on appelle, pas à ouvrir l'appel." },
      { regle: "Tout chiffre de taux de réservation : on ne connaît pas ses seuils bancaires, et se tromper devant lui coûte l'appel." },
    ],
    objections: [
      {
        q: "La commercialisation, c'est l'agence qui la fait.",
        a: "Justement : c'est elle qui a la liste, et vous qui portez le risque de l'opération. La question n'est pas qui appelle, c'est qui voit l'état réel du fichier le matin. Aujourd'hui, vous le voyez quand ?",
      },
      {
        q: "On a déjà un CRM / un tableur qui marche très bien.",
        a: "S'il marche, on n'y touche pas. Ce que je regarde, c'est ce qui n'y est PAS : les intéressés sans prochaine date. Quinze minutes pour vous montrer où ils sont, et si le tableur les a déjà, vous m'aurez fait perdre mon temps et pas le vôtre.",
      },
      {
        q: "On est en fin de programme, il reste trois lots.",
        a: "Ce sont les trois plus longs à écouler, et les plus chers à porter. C'est exactement le moment où une relance oubliée se voit sur la trésorerie.",
      },
      { q: "Ça coûte combien ?", a: "Il y a une offre à 10 000 € et une formule au résultat. Laquelle est la bonne dépend de votre volume de programmes — c'est ce qu'on cale en quinze minutes, je préfère un chiffre juste qu'un chiffre au hasard." },
    ],
    /**
     * ⚠ PAS DE BLOC `leak`, ET C'EST LE POINT.
     *
     * Le chiffrage de fuite du playbook compte des APPELS MANQUÉS. Un maître
     * d'ouvrage n'en perd pas : ce qu'il perd, ce sont des acquéreurs déjà
     * rencontrés que personne n'a rappelés. Le convertir en euros demanderait
     * son prix moyen au lot et son taux de transformation — deux chiffres
     * qu'on n'a pas, et qui varient d'un programme à l'autre.
     *
     * Alors on ne chiffre pas. C'est la règle « zéro donnée → zéro chiffre » :
     * un montant inventé à partir d'hypothèses d'accueil téléphonique se
     * ferait démonter au premier rendez-vous, et par quelqu'un dont c'est le
     * métier de faire des plans de financement.
     */
  },
  {
    id: "auto-ecole",
    label: "Auto-écoles",
    sectors: [],
    criterion: "Les métiers où le patron est sur le terrain, pas derrière un bureau — et où le téléphone EST le chiffre d'affaires.",
    structuralPain:
      "Beaucoup n'ouvrent que l'après-midi : chaque matin, le téléphone sonne dans le vide pendant quatre à cinq heures. Et quand le gérant est sur le plateau ou en leçon, personne ne prend l'inscription.",
    opener: [
      {
        label: "Barrage",
        line: "Bonjour, je cherche à joindre le gérant. C'est pour lui proposer un rendez-vous de quinze minutes où on l'aide à ne plus rater d'inscriptions quand il est sur le plateau. Il est là ?",
      },
      { label: "Permission", line: "Je vous appelle à froid, très court : trente secondes, et si c'est pas pour vous, vous me le dites et je raccroche. Ça marche ?" },
      {
        label: "Ciblage",
        line: "Je travaille avec les métiers où le téléphone est le chiffre d'affaires et où le patron est sur le terrain — l'auto-école, c'est le cas d'école. Et chez vous, si j'ai bien vu, vous n'ouvrez que l'après-midi, c'est ça ?",
      },
      { label: "Bascule", line: "On installe un accueil qui décroche à votre place, prend l'élève et ses coordonnées, et vous envoie le résumé par SMS. Vous continuez à conduire, lui capte tout ce que vous ratez." },
      { label: "CTA", line: "Quinze minutes en visio pour vous montrer sur votre auto-école — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Et le matin, quand vous êtes fermés, les appels tombent où ?",
      "Et quand vous êtes sur le plateau ou en leçon et que ça sonne pour une inscription — il se passe quoi ?",
    ],
    mirror:
      "Celui qui tombe sur le répondeur ne laisse pas de message — il appelle l'auto-école suivante. Et c'est une formation à mille deux cents, mille quatre cents euros qui vient de partir. Vous ne saurez jamais qu'il a appelé.",
    forbidden: [
      { regle: "Le détail de l'intégration planning et des appels simultanés — ça se montre en visio." },
    ],
    objections: [
      { q: "On a déjà un répondeur.", a: "C'est justement le problème : sur un répondeur, personne ne rappelle. L'agent, lui, parle, prend l'inscription et les coordonnées. C'est le jour et la nuit." },
      { q: "Le matin on est fermés, c'est normal.", a: "Bien sûr. Mais vos futurs élèves, eux, appellent quand ça les arrange — souvent le matin ou le soir. Vous êtes fermés, l'auto-école d'à côté ne l'est peut-être pas." },
      { q: "Je suis avec un élève, là.", a: "Jouer le coup du méta, puis : « fin de semaine ou début de la prochaine ? » Ne jamais raccrocher sans créneau." },
      { q: "C'est cher.", a: "Une seule inscription récupérée dans le mois et c'est remboursé. Vous en ratez combien par semaine, à votre avis ? (silence — le laisser faire le calcul)" },
    ],
    leak: { callsPerMonth: 180, missRate: 0.35, avgTicket: 1300, convertRate: 0.15 },
  },
  {
    id: "garage-carrosserie",
    label: "Garage & carrosserie",
    sectors: [],
    criterion: "Les métiers où l'atelier tourne et le téléphone sonne en même temps.",
    structuralPain:
      "Structure à deux ou trois : quand tout le monde est sous une voiture, il n'y a personne pour le téléphone. Pas de secrétaire à convaincre — le problème est structurel, pas accidentel. Et le téléphone n'y sert pas qu'à vendre : il orchestre le dossier (client sinistré, expert, assureur, suivi de réparation).",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le gérant — c'est au sujet des appels qui arrivent pendant que vous êtes à l'atelier. Il est là ?" },
      { label: "Permission", line: "Je vous appelle à froid, trente secondes : si c'est pas pour vous, vous me le dites et je raccroche." },
      { label: "Ciblage", line: "Je travaille avec les métiers où l'atelier tourne et le téléphone sonne en même temps. La carrosserie, c'est exactement ça. Vous êtes combien à l'atelier ?" },
      { label: "Bascule", line: "On installe un accueil qui décroche quand vous avez les mains dedans, prend la demande et vous envoie le résumé par SMS." },
      { label: "CTA", line: "Quinze minutes pour vous montrer — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Quand vous êtes tous les deux sous une voiture et que ça sonne, il se passe quoi ?",
      "Vos clients assurance, ils vous appellent en premier ou après avoir essayé un autre carrossier ?",
    ],
    mirror:
      "Le client sinistré a une liste de carrossiers agréés. Il appelle dans l'ordre. Le premier qui décroche prend le dossier — et le dossier, c'est plusieurs centaines d'euros.",
    forbidden: [
      { regle: "Le dashboard « le leur » tant qu'il n'existe pas : rester sur « voilà ce que vous verriez »." },
    ],
    objections: [
      { q: "On est deux, on gère.", a: "Justement — quand vous êtes deux sous des voitures, vous êtes à zéro sur le téléphone. L'agent, c'est votre troisième paire de mains, celle qui décroche." },
      { q: "Les assurances nous envoient déjà des clients.", a: "Oui, et ces clients-là appellent souvent plusieurs carrossiers de la liste. Le premier qui décroche prend le dossier. L'agent fait que ce soit toujours vous." },
      { q: "Un robot au téléphone, ça fait fuir.", a: "Vous venez de l'entendre — dites-moi franchement si ça sonnait robot. Et la vraie question : mieux vaut un accueil qui répond, ou une sonnerie dans le vide ?" },
      { q: "On débute, c'est pas le moment d'investir.", a: "C'est le meilleur moment, au contraire : vous construisez votre base client maintenant. Chaque appel raté aujourd'hui, c'est un client que vous ne fidéliserez jamais." },
    ],
    leak: { callsPerMonth: 160, missRate: 0.25, avgTicket: 700, convertRate: 0.18 },
  },
  {
    id: "sante-cabinet",
    label: "Santé — cabinets & centres",
    sectors: [],
    criterion: "Les structures où le soin et le standard se disputent la même personne : le secrétariat lâche le téléphone dès qu'un patient est au comptoir.",
    structuralPain:
      "Le patient qui n'obtient pas de réponse ne rappelle pas : il prend le premier créneau disponible ailleurs, souvent en ligne. Chaque appel perdu est un fauteuil vide — et un fauteuil vide ne se rattrape jamais.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche la personne qui gère l'organisation du cabinet — c'est au sujet des appels patients non pris aux heures de pointe." },
      { label: "Permission", line: "Trente secondes, et si ce n'est pas pour vous, vous me le dites et je raccroche." },
      { label: "Ciblage", line: "Je travaille avec les cabinets où le secrétariat doit choisir entre le patient au comptoir et celui au téléphone. Aux heures de pointe, chez vous, ça se passe comment ?" },
      { label: "Bascule", line: "On installe un accueil qui prend les appels que le secrétariat ne peut pas prendre, qualifie la demande et transmet le résumé." },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur votre cabinet — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Aux heures de pointe, combien d'appels tombent pendant que le secrétariat est avec un patient ?",
      "Un patient qui n'a personne au bout du fil, il rappelle ou il va ailleurs ?",
    ],
    mirror:
      "Un fauteuil vide ne se rattrape pas. Le patient qui n'a pas eu de réponse a déjà pris rendez-vous ailleurs — et vous ne saurez jamais qu'il a appelé.",
    forbidden: [
      { regle: "Toute promesse touchant au secret médical ou au tri clinique : l'agent prend des demandes, il ne fait pas de médecine." },
    ],
    objections: [
      { q: "On a un secrétariat.", a: "Il ne prend qu'un appel à la fois. L'agent prend les autres — celui-là n'est pas remplacé, il arrête juste de rater des appels." },
      { q: "Nos patients n'aiment pas les robots.", a: "Ils aiment encore moins la sonnerie dans le vide. Et la vraie question : préférez-vous qu'ils entendent quelqu'un, ou rien ?" },
      { q: "On est complets de toute façon.", a: "Un carnet plein se vide par les annulations. Ce sont exactement les appels que personne ne prend qui les remplissent." },
    ],
    leak: { callsPerMonth: 400, missRate: 0.3, avgTicket: 180, convertRate: 0.35 },
  },

  // ── Verticales natives EAGLEYE — rattachées aux secteurs de l'app ──
  {
    id: "restauration",
    label: "Restaurants",
    sectors: ["restaurant"],
    criterion: "Les métiers où le téléphone sonne exactement au pire moment : pendant le service.",
    structuralPain:
      "Le coup de feu et le téléphone tombent en même temps. Les réservations arrivent pendant qu'on est en salle, et hors service il n'y a personne. Le client qui n'a personne au bout du fil réserve ailleurs — il ne rappelle jamais.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le patron — c'est au sujet des appels qui arrivent pendant le service. Il est là ?" },
      { label: "Permission", line: "Je vous appelle à froid, trente secondes : si c'est pas pour vous, vous me le dites et je raccroche. Ça marche ?" },
      {
        label: "Ciblage",
        line: "Je travaille avec les métiers où le téléphone sonne au pire moment — la restauration, c'est le cas type. Chez vous, en plein service, c'est qui qui décroche ?",
        note: "L'observation en question : il énonce lui-même le problème.",
      },
      { label: "Bascule", line: "On installe un accueil qui décroche pendant le service, prend la réservation et vous envoie le résumé. Vous restez en salle, lui capte tout ce qui passe." },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur votre restaurant — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "En plein coup de feu, quand ça sonne, il se passe quoi ?",
      "Et entre les services, quand la salle est fermée — les appels tombent où ?",
    ],
    mirror:
      "Celui qui tombe sur le répondeur ne laisse pas de message : il réserve au restaurant d'à côté. Vous ne saurez jamais qu'il a appelé — il n'apparaîtra nulle part.",
    forbidden: [
      { regle: "Le détail du logiciel de réservation et des intégrations — ça se montre, ça ne se raconte pas." },
    ],
    objections: [
      { q: "On a déjà TheFork / une plateforme.", a: "Et vous leur payez une commission sur chaque couvert. Une réservation prise en direct, c'est votre table, sans commission." },
      { q: "On rappelle toujours après le service.", a: "Le rappel, c'est dans trois heures. La table, elle est réservée dans les dix minutes — chez celui qui a décroché." },
      { q: "J'ai pas le temps là.", a: "Jouer le coup du méta, puis : « fin de semaine ou début de la prochaine ? » Jamais raccrocher sans créneau." },
    ],
    leak: { callsPerMonth: 300, missRate: 0.35, avgTicket: 55, convertRate: 0.4 },
  },
  {
    id: "bar-pub",
    label: "Bars & pubs",
    sectors: ["pub"],
    criterion: "Les établissements dont le chiffre se joue sur les soirées et les privatisations — et dont personne ne décroche en journée.",
    structuralPain:
      "L'équipe arrive en fin d'après-midi : toute la journée, les appels de privatisation, de groupes et d'événements tombent dans le vide. Or ce sont les appels les plus rentables — une privatisation vaut une soirée entière.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le gérant — c'est au sujet des demandes de privatisation qui arrivent en journée. Il est là ?" },
      { label: "Permission", line: "Appel à froid, trente secondes, et si c'est pas pour vous je raccroche. Ça marche ?" },
      { label: "Ciblage", line: "Je travaille avec les établissements où le chiffre se fait le soir mais où les demandes arrivent en journée. Chez vous, avant l'ouverture, qui prend les appels ?" },
      { label: "Bascule", line: "On installe un accueil qui décroche en journée, prend la demande de groupe ou d'événement et vous envoie le résumé avant l'ouverture." },
      { label: "CTA", line: "Quinze minutes pour vous montrer — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Les demandes de privatisation, elles vous arrivent comment aujourd'hui ?",
      "Et en journée, avant l'ouverture, les appels tombent où ?",
    ],
    mirror:
      "Une soirée d'entreprise se décide dans la journée, sur trois appels. Celui qui décroche prend la privatisation — et c'est votre plus grosse soirée du mois qui part ailleurs.",
    forbidden: [
      { regle: "La billetterie et l'agenda automatisé : ça se montre en RDV." },
    ],
    objections: [
      { q: "On est connus, les gens viennent.", a: "Justement — capitalisez dessus. Les habitués viennent seuls ; les groupes, eux, appellent. Et en journée, personne ne répond." },
      { q: "On a Instagram.", a: "On ne privatise pas une salle sur Instagram. La demande de groupe passe par le téléphone, toujours." },
      { q: "C'est cher.", a: "Une privatisation récupérée dans le mois et c'est remboursé. Vous en ratez combien, à votre avis ? (silence)" },
    ],
    leak: { callsPerMonth: 200, missRate: 0.4, avgTicket: 400, convertRate: 0.12 },
  },
  {
    id: "ambulance",
    label: "Ambulances & transport sanitaire",
    sectors: ["ambulance"],
    criterion: "Les métiers où le standard sature aux heures de pointe et où la demande non prise part chez le confrère dans la minute.",
    structuralPain:
      "Le standard sature entre 8h et 10h, exactement quand les établissements passent leurs commandes de transport. Et les demandes de nuit se perdent entièrement. Une course non prise ne se rattrape pas : elle est passée au confrère suivant sur la liste.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le responsable d'exploitation — c'est au sujet des appels non pris aux heures de pointe. Il est là ?" },
      { label: "Permission", line: "Appel à froid, trente secondes : si ce n'est pas pour vous, vous me le dites et je raccroche." },
      { label: "Ciblage", line: "Je travaille avec les métiers où le standard sature aux heures de pointe. Le transport sanitaire, c'est le cas type. Le matin entre 8h et 10h, chez vous, ça se passe comment ?" },
      { label: "Bascule", line: "On installe un accueil qui prend les demandes que le standard ne peut pas prendre, note le transport et vous transmet le résumé." },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur votre exploitation — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Entre 8h et 10h, combien d'appels vous n'arrivez pas à prendre ?",
      "Et les demandes qui arrivent la nuit, elles vont où ?",
    ],
    mirror:
      "Un établissement qui n'a personne au bout du fil appelle le transporteur suivant. La course est partie en trente secondes — et le compte avec elle, parce que la prochaine fois il appellera l'autre en premier.",
    forbidden: [
      { regle: "Toute promesse touchant la régulation médicale ou l'urgence vitale : l'agent prend des demandes de transport, il ne régule rien." },
    ],
    objections: [
      { q: "On a un standard dédié.", a: "Il prend un appel à la fois. Aux heures de pointe, trois établissements appellent en même temps — deux tombent dans le vide." },
      { q: "Nos clients nous connaissent, ils rappellent.", a: "Un service hospitalier ne rappelle pas : il descend sa liste. Le premier disponible prend la course." },
      { q: "C'est réglementé, ça ne marchera pas.", a: "L'agent ne régule rien : il prend la demande et vous la transmet. Ce sont vos équipes qui décident, comme aujourd'hui." },
    ],
    leak: { callsPerMonth: 500, missRate: 0.25, avgTicket: 120, convertRate: 0.45 },
  },
  {
    id: "artisan-batiment",
    label: "Artisans & bâtiment",
    sectors: ["artisan"],
    criterion: "Les métiers où l'artisan est sur le chantier toute la journée — donc jamais près du téléphone.",
    structuralPain:
      "Sur un chantier, on ne décroche pas : les mains sont prises, il y a du bruit, et le client qui appelle pour un devis tombe systématiquement sur la messagerie. Or une demande de devis n'attend pas : elle part chez le prochain artisan de la liste.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le patron — c'est au sujet des demandes de devis qui arrivent pendant les chantiers." },
      { label: "Permission", line: "Appel à froid, trente secondes, et si c'est pas pour vous je raccroche. Ça marche ?" },
      { label: "Ciblage", line: "Je travaille avec les métiers où le patron est sur le chantier toute la journée, donc jamais près du téléphone. C'est votre cas ?" },
      { label: "Bascule", line: "On installe un accueil qui décroche pendant que vous êtes sur le chantier, prend la demande de devis et vous envoie le résumé par SMS." },
      { label: "CTA", line: "Quinze minutes pour vous montrer — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Quand vous êtes sur un chantier et que ça sonne, il se passe quoi ?",
      "Les demandes de devis, vous les récupérez comment aujourd'hui ?",
    ],
    mirror:
      "Une demande de devis n'attend pas. Celui qui tombe sur la messagerie appelle l'artisan suivant — et c'est un chantier entier qui part, sans que vous sachiez qu'il a appelé.",
    forbidden: [
      { regle: "Le devis automatisé : à ne promettre qu'après validation technique, sinon c'est une promesse en l'air." },
    ],
    objections: [
      { q: "Je rappelle le soir.", a: "Le soir, il a déjà eu deux autres devis. Le chantier va au premier qui a répondu, pas au meilleur qui a rappelé." },
      { q: "J'ai déjà trop de travail.", a: "Alors l'agent vous sert à trier : il prend tout, vous ne rappelez que ce qui vaut le coup. Aujourd'hui vous ne choisissez pas, vous subissez." },
      { q: "Ma femme / ma secrétaire prend les appels.", a: "Elle prend un appel à la fois, et pas la nuit ni le week-end. Elle n'est pas remplacée, elle arrête juste de rater des demandes." },
    ],
    leak: { callsPerMonth: 140, missRate: 0.4, avgTicket: 1800, convertRate: 0.1 },
  },
  {
    // ⚠ Ces deux verticales ne vendent PAS la même chose que les précédentes.
    // Au-dessus, on vend à une entreprise qui rate ses appels entrants. Ici, on
    // vend à une organisation qui a DÉJÀ des commerciaux : elle ne rate pas ses
    // appels, elle perd ce que ses gens n'ont pas noté. Servir l'argument
    // « vous ratez des appels » à un directeur commercial de 15 personnes, c'est
    // se disqualifier en une phrase.
    id: "equipe-terrain",
    label: "Équipes commerciales terrain (porte-à-porte, rénovation)",
    sectors: [],
    criterion:
      "Les organisations qui font vendre des PERSONNES sur le terrain : toiture, isolation, photovoltaïque, pompe à chaleur, menuiserie. 3 commerciaux ou plus, un secteur découpé, des tournées.",
    structuralPain:
      "Ce qui se dit à la porte reste dans la tête du commercial. Le « rappelez-moi en septembre » n'est écrit nulle part, le devis parti n'est relancé par personne, et le jour où le commercial part, son secteur repart de zéro. Le directeur ne pilote pas une équipe : il pilote des souvenirs.",
    opener: [
      {
        label: "Barrage",
        line: "Bonjour, je cherche le responsable de l'équipe commerciale. C'est au sujet des devis partis qui ne sont relancés par personne.",
        note: "On nomme SA perte, pas notre outil. Transmissible en 10 secondes.",
      },
      { label: "Permission", line: "Je vous appelle à froid, trente secondes : si ce n'est pas pour vous, vous me le dites et je raccroche." },
      {
        label: "Ciblage",
        line: "Je travaille avec les boîtes qui ont des commerciaux sur le terrain plutôt qu'un flux d'appels entrants. Vous êtes combien à faire de la pose de rendez-vous chez le particulier ?",
        note: "La question de taille sert au diagnostic : sous 3 commerciaux, l'argument ne tient pas.",
      },
      {
        label: "Bascule",
        line: "On installe le système qui garde ce que vos commerciaux entendent : chaque visite laisse une trace datée, chaque devis a sa relance programmée, et vous voyez le secteur de chacun sans avoir à le demander.",
      },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur une tournée réelle — plutôt fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Un devis parti la semaine dernière et jamais rappelé — comment vous le sauriez, aujourd'hui ?",
      "Quand un commercial s'en va, il reste quoi de son secteur ?",
      "Le « rappelez-moi dans trois mois », il est noté où ?",
    ],
    mirror:
      "Vos commerciaux ne perdent pas les affaires qu'ils rencontrent — ils perdent celles qu'ils ont bien travaillées et qu'ils n'ont pas relancées. C'est la partie la plus chère du gisement, parce qu'elle est déjà chaude.",
    forbidden: [
      {
        regle: "« Vous ratez des appels » : faux ici, et ça prouve qu'on n'a pas compris son métier.",
        motif: MOTIF_APPELS_NON_PRIS,
      },
      {
        regle: "Le mot CRM à froid : il a déjà essayé, ses commerciaux ne l'ont pas rempli, et il vous rangera là-dedans.",
        motif: /\bcrm\b/i,
      },
    ],
    objections: [
      {
        q: "On a déjà un CRM, personne ne le remplit.",
        a: "C'est exactement le problème qu'on traite. Si ça demande de saisir, ça ne sera pas saisi — c'est humain. Chez nous la trace se crée depuis la voiture, à la voix, en trente secondes. Ce qui n'est pas saisi n'est pas perdu.",
      },
      {
        q: "Mes commerciaux ne voudront pas être fliqués.",
        a: "Question juste. Ce qui remonte, c'est l'affaire, pas la personne — et le premier gagnant c'est le commercial : ses relances lui sont rappelées, donc il signe plus. Ceux qui râlent au début sont ceux qui réclament l'accès au bout de trois semaines.",
      },
      {
        q: "On est trop peu nombreux.",
        a: "Sous trois commerciaux, je vous le dis franchement : ça ne vaut pas l'installation, on en reparle quand vous recrutez. Vous êtes combien aujourd'hui ?",
      },
      {
        q: "Ça coûte combien ?",
        a: "Une installation, puis un abonnement dimensionné à la taille de l'équipe. C'est précisément ce qu'on cale en quinze minutes — je préfère un chiffre juste à un chiffre au hasard.",
      },
    ],
    // Fuite lue en DEVIS non relancés, pas en appels manqués : c'est l'unité de
    // perte réelle de ce métier.
    leak: { callsPerMonth: 120, missRate: 0.35, avgTicket: 9000, convertRate: 0.12 },
  },
  {
    id: "centre-appels",
    label: "Centres d'appels & plateaux",
    sectors: [],
    criterion:
      "Les plateaux de 5 positions et plus : centres d'appels, services de relation client, plateformes de prise de rendez-vous. Ils vivent au volume et à la marge par appel.",
    structuralPain:
      "La qualification et la relance mangent le temps des téléopérateurs les mieux payés. Les heures de pointe débordent, les heures creuses coûtent, et le turnover impose de reformer en continu des gens qui feront les mêmes appels sans intérêt.",
    opener: [
      {
        label: "Barrage",
        line: "Bonjour, je cherche le responsable du plateau ou de la production. C'est au sujet du coût des appels de qualification et de relance.",
      },
      { label: "Permission", line: "Appel à froid, je fais court : trente secondes, et si ce n'est pas pour vous, je raccroche." },
      {
        label: "Ciblage",
        line: "Je travaille avec les plateaux où une partie des appels ne demande aucune compétence humaine — la qualification, la relance, la confirmation de rendez-vous. Vous êtes combien en position ?",
      },
      {
        label: "Bascule",
        line: "On prend cette couche-là en IA — elle se déclare comme telle dès la première phrase, elle qualifie, et elle passe l'appel à vos conseillers quand il devient intéressant. Vos gens ne font plus que ce qui a de la valeur.",
        note: "La divulgation IA n'est pas un détail à cacher : sur ce marché, c'est un argument de conformité.",
      },
      { label: "CTA", line: "Quinze minutes pour chiffrer sur votre volume réel — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Sur cent appels sortants, combien n'aboutissent à rien du tout ?",
      "Vos pics de charge, vous les absorbez comment aujourd'hui ?",
      "Un conseiller formé coûte combien avant d'être rentable, et il reste combien de temps ?",
    ],
    mirror:
      "Vous payez au tarif d'un conseiller formé des appels qui ne demandent pas de conseiller. Ce n'est pas un problème de productivité — c'est une couche de travail qui n'a jamais eu besoin d'être humaine.",
    forbidden: [
      {
        regle: "« On remplace vos équipes » : c'est faux, et ça fait fermer la porte immédiatement.",
        motif: /remplace[rz]? (?:vos|les|votre|leurs?) (?:équipes?|conseillers?|salariés?|collaborateurs?)/i,
      },
      { regle: "Le prix au forfait sans son volume réel : sur ce marché, le prix se dit à la minute et au palier, chiffres en main." },
    ],
    objections: [
      {
        q: "Nos clients ne veulent pas parler à un robot.",
        a: "Ils ne veulent pas d'un robot qui fait semblant. Le nôtre annonce qu'il est une IA à la première phrase — c'est la loi, et c'est ce qui fait tomber l'agacement. Ce qu'ils veulent, c'est ne pas attendre quatre minutes.",
      },
      {
        q: "On a déjà un SVI.",
        a: "Un SVI trie, il ne parle pas. Il ne prend pas une demande hors script et il n'a jamais qualifié personne. C'est une autre catégorie d'objet.",
      },
      {
        q: "Nos scripts sont propriétaires et complexes.",
        a: "Tant mieux : c'est ce qu'on charge. Le script est audité avant mise en service — s'il n'est pas conforme, l'agent refuse de le jouer. Ça vous protège autant que ça nous protège.",
      },
      {
        q: "Et la qualité, comment vous la garantissez ?",
        a: "Chaque appel est transcrit et relu, et le passage à l'humain est déclenché dès que l'appel sort du cadre. Vous pilotez le seuil, pas nous.",
      },
    ],
    leak: { callsPerMonth: 12000, missRate: 0.2, avgTicket: 45, convertRate: 0.1 },
  },
  {
    id: "generique",
    label: "Autres métiers",
    sectors: ["autre"],
    criterion: "Les métiers où le téléphone est le premier point de contact et où personne n'est dédié à le prendre.",
    structuralPain:
      "Quand l'activité tourne, personne n'est au téléphone. La demande non prise ne laisse aucune trace : elle part chez le concurrent qui a décroché, et l'entreprise ne saura jamais qu'elle a existé.",
    opener: [
      { label: "Barrage", line: "Bonjour, je cherche le responsable — c'est au sujet des appels qui arrivent quand personne n'est disponible pour les prendre." },
      { label: "Permission", line: "Appel à froid, trente secondes : si ce n'est pas pour vous, vous me le dites et je raccroche." },
      { label: "Ciblage", line: "Je travaille avec les métiers où le téléphone est le premier point de contact et où personne n'est dédié à le prendre. C'est votre cas ?" },
      { label: "Bascule", line: "On installe un accueil qui décroche quand vous ne pouvez pas, prend la demande et vous en envoie le résumé." },
      { label: "CTA", line: "Quinze minutes pour vous montrer sur votre activité — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Quand tout le monde est occupé et que ça sonne, il se passe quoi ?",
      "Un client qui n'a personne au bout du fil, il rappelle ou il va ailleurs ?",
    ],
    mirror:
      "Celui qui n'obtient pas de réponse ne rappelle pas : il appelle le suivant. La perte est invisible — c'est exactement ce qui la rend dangereuse.",
    forbidden: [
      { regle: "Les fonctionnalités en liste : une seule capacité à la bascule, le reste se montre en RDV." },
    ],
    objections: [
      { q: "On gère, on n'a pas tant d'appels manqués.", a: "C'est ce qu'on croit tous — jusqu'à les compter. Je vous propose de mesurer une semaine, et on regarde ensemble." },
      { q: "On a un répondeur.", a: "Sur un répondeur, personne ne laisse de message. L'agent, lui, parle et prend la demande. C'est le jour et la nuit." },
      { q: "Ça coûte combien ?", a: "Des frais d'installation, puis un abonnement dimensionné à votre volume. C'est ce qu'on cale en 15 minutes — je préfère un chiffre juste qu'un chiffre au hasard." },
    ],
    leak: { callsPerMonth: 150, missRate: 0.3, avgTicket: 400, convertRate: 0.15 },
  },
];

export const verticalById = (id: string) => VERTICALS.find((v) => v.id === id) ?? null;

/** Verticale par défaut d'un secteur de l'app (repli : la plus proche). */
export function verticalForSector(sector: Sector): VerticalPlaybook | null {
  return VERTICALS.find((v) => v.sectors.includes(sector)) ?? null;
}

/**
 * Chiffrage de la fuite d'un prospect — le calcul terrain, honnête.
 *
 * Rend `null` quand la verticale n'a pas de fuite d'appels à chiffrer. Le
 * `null` est le message : il oblige chaque appelant à décider quoi afficher
 * en l'absence de chiffre, au lieu de laisser passer un « 0 € » qui se lit
 * comme un résultat mesuré.
 */
export function estimateLeak(v: VerticalPlaybook): {
  missedPerMonth: number;
  monthly: number;
  basis: string;
} | null {
  if (!v.leak) return null;
  const missed = Math.round(v.leak.callsPerMonth * v.leak.missRate);
  const monthly = Math.round(missed * v.leak.avgTicket * v.leak.convertRate);
  return {
    missedPerMonth: missed,
    monthly,
    basis: `${v.leak.callsPerMonth} appels/mois × ${Math.round(v.leak.missRate * 100)} % manqués × ${v.leak.avgTicket} € de valeur moyenne × ${Math.round(v.leak.convertRate * 100)} % convertible`,
  };
}

/**
 * Bloc de contexte injecté dans le prompt système de l'IA. C'est LUI
 * qui fait la différence entre un conseil générique et la méthode
 * maison. Compact : les petits modèles locaux ont une fenêtre courte.
 */
export function playbookPrompt(sector?: Sector, verticalId?: string): string {
  const v = (verticalId ? verticalById(verticalId) : null) ?? (sector ? verticalForSector(sector) : null);
  const lines: string[] = [
    // Pas de nom de compte en dur : l'OS est white-label, la méthode est celle
    // de l'agence qui l'utilise.
    "## Méthode terrain de l'agence (non négociable — issue du terrain réel)",
    ...DOCTRINE_TERRAIN.map((d) => `- ${d.rule} (${d.why})`),
  ];
  if (v) {
    const leak = estimateLeak(v);
    lines.push(
      "",
      `## Verticale : ${v.label}`,
      `- Critère de ciblage : ${v.criterion}`,
      `- Douleur structurelle : ${v.structuralPain}`,
      `- Ouverture : ${v.opener.map((o) => `[${o.label}] ${o.line}`).join(" ")}`,
      `- Diagnostic (poser puis se taire) : ${v.diagnostic.join(" / ")}`,
      `- Miroir : ${v.mirror}`,
      `- Ne pas dire à froid : ${v.forbidden.map((f) => f.regle).join(" ; ")}`,
      `- Objections travaillées : ${v.objections.map((o) => `${citer(o.q)} → ${o.a}`).join(" | ")}`,
      // ⚠ Sans fuite chiffrable, on ÉCRIT l'angle mort au lieu de le combler :
      // une IA à qui on ne dit rien invente un montant, une IA à qui on dit
      // « ce chiffre n'existe pas » pose la question au prospect.
      leak
        ? `- Ordre de grandeur de la fuite : ≈ ${leak.monthly.toLocaleString("fr-FR")} €/mois (${leak.basis}) — TOUJOURS présenté comme une estimation à valider.`
        : "- Aucun chiffrage de fuite pour cette verticale : elle ne perd pas d'appels entrants. NE JAMAIS avancer de montant — le faire dire au prospect par une question."
    );
  }
  return lines.join("\n");
}

/**
 * Mots-clés qui rattachent une fiche à une verticale.
 *
 * L'ORDRE EST LA RÈGLE, pas un détail de style : on descend la liste et on
 * s'arrête au premier match. Une entreprise de 12 poseurs en porte-à-porte
 * contient « couvreur » et « rénovation » — sans priorité, elle tomberait sur
 * la verticale « artisan du bâtiment », qui vend à un artisan SEUL et sert
 * l'argument « vous ratez des appels ». À un directeur commercial, cette phrase
 * ferme la porte. Les verticales « organisation » passent donc AVANT les
 * verticales « métier ».
 */
const VERTICAL_KEYWORDS: { id: string; re: RegExp }[] = [
  { id: "centre-appels", re: /centre d'?appel|call ?center|plateau|téléopé|teleope|relation client|hotline|téléconseill|teleconseill/ },
  { id: "equipe-terrain", re: /porte-?à-?porte|porte-?a-?porte|force de vente|équipe commerciale|equipe commerciale|commerciaux|poseur|photovolta|isolation|pompe à chaleur|pompe a chaleur/ },
  /**
   * ⚠ AVANT `immobilier`, ET C'EST TOUT L'INTÉRÊT.
   *
   * `.find()` rend la PREMIÈRE règle qui matche. Placée après, cette verticale
   * ne serait jamais atteinte : « promoteur immobilier » et « directeur de
   * programmes immobiliers » contiennent tous les deux « immobil » et
   * tombaient donc sur le playbook transaction & gestion — celui qui parle de
   * mandats perdus le week-end, à quelqu'un qui ne prend pas de mandats.
   * Mesuré avant d'écrire cette ligne, pas supposé.
   */
  {
    id: "maitrise-ouvrage",
    re: /ma[îi]tr(e|ise) d'?ouvrage|\bmoa\b|promot(eur|ion) immobili|\bsccv\b|\bvefa\b|am[ée]nageur|programme immobilier|(directeur|responsable|charg[ée]) de programme|permis de construire/,
  },
  // ⚠ « agence » seul a été retiré : il attrapait les agences web, d'intérim
  // et de voyage, et les classait en immobilier. « agence immobilière » passe
  // toujours, par « immobil ».
  { id: "immobilier", re: /immobil|mandat|syndic|régie|regie/ },
  /**
   * ⚠ `permis` était NU, et attrapait « permis de construire » : un export de
   * permis entier se classait en auto-école. La négation vaut mieux que le
   * retrait pur et simple — « il passe son permis », « école de permis »
   * restent des auto-écoles, et les trois autorisations d'urbanisme sont
   * nommées pour que la prochaine (« permis d'aménager ») ne se rajoute pas
   * en silence.
   */
  /**
   * ⚠ LE VERROU SUR « PERMIS » ÉTAIT TROP ÉTROIT, ET ÇA A ENVOYÉ HUIT
   * PROMOTEURS SUR LE SCRIPT D'UNE AUTO-ÉCOLE.
   *
   * Il ne bloquait que « permis DE construire / d'aménager / de démolir ».
   * Or une fiche issue d'un export d'urbanisme n'écrit presque jamais ça :
   * `notesDepuisPermis` produit « Permis : PC 069 383 24 A0123 », et une note
   * saisie à la main dit « permis obtenu », « permis purgé », « permis n° … ».
   * Aucune de ces formes ne contient « de construire » — donc toutes
   * tombaient ici, sur la verticale la plus éloignée de la cible.
   *
   * Mesuré sur les huit fiches de démonstration, pas supposé : elles
   * rendaient toutes `auto-ecole`. En production, l'écran du matin aurait
   * servi le script du moniteur de conduite à un directeur de programmes.
   *
   * Le motif exige donc maintenant un CONTEXTE de conduite autour du mot, au
   * lieu d'énumérer les permis d'urbanisme à exclure — une liste d'exceptions
   * est toujours en retard sur la façon dont les gens écrivent.
   */
  { id: "auto-ecole", re: /auto-?école|auto-?ecole|permis (?:de conduire|b\b|auto|moto)|conduite|moniteur|code de la route/ },
  { id: "garage-carrosserie", re: /garage|carross|mécanic|mecanic|peinture auto/ },
  // « couvreu » ne suffisait pas : une entreprise de toiture s'appelle
  // « Couverture Roux », pas « Roux couvreur ». Idem pour la charpente, le
  // zinc et l'étanchéité, qui sont des noms d'enseigne courants.
  { id: "artisan-batiment", re: /plomb|électric|electric|menuis|serrur|chauffag|couvreu|couvertur|charpent|zinguerie|étanch|etanch|toiture|maçon|macon|peintre|rénov|renov|artisan|bâtiment|batiment|dépann|depann|terrassement|carrelag/ },
  { id: "sante-cabinet", re: /dentaire|cabinet|médical|medical|centre de santé|kiné|kine|ostéo|osteo|labo/ },
];

/**
 * Verticale déduite d'un TEXTE libre.
 *
 * Extrait de `verticalForProspect` parce que le ciblage LinkedIn n'a pas de
 * fiche à lui donner : il ne dispose que d'un intitulé de poste et d'un nom
 * d'entreprise. Un seul jeu de mots-clés pour les deux usages — sinon la
 * qualification d'un profil et celle d'une fiche divergent, et personne ne
 * comprend pourquoi le même métier tombe dans deux verticales.
 */
export function verticalForText(texte: string): VerticalPlaybook | null {
  const hay = (texte ?? "").toLowerCase();
  const hit = VERTICAL_KEYWORDS.find((k) => k.re.test(hay));
  return hit ? verticalById(hit.id) : null;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * Verticale déduite d'une fiche : TAG, puis mots-clés, puis secteur.
 *
 * ⚠ LE TAG EST PASSÉ DEVANT, ET C'EST LA MÊME LEÇON QUE `lecons-terrain`.
 *
 * La déduction se faisait sur le TEXTE des notes. C'est une devinette : elle
 * dépend de la façon dont quelqu'un a tourné une phrase, et elle se trompe en
 * silence. Mesuré sur les huit fiches de maîtrise d'ouvrage — elles
 * contenaient « Permis PC 069 … », ce qui a déclenché la verticale
 * AUTO-ÉCOLE, à un mot près.
 *
 * Un tag posé par l'importeur est DÉTERMINISTE : `permisVersProspect` écrit
 * `["permis-construire", "maitrise-ouvrage", phase]`, et c'est le module de
 * tri qui l'a décidé, pas une tournure de phrase. CLAUDE.md l'énonce déjà
 * pour le Cerveau : « verticale identifiée par tag, jamais par ressemblance
 * de mots ». La règle valait pour la file d'appels aussi ; elle n'y était pas.
 *
 * ⚠ Le texte reste le repli, et il doit le rester : les imports CSV, LinkedIn
 * et terrain ne posent pas de tag de verticale, et le ciblage LinkedIn n'a
 * même pas de fiche — seulement un intitulé de poste.
 * ─────────────────────────────────────────────────────────────────────
 */
export function verticalForProspect(
  p: Pick<Prospect, "sector" | "notes"> & { tags?: string[] }
): VerticalPlaybook | null {
  for (const t of p.tags ?? []) {
    const v = verticalById(t);
    if (v) return v;
  }
  return verticalForText(p.notes ?? "") ?? verticalForSector(p.sector);
}
