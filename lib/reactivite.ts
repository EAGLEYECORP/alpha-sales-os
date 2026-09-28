/**
 * ─────────────────────────────────────────────────────────────────────
 * RÉACTIVITÉ MESURÉE — l'ouverture et le clic reviennent dans le plan.
 *
 * Quatrième maillon ouvert du flux. Le pixel de suivi et les liens tracés
 * écrivent bien opens/clicks (`lib/tracking.ts`), et l'écran de la fiche les
 * affiche dans un onglet. Mais MASTER RAPPEL ne les lisait pas.
 *
 * Or la doctrine dit : « la fréquence suit la RÉACTIVITÉ, jamais le
 * calendrier ». Sans ces données, `vitalSigns` compte une touche sortante
 * sans réponse et rien d'autre — donc :
 *
 *   3 emails ouverts cinq fois chacun  →  compté comme « saturé »
 *   3 emails jamais ouverts            →  compté comme « saturé »
 *
 * Ce sont deux situations opposées. La première dit que l'objet marche et
 * que c'est la DEMANDE qui coince : on change l'ask, pas le canal. La seconde
 * dit que le message n'arrive pas, ou pas au bon endroit : là, changer de
 * canal (et vérifier la délivrabilité) est la seule chose à faire.
 *
 * ⚠ CE QUE L'OUVERTURE NE PROUVE PAS — et il faut le dire à l'écran.
 *
 *  · Une ouverture NON comptée ne prouve pas qu'il n'a pas lu : la plupart
 *    des clients bloquent les images par défaut. Le taux d'ouverture est un
 *    PLANCHER, jamais une mesure.
 *  · Une ouverture comptée ne prouve pas qu'un humain a lu : les proxys de
 *    confidentialité (Apple Mail Privacy Protection en tête) préchargent les
 *    images sans que personne n'ouvre rien.
 *  · Le CLIC est le seul signal presque dur — presque, parce que certains
 *    filtres de sécurité visitent les liens automatiquement. Un clic isolé
 *    à la seconde de l'envoi est un scanner, pas un prospect.
 *
 * D'où la règle du module : il rend une LECTURE et une phrase qui porte sa
 * propre réserve. Il ne rend jamais un pourcentage nu, et il ne décide rien
 * tout seul — il informe le plan.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le minimum de `lib/tracking.ts` dont on a besoin. Volontairement étroit. */
export interface EnvoiSuivi {
  createdAt: string;
  opens: number;
  clicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
}

export type LectureReactivite =
  /** Aucun envoi tracé : on ne sait rien, et on le dit. */
  | "aucune-donnee"
  /** Des envois, zéro ouverture comptée. Plancher, pas preuve. */
  | "muet"
  /** Il ouvre et ne répond pas : l'objet marche, la demande coince. */
  | "lu-sans-reponse"
  /** Il a cliqué : le signal le plus dur qu'on ait. */
  | "clic";

export interface Reactivite {
  lecture: LectureReactivite;
  envois: number;
  /** Envois ayant reçu au moins une ouverture comptée. */
  ouverts: number;
  ouverturesTotales: number;
  clics: number;
  dernierSignalAt: string | null;
  /** Heures depuis la dernière ouverture ou le dernier clic. */
  heuresDepuisSignal: number | null;
  /** Ce qui s'affiche, réserve comprise. Jamais un taux nu. */
  phrase: string;
  /** Ce que ça change au plan, ou null si ça ne change rien. */
  conseil: string | null;
}

/**
 * Un clic dans la minute de l'envoi est un scanner de sécurité, pas un lecteur.
 *
 * Le seuil est volontairement bas : un prospect qui ouvre son mail tout de
 * suite existe, et l'écarter serait pire que compter un scanner de temps en
 * temps. C'est le clic *simultané* à l'envoi qui trahit la machine.
 */
export const DELAI_SCANNER_MS = 60_000;

/** Au-delà, le signal est vieux : il ne définit plus une fenêtre. */
export const FENETRE_CHAUDE_H = 48;

/** En dessous, « il n'ouvre jamais » n'est qu'une petite série. */
export const ENVOIS_MIN_POUR_CONCLURE = 3;

const H = 3_600_000;

function plusRecent(a: string | null, b: string | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return b.localeCompare(a) > 0 ? b : a;
}

/**
 * Lit les envois tracés d'UN prospect.
 *
 * Rend toujours un objet — jamais null : l'absence de données est un état à
 * afficher (« on ne sait pas »), pas un trou à masquer.
 */
export function lireReactivite(envois: EnvoiSuivi[], now: Date = new Date()): Reactivite {
  const n = envois.length;
  if (n === 0) {
    return {
      lecture: "aucune-donnee",
      envois: 0,
      ouverts: 0,
      ouverturesTotales: 0,
      clics: 0,
      dernierSignalAt: null,
      heuresDepuisSignal: null,
      phrase:
        "Aucun envoi tracé sur cette fiche — on ne sait pas s'il lit. Ce n'est pas « il ignore » : c'est un angle mort.",
      conseil: null,
    };
  }

  let ouverts = 0;
  let ouverturesTotales = 0;
  let clics = 0;
  let dernier: string | null = null;

  for (const e of envois) {
    ouverturesTotales += Math.max(0, e.opens);
    if (e.opens > 0) ouverts += 1;

    // Le clic ne compte que s'il n'est pas simultané à l'envoi.
    const dt = e.lastClickAt ? new Date(e.lastClickAt).getTime() - new Date(e.createdAt).getTime() : null;
    const humain = e.clicks > 0 && (dt === null || dt > DELAI_SCANNER_MS);
    if (humain) {
      clics += Math.max(0, e.clicks);
      dernier = plusRecent(dernier, e.lastClickAt);
    }
    dernier = plusRecent(dernier, e.lastOpenAt);
  }

  const heures = dernier ? Math.max(0, (now.getTime() - new Date(dernier).getTime()) / H) : null;
  const chaud = heures !== null && heures <= FENETRE_CHAUDE_H;

  if (clics > 0) {
    return {
      lecture: "clic",
      envois: n,
      ouverts,
      ouverturesTotales,
      clics,
      dernierSignalAt: dernier,
      heuresDepuisSignal: heures,
      phrase: `${clics} clic(s) sur ${n} envoi(s) — le seul signal presque dur qu'on ait. Un clic simultané à l'envoi aurait été écarté (scanner de sécurité).`,
      conseil: chaud
        ? "Il vient de cliquer : la fenêtre est MAINTENANT, et le rappel se raccroche à ce qu'il a ouvert — pas à « je me permets de relancer »."
        : "Il a cliqué, puis plus rien. Reprendre sur CE lien : « vous avez regardé X, qu'est-ce qui vous a arrêté ? »",
    };
  }

  if (ouverts > 0) {
    return {
      lecture: "lu-sans-reponse",
      envois: n,
      ouverts,
      ouverturesTotales,
      clics: 0,
      dernierSignalAt: dernier,
      heuresDepuisSignal: heures,
      phrase: `${ouverturesTotales} ouverture(s) comptée(s) sur ${n} envoi(s), aucune réponse. ⚠ Une ouverture comptée ne prouve pas qu'un humain a lu — les proxys de confidentialité préchargent les images.`,
      conseil:
        "Il ouvre et ne répond pas : l'objet fonctionne, c'est la DEMANDE qui coince. Changer l'ask (plus petit, plus concret), pas le canal.",
    };
  }

  if (n < ENVOIS_MIN_POUR_CONCLURE) {
    return {
      lecture: "muet",
      envois: n,
      ouverts: 0,
      ouverturesTotales: 0,
      clics: 0,
      dernierSignalAt: null,
      heuresDepuisSignal: null,
      phrase: `${n} envoi(s), aucune ouverture comptée — trop peu pour en conclure quoi que ce soit.`,
      conseil: null,
    };
  }

  return {
    lecture: "muet",
    envois: n,
    ouverts: 0,
    ouverturesTotales: 0,
    clics: 0,
    dernierSignalAt: null,
    heuresDepuisSignal: null,
    phrase: `${n} envois, zéro ouverture comptée. ⚠ Ce n'est PAS la preuve qu'il n'a pas lu : la plupart des clients bloquent les images, donc le taux d'ouverture est un plancher.`,
    conseil:
      "Zéro signal sur plusieurs envois : traiter d'abord l'hypothèse technique (délivrabilité, spam, mauvaise adresse) avant de conclure qu'il n'est pas intéressé. Puis changer de canal.",
  };
}
