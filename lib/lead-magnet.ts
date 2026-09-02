import type { Prospect } from "./types";
import { getAccount } from "./accounts";
import { deepDive } from "./deep-dive";
import { recovery } from "./recovery";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LEAD MAGNET — ce qu'on donne AVANT de vendre.
 *
 * Doctrine, tirée des chiffres réels de juillet 2026 : là où un audit écrit
 * est parti, le taux d'opportunité monte ; là où il n'y a eu que des appels,
 * il reste à zéro. L'aimant n'est donc pas un gadget marketing — c'est la
 * PIÈCE ÉCRITE qui ouvre la conversation.
 *
 * Trois règles qui le rendent efficace, et qu'on ne contourne pas :
 *
 * 1. IL DOIT ÊTRE UTILE MÊME S'IL N'ACHÈTE JAMAIS. Un aimant qui ne sert
 *    qu'à capturer un email se voit, et brûle la marque. Le nôtre chiffre SA
 *    perte avec SES données : il peut le garder et agir sans nous.
 *
 * 2. IL EST CIBLÉ, PAS GÉNÉRIQUE. Un aimant par offre, avec l'ICP qu'il
 *    attire. Envoyer l'audit téléphonie à quelqu'un qui n'a pas de téléphone
 *    fait perdre les deux parties.
 *
 * 3. IL MÈNE AU CADRAGE, PAS À LA VENTE. L'aimant ne vend rien : il prouve
 *    qu'on sait de quoi on parle et propose de mesurer ensemble. Le prix
 *    n'apparaît jamais dedans.
 *
 * Le rendu du document existe déjà (lib/audit-doc.ts) : ce module choisit
 * QUEL aimant, pour QUI, avec quel crochet — il ne redessine rien.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface LeadMagnet {
  id: string;
  /** Le titre tel que le prospect le lit. */
  title: string;
  /** Ce qu'il contient concrètement. */
  contains: string[];
  /** L'offre à laquelle il mène. */
  offer: EagleyeOffer;
  /** Comptes autorisés à le servir (vide = tous). */
  accountIds?: string[];
  /** Le prospect type — le ciblage, dit en une ligne. */
  targets: string;
  /** Les signaux qui déclenchent CET aimant plutôt qu'un autre. */
  triggers: string[];
  /** La phrase d'envoi — courte, sans vente. */
  hook: string;
  /** Ce qu'on demande en retour. Jamais plus qu'un créneau. */
  ask: string;
  /** Pourquoi il a de la valeur même sans achat. */
  standaloneValue: string;
}

export const LEAD_MAGNETS: LeadMagnet[] = [
  {
    id: "audit-telephone",
    title: "Audit de votre accueil téléphonique",
    contains: [
      "Le nombre d'appels que vous perdez chaque semaine, chiffré",
      "Ce que ça représente en euros par mois et par an, sur VOS chiffres",
      "Ce que font vos trois concurrents les plus proches quand on les appelle",
      "Les trois correctifs applicables sans nous",
    ],
    offer: "alpha-voice",
    accountIds: ["eagleye"],
    targets: "Métiers où le téléphone EST le canal d'entrée : garages, artisans, santé, auto-écoles, immobilier.",
    triggers: [
      "Appels manqués constatés ou déclarés",
      "Le gérant décroche lui-même entre deux interventions",
      "Standard saturé aux heures de pointe",
    ],
    hook:
      "« J'ai appelé votre entreprise trois fois cette semaine à des heures différentes. " +
      "J'ai noté ce qui s'est passé — je vous envoie la page, vous en faites ce que vous voulez. »",
    ask: "Quinze minutes pour vérifier ensemble si mes chiffres correspondent à votre réalité.",
    standaloneValue:
      "Il repart avec le coût réel de ses appels manqués et trois correctifs gratuits. " +
      "S'il les applique seul et que ça suffit, tant mieux — on ne lui aura pas menti.",
  },
  {
    id: "audit-visibilite",
    title: "Audit de votre visibilité locale",
    contains: [
      "Ce que voit un client qui vous cherche sur Google, capture à l'appui",
      "Votre note et vos avis comparés aux trois concurrents du quartier",
      "L'état de votre site : ce qui bloque un contact, en clair",
      "Les corrections gratuites, par ordre d'impact",
    ],
    offer: "visibilite-growth",
    accountIds: ["eagleye"],
    targets: "Commerces et artisans invisibles en ligne alors qu'ils sont bons dans leur métier.",
    triggers: ["Site absent ou daté", "Moins de dix avis Google", "Note sous 4/5", "Réseaux inactifs"],
    hook:
      "« J'ai cherché votre métier dans votre ville et regardé ce qui remonte. " +
      "Vous n'êtes pas où vous devriez être — voilà la page, avec ce qui se corrige tout seul. »",
    ask: "Un quart d'heure pour vous montrer ce que ça change une fois corrigé.",
    standaloneValue:
      "Les corrections listées sont réellement applicables sans nous : fiche Google, avis, coordonnées. " +
      "Ça marche, et ça prouve qu'on sait de quoi on parle.",
  },
  {
    id: "audit-process",
    title: "Audit de votre process commercial",
    contains: [
      "Le trajet complet d'un lead chez vous, étape par étape, avec les points de fuite",
      "Combien d'affaires meurent faute de relance, estimé sur votre volume",
      "Ce qui dépend d'une seule personne — et ce qui tombe si elle s'absente",
      "Le premier automatisme à poser, celui qui rapporte le plus vite",
    ],
    offer: "alpha-sales-os",
    accountIds: ["eagleye"],
    targets: "Structures avec une vraie fonction commerciale : agences, conseil, B2B, courtage.",
    triggers: [
      "Cycle de vente structuré mais suivi artisanal",
      "Panier ou récurrent élevé",
      "Croissance récente sans outillage",
    ],
    hook:
      "« On a cartographié le trajet d'un lead chez vous. Il y a trois endroits où ça fuit. " +
      "La page est à vous. »",
    ask: "Vingt minutes pour regarder si ma lecture est juste.",
    standaloneValue:
      "La cartographie du process a de la valeur en soi : beaucoup de dirigeants ne l'ont jamais vue écrite. " +
      "Même sans nous, elle leur sert.",
  },
];

export const magnetById = (id: string): LeadMagnet | undefined => LEAD_MAGNETS.find((m) => m.id === id);

/** Les aimants qu'un compte a le droit de servir. */
export function magnetsFor(accountId: string): LeadMagnet[] {
  const a = getAccount(accountId);
  return LEAD_MAGNETS.filter(
    (m) => (!m.accountIds || m.accountIds.includes(a.id)) && a.offers.includes(m.offer)
  );
}

export interface MagnetPick {
  magnet: LeadMagnet;
  /** Pourquoi celui-là pour CE prospect. */
  why: string;
  /** Le crochet, personnalisé avec ses données. */
  hook: string;
  /** Le chiffre qui donne envie d'ouvrir — absent s'il n'est pas mesuré. */
  teaser?: string;
  /** Ce qu'on demande. */
  ask: string;
}

/**
 * L'aimant à servir à CE prospect, choisi sur son deep-dive.
 *
 * Renvoie null si aucun aimant ne correspond : mieux vaut ne rien envoyer
 * qu'envoyer l'audit téléphonique à quelqu'un qui n'a pas ce problème.
 * Un aimant hors-sujet coûte plus cher que pas d'aimant du tout.
 */
export function pickMagnet(p: Prospect, accountId = "eagleye"): MagnetPick | null {
  const allowed = magnetsFor(accountId);
  if (allowed.length === 0) return null;

  const dive = deepDive(p, accountId);
  // L'aimant suit l'offre recommandée par le deep-dive : même logique de
  // routage, donc jamais de contradiction entre ce qu'on envoie et ce qu'on
  // proposera ensuite.
  const magnet = allowed.find((m) => m.offer === dive.offer) ?? allowed[0];

  const a = p.deepAudit ?? {};
  const missed = a.missedCallsPerWeek;
  const ticket = a.avgTicket;

  // Le teaser n'existe QUE si on a de vrais chiffres. Pas d'accroche inventée.
  let teaser: string | undefined;
  if (magnet.offer === "alpha-voice" && missed !== undefined && ticket !== undefined) {
    const r = recovery({ missedPerWeek: missed, avgTicket: ticket, conversionPct: a.conversionRate ?? 20 });
    if (r.perMonth > 0) {
      teaser = `≈ ${r.perMonth.toLocaleString("fr-FR")} € par mois qui partent chez le concurrent, sur vos propres chiffres.`;
    }
  } else if (magnet.offer === "visibilite-growth" && a.googleReviews !== undefined) {
    // ⚠ On ne dit PAS « vos concurrents en ont davantage » : on ne les a pas
    // comptés. Une comparaison inventée en première phrase est le plus court
    // chemin vers la corbeille — il suffit qu'il en ait plus qu'eux pour que
    // tout le document devienne suspect. On énonce SON chiffre, et on laisse
    // le seuil parler : sous 10 avis, personne n'a besoin qu'on compare.
    teaser =
      a.googleReviews < 10
        ? `${a.googleReviews} avis Google. En dessous de dix, la fiche ne remonte quasiment jamais sur une recherche locale.`
        : `${a.googleReviews} avis Google — on a regardé ce que ça donne face aux recherches de votre zone.`;
  }

  const firstName = p.name?.trim() && !/^(g[ée]rant|cabinet|accueil|contact|standard)$/i.test(p.name.trim())
    ? p.name.trim().split(" ")[0]
    : null;

  const hook = firstName ? magnet.hook.replace("« ", `« ${firstName}, `) : magnet.hook;

  const why = dive.signals.length
    ? `Choisi sur : ${dive.signals.slice(0, 2).join(" · ")}.`
    : "Choisi par défaut — la fiche est trop pauvre pour trancher, à compléter avant l'envoi.";

  return { magnet, why, hook, teaser, ask: magnet.ask };
}

/**
 * L'email d'envoi de l'aimant. Court par construction : un email long ne se
 * lit pas, et l'aimant est la pièce jointe — pas le message.
 *
 * ⚠ Aucun prix n'y figure, jamais. Le prix vient après le cadrage.
 */
export function magnetEmail(pick: MagnetPick, p: Prospect, senderName: string, accountName: string): { subject: string; body: string } {
  const subject = `${p.company} — ${pick.magnet.title.toLowerCase()}`;
  const lines = [
    pick.hook,
    "",
    ...(pick.teaser ? [pick.teaser, ""] : []),
    "Ce que vous trouverez dans la page jointe :",
    ...pick.magnet.contains.map((c) => `— ${c}`),
    "",
    "C'est à vous, que l'on travaille ensemble ou non.",
    "",
    pick.ask,
    "",
    `${senderName}`,
    accountName,
  ];
  return { subject, body: lines.join("\n") };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE L'AIMANT CONTIENDRA VRAIMENT — avant de l'envoyer.
 *
 * ── LE PROBLÈME TROUVÉ ──
 *
 * Chaque aimant PROMET quatre choses (`contains`). Le générateur de document
 * (`lib/audit-doc.ts`) n'en produit qu'une partie : il met en page des champs
 * SAISIS À LA MAIN, plus des ordres de grandeur tirés des repères de la
 * verticale. Personne n'appelle les trois concurrents, personne ne fait de
 * capture Google — ces sections n'existent que si l'humain les fabrique.
 *
 * Un prospect qui reçoit un document annonçant quatre parties et n'en trouve
 * que deux ne se dit pas « il manque des données ». Il se dit « ils ont
 * survendu ». Sur une première prise de contact, c'est le pire moment
 * possible pour perdre le bénéfice du doute.
 *
 * Pire cas : `withMetierBenchmark` remplit les appels manqués depuis la
 * MOYENNE du métier quand la fiche est vide. Un document intitulé « sur VOS
 * chiffres » peut donc afficher une moyenne sectorielle. Le garagiste qui
 * reçoit « vous perdez 23 appels/semaine » alors qu'il en reçoit 4 par jour
 * jette la page ET nous avec.
 *
 * ── CE QUE FAIT CE BLOC ──
 *
 * Il dit, promesse par promesse, si elle est adossée à une donnée RÉELLE, à
 * une ESTIMATION de secteur, ou à un travail que l'humain doit encore faire.
 * Il ne bloque rien : c'est l'opérateur qui décide d'envoyer. Mais il ne peut
 * plus envoyer sans savoir.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatPromesse =
  /** Adossée à une donnée saisie sur la fiche. */
  | "reel"
  /** Sera remplie par la moyenne du métier — vraie en ordre de grandeur, pas SA vérité. */
  | "estime"
  /** Rien ne la produit : l'humain doit la fabriquer avant d'envoyer. */
  | "a-faire"
  /** La donnée manque et rien ne la remplace : la section sortira vide. */
  | "absent";

export interface PromesseVerifiee {
  promesse: string;
  etat: EtatPromesse;
  /** Ce qu'il faut faire, quand il y a quelque chose à faire. */
  action?: string;
}

export interface MagnetReadiness {
  magnetId: string;
  promesses: PromesseVerifiee[];
  /** Nombre de promesses réellement tenues par le document tel quel. */
  tenues: number;
  /** Minutes de travail humain avant que le document tienne ses promesses. */
  minutesDeTravail: number;
  /** Verdict en une ligne pour l'opérateur. Jamais vide. */
  verdict: string;
}

/**
 * Les promesses qu'AUCUN code ne produit aujourd'hui, et le temps qu'elles
 * coûtent à l'humain. Repérées par un fragment distinctif de leur libellé.
 *
 * C'est une liste explicite plutôt qu'une heuristique : une heuristique qui
 * se trompe ici ferait passer une promesse non tenue pour tenue, ce qui est
 * exactement le bug qu'on corrige.
 */
const PROMESSES_MANUELLES: { fragment: RegExp; minutes: number; action: string }[] = [
  {
    fragment: /concurrents les plus proches quand on les appelle/i,
    minutes: 15,
    action: "Appeler 3 concurrents à 3 moments différents et noter ce qui se passe (décroché, sonnerie, rappel).",
  },
  {
    fragment: /capture à l'appui/i,
    minutes: 10,
    action: "Faire la recherche Google du métier + ville et capturer ce qui remonte.",
  },
  {
    fragment: /comparés aux trois concurrents/i,
    minutes: 10,
    action: "Relever la note et le nombre d'avis des 3 concurrents du quartier.",
  },
  {
    fragment: /trajet complet d'un lead/i,
    minutes: 20,
    action: "Cartographier le parcours d'un lead avec lui — ça se fait au téléphone, pas depuis un bureau.",
  },
  {
    fragment: /ce qui dépend d'une seule personne/i,
    minutes: 10,
    action: "Identifier les points de dépendance à une personne (à demander pendant le cadrage).",
  },
];

/** Ce qu'une promesse chiffrée exige comme données sur la fiche. */
function etatChiffre(p: Prospect, promesse: string): EtatPromesse | null {
  const d = p.deepAudit ?? {};
  if (/appels que vous perdez/i.test(promesse)) {
    if (d.missedCallsPerWeek !== undefined) return "reel";
    // Le repère de verticale existe : le document sortira rempli, mais avec
    // une moyenne. C'est le cas le plus dangereux — il ne se voit pas.
    return "estime";
  }
  if (/en euros par mois et par an/i.test(promesse)) {
    return p.ignoranceTax > 0 || (d.missedCallsPerWeek !== undefined && d.avgTicket !== undefined) ? "reel" : "estime";
  }
  if (/votre note et vos avis/i.test(promesse)) {
    return d.googleRating !== undefined || d.googleReviews !== undefined ? "reel" : "absent";
  }
  if (/l'état de votre site/i.test(promesse)) {
    return d.websiteState?.trim() ? "reel" : "absent";
  }
  if (/combien d'affaires meurent/i.test(promesse)) {
    return p.ignoranceTax > 0 ? "reel" : "estime";
  }
  return null;
}

/**
 * Ce que l'aimant contiendra vraiment pour CE prospect, promesse par promesse.
 */
export function magnetReadiness(p: Prospect, magnet: LeadMagnet): MagnetReadiness {
  const promesses: PromesseVerifiee[] = magnet.contains.map((promesse) => {
    const manuelle = PROMESSES_MANUELLES.find((m) => m.fragment.test(promesse));
    if (manuelle) return { promesse, etat: "a-faire", action: manuelle.action };

    const chiffre = etatChiffre(p, promesse);
    if (chiffre) {
      return {
        promesse,
        etat: chiffre,
        action:
          chiffre === "estime"
            ? "Remplacer la moyenne du métier par SON chiffre avant d'envoyer — sinon il verra que ce n'est pas le sien."
            : chiffre === "absent"
              ? "Donnée absente : la section sortira vide. La saisir ou retirer la promesse."
              : undefined,
      };
    }
    // Les promesses qualitatives (correctifs, recommandations) sont produites
    // par le document à partir de la verticale : toujours là, jamais fausses.
    return { promesse, etat: "reel" };
  });

  const tenues = promesses.filter((x) => x.etat === "reel").length;
  const minutesDeTravail = promesses
    .filter((x) => x.etat === "a-faire")
    .reduce((s, x) => {
      const m = PROMESSES_MANUELLES.find((pm) => pm.fragment.test(x.promesse));
      return s + (m?.minutes ?? 0);
    }, 0);

  const aFaire = promesses.filter((x) => x.etat === "a-faire").length;
  const estimes = promesses.filter((x) => x.etat === "estime").length;
  const absents = promesses.filter((x) => x.etat === "absent").length;

  const verdict =
    tenues === promesses.length
      ? "Le document tient ses quatre promesses. Envoyable tel quel."
      : [
          `${tenues}/${promesses.length} promesses tenues par le document seul.`,
          aFaire ? `${aFaire} demandent ${minutesDeTravail} min de ta part.` : "",
          estimes ? `${estimes} sortiront avec une MOYENNE de secteur, pas son chiffre.` : "",
          absents ? `${absents} sortiront vides.` : "",
        ]
          .filter(Boolean)
          .join(" ");

  return { magnetId: magnet.id, promesses, tenues, minutesDeTravail, verdict };
}
