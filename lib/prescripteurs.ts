/**
 * ─────────────────────────────────────────────────────────────────────
 * Les prescripteurs — le seul canal qui finit par tourner sans toi.
 *
 * Un prospect, tu le convaincs une fois et tu recommences le mois
 * suivant. Un prescripteur, tu le convaincs une fois et il te ramène des
 * affaires pendant des années. C'est le seul actif de la prospection qui
 * COMPOSE.
 *
 * La faute qui tue ce canal, et à peu près tout le monde la commet :
 * approcher un prescripteur comme un prospect. Un expert-comptable n'a
 * pas de problème d'appels manqués — il a un problème de valeur perçue
 * et de risque relationnel. Lui parler de « fuite de chiffre d'affaires »
 * ne produit rien : ce n'est pas son chiffre d'affaires.
 *
 * D'où ce module. Chaque archétype porte SON économie, SON incitation
 * réelle (rarement l'argent en premier), SA peur, et la structure de
 * deal qui lui correspond. C'est cette précision-là qui sépare un
 * partenariat signé d'un « oui pourquoi pas » qui ne donne jamais rien.
 * ─────────────────────────────────────────────────────────────────────
 */

export type PartnerArchetypeId =
  | "expert-comptable"
  | "assureur-pro"
  | "vendeur-caisse"
  | "agence-web"
  | "reseau-consulaire"
  | "groupement";

/** Ce qui fait dire oui — et ce n'est presque jamais la commission. */
export interface PartnerArchetype {
  id: PartnerArchetypeId;
  label: string;
  /** Qui c'est, en une phrase de reconnaissance sur le terrain. */
  who: string;
  /** Taille de portefeuille PME typique — sert au calcul, pas à l'esbroufe. */
  portfolio: { low: number; high: number };
  /**
   * Son intérêt RÉEL, dans son ordre à lui. L'argent arrive rarement en
   * premier ; le dire en premier fait perdre la moitié des archétypes.
   */
  motivations: string[];
  /** Ce qu'il redoute. Non traité, ça bloque tout, même avec un bon deal. */
  fear: string;
  /** La structure de deal qui lui correspond. Elle n'est PAS universelle. */
  deal: { structure: string; why: string };
  /** L'ouverture, mot pour mot. Jamais la phrase qu'on sert aux prospects. */
  opener: string;
  /** Questions à poser, puis se taire. */
  diagnostic: string[];
  /** La demande — petite, concrète, sans engagement. */
  ask: string;
  objections: { q: string; a: string }[];
  /** Taux de pénétration réaliste du portefeuille, an 1. */
  penetration: { low: number; high: number };
}

export const PARTNER_ARCHETYPES: PartnerArchetype[] = [
  {
    id: "expert-comptable",
    label: "Expert-comptable",
    who: "Cabinet de 2 à 15 collaborateurs, portefeuille de TPE-PME locales qu'il voit au moins une fois par trimestre.",
    portfolio: { low: 80, high: 250 },
    motivations: [
      "Être vu comme le conseil qui apporte des solutions, pas seulement celui qui produit des liasses.",
      "Retenir ses clients : un cabinet perd surtout ceux qui ne trouvent chez lui qu'un service comptable.",
      "Zéro travail supplémentaire. Son temps facturable est son unique ressource.",
    ],
    fear: "Passer pour un vendeur auprès de ses clients. Son capital, c'est l'indépendance de son conseil — il ne la risquera pas pour une commission.",
    deal: {
      structure:
        "Aucune commission mentionnée au premier rendez-vous. On propose l'audit gratuit pour 3 de ses clients, qu'il choisit. La rémunération se discute seulement s'il en parle, ou après le premier résultat.",
      why: "Proposer de l'argent d'emblée le transforme en apporteur d'affaires — exactement le rôle qu'il refuse. Une fois qu'un de ses clients l'a remercié de l'avoir mis en relation, la question de la rémunération devient facile et c'est souvent lui qui l'ouvre.",
    },
    opener:
      "« Je travaille avec des TPE lyonnaises sur un angle que vous voyez passer dans les bilans sans qu'il ait de ligne : les appels qu'elles ne prennent pas. Je ne viens pas vous vendre quelque chose — je voulais savoir si ça vous parle, sur votre portefeuille. »",
    diagnostic: [
      "Parmi vos clients, lesquels vivent du téléphone et n'ont personne pour le prendre ?",
      "Quand un client vous demande une recommandation sur un outil, vous faites quoi aujourd'hui ?",
      "Qu'est-ce qui vous ferait dire non tout de suite à ce genre de mise en relation ?",
    ],
    ask: "« Trois clients. Vous les choisissez, je fais l'audit gratuitement, je vous envoie le document avant eux. Si c'est mauvais, vous jetez et on n'en parle plus. »",
    objections: [
      {
        q: "Je ne fais pas de commercial pour mes clients.",
        a: "« Justement, je ne vous demande pas de vendre. Je vous demande trois noms, et c'est moi qui vais les voir. Vous ne portez rien — vous relisez juste l'audit avant qu'il parte, pour être sûr qu'il est à la hauteur de votre nom. »",
      },
      {
        q: "Et je gagne quoi ?",
        a: "« Pour l'instant, rien, et c'est volontaire : je préfère que vous jugiez sur pièce. Si vos clients vous remercient de la mise en relation, on parlera de la suite — et ce sera vous qui fixerez la règle. »",
      },
      {
        q: "Mes clients sont trop petits pour ça.",
        a: "« C'est ce qu'on croit tous. Un artisan seul sur un chantier rate plus d'appels qu'un cabinet de dix personnes. Le critère n'est pas la taille, c'est de savoir si le téléphone est le premier point de contact. »",
      },
      {
        q: "On a déjà des partenaires.",
        a: "« Tant mieux — ça veut dire que le principe vous va. Je ne remplace personne : je couvre un angle que vos partenaires actuels ne traitent probablement pas, l'accueil téléphonique. »",
      },
    ],
    penetration: { low: 0.02, high: 0.06 },
  },
  {
    id: "assureur-pro",
    label: "Assureur / courtier pro",
    who: "Agent général ou courtier en risques professionnels, portefeuille de commerçants, artisans et professions libérales.",
    portfolio: { low: 150, high: 600 },
    motivations: [
      "Avoir une raison d'appeler ses clients ENTRE deux échéances — son métier meurt du silence de douze mois.",
      "Se différencier d'un comparateur en ligne par du service concret.",
      "Réduire la résiliation : un client qu'on a aidé sur autre chose que le sinistre reste.",
    ],
    fear: "Recommander quelqu'un qui fera mal le travail. Le sinistre relationnel lui revient toujours dessus.",
    deal: {
      structure:
        "Réciprocité d'abord, commission ensuite. Il te présente, tu lui renvoies les clients que tu vois et qui sont mal couverts. La commission (10 à 20 % de la première année) se pose au second rendez-vous.",
      why: "Il vit d'apport mutuel depuis toujours — c'est une culture qu'il comprend et qui ne l'abaisse pas. La réciprocité crée une dette symétrique, plus solide qu'un pourcentage.",
    },
    opener:
      "« Vous appelez vos clients une fois par an, à l'échéance. Je vous propose une raison de les appeler entre-temps, qui ne parle pas d'assurance et qui leur rapporte quelque chose. »",
    diagnostic: [
      "Combien de vos clients pro vivent des appels entrants ?",
      "Qu'est-ce que vous leur apportez aujourd'hui, entre deux échéances ?",
      "Vous travaillez déjà avec des partenaires qui vous renvoient des clients ?",
    ],
    ask: "« On teste sur cinq clients. Vous les appelez, vous leur dites qu'un audit gratuit de leur accueil téléphonique existe. Je m'occupe du reste et je vous fais un retour sur chacun. »",
    objections: [
      {
        q: "Je ne veux pas déranger mes clients.",
        a: "« Vous ne les dérangez pas : vous leur offrez un diagnostic gratuit. C'est le contraire d'un appel commercial — et ça vous donne un prétexte pour reprendre contact. »",
      },
      {
        q: "Si ça se passe mal, ça retombe sur moi.",
        a: "« C'est exactement pour ça que je commence par cinq et pas par cinquante. Vous jugez sur les cinq premiers, et vous arrêtez quand vous voulez. »",
      },
      {
        q: "Vous prenez combien ?",
        a: "« Pour l'instant on n'en parle pas : je veux que vous jugiez le travail. Si vos clients sont contents, on partagera — je vous proposerai une règle claire et vous direz si elle vous va. »",
      },
    ],
    penetration: { low: 0.01, high: 0.04 },
  },
  {
    id: "vendeur-caisse",
    label: "Vendeur de caisse / TPE / logiciel métier",
    who: "Revendeur local de caisses enregistreuses, terminaux de paiement ou logiciels de réservation, chez les restaurants, coiffeurs, garages.",
    portfolio: { low: 100, high: 400 },
    motivations: [
      "Augmenter son panier moyen sans allonger son cycle de vente.",
      "Une offre complémentaire qui ne concurrence rien de ce qu'il vend.",
      "De la marge récurrente, pas seulement du matériel vendu une fois.",
    ],
    fear: "Alourdir sa démonstration et perdre la vente principale à cause d'un sujet annexe.",
    deal: {
      structure:
        "Commission franche, annoncée dès le premier rendez-vous : 20 à 30 % du setup et une part du récurrent. Contrat d'apporteur d'affaires écrit.",
      why: "C'est sa culture professionnelle et il la respecte. Ici, ne PAS parler d'argent en premier passe pour de l'amateurisme — l'inverse exact de l'expert-comptable.",
    },
    opener:
      "« Vous équipez déjà les restaurants lyonnais en caisse. Je vends ce qui répond au téléphone pendant qu'ils sont en service. On ne se marche pas dessus, et ça se vend au même interlocuteur, dans le même rendez-vous. »",
    diagnostic: [
      "Vous vendez quoi en plus de la caisse aujourd'hui ?",
      "Vos clients vous parlent des appels qu'ils ratent pendant le coup de feu ?",
      "Un apport d'affaires, ça se passe comment chez vous d'habitude ?",
    ],
    ask: "« On signe un accord d'apporteur simple. Vous me passez les noms, je fais le rendez-vous, vous touchez sur ce qui se signe. Rien à porter de votre côté. »",
    objections: [
      {
        q: "Je n'ai pas le temps d'ajouter un pitch.",
        a: "« Vous n'en ajoutez pas. Une phrase à la fin de votre rendez-vous : « il y a un truc pour vos appels, je vous mets en relation ? » Trois secondes. »",
      },
      {
        q: "Et si ça décrédibilise mon offre ?",
        a: "« C'est le risque inverse qui existe : un restaurateur qui rate ses réservations en vous ayant acheté une caisse se demandera pourquoi vous ne lui en avez pas parlé. »",
      },
      {
        q: "Combien je touche ?",
        a: "« 25 % du setup et 15 % du récurrent la première année, versés au mois. Contrat écrit, pas de parole en l'air. »",
      },
    ],
    penetration: { low: 0.03, high: 0.08 },
  },
  {
    id: "agence-web",
    label: "Agence web / freelance local",
    who: "Petite structure lyonnaise qui fait des sites vitrines et du référencement local pour commerçants et artisans.",
    portfolio: { low: 30, high: 150 },
    motivations: [
      "Compléter son offre sans embaucher ni développer.",
      "Renvoyer l'ascenseur : elle cherche aussi des clients.",
      "Répondre à la question qu'on lui pose sans arrêt : « et les gens qui appellent ? »",
    ],
    fear: "Qu'on lui prenne son client, ou qu'on le solliciter sur ce qu'elle vend déjà.",
    deal: {
      structure:
        "Échange croisé, formalisé : elle t'envoie le téléphone, tu lui envoies les sites. Pas d'argent au départ, un décompte tenu des deux côtés.",
      why: "Une petite agence a une trésorerie tendue et un besoin de clients aussi fort que le tien. Un flux de prospects vaut mieux qu'un pourcentage, et ça crée une dette symétrique.",
    },
    opener:
      "« Vous faites les sites, moi ce qui décroche le téléphone. On voit les mêmes commerçants et on ne vend pas la même chose. Je viens vous proposer qu'on s'envoie ce qu'on ne fait pas. »",
    diagnostic: [
      "On vous demande souvent ce qu'il se passe quand le client appelle et que personne ne répond ?",
      "Vous refusez quels types de demandes aujourd'hui, faute de temps ou de compétence ?",
      "Vous avez déjà des accords de ce genre avec d'autres ?",
    ],
    ask: "« On commence par un chacun. Vous m'envoyez un client, je vous en envoie un. On regarde dans un mois ce que ça a donné. »",
    objections: [
      {
        q: "J'ai peur que vous me preniez le client.",
        a: "« Je ne fais pas de sites, et je ne veux pas en faire. Écrivons-le noir sur blanc si ça vous rassure : je ne touche à rien de ce que vous vendez. »",
      },
      {
        q: "Mes clients n'ont pas de budget.",
        a: "« Ceux qui n'ont pas de budget pour un site n'en ont pas pour moi non plus — on parle des mêmes. Envoyez-moi ceux qui ont dit oui chez vous. »",
      },
    ],
    penetration: { low: 0.05, high: 0.12 },
  },
  {
    id: "reseau-consulaire",
    label: "CCI, Chambre de métiers, réseau d'entrepreneurs",
    who: "Conseiller de la CCI ou de la CMA, animateur de club d'entrepreneurs, réseau BNI, association de commerçants de quartier.",
    portfolio: { low: 200, high: 2000 },
    motivations: [
      "Apporter un service concret à ses adhérents — c'est ce qu'on lui demande.",
      "Remplir un programme d'ateliers avec du contenu utile et gratuit.",
      "Aucune contrepartie financière : il ne peut pas en accepter.",
    ],
    fear: "Cautionner un vendeur déguisé et se le faire reprocher par ses adhérents.",
    deal: {
      structure:
        "Aucune commission — c'est souvent interdit. Un atelier gratuit de 45 minutes : « ce que vous perdez au téléphone, et comment le mesurer ». Aucune mention de produit dans l'atelier.",
      why: "Le canal ne paie rien directement mais donne accès à une salle de dirigeants qui viennent volontairement. Vendre pendant l'atelier détruit le canal en une fois ; ne rien vendre le rend renouvelable.",
    },
    opener:
      "« Je propose un atelier gratuit pour vos adhérents : comment mesurer ce qu'on perd en appels non pris. Pas de démonstration produit, pas de plaquette — une méthode qu'ils repartent avec. »",
    diagnostic: [
      "Quels formats fonctionnent le mieux auprès de vos adhérents ?",
      "Vous avez déjà eu des interventions sur les sujets numériques ? Qu'est-ce qui a plu ou déplu ?",
      "Quelle est votre règle sur les intervenants qui sont aussi des entreprises ?",
    ],
    ask: "« Je vous envoie le déroulé écrit. Vous le lisez, vous coupez ce qui vous gêne, et vous me dites si ça a sa place dans votre programme. »",
    objections: [
      {
        q: "On n'accepte pas les interventions commerciales.",
        a: "« Vous avez raison, et c'est aussi ma règle : l'atelier ne cite aucun produit, pas même le mien. Je vous envoie le déroulé, vous coupez ce que vous voulez. »",
      },
      {
        q: "Qu'est-ce que vous y gagnez ?",
        a: "« De la crédibilité auprès de dirigeants lyonnais. Ceux qui voudront aller plus loin viendront me voir — les autres repartiront avec une méthode utile. C'est un échange honnête. »",
      },
    ],
    penetration: { low: 0.005, high: 0.02 },
  },
  {
    id: "groupement",
    label: "Franchise, groupement, réseau d'enseignes",
    who: "Tête de réseau ou animateur régional : garages sous enseigne, boulangeries, auto-écoles en groupement, réseaux de santé.",
    portfolio: { low: 20, high: 300 },
    motivations: [
      "Une performance mesurable à l'échelle du réseau, pas au coup par coup.",
      "Justifier la redevance auprès de ses adhérents par des services concrets.",
      "Homogénéiser la qualité d'accueil — c'est un sujet de marque pour lui.",
    ],
    fear: "Déployer sur tout le réseau une solution qui échoue, et le payer politiquement devant les adhérents.",
    deal: {
      structure:
        "Pilote sur 3 sites, mesuré, à ses conditions. Tarif réseau seulement après le pilote. Rapport écrit de ce qui a été mesuré, chiffres bruts inclus.",
      why: "Une tête de réseau ne peut pas se permettre un échec visible. Le pilote transforme un risque politique en décision documentée — c'est ce qu'il achète réellement.",
    },
    opener:
      "« Vos adhérents n'ont pas tous le même accueil téléphonique, et ça se voit dans leurs résultats. Je vous propose de le mesurer sur trois sites, à vos conditions, avant même de parler de déploiement. »",
    diagnostic: [
      "Comment mesurez-vous aujourd'hui la qualité d'accueil de vos adhérents ?",
      "Quels services du réseau ont été le mieux adoptés, et pourquoi selon vous ?",
      "Qui décide : vous, ou chaque adhérent ?",
    ],
    ask: "« Trois sites, six semaines, un rapport écrit avec les chiffres bruts. Vous choisissez les sites. Si le rapport ne vous convainc pas, on s'arrête là. »",
    objections: [
      {
        q: "Nos adhérents sont indépendants, je ne peux rien imposer.",
        a: "« Je ne vous demande pas d'imposer. Je vous demande de me laisser mesurer chez trois volontaires, et de partager le résultat. Ce sont les chiffres qui convaincront les autres, pas vous. »",
      },
      {
        q: "On a déjà un prestataire national.",
        a: "« Alors le pilote est encore plus utile : vous aurez un point de comparaison sur trois sites, sans rien changer ailleurs. »",
      },
    ],
    penetration: { low: 0.1, high: 0.3 },
  },
];

export const archetypeById = (id?: string | null): PartnerArchetype | null =>
  PARTNER_ARCHETYPES.find((a) => a.id === id) ?? null;

/**
 * L'arithmétique d'un partenariat — bornes basses ET hautes, toujours.
 *
 * Un partenariat se vend souvent avec un chiffre unique et flatteur
 * (« 200 clients × 3 000 € »). Ça ne survit pas au premier trimestre et
 * ça grille le partenaire. On donne une fourchette, avec les hypothèses
 * visibles, pour qu'il puisse la contester — c'est ce qui la rend
 * crédible.
 */
export interface PartnerPotential {
  portfolioLow: number;
  portfolioHigh: number;
  clientsLow: number;
  clientsHigh: number;
  setupLow: number;
  setupHigh: number;
  recurringLow: number;
  recurringHigh: number;
  /** Les hypothèses, écrites. Un chiffre sans hypothèse ne vaut rien. */
  assumptions: string[];
}

export function partnerPotential(
  a: PartnerArchetype,
  setupValue: number,
  monthlyValue: number,
  portfolio?: number
): PartnerPotential {
  const low = portfolio ?? a.portfolio.low;
  const high = portfolio ?? a.portfolio.high;
  const clientsLow = Math.floor(low * a.penetration.low);
  const clientsHigh = Math.round(high * a.penetration.high);
  return {
    portfolioLow: low,
    portfolioHigh: high,
    clientsLow,
    clientsHigh,
    setupLow: clientsLow * setupValue,
    setupHigh: clientsHigh * setupValue,
    recurringLow: clientsLow * monthlyValue,
    recurringHigh: clientsHigh * monthlyValue,
    assumptions: [
      `Portefeuille estimé : ${low} à ${high} entreprises.`,
      `Taux de pénétration an 1 : ${Math.round(a.penetration.low * 100)} à ${Math.round(a.penetration.high * 100)} % — pas 30 %, personne ne fait 30 %.`,
      `Valeurs unitaires : ${setupValue} € de setup, ${monthlyValue} €/mois.`,
      `Hypothèse implicite : le partenaire présente réellement. Un accord signé qui dort vaut zéro.`,
    ],
  };
}

/**
 * Doctrine injectée dans les prompts IA quand la conversation porte sur
 * un prescripteur. Sans elle, le modèle sert l'argumentaire prospect à un
 * expert-comptable — et le perd en une phrase.
 */
export function prescripteurPrompt(archetypeId?: string | null): string {
  const a = archetypeById(archetypeId);
  const base = [
    `## Doctrine prescripteurs (NON négociable)`,
    ``,
    `- Un prescripteur n'est PAS un prospect. Il n'a pas le problème qu'on résout : il connaît des gens qui l'ont.`,
    `- Ne JAMAIS lui servir l'argumentaire prospect (appels manqués, chiffre d'affaires perdu). Ce n'est pas son chiffre d'affaires.`,
    `- Partir de SON économie à lui : ce qu'il gagne, ce qu'il risque, ce que ça lui coûte en temps.`,
    `- L'argent n'est pas l'argument premier pour tous les archétypes. Le proposer au mauvais moment fait perdre l'expert-comptable et le réseau consulaire.`,
    `- La demande doit être PETITE et concrète : trois noms, un client, un atelier. Jamais « un partenariat ».`,
    `- Le risque relationnel est la vraie objection, même quand elle est formulée autrement.`,
    `- Toute projection chiffrée s'annonce en fourchette, avec ses hypothèses visibles.`,
  ];
  if (!a) return base.join("\n");
  return [
    ...base,
    ``,
    `## Archétype : ${a.label}`,
    `- Qui : ${a.who}`,
    `- Ses motivations, dans son ordre : ${a.motivations.join(" | ")}`,
    `- Sa peur : ${a.fear}`,
    `- Structure de deal : ${a.deal.structure}`,
    `- Pourquoi cette structure : ${a.deal.why}`,
    `- Ouverture de référence : « ${a.opener} »`,
    `- Diagnostic : ${a.diagnostic.join(" | ")}`,
    `- La demande : « ${a.ask} »`,
    `- Objections et réponses : ${a.objections.map((o) => `« ${o.q} » → ${o.a}`).join(" ;; ")}`,
  ].join("\n");
}
