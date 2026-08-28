import type { Prospect } from "./types";
import { attemptsFromEvents } from "./master-rappel";
import { aDecroche } from "./call-cadence";
import { tauxMesure, ECHANTILLON_MIN, type Taux } from "./calibration";
import { closersRequis } from "./capacite-appels";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PALIERS DE CAMPAGNE — 10, puis 100, puis 1 000. Un plafond, pas un tutoriel.
 *
 * ── LE PROBLÈME QUE ÇA RÈGLE ──
 *
 * Trois chiffres décident de TOUT dans cette campagne, et les trois sont
 * aujourd'hui des suppositions :
 *   · le taux de décroché (hypothèse : 30 %) ;
 *   · le taux d'intérêt qualifié parmi les décrochés (hypothèse : 20 %) — c'est
 *     lui qui fait dire « un seul closer suffit pour 500 appels/jour » ;
 *   · le tarif Telnyx à la minute, dont le relevé réel autorise un facteur 29.
 *
 * Lancer 1 000 appels sans les avoir mesurés, ce n'est pas de l'ambition :
 * c'est brûler une liste de 1 000 personnes pour apprendre ce que 10 appels
 * auraient dit. Un prospect appelé avec un script cassé ne se rappelle pas.
 *
 * ── CE QUI REND CE MODULE DIFFÉRENT D'UNE CHECKLIST ──
 *
 * Une checklist se coche. Un palier BORNE : tant qu'il n'est pas validé, le
 * plafond d'appels de la campagne est celui du palier (`plafondPalierCampagne`), et
 * `buildCampaignRun` écarte le reste avec la raison écrite. C'est la seule
 * façon qu'un garde-fou serve à quelque chose — sinon il décore.
 *
 * ── CE QUE CE MODULE N'EST PAS : `lib/checkpoints.ts` ──
 *
 * Celui-là garde les portes d'UNE FICHE, étape par étape (« le décideur est
 * nommé », « la démo a été montrée avant le prix »). Il répond à : ce prospect
 * peut-il avancer ?
 *
 * Ici on garde une porte de VOLUME : la campagne entière peut-elle monter d'un
 * cran ? Rien à voir avec une fiche, et un prospect parfaitement qualifié ne
 * fait pas franchir un palier.
 *
 * La distinction vérifiable/déclaratif est reprise telle quelle de ce
 * module-là, vocabulaire compris — deux mots pour la même idée, c'est ce qui
 * fait diverger deux écrans qui devraient dire pareil.
 *
 * ── LES DEUX GENRES DE POINT, ET POURQUOI ILS SONT SÉPARÉS ──
 *
 * · `mesure` : la base répond toute seule. Personne ne peut la cocher, elle se
 *   constate. On ne peut pas se mentir dessus.
 * · `declaratif` : personne d'autre que l'opérateur ne peut l'observer (avoir
 *   ENTENDU la phrase d'ouverture, avoir relevé un compteur chez un
 *   fournisseur). Celui-là se coche — mais **il ne s'offre pas** tant que sa
 *   condition préalable n'existe pas dans la base. Cocher « j'ai entendu la
 *   phrase » sans qu'aucun appel n'ait été décroché fabriquerait la preuve.
 *
 * ⚠ Aucun palier ne se valide tout seul, même quand tout est vert. La règle du
 * dépôt vaut ici comme ailleurs : le module rend un verdict, l'humain tranche,
 * et ça se voit. Ce qui est automatique, c'est le REFUS.
 * ─────────────────────────────────────────────────────────────────────
 */

export type IdPalierCampagne = "p10" | "p100" | "p1000";

export interface PointPalier {
  id: string;
  question: string;
  genre: "mesure" | "declaratif";
  /** Pour un point déclaratif : pourquoi la machine ne peut pas y répondre. */
  pourquoi: string;
}

export interface PalierCampagne {
  id: IdPalierCampagne;
  /** Plafond CUMULÉ d'appels composés autorisés tant que le palier n'est pas validé. */
  appels: number;
  titre: string;
  /** Ce que ce palier sert à APPRENDRE. Aucun palier ne sert à vendre. */
  objet: string;
  points: PointPalier[];
}

export const PALIERS_CAMPAGNE: PalierCampagne[] = [
  {
    id: "p10",
    appels: 10,
    titre: "10 appels — la chaîne marche",
    objet:
      "Vérifier que l'appel part, que l'agent parle, et que le résultat REVIENT dans la fiche. " +
      "Et fermer le modèle de coût : un seul appel isolé, compteurs relevés avant et après, " +
      "tranche les deux inconnues fournisseurs.",
    points: [
      {
        id: "p10-composes",
        question: "10 appels ont été composés",
        genre: "mesure",
        pourquoi: "",
      },
      {
        id: "p10-retour",
        question: "Au moins un appel a écrit son résultat dans la fiche",
        genre: "mesure",
        pourquoi: "",
      },
      {
        id: "p10-art50",
        question: "La phrase d'ouverture (IA · pas une personne · pour le compte de X) a été ENTENDUE",
        genre: "declaratif",
        pourquoi:
          "Le code la prononce en premier et refuse un script non conforme, mais rien ne prouve " +
          "qu'elle est audible et compréhensible au téléphone. C'est une obligation légale " +
          "(art. 50 EU AI Act) : elle se vérifie avec une oreille, pas avec un test.",
      },
      {
        id: "p10-cdr",
        question: "L'export CDR Telnyx est relevé (minutes et coût par appel)",
        genre: "declaratif",
        pourquoi:
          "C'est la dernière ligne du coût d'usine qui repose sur une supposition, et l'écart " +
          "possible va de ×1,5 à ×29. Aucune donnée de l'app ne peut y répondre : il faut " +
          "Telnyx → Reporting → Usage Reports.",
      },
      {
        id: "p10-fish",
        question: "Le compteur Fish a été relevé avant et après UN appel isolé",
        genre: "declaratif",
        pourquoi:
          "Le coût de synthèse retenu vient d'un relevé unique (n=1) qui donne ×2,24 " +
          "l'hypothèse, sans explication. Deux relevés encadrant un seul appel le tranchent.",
      },
    ],
  },
  {
    id: "p100",
    appels: 100,
    titre: "100 appels — on mesure au lieu de supposer",
    objet:
      "Remplacer les deux hypothèses qui gouvernent tout le dimensionnement : le taux de " +
      "décroché, et la part de décrochés qui donnent un intérêt qualifié.",
    points: [
      { id: "p100-composes", question: "100 appels ont été composés", genre: "mesure", pourquoi: "" },
      {
        id: "p100-decroche",
        question: `Le taux de décroché tient sur assez d'appels pour décider (${ECHANTILLON_MIN} minimum)`,
        genre: "mesure",
        pourquoi: "",
      },
      {
        id: "p100-interet",
        question: "Au moins un INTÉRÊT QUALIFIÉ est remonté par l'agent",
        genre: "mesure",
        pourquoi: "",
      },
      {
        id: "p100-ecoute",
        question: "Un appel a été réécouté en entier, du début au raccroché",
        genre: "declaratif",
        pourquoi:
          "Les compteurs disent qu'un appel s'est passé, jamais s'il était bon. Un agent qui " +
          "coupe la parole, répond à côté ou s'excuse en boucle produit exactement les mêmes " +
          "statistiques qu'un agent qui convertit.",
      },
    ],
  },
  {
    id: "p1000",
    appels: 1000,
    titre: "1 000 appels — le volume",
    objet:
      "Passer à l'échelle sur des taux mesurés, avec assez d'humains pour prendre les " +
      "rendez-vous que ça produit.",
    points: [
      { id: "p1000-composes", question: "1 000 appels ont été composés", genre: "mesure", pourquoi: "" },
      {
        id: "p1000-closers",
        question: "Il y a assez de closers pour absorber les intérêts qualifiés produits",
        genre: "mesure",
        pourquoi: "",
      },
      {
        id: "p1000-opposition",
        question: "Le taux d'opposition reste sous 10 %",
        genre: "mesure",
        pourquoi: "",
      },
    ],
  },
];

/**
 * Seuil d'opposition au-delà duquel la campagne brûle sa liste.
 *
 * Une opposition n'est pas un refus : c'est quelqu'un qui demande à ne plus
 * JAMAIS être contacté. Au-delà de 10 %, ce n'est plus le marché qui répond,
 * c'est le script qui agresse — et chaque appel supplémentaire détruit une
 * fiche définitivement.
 */
export const SEUIL_OPPOSITION = 0.1;

/** Ce que la base sait des appels passés. Aucun chiffre inventé. */
export interface VecuAppels {
  composes: number;
  decroches: number;
  interesses: number;
  oppositions: number;
  /** Tentatives dont le résultat a été écrit (autre chose que « sans-réponse »). */
  avecResultat: number;
}

/**
 * Relit la base. Une seule lecture, partagée par tous les paliers : deux
 * comptages du même événement finiraient par diverger.
 */
export function vecuAppels(prospects: Prospect[]): VecuAppels {
  let composes = 0;
  let decroches = 0;
  let interesses = 0;
  let oppositions = 0;
  let avecResultat = 0;

  for (const p of prospects) {
    for (const a of attemptsFromEvents(p)) {
      composes++;
      if (aDecroche(a.outcome)) decroches++;
      if (a.outcome === "interesse") interesses++;
      if (a.outcome === "opposition") oppositions++;
      if (a.outcome !== "sans-reponse") avecResultat++;
    }
  }
  return { composes, decroches, interesses, oppositions, avecResultat };
}

export interface EtatPointPalier extends PointPalier {
  satisfait: boolean;
  /** Ce que la donnée dit — ou ce qui manque pour qu'elle puisse le dire. */
  constat: string;
  /**
   * Pour un point déclaratif : ce qui empêche encore de le cocher. Vide = cochable.
   *
   * ⚠ Ce n'est pas du confort d'interface. Cocher « j'ai entendu la phrase »
   * avant qu'un seul appel n'ait été décroché fabriquerait la preuve du seul
   * point qui soit une obligation légale.
   */
  bloquePar: string;
}

export type EtatPalierCampagneId = "verrouille" | "en-cours" | "pret" | "valide";

export interface EtatPalierCampagne {
  palier: PalierCampagne;
  etat: EtatPalierCampagneId;
  /** Appels composés restant avant le plafond de CE palier. */
  restants: number;
  points: EtatPointPalier[];
  /** La seule phrase à lire : quoi faire maintenant. */
  prochainGeste: string;
}

export interface Progression {
  vecu: VecuAppels;
  tauxDecroche: Taux;
  tauxInteret: Taux;
  tauxOpposition: Taux;
  paliers: EtatPalierCampagne[];
  /** Le palier sur lequel on travaille. */
  courant: EtatPalierCampagne;
  /**
   * Plafond CUMULÉ d'appels autorisé aujourd'hui. `null` = plus de bornage par
   * palier (tout est validé) ; le plafond quotidien habituel reprend seul.
   */
  plafond: number | null;
}

export interface EntreeProgression {
  /** Paliers validés à la main par l'opérateur. */
  valides?: IdPalierCampagne[];
  /** Points humains cochés, par identifiant de checkpoint. */
  coches?: string[];
  /** Closers disponibles, pour le point de capacité du palier 1 000. */
  closers?: number;
}

/**
 * Le plafond d'appels imposé par les paliers.
 *
 * ⚠ Fonction séparée et exportée pour qu'il n'y ait qu'UNE réponse à « combien
 * d'appels a-t-on le droit de passer ». Le serveur (`/api/campaign/tick`) et
 * l'écran de contrôle la posent au même endroit ; deux calculs auraient fini
 * par autoriser deux volumes différents.
 */
export function plafondPalierCampagne(valides: IdPalierCampagne[] = []): number | null {
  for (const p of PALIERS_CAMPAGNE) {
    if (!valides.includes(p.id)) return p.appels;
  }
  return null;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;

export function evaluerProgression(prospects: Prospect[], e: EntreeProgression = {}): Progression {
  const vecu = vecuAppels(prospects);
  const valides = e.valides ?? [];
  const coches = new Set(e.coches ?? []);

  /**
   * ⚠ Zéro donnée → zéro chiffre. `tauxMesure` rend `valeur: null` et
   * `source: "aucune"` quand rien n'a été appelé : un « 0 % de décroché » se
   * lirait comme un résultat catastrophique alors qu'il ne s'est rien passé.
   */
  const tauxDecroche = tauxMesure(vecu.decroches, vecu.composes, "Décroché");
  const tauxInteret = tauxMesure(vecu.interesses, vecu.decroches, "Intérêt qualifié parmi les décrochés");
  const tauxOpposition = tauxMesure(vecu.oppositions, vecu.composes, "Opposition");

  const closers = Math.max(0, Math.floor(e.closers ?? 0));

  const evaluerPoint = (c: PointPalier, palier: PalierCampagne): EtatPointPalier => {
    const base = { ...c, bloquePar: "" };

    switch (c.id) {
      case "p10-composes":
      case "p100-composes":
      case "p1000-composes":
        return {
          ...base,
          satisfait: vecu.composes >= palier.appels,
          constat: `${vecu.composes} / ${palier.appels} appels composés.`,
        };

      case "p10-retour":
        return {
          ...base,
          satisfait: vecu.avecResultat > 0,
          constat:
            vecu.avecResultat > 0
              ? `${vecu.avecResultat} appel(s) ont écrit un résultat dans la fiche.`
              : vecu.composes === 0
                ? "Aucun appel composé — rien à constater."
                : "Aucun résultat écrit. Soit personne n'a décroché, soit la boucle ne remonte pas : " +
                  "c'est exactement ce que ce palier doit trancher.",
        };

      case "p100-decroche":
        return {
          ...base,
          satisfait: tauxDecroche.source === "mesure" && !tauxDecroche.fragile,
          constat: tauxDecroche.phrase,
        };

      case "p100-interet":
        return {
          ...base,
          satisfait: vecu.interesses > 0,
          constat:
            vecu.interesses > 0
              ? `${vecu.interesses} intérêt(s) qualifié(s) remonté(s) par l'agent.`
              : vecu.decroches === 0
                ? "Aucun décroché — le passage de main n'a pas encore pu se produire."
                : `${vecu.decroches} décroché(s), aucun intérêt qualifié. Tant qu'un seul n'est pas ` +
                  "remonté, rien ne prouve qu'un « oui » réveille un humain.",
        };

      case "p1000-closers": {
        // On ne dimensionne PAS sur l'hypothèse : sans taux d'intérêt mesuré,
        // `closersRequis` retombe sur son repli prudent (tout décroché mobilise
        // un humain), et ce point reste rouge. C'est voulu.
        if (tauxInteret.source !== "mesure" || tauxInteret.valeur === null) {
          return {
            ...base,
            satisfait: false,
            constat: "Taux d'intérêt non mesuré : impossible de dire combien de closers il faut.",
          };
        }
        const requis = closersRequis(palier.appels, (tauxDecroche.valeur ?? 0) * 100, {
          tauxInteretPct: tauxInteret.valeur * 100,
        });
        return {
          ...base,
          satisfait: closers >= requis,
          constat: `${requis} closer(s) nécessaires pour ${palier.appels} appels, ${closers} déclaré(s).`,
        };
      }

      case "p1000-opposition":
        return {
          ...base,
          satisfait: tauxOpposition.source === "mesure" && (tauxOpposition.valeur ?? 1) < SEUIL_OPPOSITION,
          constat:
            tauxOpposition.source === "mesure"
              ? `${tauxOpposition.phrase} Seuil d'alerte : ${pct(SEUIL_OPPOSITION)}.`
              : "Aucune mesure d'opposition — rien n'a encore été appelé.",
        };

      // ── Les points déclaratifs ──
      case "p10-art50":
        return {
          ...base,
          satisfait: coches.has(c.id),
          constat: coches.has(c.id) ? "Confirmé à l'oreille." : "Pas encore confirmé.",
          bloquePar:
            vecu.decroches === 0
              ? "Aucun appel n'a été décroché : il n'y a rien à avoir entendu."
              : "",
        };

      case "p10-cdr":
      case "p10-fish":
        return {
          ...base,
          satisfait: coches.has(c.id),
          constat: coches.has(c.id) ? "Relevé effectué." : "Pas encore relevé.",
          bloquePar: vecu.composes === 0 ? "Aucun appel composé : les compteurs n'ont rien à montrer." : "",
        };

      case "p100-ecoute":
        return {
          ...base,
          satisfait: coches.has(c.id),
          constat: coches.has(c.id) ? "Un appel a été réécouté en entier." : "Pas encore réécouté.",
          bloquePar: vecu.decroches === 0 ? "Aucun appel décroché : il n'y a aucune conversation à réécouter." : "",
        };

      default:
        /**
         * ⚠ Un checkpoint ajouté à `PALIERS_CAMPAGNE` sans être évalué ici doit être
         * FAUX, jamais vrai par défaut. Un point de contrôle inconnu qui
         * s'affiche vert laisserait franchir un palier sans rien vérifier.
         */
        return { ...base, satisfait: false, constat: "Point de contrôle non évalué — il ne peut pas être franchi." };
    }
  };

  const paliers: EtatPalierCampagne[] = PALIERS_CAMPAGNE.map((palier, i) => {
    const points = palier.points.map((c) => evaluerPoint(c, palier));
    const precedentValide = i === 0 || valides.includes(PALIERS_CAMPAGNE[i - 1].id);
    const tousVerts = points.every((c) => c.satisfait);

    const etat: EtatPalierCampagneId = valides.includes(palier.id)
      ? "valide"
      : !precedentValide
        ? "verrouille"
        : tousVerts
          ? "pret"
          : "en-cours";

    const manquants = points.filter((c) => !c.satisfait);
    const prochainGeste =
      etat === "valide"
        ? "PalierCampagne validé."
        : etat === "verrouille"
          ? `Valide d'abord « ${PALIERS_CAMPAGNE[i - 1].titre} ».`
          : etat === "pret"
            ? "Tous les points sont vérifiés. Valide le palier pour ouvrir le suivant."
            : manquants[0]
              ? `${manquants[0].question} — ${manquants[0].bloquePar || manquants[0].constat}`
              : "";

    return {
      palier,
      etat,
      restants: Math.max(0, palier.appels - vecu.composes),
      points,
      prochainGeste,
    };
  });

  const courant = paliers.find((p) => p.etat === "en-cours" || p.etat === "pret") ?? paliers[paliers.length - 1];

  return {
    vecu,
    tauxDecroche,
    tauxInteret,
    tauxOpposition,
    paliers,
    courant,
    plafond: plafondPalierCampagne(valides),
  };
}
