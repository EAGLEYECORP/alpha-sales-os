import type { Prospect, Sector } from "./types";

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
    sectors: ["autre"],
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
    sectors: ["autre"],
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
    sectors: ["artisan"],
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
    sectors: ["autre"],
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
    "## Méthode terrain EAGLEYE (non négociable — issue du terrain réel)",
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
      `- Objections travaillées : ${v.objections.map((o) => `« ${o.q} » → ${o.a}`).join(" | ")}`,
      `- Ordre de grandeur de la fuite : ≈ ${leak.monthly.toLocaleString("fr-FR")} €/mois (${leak.basis}) — TOUJOURS présenté comme une estimation à valider.`
    );
  }
  return lines.join("\n");
}

/** Verticale déduite d'une fiche (secteur, à défaut mots-clés du métier). */
export function verticalForProspect(p: Pick<Prospect, "sector" | "notes">): VerticalPlaybook | null {
  const hay = `${p.notes ?? ""}`.toLowerCase();
  const byWord = VERTICALS.find((v) =>
    v.id === "immobilier"
      ? /immobil|agence|mandat|syndic|régie|regie/.test(hay)
      : v.id === "auto-ecole"
        ? /auto-?école|auto-?ecole|permis|conduite/.test(hay)
        : v.id === "garage-carrosserie"
          ? /garage|carross|mécanic|mecanic|peinture auto/.test(hay)
          : /dentaire|cabinet|médical|medical|centre de santé|kiné|kine/.test(hay)
  );
  return byWord ?? verticalForSector(p.sector);
}
