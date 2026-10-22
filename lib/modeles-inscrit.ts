import type { ProfilOperateur } from "./profil-operateur";
import type { StageGroup, TemplateFormat } from "./templates";
import { approcheInscrit } from "./approche-ecrite";
import { scriptOperateur } from "./script-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BIBLIOTHÈQUE D'UN INSCRIT — bâtie sur SON offre.
 *
 * ⚠⚠ MESURÉ LE 22/10/2026 : `/templates` servait à tout compte les 108 gabarits
 * de `buildTemplates`, écrits pour vendre NOTRE offre — « des tables vides en
 * semaine et des appels ratés pendant le service », « j'ai un truc à vous
 * montrer sur mon téléphone », la « taxe d'ignorance » de l'accueil
 * téléphonique. Un inscrit qui vend un logiciel de paie les copiait tels quels.
 *
 * Mêmes six moments du cycle, mêmes trois formats ; le CONTENU vient de son
 * profil (`approcheInscrit`, `scriptOperateur`) et ne prétend rien : aucune
 * preuve, aucun prix, aucun chiffre de perte, aucune douleur affirmée. Les
 * variables `{prenom}` `{closer}` `{jour}` `{heure}` sont celles que remplit
 * `fillTemplate`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ModeleInscrit {
  id: string;
  group: StageGroup;
  format: TemplateFormat;
  title: string;
  body: string;
  tip: string;
}

/** Les moments du cycle, dits sans NOTRE vocabulaire (« démo mobile », « audit gratuit »). */
export const GROUPES_INSCRIT: { id: StageGroup; label: string; goal: string }[] = [
  { id: "premier-contact", label: "Premier contact", goal: "Obtenir un oui, un non ou un créneau — rien vendre" },
  { id: "audit", label: "Rendez-vous", goal: "Confirmer le créneau, puis écouter avant de proposer" },
  { id: "demo", label: "Démonstration", goal: "Montrer ce que ça change pour lui AVANT de parler prix" },
  { id: "closing", label: "Closing", goal: "Obtenir une décision — jamais de prix par écrit avant la démonstration" },
  { id: "apres-signature", label: "Après signature", goal: "Tenir ce qui a été promis, puis demander qui d'autre en aurait besoin" },
  { id: "reconquete", label: "Reconquête", goal: "Poser la question une fois, sans relance derrière" },
];

export function modelesInscrit(
  profil: ProfilOperateur | null | undefined,
  agencyName: string
): ModeleInscrit[] {
  const a = approcheInscrit(profil);
  const script = scriptOperateur(profil).vertical;
  const quoi = profil?.metier.trim() || "ce que je propose";
  const agence = agencyName.trim();
  const signe = agence ? `{closer} — ${agence}` : "{closer}";
  const m = (group: StageGroup, format: TemplateFormat, title: string, body: string, tip: string): ModeleInscrit => ({
    id: `inscrit-${group}-${format}`,
    group,
    format,
    title,
    body,
    tip,
  });

  return [
    m(
      "premier-contact",
      "email",
      "Prise de contact — une question, pas un pitch",
      `Objet : une question\n\nBonjour {prenom},\n\nJe vous écris directement, ce sera court : ${a.phraseCritere}.\n\n${a.question}\n\nSi oui : 20 minutes pour regarder votre cas, mardi 15h ou jeudi 10h ? Si non, dites-le-moi, je n'insisterai pas.\n\n${signe}`,
      "Une seule question, zéro prix. L'objectif : un oui, un non, ou un créneau."
    ),
    m(
      "premier-contact",
      "dm",
      "Message direct — trois lignes",
      `Bonjour {prenom}, ${a.phraseCritere}. ${a.question} Un non me va très bien.`,
      "Court : un message long s'excuse d'exister."
    ),
    m(
      "premier-contact",
      "appel",
      "Ouverture d'appel — permission d'abord",
      script.opener.map((o, i) => `${i + 1}. ${o.label.toUpperCase()}\n« ${o.line} »`).join("\n\n"),
      "Une seule chose à la bascule. Le reste se montre en rendez-vous."
    ),
    m(
      "audit",
      "email",
      "Confirmer le rendez-vous",
      `Objet : notre rendez-vous de {jour}\n\nBonjour {prenom},\n\nConfirmé pour {jour} à {heure}. Pour que ce temps vous serve : je vous poserai quelques questions sur la façon dont vous gérez le sujet aujourd'hui, et vous repartirez avec ce que j'en comprends, que l'on travaille ensemble ou non.\n\n${signe}`,
      "Le rendez-vous se confirme par écrit, la veille. Rien d'autre dans le message."
    ),
    m("audit", "dm", "Rappel de la veille", `{prenom}, c'est {closer} : on se voit {jour} à {heure}. À demain !`, "Une ligne. Le but est qu'il vienne."),
    m(
      "audit",
      "appel",
      "Pendant le rendez-vous — poser, puis se taire",
      [...script.diagnostic.map((q, i) => `${i + 1}. « ${q} »`), `Puis le miroir : « ${script.mirror} »`].join("\n"),
      "C'est LUI qui doit énoncer ce qui lui coûte. Tu ne l'affirmes pas."
    ),
    m(
      "demo",
      "email",
      "Ce que je vous montre",
      `Objet : ce que je vous montre {jour}\n\nBonjour {prenom},\n\n{jour}, je vous montre ${quoi} sur votre cas, avant de parler de prix. Si ça ne vous sert pas, vous me le dites et on s'arrête là.\n\n${signe}`,
      "Montrer avant de chiffrer : un prix lâché trop tôt transforme la conversation en négociation."
    ),
    m("demo", "dm", "Avant la démonstration", `{prenom}, {jour} je vous montre ce que ça change concrètement chez vous. Dix minutes suffisent.`, "Pas de prix, pas de liste de fonctionnalités."),
    m(
      "demo",
      "appel",
      "Pendant la démonstration",
      `« Avant de parler de prix, regardez ce que ça change pour vous. »\n\nMontrer UNE chose, celle qui répond à ce qu'il a dit au rendez-vous. Puis se taire, et laisser regarder.`,
      "Chaque fonctionnalité en plus fait passer du ressenti à la comparaison."
    ),
    m(
      "closing",
      "email",
      "La décision",
      `Objet : votre décision\n\nBonjour {prenom},\n\nSuite à notre échange, la seule question qui reste est la vôtre : est-ce qu'on y va ? Si quelque chose vous retient, dites-moi quoi — c'est plus utile qu'un oui poli.\n\n${signe}`,
      "Le prix se redit de vive voix, jamais par écrit avant la démonstration."
    ),
    m("closing", "dm", "Relancer une décision", `{prenom}, une seule question : on y va, oui ou non ? Un non me va, je préfère le savoir.`, "Une question fermée. Pas de « je me permets »."),
    m(
      "closing",
      "appel",
      "Isoler ce qui retient",
      `« Si ça ne tenait qu'à vous, vous le feriez ? »\n\nSa réponse dit si l'obstacle est réel ou un paravent. On n'argumente pas : on épluche — les circonstances, les autres, soi.`,
      "Obstacles (avant l'offre) ≠ objections (après). Ne pas les confondre."
    ),
    m(
      "apres-signature",
      "email",
      "Bienvenue — ce qui se passe maintenant",
      `Objet : la suite\n\nBonjour {prenom},\n\nMerci pour votre confiance. Voici ce qui se passe maintenant, et quand : je vous recontacte {jour} pour faire le point.\n\nSi un jour vous pensez à quelqu'un pour qui ${quoi} serait utile, je suis preneur — seulement si vous êtes satisfait.\n\n${signe}`,
      "La recommandation se demande après une promesse tenue, jamais avant."
    ),
    m("apres-signature", "dm", "Premier point", `{prenom}, c'est {closer} : tout se passe comme prévu de votre côté ?`, "Une question ouverte, une semaine après."),
    m(
      "apres-signature",
      "appel",
      "Point à un mois",
      `« Qu'est-ce qui a changé pour vous depuis qu'on a commencé ? »\n\nPuis, seulement si c'est positif : « Qui d'autre autour de vous aurait besoin de la même chose ? »`,
      "Ses mots à lui valent plus que tout ce que tu pourrais écrire."
    ),
    m(
      "reconquete",
      "email",
      "Une seule question, quelques mois après",
      `Objet : une question\n\nBonjour {prenom},\n\nIl y a quelques mois, ce n'était pas le moment. Je vous pose la question une fois, sans relance derrière : est-ce que ${quoi} est redevenu un sujet chez vous ?\n\nUn non me va très bien.\n\n${signe}`,
      "Si tu as une raison neuve (une date qu'il t'a donnée), elle passe avant ce modèle."
    ),
    m("reconquete", "dm", "Reprendre contact", `Bonjour {prenom}, une question, une seule fois : est-ce que c'est redevenu un sujet chez vous ? Un non me va.`, "Pas de « je me permets de relancer »."),
    m(
      "reconquete",
      "appel",
      "Rappel de reconquête",
      `« La dernière fois, ce n'était pas le moment. Qu'est-ce qui a changé depuis ? »\n\nS'il répond « rien » : on remercie, on raccroche.`,
      "Une réponse honnête vaut mieux qu'un rendez-vous arraché."
    ),
  ];
}
