/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MODE DE SORTIE DU BUILD NEXT — une décision, pas un ternaire noyé.
 *
 * ══ POURQUOI CE MODULE EXISTE (17/09/2026) ══
 *
 * `next.config.ts` posait `output: "standalone"` en dur. C'est REQUIS par le
 * Dockerfile du self-host client : il copie `.next/standalone` et lance
 * `node server.js`. On ne peut donc pas le retirer.
 *
 * Mais Alpha passe sur Netlify, et le runtime `@netlify/plugin-nextjs` gère la
 * sortie LUI-MÊME (traçage des fichiers, fonctions). Lui imposer `standalone`
 * — une sortie qu'il n'attend pas — est le suspect n°1 d'un premier build
 * Netlify qui casse. Je n'ai pas pu le vérifier depuis la sandbox (réseau
 * bloqué) ; le geste sûr est donc de donner à chaque cible EXACTEMENT ce
 * qu'elle attend, au lieu de parier qu'elle tolère l'autre.
 *
 * ⚠ La décision est ISOLÉE ici, pure et testée, plutôt qu'un ternaire sur le
 * signal `NETLIFY` noyé dans la config. `next.config.ts` n'est pas testable
 * simplement (Next l'évalue) ; un module pur l'est, et la règle qui décide où
 * tourne l'app mérite mieux qu'une ligne qu'on ne peut pas exercer.
 *
 * ⚠ Le défaut de sûreté va dans le sens DOCKER, pas Netlify : en l'absence de
 * tout signal, on rend `standalone`. Un build Docker sans `standalone` produit
 * une image qui ne démarre pas (`server.js` absent) — panne bruyante, au build
 * du client. Un build Netlify avec la sortie par défaut est le cas nominal du
 * runtime. On ne casse le self-host que si on est SÛR d'être sur Netlify.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que `next.config` doit passer à `output`. `undefined` = défaut Next. */
export type ModeSortie = "standalone" | undefined;

/**
 * ⚠ On ne prend PAS `NodeJS.ProcessEnv` : ce type exige `NODE_ENV`, et chaque
 * appelant devrait alors fabriquer un faux environnement complet pour tester
 * une seule variable — un cast finit par masquer une faute de frappe. Même
 * décision que `lib/url-publique.ts`, pour la même raison.
 */
export type EnvBuild = { NETLIFY?: string; [autre: string]: string | undefined };

/**
 * `NETLIFY` est posé à `"true"` par tout build Netlify. C'est le seul signal
 * fiable qu'on tourne sous son runtime — `VERCEL` a son équivalent, mais Vercel
 * tolère `standalone`, donc lui n'a pas besoin d'être distingué.
 */
export function modeSortie(env: EnvBuild = process.env): ModeSortie {
  return env.NETLIFY === "true" ? undefined : "standalone";
}
