import { VERTICALS, type VerticalPlaybook } from "./playbook";
import { normalize, overlap } from "./speech-text";
import { citer } from "./citation";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Assistant d'appel en direct — l'IA souffle, l'humain parle.
 *
 * Aucune IA générative ici, et c'est délibéré : pendant un appel, une
 * réponse qui met deux secondes à arriver arrive trop tard. La
 * reconnaissance de l'objection est un appariement local sur le
 * playbook — quelques millisecondes, hors-ligne, déterministe. La bonne
 * réponse est celle qu'on a écrite à froid, pas celle qu'un modèle
 * improvise à chaud.
 *
 * Cadre légal : cet assistant écoute pour SON opérateur et n'adresse
 * jamais la parole à l'interlocuteur. Il ne relève donc pas des
 * obligations de divulgation de l'article 50 du règlement européen sur
 * l'IA (applicable depuis le 2 août 2026), qui visent les systèmes qui
 * interagissent directement avec une personne. Voir docs/MARCHE.md §4.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ObjectionCue {
  id: string;
  label: string;
  /** Chaque entrée est une conjonction : TOUS ces tokens doivent être entendus. */
  cues: string[][];
  /** La réponse à souffler, mot pour mot. */
  answer: string;
  /** La croyance cassée (1 le produit marche, 2 tu le soutiens, 3 pour LUI). */
  belief?: 1 | 2 | 3;
}

/**
 * Catalogue générique — ce qui se dit dans tous les métiers. Les
 * réponses spécifiques à une verticale sont dans le playbook et
 * l'emportent quand elles collent mieux.
 */
export const OBJECTION_CUES: ObjectionCue[] = [
  {
    id: "deja-quelquun",
    label: "« On a déjà quelqu'un / un standard »",
    cues: [["deja", "quelqu"], ["deja", "assistante"], ["deja", "secretaire"], ["deja", "standard"], ["deja", "repondeur"], ["on", "secretariat"], ["secretariat"]],
    answer:
      "« Elle ne prend qu'un appel à la fois — c'est physique. Trois personnes qui appellent en même temps, deux tombent dans le vide. Elle n'est pas remplacée : elle arrête juste de rater des appels. »",
    belief: 1,
  },
  {
    id: "trop-cher",
    label: "« C'est trop cher »",
    cues: [["trop", "cher"], ["cest", "cher"], ["cher"], ["budget"], ["coute", "cher"], ["moyens"]],
    answer:
      "« Une seule affaire récupérée dans le mois et c'est remboursé. Vous en ratez combien par semaine, à votre avis ? » — puis SILENCE. Laissez-le faire le calcul lui-même.",
    belief: 3,
  },
  {
    id: "combien",
    label: "« Ça coûte combien ? »",
    cues: [["combien"], ["quel", "prix"], ["tarif"], ["ca", "coute"]],
    answer:
      "« Des frais d'installation, puis un abonnement dimensionné à votre volume d'appels. C'est exactement ce qu'on cale en 15 minutes — je préfère un chiffre juste qu'un chiffre au hasard. » JAMAIS de prix avant la démo mobile.",
  },
  {
    id: "envoyez-mail",
    label: "« Envoyez-moi un mail »",
    cues: [["envoyez", "mail"], ["envoyez", "email"], ["envoyer", "mail"], ["documentation"], ["plaquette"], ["par", "mail"]],
    answer:
      "« Avec plaisir, je vous l'envoie en sortant. Mais un mail se perd — laissez-moi 15 minutes, et si ça vous parle pas vous jetez. On dit fin de semaine ? »",
  },
  {
    id: "pas-le-temps",
    label: "« Je n'ai pas le temps / je suis occupé »",
    cues: [["pas", "temps"], ["occupe"], ["en", "clientele"], ["je", "reunion"], ["reunion"], ["la", "avec"], ["suis", "client"]],
    answer:
      "Jouez le méta : « c'est exactement pour ça que je vous appelle — vous êtes pris, donc le téléphone sonne dans le vide. » Puis : « fin de semaine ou début de la prochaine ? » Ne raccrochez jamais sans créneau.",
  },
  {
    id: "en-parler",
    label: "« Je dois en parler à mon associé »",
    cues: [["parler", "associe"], ["parler", "femme"], ["parler", "equipe"], ["voir", "associe"], ["decide", "pas", "seul"], ["mon", "associe"]],
    answer:
      "Couche « Les Autres » de l'Oignon du Blâme. « Bien sûr. Si ça ne tenait qu'à vous, vous le feriez ? » — sa réponse vous dit si l'associé est la vraie raison ou le paravent. Puis : on cale un créneau à deux.",
    belief: 3,
  },
  {
    id: "robot",
    label: "« Un robot au téléphone, ça fait fuir »",
    cues: [["robot"], ["machine"], ["intelligence", "artificielle"], ["cest", "ia"], ["ca", "fait", "fuir"], ["impersonnel"]],
    answer:
      "« Vous venez de l'entendre — dites-moi franchement si ça sonnait robot. Et la vraie question : mieux vaut un accueil qui répond, ou une sonnerie dans le vide ? »",
    belief: 1,
  },
  {
    id: "on-gere",
    label: "« On gère, on ne rate pas d'appels »",
    cues: [["on", "gere"], ["on", "rate", "pas"], ["pas", "tant", "appels"], ["on", "rappelle", "toujours"], ["ca", "va", "comme"], ["pas", "besoin"]],
    answer:
      "« C'est ce qu'on croit tous — jusqu'à les compter. Je vous propose un test : on mesure une semaine, et on regarde ensemble. » On ne débat pas : on propose de mesurer.",
    belief: 1,
  },
  {
    id: "rappelez-moi",
    label: "« Rappelez-moi plus tard »",
    cues: [["rappelez"], ["rappeler", "plus", "tard"], ["plus", "tard"], ["autre", "moment"], ["pas", "maintenant"]],
    answer:
      "« Volontiers — mardi 15h ou jeudi 10h ? » Une date, deux créneaux fermés. Un « rappelez-moi » sans date est un non poli.",
  },
  {
    id: "pas-interesse",
    label: "« Ça ne m'intéresse pas »",
    cues: [["pas", "interesse"], ["interesse", "pas"], ["merci", "non"], ["non", "merci"], ["pas", "pour", "nous"]],
    answer:
      "« Aucun souci — je raccroche. Juste par curiosité, pour ne pas rappeler pour rien : c'est le sujet du téléphone qui ne vous parle pas, ou c'est le moment ? » La réponse vous dit s'il faut ranger la fiche ou la rappeler dans trois mois.",
  },
  {
    id: "complets",
    label: "« On est complets / on n'a pas besoin de clients »",
    cues: [["on", "complet"], ["complets"], ["assez", "clients"], ["carnet", "plein"], ["deja", "plein"]],
    answer:
      "« Un carnet plein se vide par les annulations. Ce sont exactement les appels que personne ne prend qui les remplissent. »",
    belief: 3,
  },
  {
    id: "essai",
    label: "« On verra plus tard / ce n'est pas le moment »",
    cues: [["plus", "tard"], ["pas", "moment"], ["annee", "prochaine"], ["apres", "ete"], ["on", "verra"]],
    answer:
      "Couche « Circonstances ». « Je comprends. Concrètement, qu'est-ce qui doit changer pour que ce soit le moment ? » — s'il ne sait pas répondre, ce n'était pas la vraie raison.",
    belief: 3,
  },
];

/** Alertes doctrine — ce que l'opérateur vient de dire et ne devrait pas. */
export interface DoctrineAlarm {
  id: string;
  label: string;
  fix: string;
}

interface AlarmRule extends DoctrineAlarm {
  cues: string[][];
}

const ALARMS: AlarmRule[] = [
  {
    id: "prix-avant-demo",
    label: "Tu parles prix avant la démo",
    fix: "Le prix ne se donne jamais avant que la démo mobile ait été vue. « Je préfère vous montrer 2 minutes, puis on parle chiffres. »",
    cues: [["euros"], ["ca", "coute"], ["tarif"], ["abonnement", "mois"], ["prix", "est"]],
  },
  {
    id: "euros-perdus-a-froid",
    label: "Tu chiffres les € perdus à froid",
    fix: "Interdit à froid : ça déclenche un débat sur ta méthode au lieu de la douleur. Garde le chiffrage pour l'audit, sur place.",
    cues: [["vous", "perdez"], ["euros", "mois"], ["manque", "gagner"], ["vous", "coute", "par"]],
  },
  {
    id: "note-google",
    label: "Tu cites sa note Google",
    fix: "Même bonne, elle se prend comme une attaque. On ne parle jamais de la note à froid.",
    cues: [["note", "google"], ["avis", "google"], ["etoiles"], ["votre", "note"]],
  },
  {
    id: "ciblage-volume",
    label: "Tu dis ton ciblage en volume, pas en critère",
    fix: "« Je travaille avec les métiers où le téléphone EST le chiffre d'affaires » — un critère, jamais « j'appelle toutes les agences de Lyon ».",
    cues: [["toutes", "agences"], ["tous", "garages"], ["tous", "restaurants"], ["appelle", "tout", "monde"], ["toutes", "entreprises"]],
  },
  {
    id: "observation-affirmee",
    label: "Ton observation est une affirmation",
    fix: "Pose-la en question : « vous fermez le week-end, c'est bien ça ? » — c'est LUI qui doit énoncer sa douleur. « J'ai vu que… » sonne fliqué.",
    // « j'ai » se normalise en « j ai » : le token est « ai », jamais « jai ».
    cues: [["ai", "vu", "que"], ["ai", "remarque"], ["ai", "constate"], ["ai", "regarde", "votre"]],
  },
  {
    id: "liste-fonctionnalites",
    label: "Tu déroules les fonctionnalités",
    fix: "Chaque fonctionnalité en plus fait basculer du ressenti vers la comparaison — et on perd. Reviens à la douleur.",
    cues: [["ca", "permet", "aussi"], ["il", "y", "aussi"], ["fonctionnalites"], ["ca", "fait", "aussi"], ["en", "plus", "vous", "avez"]],
  },
];

const hits = (heardTokens: Set<string>, cue: string[]) => cue.every((t) => heardTokens.has(t));

const tokenSet = (s: string) => new Set(normalize(s).split(" ").filter(Boolean));

export interface AssistMatch {
  id: string;
  label: string;
  answer: string;
  belief?: 1 | 2 | 3;
  /** D'où vient la réponse : catalogue général ou playbook de la verticale. */
  source: "général" | "verticale";
  /** 0–1. Un cue exact vaut 1 ; un appariement de playbook vaut son recouvrement. */
  score: number;
}

/** Seuil de recouvrement en dessous duquel on n'affiche rien : mieux vaut se taire que souffler à côté. */
export const MATCH_FLOOR = 0.5;

/**
 * Reconnaît l'objection dans ce qui vient d'être entendu.
 * Les objections propres à la verticale l'emportent à score égal : elles
 * sont écrites pour ce métier-là.
 */
export function matchObjections(heard: string, vertical?: VerticalPlaybook | null): AssistMatch[] {
  const set = tokenSet(heard);
  const out: AssistMatch[] = [];

  for (const o of OBJECTION_CUES) {
    if (o.cues.some((c) => hits(set, c))) {
      out.push({ id: o.id, label: o.label, answer: o.answer, belief: o.belief, source: "général", score: 1 });
    }
  }

  if (vertical) {
    for (const [i, o] of vertical.objections.entries()) {
      const score = overlap(heard, o.q);
      if (score >= MATCH_FLOOR) {
        out.push({
          id: `${vertical.id}-${i}`,
          label: citer(o.q),
          answer: o.a,
          source: "verticale",
          score,
        });
      }
    }
  }

  return out
    .sort((a, b) => b.score - a.score || (a.source === "verticale" ? -1 : 1))
    .slice(0, 3);
}

/** Ce que l'opérateur vient de dire et qui casse la doctrine. */
export function matchAlarms(heard: string): DoctrineAlarm[] {
  const set = tokenSet(heard);
  return ALARMS.filter((a) => a.cues.some((c) => hits(set, c))).map(({ id, label, fix }) => ({ id, label, fix }));
}

export const verticalById = (id?: string | null): VerticalPlaybook | null =>
  VERTICALS.find((v) => v.id === id) ?? null;
