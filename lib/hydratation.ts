import { LOT_MAX } from "./sync-prospects";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PIPE VIT SUR LE SERVEUR — et le navigateur n'en garde qu'une copie.
 *
 * ⚠ POURQUOI CE MODULE EXISTE : LE NAVIGATEUR NE TIENT PAS 2 500 FICHES.
 *
 * Mesuré (`tests/mur-stockage.test.ts`) : une fiche d'import Places pèse
 * ~1,9 Ko, et sa timeline en ajoute autant sur six touches. Le quota
 * localStorage est de 5 Mo.
 *
 *     alerte (80 %) ....... 1 200 fiches
 *     dépassement (100 %) . 1 500 fiches
 *
 * Au-delà, `localStorage.setItem` échoue — EN SILENCE. L'écran continue
 * d'afficher les fiches ; elles disparaissent en fermant l'onglet. Aucun
 * élagage ne repousse cette limite : supprimer les phrases répétées des
 * événements ne gagne que 30 %, on reste au-dessus.
 *
 * La seule sortie est architecturale : les fiches vivent dans Supabase, le
 * navigateur les charge au démarrage, et ne les persiste plus.
 *
 * ── LA RÈGLE QUI REND ÇA SÛR, ET SANS LAQUELLE C'EST DANGEREUX ──
 *
 * Un pipe qui vit sur le serveur peut être DÉTRUIT par le client : la synchro
 * sortante calcule des suppressions (`planifierSync`), et un navigateur qui
 * n'a pas réussi à charger a une liste vide. Pousser depuis là supprimerait
 * tout.
 *
 * D'où l'invariant central de ce module :
 *
 *     ON NE POUSSE JAMAIS DEPUIS UN ÉTAT QU'ON N'A PAS CHARGÉ.
 *
 * `peutSynchroniser` est la seule réponse à cette question. Un deuxième
 * endroit qui déciderait « bon, on peut envoyer » finirait par répondre
 * autrement un jour de bug réseau — et ce jour-là le pipe est perdu.
 *
 * ⚠⚠ CE N'EST PAS LA SEULE PROTECTION, ET C'EST VOULU. `planifierSync` refuse
 * déjà un effacement de plus d'un tiers (`SEUIL_EFFACEMENT`). Les deux gardes
 * se recouvrent : celle-ci empêche d'essayer, celle-là empêche d'aboutir. Une
 * seule aurait suffi le jour où elle marche.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatHydratation =
  /** Le pipe local fait foi : rien à charger (mode par défaut, historique). */
  | "locale"
  /** Serveur configuré, chargement pas encore tenté. */
  | "jamais"
  /** Chargement en cours — l'écran doit dire « chargement », pas « vide ». */
  | "en-cours"
  /** Chargé : c'est le seul état où l'on a le droit de pousser. */
  | "chargee"
  /** Le chargement a échoué. La liste affichée n'est PAS le pipe. */
  | "echec";

/**
 * A-t-on le droit de pousser vers le serveur ?
 *
 * ⚠ La seule réponse à cette question dans tout le produit. Elle est
 * volontairement stricte : en mode serveur, seul `chargee` autorise.
 *
 * `locale` autorise aussi — c'est le mode historique, où le navigateur EST la
 * source et où la synchro n'est qu'une sauvegarde. Le distinguer évite de
 * casser les installations existantes en changeant leur comportement sans
 * qu'elles aient rien demandé.
 */
export function peutSynchroniser(etat: EtatHydratation): boolean {
  return etat === "locale" || etat === "chargee";
}

/**
 * L'état au DÉMARRAGE, dérivé du seul réglage qui compte.
 *
 * ⚠ Cette fonction existe pour que l'état ne puisse pas être PERSISTÉ. Écrire
 * `chargee` dans le localStorage et le relire au démarrage suivant rendrait
 * `peutSynchroniser` vrai sur une liste vide qu'on n'a jamais chargée — donc
 * autoriserait exactement la poussée destructrice que ce module empêche.
 * Le store repasse par ici à chaque écriture (`partialize`), si bien que ce
 * qui redescend du disque est toujours honnête.
 */
export function etatInitial(pipeServeur: boolean): EtatHydratation {
  return pipeServeur ? "jamais" : "locale";
}

/**
 * Ce que l'écran doit dire d'une liste vide, selon l'état.
 *
 * ⚠ « Aucun prospect » et « pas encore chargé » sont deux phrases très
 * différentes, et l'opérateur agit différemment : la première l'envoie
 * importer, la seconde recharger. Les confondre lui fait réimporter un
 * fichier par-dessus un pipe qui existe déjà.
 */
export function phraseListeVide(etat: EtatHydratation): string | null {
  switch (etat) {
    case "en-cours":
      return "Chargement du pipe depuis le serveur…";
    case "jamais":
      return "Le pipe vit sur le serveur et n'a pas encore été chargé.";
    case "echec":
      return (
        "Le pipe n'a PAS pu être chargé depuis le serveur. Ce qui s'affiche n'est pas ton pipeline — " +
        "ne réimporte rien et ne supprime rien tant que le chargement n'a pas abouti."
      );
    default:
      return null;
  }
}

export interface Page {
  /** Index de la première fiche (0-based). */
  depuis: number;
  taille: number;
}

/**
 * Découpe un total en pages de chargement.
 *
 * Même taille de lot que la synchro sortante : deux tailles différentes pour
 * la même table, c'est deux comportements à déboguer au lieu d'un.
 */
export function pages(total: number, taille = LOT_MAX): Page[] {
  const n = Math.max(0, Math.floor(total));
  const t = Math.max(1, Math.floor(taille));
  const out: Page[] = [];
  for (let depuis = 0; depuis < n; depuis += t) out.push({ depuis, taille: t });
  return out;
}

/**
 * Le chargement est-il complet ?
 *
 * ⚠ On compare au TOTAL annoncé par le serveur, pas au nombre de pages
 * demandées. Une page qui revient courte (fiche supprimée entre deux
 * requêtes) donnerait sinon un pipe amputé qu'on croirait complet — et la
 * synchro suivante proposerait de supprimer les manquantes côté serveur.
 */
export function chargementComplet(recues: number, total: number): boolean {
  return total >= 0 && recues >= total;
}

/**
 * Verdict après un chargement, avec la raison quand ça n'a pas abouti.
 *
 * Rendre `chargee` sur un chargement partiel serait la pire erreur possible :
 * ça ouvrirait la synchro sortante sur une liste incomplète.
 */
export function verdictChargement(recues: number, total: number, erreur?: string): { etat: EtatHydratation; pourquoi: string } {
  if (erreur) {
    return { etat: "echec", pourquoi: `Le serveur n'a pas répondu : ${erreur}` };
  }
  if (!chargementComplet(recues, total)) {
    return {
      etat: "echec",
      pourquoi:
        `Chargement incomplet : ${recues} fiche(s) reçues sur ${total} annoncées. ` +
        `La synchro sortante reste bloquée — pousser d'ici supprimerait les manquantes côté serveur.`,
    };
  }
  return { etat: "chargee", pourquoi: `${recues} fiche(s) chargées depuis le serveur.` };
}
