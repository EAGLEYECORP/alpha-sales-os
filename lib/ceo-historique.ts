import type { Alerte, Gravite } from "./alpha-ceo";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'HISTORIQUE D'ALPHA CEO — « depuis quand », la seule chose que le
 * diagnostic instantané ne savait pas dire.
 *
 * ══ CE QUE ÇA CHANGE, ET POURQUOI CE N'EST PAS DU CONFORT ══
 *
 * `diagnostiquer()` rend une photo : voilà ce qui ne va pas MAINTENANT. Deux
 * alertes identiques à l'écran peuvent pourtant demander des gestes opposés :
 *
 *  · une panne apparue CE MATIN est probablement un déploiement — on regarde
 *    ce qui vient de changer ;
 *  · la même panne ouverte depuis trois semaines n'est plus une panne, c'est
 *    une DÉCISION qu'on n'a pas prise. La traiter comme un incident fait
 *    chercher un coupable technique là où il n'y en a pas.
 *
 * Sans historique, l'écran affiche les deux pareil, et c'est l'ancienneté —
 * la seule information qui les distingue — qui manque.
 *
 * ══ LES TROIS RÈGLES, ET ELLES VIENNENT DE LA DOCTRINE DE MESURE ══
 *
 * 1. **UN RELEVÉ N'EST PAS UNE ABSENCE DE PANNE.** Une panne qui disparaît du
 *    diagnostic parce que la sonde n'a pas répondu n'est pas résolue. On ne
 *    ferme donc JAMAIS une entrée sur l'absence d'une alerte : on la ferme
 *    quand le relevé est COMPLET et que l'alerte n'y est plus. « Je n'ai pas
 *    regardé » et « tout va bien » sont deux choses, et les confondre fait
 *    disparaître une panne de l'écran le jour où la sonde tombe.
 *
 * 2. **RIEN NE S'AUTO-CORRIGE.** L'historique constate, il ne décide pas. Il
 *    ne réordonne pas les gravités, ne masque pas une alerte « qu'on a déjà
 *    vue », et n'invente aucune tendance sur trois points. C'est la même
 *    règle que `lib/calibration.ts` : le module rend un verdict, l'humain
 *    change la constante.
 *
 * 3. **ZÉRO DONNÉE → ZÉRO CHIFFRE.** Une entrée sans date d'apparition rend
 *    `depuisJours: null`, jamais `0`. Un `0` se lit « apparue aujourd'hui »,
 *    ce qui est une affirmation qu'on n'a pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Une panne suivie dans le temps. */
export interface EntreeHistorique {
  /** L'id de l'alerte (`PANNES` ou `POINTS`). */
  id: string;
  /** Première fois qu'on l'a vue, en ISO. */
  apparueLe: string;
  /** Dernière fois qu'on l'a vue ouverte, en ISO. */
  vueLe: string;
  /** Fermée quand un relevé COMPLET ne la contient plus. `null` si ouverte. */
  resolueLe: string | null;
  /** La gravité au dernier relevé — elle peut monter. */
  gravite: Gravite;
  /** Combien de relevés l'ont vue ouverte. */
  occurrences: number;
}

/**
 * Un relevé, tel qu'il arrive.
 *
 * ⚠ `complet` EST LE CHAMP QUI COMPTE. Il dit si TOUTES les sondes ont
 * répondu. Un relevé partiel peut ajouter des pannes (celles qu'il a vues
 * sont bien réelles) mais ne peut en fermer AUCUNE : l'absence d'une alerte
 * dans un relevé borgne ne prouve rien.
 */
export interface Releve {
  a: string;
  alertes: Alerte[];
  complet: boolean;
}

/**
 * Applique un relevé à l'historique.
 *
 * Pure : elle ne lit pas l'horloge et n'écrit rien. La date vient du relevé,
 * ce qui la rend rejouable — un historique qu'on ne peut pas rejouer est un
 * historique qu'on ne peut pas vérifier.
 */
export function appliquerReleve(historique: EntreeHistorique[], releve: Releve): EntreeHistorique[] {
  const parId = new Map(historique.map((e) => [e.id, { ...e }]));
  const vues = new Set(releve.alertes.map((a) => a.id));

  for (const alerte of releve.alertes) {
    const existante = parId.get(alerte.id);
    if (!existante || existante.resolueLe) {
      /**
       * ⚠ UNE PANNE QUI REVIENT REPART À ZÉRO, et c'est délibéré. Garder la
       * date d'apparition d'origine ferait afficher « ouverte depuis 3
       * semaines » pour quelque chose qui a été corrigé puis cassé à nouveau —
       * deux histoires différentes fondues en une, et celle qui compte
       * (« ça vient de recasser ») serait perdue.
       */
      parId.set(alerte.id, {
        id: alerte.id,
        apparueLe: releve.a,
        vueLe: releve.a,
        resolueLe: null,
        gravite: alerte.gravite,
        occurrences: 1,
      });
      continue;
    }
    existante.vueLe = releve.a;
    existante.gravite = alerte.gravite;
    existante.occurrences += 1;
  }

  /**
   * ⚠⚠ LA FERMETURE N'A LIEU QUE SUR UN RELEVÉ COMPLET — c'est la règle 1, et
   * c'est le seul endroit où elle s'applique. Sur un relevé partiel, une
   * alerte absente reste OUVERTE : sa disparition peut venir de la sonde
   * plutôt que du système.
   */
  if (releve.complet) {
    for (const e of parId.values()) {
      if (!e.resolueLe && !vues.has(e.id)) e.resolueLe = releve.a;
    }
  }

  return [...parId.values()];
}

const JOUR = 86_400_000;

export interface PanneDatee {
  entree: EntreeHistorique;
  /** Jours depuis l'apparition. `null` quand la date est illisible. */
  depuisJours: number | null;
  /** Ce qu'on affiche à côté de l'alerte. */
  phrase: string;
}

/**
 * L'ancienneté d'une panne, dite plutôt que calculée à l'écran.
 *
 * ⚠ `null` PLUTÔT QUE `0` SUR UNE DATE ILLISIBLE. Un `0` s'affiche
 * « apparue aujourd'hui » — une affirmation qu'on n'a pas, et qui ferait
 * chercher la cause dans le déploiement du jour.
 */
export function ancienneté(entree: EntreeHistorique, maintenant = new Date()): PanneDatee {
  const t = new Date(entree.apparueLe).getTime();
  if (!Number.isFinite(t)) {
    return {
      entree,
      depuisJours: null,
      phrase: "Date d'apparition illisible — on ne sait pas depuis quand, et on ne le devine pas.",
    };
  }

  const jours = Math.max(0, Math.floor((maintenant.getTime() - t) / JOUR));

  if (entree.resolueLe) {
    return { entree, depuisJours: jours, phrase: `Résolue. Elle avait été vue ${entree.occurrences} fois.` };
  }

  /**
   * ⚠ LE SEUIL EST UNE DÉCISION, PAS UNE MESURE, et il est écrit comme telle.
   * Sept jours, parce qu'une semaine couvre un cycle de travail complet :
   * en dessous, on peut encore croire à un incident ; au-delà, personne ne
   * l'a traitée alors que tout le monde l'a vue. Aucune donnée ne valide ce
   * chiffre — il se changera quand on aura des relevés à regarder.
   */
  if (jours >= 7) {
    return {
      entree,
      depuisJours: jours,
      phrase:
        `Ouverte depuis ${jours} jours, vue ${entree.occurrences} fois. ` +
        `Ce n'est plus un incident : c'est une décision qui n'a pas été prise.`,
    };
  }

  return {
    entree,
    depuisJours: jours,
    phrase: jours === 0 ? "Apparue aujourd'hui — regarde ce qui vient de changer." : `Ouverte depuis ${jours} j.`,
  };
}

/** Les pannes encore ouvertes, la plus ancienne d'abord. */
export function ouvertes(historique: EntreeHistorique[]): EntreeHistorique[] {
  return historique.filter((e) => !e.resolueLe).sort((a, b) => a.apparueLe.localeCompare(b.apparueLe));
}

/**
 * Ce qui vient d'être RÉSOLU depuis le relevé précédent.
 *
 * ⚠ Ça se dit, et ce n'est pas de la décoration : un écran qui ne montre que
 * ce qui va mal ne donne jamais le signal « ton correctif a marché ». Sans
 * lui, on redéploie en aveugle pour vérifier.
 */
export function resoluesDepuis(historique: EntreeHistorique[], depuis: string): EntreeHistorique[] {
  return historique.filter((e) => e.resolueLe && e.resolueLe > depuis);
}
