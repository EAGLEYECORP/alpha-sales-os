/**
 * ─────────────────────────────────────────────────────────────────────
 * L'URL PUBLIQUE DU DÉPLOIEMENT — pour ce qui n'a PAS de requête sous la main.
 *
 * ⚠⚠ POURQUOI CE MODULE EXISTE, et ce qu'il coûtait de ne pas l'avoir.
 *
 * Les métadonnées Next (`export const metadata`) sont évaluées AU BUILD, dans
 * un layout : il n'y a aucune requête HTTP à ce moment-là, donc aucun
 * `req.nextUrl.origin` à lire. Sans base explicite, Next résout toute URL
 * relative contre `http://localhost:3000` — et il l'écrit dans le HTML livré.
 *
 * Mesuré sur le build de production, pas déduit :
 *
 *   <meta property="og:image" content="http://localhost:3000/media/hero-poster.jpg"/>
 *   <meta name="twitter:image" content="http://localhost:3000/media/hero-poster.jpg"/>
 *
 * C'est l'adresse annoncée à LinkedIn quand quelqu'un partage le lien. LinkedIn
 * va chercher cette image sur SA propre machine, ne trouve rien, et publie la
 * carte SANS vignette. Le layout de la vitrine porte lui-même la phrase qui
 * chiffre la perte : « le premier canal, c'est LinkedIn, et un lien partagé
 * sans image ni titre correct perd la moitié de ses clics avant même d'être
 * ouvert ». La doctrine désigne LinkedIn comme le canal PAR DÉFAUT de notre
 * ICP. Le canal principal saignait, et le build le disait à chaque passage —
 * dans un avertissement que personne ne lit.
 *
 * ⚠ L'ORDRE DE REPLI REPREND CELUI DES SEPT ROUTES D'API qui lisent déjà
 * `APP_BASE_URL`. Ce n'est pas une deuxième définition de « quelle est notre
 * adresse ? » : c'est la MÊME question posée là où la réponse habituelle
 * (l'origine de la requête) n'existe pas. Quand la variable est posée, les
 * deux chemins rendent la même valeur — ils ne peuvent pas diverger.
 * Les routes gardent leur repli sur `req.nextUrl.origin`, et c'est voulu :
 * une origine de requête réelle est une INFORMATION, pas une supposition.
 * Leur retirer serait dégrader ce qui marche pour faire joli.
 *
 * ⚠ LE REPLI DE PLATEFORME REND LA CORRECTION AUTO-SUFFISANTE. L'hébergeur
 * pose seul, à chaque build, une variable qui porte l'adresse du déploiement :
 * même si personne ne touche aux réglages, la vignette pointe vers un hôte
 * joignable au lieu de localhost. Une correction qui exige une action humaine
 * pour marcher n'est pas une correction — c'est une ligne de plus sur une
 * checklist.
 *
 * ⚠⚠ ET IL Y A DEUX HÉBERGEURS, PAS UN — sinon la correction ne vaut que sur
 * l'un d'eux. Chaque plateforme nomme SA variable, et l'autre ne la pose
 * jamais :
 *   · Vercel  → `VERCEL_URL` (sans protocole, `mon-app.vercel.app`) ;
 *   · Netlify → `URL` (l'adresse canonique de production) et
 *               `DEPLOY_PRIME_URL` (l'aperçu d'une branche).
 * Le repli les essaie toutes. Ne garder que `VERCEL_URL` faisait retomber
 * l'app sur `localhost` **le jour où elle passe sur Netlify** — c'est-à-dire
 * exactement la panne que ce module existe pour empêcher, ressuscitée par un
 * changement d'hébergeur. Mesuré : `eagleyecorp.fr` est déjà sur Netlify, et
 * Alpha l'y rejoint ; sans ce repli, la carte LinkedIn de l'app y sortirait
 * sans vignette.
 *
 * ⚠ `URL` passe devant `DEPLOY_PRIME_URL` : sur un aperçu de branche, on veut
 * l'adresse de PRODUCTION dans une balise Open Graph (canonique), pas l'URL
 * éphémère du preview — sinon un lien partagé depuis un aperçu pointe vers un
 * déploiement qui disparaîtra. Et les deux restent DERRIÈRE les variables
 * explicites : une adresse qu'un humain a posée à la main l'emporte toujours
 * sur celle que la plateforme devine.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le dernier repli, et il n'est juste qu'en développement. */
export const URL_DEV = "http://localhost:3000";

/**
 * Normalise ce qu'on lit d'une variable d'environnement.
 *
 * Deux pièges, tous deux vus dans de vraies configurations :
 *  · `VERCEL_URL` arrive SANS protocole (`mon-app.vercel.app`) — passée telle
 *    quelle à `new URL()`, elle jette, et une métadonnée qui jette fait tomber
 *    le build entier ;
 *  · une variable posée puis vidée (`APP_BASE_URL=`) rend `""`, qui est falsy
 *    mais qu'un `?? ` laisserait passer — d'où le `.trim()` et le test de
 *    longueur, jamais un `??`.
 */
function normaliser(valeur: string | undefined): string | null {
  const brut = valeur?.trim();
  if (!brut) return null;
  const avecProtocole = /^https?:\/\//i.test(brut) ? brut : `https://${brut}`;
  try {
    // On repasse par `URL` pour retirer un éventuel `/` final : une base qui
    // se termine par `/` et un chemin qui commence par `/` donnent `//media`.
    return new URL(avecProtocole).origin;
  } catch {
    // Une valeur illisible ne doit JAMAIS faire tomber le build. On la refuse
    // et on retombe sur le maillon suivant, comme si elle n'était pas posée.
    return null;
  }
}

/**
 * Les TROIS variables dont dépend la réponse — et rien d'autre.
 *
 * ⚠ La signature ne prend volontairement pas `NodeJS.ProcessEnv` : `tsc` a
 * refusé un test qui passait trois clés, parce que ce type-là exige aussi
 * `NODE_ENV`. Le compilateur avait raison sur le fond — une fonction qui
 * réclame l'environnement ENTIER pour lire trois chaînes force chaque
 * appelant à en fabriquer un faux, et un cast finit par masquer une vraie
 * erreur de frappe sur un nom de variable.
 */
export type EnvUrl = {
  APP_BASE_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  /** Posée par Vercel, sans protocole. */
  VERCEL_URL?: string;
  /** Posée par Netlify : l'adresse canonique de production. */
  URL?: string;
  /** Posée par Netlify : l'URL d'un déploiement d'aperçu (branche). */
  DEPLOY_PRIME_URL?: string;
  // ⚠ La signature d'index n'est pas une facilité : sans elle, TypeScript
  // applique sa détection de « type faible » (toutes propriétés optionnelles)
  // et REFUSE `process.env`, qui est un dictionnaire. Elle dit la vérité — un
  // environnement porte soixante autres variables — et c'est ce qui permet de
  // passer le vrai `process.env` sans un seul cast.
  [autre: string]: string | undefined;
};

/**
 * L'origine publique de ce déploiement, absolue et sans `/` final.
 *
 * Ordre : `APP_BASE_URL` (celle des routes d'API) → `NEXT_PUBLIC_APP_URL`
 * (déjà lue par `/api/calendar`) → la variable de plateforme (Vercel PUIS
 * Netlify) → localhost. Les deux hébergeurs ne sont jamais posés en même
 * temps, donc l'ordre entre eux ne tranche rien — il ne fait qu'assurer que
 * l'app est correcte quel que soit celui qui construit.
 */
export function urlPublique(env: EnvUrl = process.env): string {
  return (
    normaliser(env.APP_BASE_URL) ??
    normaliser(env.NEXT_PUBLIC_APP_URL) ??
    normaliser(env.VERCEL_URL) ??
    normaliser(env.URL) ??
    normaliser(env.DEPLOY_PRIME_URL) ??
    URL_DEV
  );
}

/**
 * La même chose en `URL`, telle que `metadataBase` l'attend.
 *
 * ⚠ Elle se pose à la RACINE et nulle part ailleurs : Next la fait hériter par
 * tous les layouts enfants. La reposer dans `/vitrine` et `/souscrire`
 * créerait trois endroits où se décide la même chose, et c'est celui qu'on ne
 * relit pas qui finirait par mentir.
 */
export function baseMetadonnees(env: EnvUrl = process.env): URL {
  return new URL(urlPublique(env));
}
