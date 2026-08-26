/**
 * ─────────────────────────────────────────────────────────────────────
 * PROGRESSION DE L'ASSISTANT DE CONFIGURATION.
 *
 * Deux composants ont besoin du même état et ils ne se parlent pas :
 *  · `SetupWizard` écrit où en est l'utilisateur (l'installation complète
 *    prend ~1 h, on ne la refait pas depuis le début à chaque retour) ;
 *  · `Onboarding` décide si l'assistant s'OUVRE tout seul au chargement.
 *
 * ⚠ LE DÉFAUT QUE CE MODULE CORRIGE — trouvé au navigateur, pas par un test.
 * Le rail de l'assistant promet noir sur blanc : « Votre progression est
 * sauvegardée — fermez et revenez quand vous voulez. » Or la croix ne posait
 * rien : elle basculait un `useState` local. Au chargement suivant — un lien
 * cliqué, un onglet rouvert — `onboarded` valait toujours faux et l'assistant
 * revenait par-dessus l'écran (`fixed inset-0 z-95`, il intercepte TOUS les
 * clics). L'app était donc inutilisable tant que l'utilisateur n'avait pas
 * traversé les onze étapes, alors que le texte lui disait le contraire.
 *
 * On ne corrige PAS en posant `onboarded: true` à la fermeture : ce drapeau
 * dit « la configuration est faite », et le poser mentirait — le tour
 * opérateur s'ouvrirait sur une machine non branchée, et les écrans
 * croiraient à un n8n configuré. On enregistre autre chose, exactement ce que
 * l'utilisateur a fait : il a REPOUSSÉ, il n'a pas fini.
 * ─────────────────────────────────────────────────────────────────────
 */

export const PROGRESS_KEY = "alpha_wizard_progress_v2";

export interface Progress {
  step: number;
  sheetsReady: boolean;
  workflowReady: boolean;
  /** L'utilisateur a fermé l'assistant à la croix : ne plus l'ouvrir seul. */
  differe?: boolean;
}

const VIDE: Progress = { step: 0, sheetsReady: false, workflowReady: false, differe: false };

/**
 * Relit la progression. Tolère tout : clé absente, JSON cassé, champs d'une
 * version antérieure (`differe` n'existait pas). Une progression illisible
 * n'est pas une panne — on repart du début, ce qui est déjà le cas du
 * nouvel arrivant.
 */
export function lireProgression(raw: string | null): Progress {
  if (!raw) return { ...VIDE };
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    if (typeof p !== "object" || p === null) return { ...VIDE };
    return {
      step: typeof p.step === "number" && p.step >= 0 ? Math.floor(p.step) : 0,
      sheetsReady: Boolean(p.sheetsReady),
      workflowReady: Boolean(p.workflowReady),
      differe: Boolean(p.differe),
    };
  } catch {
    return { ...VIDE };
  }
}

/**
 * LA règle d'ouverture automatique, en un seul endroit.
 *
 * Elle ne s'ouvre seule que pour quelqu'un qui n'a NI terminé NI repoussé.
 * Le bouton des Réglages (`alpha:open-setup`) reste évidemment souverain :
 * repousser n'est pas fermer la porte, c'est ne plus se la prendre en pleine
 * figure à chaque navigation.
 */
export function doitSOuvrirSeul(onboarded: boolean, p: Progress): boolean {
  return !onboarded && !p.differe;
}

/** Lecture navigateur. Un stockage bloqué rend la valeur neutre, pas une erreur. */
export function chargerProgression(): Progress {
  if (typeof window === "undefined") return { ...VIDE };
  try {
    return lireProgression(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return { ...VIDE };
  }
}

/** Écriture navigateur. Stockage plein ou bloqué : sans gravité, on continue. */
export function enregistrerProgression(p: Progress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* la progression ne sera pas reprise — l'assistant reste utilisable */
  }
}

/** Efface la progression : l'assistant est allé jusqu'au bout. */
export function effacerProgression(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}
