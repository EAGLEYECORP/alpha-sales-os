/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI PEUT LIRE LES SESSIONS D'APPEL — et pourquoi ce n'est pas la même
 * porte que pour en écrire.
 *
 * ⚠ DÉFAUT TROUVÉ AU NAVIGATEUR, pas par un test : la Salle de contrôle
 * affichait « non autorisé » sur TOUTE session d'appel, en production.
 *
 * La route exigeait `x-voice-secret` — le secret de l'AGENT PYTHON, une
 * machine externe qui poste ses transcriptions. Le navigateur de l'opérateur
 * ne l'a pas, et il ne DOIT surtout pas l'avoir : le mettre dans le bundle
 * client l'exposerait à quiconque ouvre les devtools.
 *
 * Le GET échouait donc dans les DEUX configurations possibles :
 *   · secret configuré (production) → le navigateur ne peut pas le fournir ;
 *   · secret absent → le repli `NODE_ENV !== "production"` refuse aussi.
 *
 * Résultat : l'écran de supervision d'Alpha Voice était mort en production,
 * sans message visible — juste une liste vide qui ressemble à « aucun appel ».
 *
 * La LECTURE passe donc par la porte de l'APP : requête de même origine,
 * c'est-à-dire un navigateur déjà passé par SITE_PASSWORD. C'est le contrôle
 * que le middleware applique aux routes internes ; on le refait ici parce que
 * cette route ne PEUT pas y être inscrite — l'agent Python est d'une autre
 * origine par construction, et l'inscrire le casserait.
 *
 * L'ÉCRITURE, elle, ne bouge pas : seul le secret l'ouvre.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le minimum dont on a besoin d'une requête. Rend la règle testable. */
export interface EnTetes {
  get(nom: string): string | null;
}

/**
 * Une requête vient-elle de NOTRE page ?
 *
 * `Sec-Fetch-Site` est posé par le navigateur et un site tiers ne peut pas le
 * forger ; `curl` ne l'envoie pas du tout, d'où le refus par défaut. L'entête
 * `Origin` sert de repli pour les navigateurs qui ne l'émettent pas.
 */
export function memeOrigine(h: EnTetes): boolean {
  const site = h.get("sec-fetch-site");
  if (site === "same-origin") return true;
  // Un `Sec-Fetch-Site` présent mais différent est un refus net : ne pas
  // retomber sur `Origin`, qu'un site tiers contrôle.
  if (site) return false;

  const origin = h.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (h.get("host") ?? "");
  } catch {
    return false;
  }
}

/**
 * Le droit de LIRE les sessions : le secret de l'agent, ou l'application
 * elle-même. `secretOk` est calculé par la route (il dépend de l'env).
 */
export function peutLireSessions(h: EnTetes, secretOk: boolean): boolean {
  return secretOk || memeOrigine(h);
}

/** Le message d'erreur, pour qu'il dise ce qu'il faut faire. */
export const REFUS_LECTURE =
  "non autorisé — la lecture des sessions exige soit le secret de l'agent (x-voice-secret), " +
  "soit une requête émise depuis l'application elle-même.";
