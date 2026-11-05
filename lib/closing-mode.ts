import type { Prospect } from "./types";
import type { ProfilOperateur } from "./profil-operateur";
import { OBJECTION_LIBRARY } from "./hormozi";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SCRIPT DU MODE CLOSING — celui qu'on déroule PENDANT le rendez-vous.
 *
 * ⚠⚠ TROUVÉ LE 05/11/2026 en écrivant le guide « du rendez-vous à la
 * signature » du README : le Mode Closing (`components/training/closing-mode.tsx`)
 * servait NOTRE ancienne offre à TOUT inscrit — « je ne suis pas là pour vous
 * vendre un site », « ouvrir la maquette », « combien d'appels ratés ».
 * Un menuisier l'aurait lu devant son client. Même défaut que le script
 * d'appel et ALPHA LIVE, fermés le 21-22/10 : ce module-là avait échappé au
 * balayage parce que le texte vivait DANS le composant, sans module à tester.
 *
 * La règle (CLAUDE.md, « ALPHA EST HORIZONTAL ») : nos offres et notre doctrine
 * ne servent qu'au compte MAÎTRE, verdict PROUVÉ (`useMaitreProuve`). L'inscrit
 * reçoit une trame bâtie sur SON profil, qui garde la méthode (constat →
 * démonstration → chiffre posé ensemble → offre → demande), jamais notre contenu.
 *
 * ⚠ Aucun montant inventé : sans offre ni montant sur la fiche, l'étape « L'offre »
 * dit d'annoncer SON prix — elle ne le fabrique pas.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtapeClosing = [titre: string, texte: string];

const TROU_METIER = "[ce que vous vendez]";

export function etapesClosing(p: Prospect, maitre: boolean, profil: ProfilOperateur | null | undefined): EtapeClosing[] {
  const firstName = p.name.split(" ")[0] || "";
  const salut = firstName ? `Bonjour ${firstName}` : "Bonjour";
  const fmt = (n: number) => n.toLocaleString("fr-FR");

  if (maitre) {
    return [
      [
        "Accroche",
        `« ${salut} — merci de me recevoir. Je vais être direct : je ne suis pas là pour vous vendre un site, je suis là pour une décision. Dans 20 minutes, vous saurez exactement ce que vous perdez et ce que ça coûte de le régler. »`,
      ],
      [
        "Constat",
        p.problems.length
          ? `« Voilà ce qu'on a mesuré chez ${p.company} : ${p.problems.slice(0, 3).join(" ; ")}. »`
          : `« Voilà ce que je constate chez ${p.company} : les clients qui vous cherchent en ligne ne vous trouvent pas — ils trouvent le concurrent qui répond. »`,
      ],
      [
        "Démo mobile",
        `Sortir le téléphone. Ouvrir la maquette de ${p.company}. Se taire 10 secondes.\n\n« Voilà à quoi ressemble ${p.company} quand on le cherche. C'est vous, avec vos couleurs, votre carte, votre réalité. »`,
      ],
      [
        "Le chiffre",
        p.ignoranceTax > 0
          ? `« Chaque mois sans agir, ${p.company} laisse partir environ ${fmt(p.ignoranceTax)} €. Ce n'est pas mon chiffre — c'est le vôtre, on l'a calculé ensemble. La vraie question n'est pas "combien ça coûte", c'est "combien coûte le fait de ne rien faire". »`
          : `« On chiffre ensemble, maintenant : combien d'appels ratés par semaine ? Combien vaut un client ? Multipliez. C'est ça, le coût de l'attente. »`,
      ],
      [
        "L'offre",
        p.personalizedOffer
          ? `« Voilà ce que je vous propose, à vous et personne d'autre : ${p.personalizedOffer} »`
          : `« Mon offre : ${fmt(p.setupValue)} € de mise en place + ${fmt(p.monthlyValue)} €/mois, tout compris. Comparez à ce que vous perdez chaque mois — le calcul se fait tout seul. »`,
      ],
      [
        "La demande",
        `« De 1 à 10, à combien vous croyez que ça marcherait pour ${p.company} ? »\n\n— Sous 10 → « Qu'est-ce qui manque pour un 10 ? » (et on répare CETTE croyance)\n— À 10 → « Alors on démarre. Je vous envoie le contrat ce soir. »`,
      ],
    ];
  }

  const quoi = profil?.metier.trim() || TROU_METIER;
  const montant =
    p.setupValue > 0 || p.monthlyValue > 0
      ? [p.setupValue > 0 ? `${fmt(p.setupValue)} € une fois` : "", p.monthlyValue > 0 ? `${fmt(p.monthlyValue)} € par mois` : ""].filter(Boolean).join(" + ")
      : null;

  return [
    [
      "Accroche",
      `« ${salut}, merci de me recevoir. L'objectif de ce rendez-vous : qu'à la fin, vous sachiez si ${quoi} change quelque chose pour ${p.company}, et quoi exactement. »`,
    ],
    [
      "Constat",
      p.problems.length
        ? `« Voilà ce que j'ai noté chez ${p.company} : ${p.problems.slice(0, 3).join(" ; ")}. C'est juste ? »`
        : `Pose la question, puis tais-toi :\n\n« Racontez-moi comment ça se passe aujourd'hui chez ${p.company} sur ce sujet. Qu'est-ce qui coince ? »`,
    ],
    [
      "Démonstration",
      `Montre ${quoi} sur SON cas, avant tout prix. Puis tais-toi dix secondes.\n\n« Voilà ce que ça donnerait chez ${p.company}. »`,
    ],
    [
      "Le chiffre",
      `On chiffre ensemble, avec SES nombres, jamais les tiens :\n\n« Combien ça vous coûte aujourd'hui de ne pas l'avoir ? En temps, en clients, en argent ? »`,
    ],
    [
      "L'offre",
      p.personalizedOffer
        ? `« Voilà ce que je vous propose, pour ${p.company} : ${p.personalizedOffer} »`
        : montant
          ? `« Ma proposition : ${montant}. Comparez à ce qu'on vient de chiffrer ensemble. »`
          : `Annonce TON prix maintenant, celui de ton devis : la démonstration est faite, il a chiffré son problème. Aucun montant n'est sur la fiche, ALPHA n'en invente pas.`,
    ],
    [
      "La demande",
      `« De 1 à 10, à combien vous croyez que ça marcherait pour ${p.company} ? »\n\n— Sous 10 → « Qu'est-ce qui manque pour un 10 ? »\n— À 10 → « Alors on démarre. Je vous envoie le document à signer aujourd'hui. »`,
    ],
  ];
}

/**
 * Les objections à un tap. Pour l'inscrit, seulement celles dont la RÉPONSE
 * tient pour n'importe quelle offre (`universel`) : les autres parlent de notre
 * « Taxe d'Ignorance » et d'une « garantie de résultat » qui sont à nous.
 */
export function objectionsClosing(maitre: boolean) {
  if (maitre) return OBJECTION_LIBRARY;
  // Même une réponse « universelle » peut porter notre vocabulaire (« Taxe
  // d'Ignorance » est un mot de NOTRE pitch) : on le dit en clair pour l'inscrit.
  return OBJECTION_LIBRARY.filter((o) => o.universel).map((o) => ({
    ...o,
    counter: o.counter.replace(/la Taxe d'Ignorance/g, "ce qu'on vient de chiffrer ensemble"),
  }));
}
