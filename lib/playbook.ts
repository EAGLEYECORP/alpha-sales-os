import type { Prospect, Sector } from "./types";
import { citer } from "./citation";

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

export interface VerticalPlaybook {
  id: string;
  label: string;
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
  /** Ce qu'on ne dit pas à froid, en plus des interdits généraux. */
  forbidden: string[];
  objections: { q: string; a: string }[];
  /** Paramètres de chiffrage de la fuite (ordre de grandeur, à valider). */
  leak: { callsPerMonth: number; missRate: number; avgTicket: number; convertRate: number };
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
      "Le lien de paiement / l'acompte : ça ne parle pas à une agence, ça fait du bruit.",
      "Le détail du transfert conditionnel et de la prise de RDV automatique — ça se montre en visio.",
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
    forbidden: ["Le détail de l'intégration planning et des appels simultanés — ça se montre en visio."],
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
    forbidden: ["Le dashboard « le leur » tant qu'il n'existe pas : rester sur « voilà ce que vous verriez »."],
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
      "Toute promesse touchant au secret médical ou au tri clinique : l'agent prend des demandes, il ne fait pas de médecine.",
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
    forbidden: ["Le détail du logiciel de réservation et des intégrations — ça se montre, ça ne se raconte pas."],
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
    forbidden: ["La billetterie et l'agenda automatisé : ça se montre en RDV."],
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
      "Toute promesse touchant la régulation médicale ou l'urgence vitale : l'agent prend des demandes de transport, il ne régule rien.",
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
    forbidden: ["Le devis automatisé : à ne promettre qu'après validation technique, sinon c'est une promesse en l'air."],
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
      "« Vous ratez des appels » : faux ici, et ça prouve qu'on n'a pas compris son métier.",
      "Le mot CRM à froid : il a déjà essayé, ses commerciaux ne l'ont pas rempli, et il vous rangera là-dedans.",
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
      "« On remplace vos équipes » : c'est faux, et ça fait fermer la porte immédiatement.",
      "Le prix au forfait sans son volume réel : sur ce marché, le prix se dit à la minute et au palier, chiffres en main.",
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
    forbidden: ["Les fonctionnalités en liste : une seule capacité à la bascule, le reste se montre en RDV."],
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

/** Chiffrage de la fuite d'un prospect — le calcul terrain, honnête. */
export function estimateLeak(v: VerticalPlaybook): {
  missedPerMonth: number;
  monthly: number;
  basis: string;
} {
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
      `- Ne pas dire à froid : ${v.forbidden.join(" ; ")}`,
      `- Objections travaillées : ${v.objections.map((o) => `${citer(o.q)} → ${o.a}`).join(" | ")}`,
      `- Ordre de grandeur de la fuite : ≈ ${leak.monthly.toLocaleString("fr-FR")} €/mois (${leak.basis}) — TOUJOURS présenté comme une estimation à valider.`
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
  // ⚠ « agence » seul a été retiré : il attrapait les agences web, d'intérim
  // et de voyage, et les classait en immobilier. « agence immobilière » passe
  // toujours, par « immobil ».
  { id: "immobilier", re: /immobil|mandat|syndic|régie|regie/ },
  { id: "auto-ecole", re: /auto-?école|auto-?ecole|permis|conduite|moniteur/ },
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

/** Verticale déduite d'une fiche (mots-clés du métier, à défaut le secteur). */
export function verticalForProspect(p: Pick<Prospect, "sector" | "notes">): VerticalPlaybook | null {
  return verticalForText(p.notes ?? "") ?? verticalForSector(p.sector);
}
