import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/**
 * ─────────────────────────────────────────────────────────────────────
 * ON PASSE DU MOT DE PASSE PARTAGÉ AU COMPTE — ET LA SERRURE DOIT SUIVRE.
 *
 * ⚠ LE DÉFAUT, QUI NE SE VOYAIT PAS : l'écran de connexion existait,
 * complet (email, mot de passe, création, mot de passe oublié) — et il ne se
 * fermait que sur `settings.security.requireAuth`, un réglage stocké dans le
 * NAVIGATEUR.
 *
 * Conséquence : un navigateur neuf ne l'avait pas. Le client à qui on ouvre
 * un accès, la navigation privée, un autre appareil — aucun ne voyait l'écran
 * de connexion, quelle que soit la configuration du serveur. Une serrure dont
 * l'existence dépend du trousseau de celui qui entre n'est pas une serrure.
 *
 * Les données restaient protégées (le middleware exige le JWT sur les API),
 * mais l'entrée du produit, elle, ne demandait rien à personne.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠ l'écran de connexion se ferme sur le SERVEUR, pas sur un réglage local", () => {
  const gate = sansCommentaires(lire("components/security/auth-gate.tsx"));

  // Il interroge le serveur.
  assert.match(gate, /fetch\("\/api\/gate"\)/, "l'écran doit demander au serveur ce qu'il exige");
  assert.match(gate, /compteRequis/, "et lire la réponse");

  /**
   * ⚠ LA CONDITION EXACTE : un OU, jamais un ET.
   *
   * `serveur && local` rendrait le mur serveur inopérant sur tout navigateur
   * qui n'a pas le réglage — c'est-à-dire exactement le bug qu'on corrige.
   * Le serveur ferme, OU l'opérateur ferme sur son poste. Aucun des deux
   * n'ouvre à la place de l'autre.
   */
  assert.match(
    gate,
    /const exige = Boolean\(serveur\?\.compteRequis\) \|\| Boolean\(requireAuth\)/,
    "le mur doit se fermer si le serveur l'exige OU si le réglage local l'exige"
  );
  assert.match(gate, /const gateOn = Boolean\(hydrated && exige && authAvailable\(\)\)/);
});

test("⚠ une panne du serveur ne doit pas OUVRIR la porte", () => {
  /**
   * `fetch` échoue (réseau, 500) → `serveur` reste `null`. La condition doit
   * alors retomber sur le réglage local, jamais sur « ouvert ». Un `catch` qui
   * poserait `compteRequis: false` transformerait une panne réseau en
   * déverrouillage — le pire mode de défaillance possible pour une serrure.
   */
  const gate = sansCommentaires(lire("components/security/auth-gate.tsx"));
  const i = gate.indexOf('fetch("/api/gate")');
  const bloc = gate.slice(i, i + 600);
  assert.match(bloc, /\.catch\(\(\) => \{\}\)/, "l'échec ne doit RIEN écrire");
  assert.ok(
    !/catch[\s\S]{0,120}compteRequis:\s*false/.test(bloc),
    "un catch qui conclut « pas de compte requis » ouvrirait l'app sur une panne réseau"
  );
});

test("⚠ l'impasse est NOMMÉE : serveur exige un compte, navigateur ne peut pas se connecter", () => {
  /**
   * `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` absents du build : `authAvailable()`
   * est faux, donc `gateOn` retombait à faux et on affichait une coquille dont
   * chaque appel répond 401. L'utilisateur tourne en rond sans jamais voir de
   * formulaire, et rien ne lui dit pourquoi.
   */
  const route = sansCommentaires(lire("app/api/gate/route.ts"));
  assert.match(route, /clientPeutSeConnecter/, "la route doit dire si le navigateur PEUT se connecter");
  assert.match(route, /NEXT_PUBLIC_SUPABASE_URL && process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);

  const gate = sansCommentaires(lire("components/security/auth-gate.tsx"));
  assert.match(
    gate,
    /serveur\?\.compteRequis && !serveur\.clientPeutSeConnecter/,
    "l'écran doit détecter l'impasse"
  );
  assert.match(gate, /Connexion impossible/, "et la nommer, au lieu d'afficher une coquille muette");
});

test("⚠ la sonde reste PUBLIQUE — sinon l'écran de connexion ne peut pas la lire", () => {
  /**
   * Le défaut classique : brancher la sonde derrière la serrure qu'elle
   * décrit. `/api/gate` est déjà public (c'est l'écran d'accès lui-même) —
   * ce test fige le fait qu'il le reste.
   */
  const mw = lire("middleware.ts");
  const bloc = mw.slice(mw.indexOf("const PUBLIC_PREFIXES"), mw.indexOf("const ADMIN_PREFIXES"));
  assert.ok(bloc.includes('"/api/gate"'), "la sonde doit rester joignable sans être connecté");
  assert.ok(bloc.includes('"/gate"'), "et l'écran d'accès avec elle");
});

test("le mot de passe garde encore l'ADMINISTRATION après la bascule", () => {
  /**
   * Passer au compte ne supprime pas le mot de passe : `/payouts`, `/offre` et
   * `/api/sync` parlent de NOTRE économie, jamais de celle du client. Ils
   * restent murés même pour un compte connecté — c'est `exigeMotDePasse` qui
   * teste l'admin AVANT la garde générale.
   */
  const mw = sansCommentaires(lire("middleware.ts"));
  const i = mw.indexOf("function exigeMotDePasse");
  const bloc = mw.slice(i, i + 260);
  assert.match(bloc, /startsWithAny\(pathname, ADMIN_PREFIXES\)\) return true/);
  const iAdmin = bloc.indexOf("ADMIN_PREFIXES");
  const iGarde = bloc.indexOf("verrouDeComptesActif");
  assert.ok(iAdmin < iGarde, "l'admin doit être tranché AVANT la garde, sinon la bascule l'ouvre");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LA SONDE QUI SERT À VÉRIFIER LA BASCULE NE DOIT PAS LA RECALCULER.
 *
 * `/api/health` refaisait le test de `REQUIRE_AUTH` avec sa propre expression
 * régulière — une seconde définition de « le serveur exige-t-il un compte ? »,
 * à côté de celle que le middleware utilise vraiment.
 *
 * C'est l'outil sur lequel on s'appuie pour VÉRIFIER qu'une bascule s'est bien
 * passée. Une divergence entre les deux ne planterait pas : elle mentirait —
 * la sonde annonçant « protégé » pendant que le middleware pense l'inverse.
 * Le pire mode de défaillance possible pour un diagnostic.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ /api/health LIT l'état d'authentification, il ne le redéduit pas", () => {
  const h = sansCommentaires(lire("app/api/health/route.ts"));

  assert.match(h, /serverEnforced: serverAuthEnforced\(\)/, "l'enforcement doit venir de sa source");
  assert.match(h, /misconfigured: serverAuthMisconfigured\(\)/, "la misconfiguration aussi");
  assert.match(h, /verrou: verrouDeComptesActif\(\)/, "et LA question qui décide de tout");

  /**
   * La CONDITION, pas la présence : aucune relecture maison de `REQUIRE_AUTH`
   * ne doit subsister dans ce fichier. C'est elle qui constituait la seconde
   * définition — la trouver, c'est trouver la divergence future.
   */
  assert.ok(
    !/REQUIRE_AUTH/.test(h),
    "aucune relecture locale de REQUIRE_AUTH : la question se pose à un seul endroit"
  );
});

test("la sonde de santé garde son détail derrière le mot de passe", () => {
  /**
   * Elle publie maintenant `verrou` — donc « ce déploiement est-il protégé ».
   * Sur une route publique, ce serait une invitation, pas un diagnostic. Le
   * détail n'est rendu qu'avec le cookie ; sans lui, `{ ok, checkedAt }`.
   */
  const h = sansCommentaires(lire("app/api/health/route.ts"));
  // ⚠ On vise le POINT D'APPEL, pas la définition : viser `detailAutorise`
  // tout court attrapait la fonction et prouvait seulement qu'elle existe.
  const i = h.indexOf("if (!detailAutorise(");
  assert.ok(i > 0, "le détail doit rester conditionné à l'entrée de la route");
  assert.match(h.slice(i, i + 250), /return NextResponse\.json\(\{ ok: true, checkedAt/);
});
