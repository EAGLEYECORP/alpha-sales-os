// Seuls les identifiants sont utiles ici, et ce module est rendu côté client :
// `lib/bricks` y embarquerait toute la grille tarifaire.
import { CAPACITES } from "./public-catalogue";

/**
 * ─────────────────────────────────────────────────────────────────────
 * METTRE UN NOUVEAU CLIENT EN ROUTE — le pas à pas.
 *
 * La signature n'est pas la fin de la vente : c'est le début du moment où
 * on peut la perdre. Un client qui signe et qui n'a rien vu tourner dans
 * les dix jours doute — et un client qui doute ne recommande pas, ne
 * renouvelle pas, et raconte ce doute autour de lui.
 *
 * Ce module est la liste de ce qu'il faut faire, dans l'ordre, avec :
 *   · qui le fait (nous ou lui) — la moitié des retards vient d'attendre
 *     quelque chose qu'on n'a jamais demandé ;
 *   · ce qui BLOQUE la suite, distingué de ce qui peut se faire en
 *     parallèle ;
 *   · la preuve que l'étape est réellement finie, pas juste cochée.
 *
 * ── LE CAS « ESSAI » ──
 *
 * Un client d'essai n'est pas un client au rabais : c'est un client qui
 * n'a pas encore payé. Il a donc DROIT à la même mise en route, et le
 * parcours doit produire une preuve de valeur AVANT la date de bascule —
 * sinon l'essai se termine par un silence, ce qui est le pire des retours.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Cote = "nous" | "client";

export interface EtapeOnboarding {
  id: string;
  /** Le jour visé, compté depuis la signature (J+0 = le jour même). */
  jour: number;
  titre: string;
  /** Ce qu'on fait, concrètement. */
  quoi: string;
  cote: Cote;
  /** Rien ne peut avancer tant que ce n'est pas fait. */
  bloquant: boolean;
  /** Comment on sait que c'est VRAIMENT fait. */
  preuve: string;
  /** Ce qui fait déraper cette étape précise. */
  piege?: string;
  /** Briques concernées — l'étape ne s'affiche que si le client les a. */
  briques?: string[];
}

export const ONBOARDING: EtapeOnboarding[] = [
  {
    id: "kickoff",
    jour: 0,
    titre: "Appel de lancement — 30 minutes, le jour de la signature",
    quoi: "On refixe l'objectif chiffré, on nomme un interlocuteur unique de chaque côté, et on pose les dates des trois jalons.",
    cote: "nous",
    bloquant: true,
    preuve: "Un compte rendu écrit envoyé le jour même, avec les trois dates.",
    piege:
      "Le repousser « à la semaine prochaine ». L'enthousiasme de la signature dure quarante-huit heures ; après, c'est un projet parmi d'autres.",
  },
  {
    id: "acces",
    jour: 1,
    titre: "Récupérer les accès",
    quoi: "Domaine et DNS, boîte d'envoi, numéro de téléphone si Alpha Voice, export du fichier client existant.",
    cote: "client",
    bloquant: true,
    preuve: "Chaque accès testé par nous, pas seulement reçu.",
    piege:
      "Se contenter d'un identifiant transmis. Un accès non testé se révèle faux au moment où on en a besoin, et fait perdre trois jours.",
  },
  {
    id: "compte",
    jour: 1,
    titre: "Créer le compte et cloisonner",
    quoi: "Compte client, briques activées, routes ouvertes selon ce qu'il a pris. Il ne voit QUE sa brique.",
    cote: "nous",
    bloquant: true,
    preuve: "Connexion réussie par le client, et une route non achetée qui renvoie bien une porte fermée.",
  },
  {
    id: "import",
    jour: 2,
    titre: "Importer et trier son fichier",
    quoi: "Import CSV ou API, deep-dive automatique, et le verdict de lot : combien de fiches sont réellement exploitables.",
    cote: "nous",
    bloquant: false,
    preuve: "Le triage affiché : X fiches appelables sur Y importées, et les trous qui dominent.",
    piege:
      "Annoncer « 2 000 contacts importés ». Ce chiffre ne veut rien dire. Celui qui compte est « 180 sont appelables » — et il vaut mieux le dire tout de suite que le découvrir au premier lot d'appels.",
    briques: ["crm", "audits"],
  },
  {
    id: "doctrine",
    jour: 3,
    titre: "Écrire SA doctrine",
    quoi: "Ses cibles, son offre, ses prix, ses interdits. C'est ce bloc qui part dans chaque message généré.",
    cote: "nous",
    bloquant: true,
    preuve: "Un script généré sur une de SES fiches, qu'il relit et valide mot à mot.",
    piege:
      "Garder notre doctrine par défaut. Un client dont les scripts parlent de notre offre est un client qui arrête au bout d'une semaine, sans le dire.",
  },
  {
    id: "delivrabilite",
    jour: 3,
    titre: "DNS et chauffe de la boîte d'envoi",
    quoi: "SPF, DKIM, DMARC vérifiés, puis montée en volume progressive.",
    cote: "nous",
    bloquant: true,
    preuve: "Les trois enregistrements valides, et un envoi test qui arrive en boîte principale.",
    piege:
      "Envoyer 500 emails le premier jour depuis un domaine neuf. Le domaine est grillé pour des mois, et rien ne le dit sur le moment.",
    briques: ["campagnes", "tracking"],
  },
  {
    id: "voix",
    jour: 5,
    titre: "Mettre Alpha Voice en service",
    quoi: "Numéro raccordé, script audité (article 50), un appel test entrant ET un sortant, écoutés ensemble.",
    cote: "nous",
    bloquant: false,
    preuve: "Deux appels réels écoutés par le client, et la transcription visible dans son journal.",
    piege:
      "Livrer sans le faire écouter. Un client qui entend la voix pour la première fois via un de ses propres clients est un client qui coupe tout.",
    briques: ["alpha-voice"],
  },
  {
    id: "premier-resultat",
    jour: 7,
    titre: "Le premier résultat visible",
    quoi: "Un rendez-vous pris, ou une réponse entrante, ou un devis parti — quelque chose qui n'existait pas avant nous.",
    cote: "nous",
    bloquant: true,
    preuve: "L'élément est dans SON pipeline, et il peut le montrer à son associé.",
    piege:
      "Attendre le résultat parfait. Un petit résultat au jour 7 vaut mieux qu'un beau résultat au jour 30 : c'est lui qui achète les trois semaines suivantes.",
  },
  {
    id: "formation",
    jour: 10,
    titre: "Prise en main — une heure, sur SES écrans",
    quoi: "Les trois écrans qu'il ouvrira tous les jours, et rien d'autre. Le reste se découvre quand le besoin arrive.",
    cote: "nous",
    bloquant: false,
    preuve: "Il fait une action complète seul, sans qu'on touche la souris.",
    piege:
      "Faire le tour des quarante écrans. Il en retiendra zéro. Trois écrans maîtrisés valent mieux que quarante survolés.",
  },
  {
    id: "point-30",
    jour: 30,
    titre: "Point à 30 jours — les chiffres, pas les impressions",
    quoi: "Ce qui a été produit, ce qui bloque, ce qu'on change le mois suivant. Et la demande de recommandation si c'est mérité.",
    cote: "nous",
    bloquant: false,
    preuve: "Un compte rendu chiffré envoyé, et la décision du mois 2 écrite.",
    piege:
      "Demander « alors, content ? ». On répond toujours oui, et on résilie deux mois plus tard. La bonne question est « qu'est-ce qui t'a le plus manqué ? ».",
  },
];

export interface ParcoursEtape extends EtapeOnboarding {
  /** Date visée, calculée depuis la signature. */
  date: string;
  /** Jours de retard si la date est passée et l'étape non faite. */
  retard: number;
}

export interface Parcours {
  etapes: ParcoursEtape[];
  /** Étape bloquante la plus ancienne non faite — le vrai sujet du jour. */
  bloque?: ParcoursEtape;
  /** Bascule de l'essai : la date où il faut avoir prouvé quelque chose. */
  finEssai?: string;
  message: string;
}

/** Durée d'essai par défaut, en jours. */
export const ESSAI_JOURS = 14;

/**
 * Le parcours d'un client, daté et filtré sur ce qu'il a acheté.
 *
 * `essai` change la lecture, pas les étapes : le parcours reste le même,
 * mais on rappelle la date à laquelle il faut qu'un résultat existe.
 */
export function parcours(
  signeLe: string,
  briquesAchetees: string[],
  faits: string[] = [],
  opts: { essai?: boolean; now?: Date } = {}
): Parcours {
  const now = opts.now ?? new Date();
  const depart = new Date(signeLe);
  const jourEnMs = 86_400_000;

  const achetees = new Set(briquesAchetees.length ? briquesAchetees : CAPACITES.map((c) => c.id));

  const etapes: ParcoursEtape[] = ONBOARDING
    // Une étape qui parle d'une brique non achetée n'a rien à faire dans le
    // parcours : elle donne l'impression d'un retard qui n'existe pas.
    .filter((e) => !e.briques || e.briques.some((b) => achetees.has(b)))
    .map((e) => {
      const date = new Date(depart.getTime() + e.jour * jourEnMs);
      const enRetard = !faits.includes(e.id) && date.getTime() < now.getTime();
      return {
        ...e,
        date: date.toISOString(),
        retard: enRetard ? Math.floor((now.getTime() - date.getTime()) / jourEnMs) : 0,
      };
    });

  const bloque = etapes.find((e) => e.bloquant && !faits.includes(e.id));
  const finEssai = opts.essai ? new Date(depart.getTime() + ESSAI_JOURS * jourEnMs).toISOString() : undefined;

  let message: string;
  if (!bloque) {
    message = "Rien ne bloque. Les étapes restantes peuvent avancer en parallèle.";
  } else if (bloque.retard > 0) {
    message = `« ${bloque.titre} » a ${bloque.retard} jour(s) de retard et bloque tout le reste. ${
      bloque.cote === "client" ? "C'est côté client : relancer aujourd'hui, nommément." : "C'est côté nous : personne d'autre ne le fera."
    }`;
  } else {
    message = `Prochaine étape bloquante : « ${bloque.titre} », prévue le ${new Date(bloque.date).toLocaleDateString("fr-FR")}.`;
  }

  if (finEssai && new Date(finEssai).getTime() > now.getTime()) {
    const jours = Math.ceil((new Date(finEssai).getTime() - now.getTime()) / jourEnMs);
    const resultat = faits.includes("premier-resultat");
    message += ` Essai : ${jours} jour(s) avant la bascule — ${
      resultat ? "un résultat existe déjà, c'est ce qui fera signer." : "AUCUN résultat visible pour l'instant, et c'est ce qui fera échouer l'essai."
    }`;
  }

  return { etapes, bloque, finEssai, message };
}
