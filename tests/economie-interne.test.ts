import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ACCOUNTS_COMMERCIAL } from "../lib/accounts-commercial";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTRE ÉCONOMIE N'EST PAS CELLE DU CLIENT — ET ELLE A DEUX SORTIES.
 *
 * ⚠ CE DÉFAUT A ÉTÉ MESURÉ SUR SERVEUR RÉEL, PAS SUPPOSÉ.
 *
 * Avec les comptes actifs et un jeton d'un email NON-maître, `/api/catalogue`
 * répondait 200 et rendait `ACCOUNTS_COMMERCIAL` en entier :
 * `commissionPct`, `recurringPct`, le seuil des 40 k, et les notes internes
 * du portefeuille. C'est-à-dire les 30 % + 10 % de ScintIA et les 15 % de
 * Nuwacom — lisibles par ScintIA et Nuwacom si l'un d'eux est locataire,
 * avant le cadrage qui est précisément notre levier de négociation.
 *
 * ── POURQUOI RIEN NE L'A VU ──
 *
 * La doctrine « le modèle de commission reste interne » existait, était
 * écrite, et était TESTÉE — dans `tests/vitrine-fuite.test.ts`, contre une
 * PAGE. L'en-tête de la route, elle, raisonnait « navigateur contre serveur »,
 * ce qui est la bonne opposition pour la grille des briques et la mauvaise
 * pour le portefeuille : une session authentifiée n'est pas nous.
 *
 * Douzième défaut de la même famille dans ce dépôt, et toujours le même
 * motif : du code juste, une doctrine juste, et aucun fil entre les deux.
 * D'où ce fichier, qui garde la DONNÉE au lieu de garder un écran.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();

function routes(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...routes(p));
    else if (/^route\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const ROUTES = routes(join(RACINE, "app/api"));

/**
 * Les modules qui portent NOTRE part, pas le prix du client.
 *
 * ⚠ La distinction n'est pas cosmétique et se rejoue à chaque ajout :
 * `REV_SHARE` (30 % du CA généré) est un PRIX facturé au client — il a le
 * droit de le lire, c'est ce qu'il paie. `commissionPct` est ce qui NOUS
 * revient chez un partenaire. Deux « 30 % » qui ne se montrent pas au même
 * public ; CLAUDE.md prévient déjà de ne pas les confondre.
 */
const MODULES_ECONOMIE = ["accounts-commercial", "payouts"];

test("⚠ aucune route d'API ne sert notre économie sans vérifier `maitre`", () => {
  const fautives: string[] = [];

  for (const f of ROUTES) {
    const src = readFileSync(f, "utf8");
    const sert = MODULES_ECONOMIE.some((m) => new RegExp(`from ["']@?/?(?:lib/)?${m}["']`).test(src));
    if (!sert) continue;
    // La route peut n'importer ces modules que pour un usage interne (calcul
    // qui ne ressort pas). On exige donc la MENTION du rôle : c'est le
    // minimum pour qu'un relecteur voie que la question a été posée.
    if (!/\bmaitre\b/.test(src)) fautives.push(relative(RACINE, f));
  }

  assert.deepEqual(
    fautives,
    [],
    "ces routes servent le portefeuille sans distinguer un locataire de nous :\n  " + fautives.join("\n  ")
  );
});

test("le catalogue ne rend le portefeuille qu'au compte maître", () => {
  /**
   * On lit la forme exacte du garde-fou. Un test de comportement demanderait
   * un vrai jeton et une vraie base ; la vérification en conditions réelles a
   * été faite à la main (403 pour un non-maître sur les routes réservées,
   * 200 + portefeuille pour le maître), et c'est ici qu'on l'empêche de
   * repartir.
   */
  const src = readFileSync(join(RACINE, "app/api/catalogue/route.ts"), "utf8");
  assert.match(src, /droits\.maitre\s*\?\s*\{\s*accounts:/, "le portefeuille doit être conditionné au rôle maître");
  assert.doesNotMatch(
    src.replace(/droits\.maitre\s*\?\s*\{\s*accounts:[^}]*\}/, ""),
    /accounts:\s*ACCOUNTS_COMMERCIAL/,
    "aucune seconde sortie inconditionnelle du portefeuille"
  );
  // Ce qui reste dû à TOUT locataire : ses prix. Les retirer casserait le
  // sélecteur de briques, et un client a le droit de savoir ce qu'il paie.
  for (const attendu of ["bricks: BRICKS", "outboundTiers: OUTBOUND_TIERS", "pack: {"]) {
    assert.ok(src.includes(attendu), `${attendu} doit rester servi à tout locataire`);
  }
});

test("le portefeuille contient bien ce qu'on refuse de montrer — sinon ce test ne garde rien", () => {
  /**
   * Une garde posée sur une donnée devenue inoffensive s'oublie et se retire.
   * On vérifie donc que le portefeuille porte TOUJOURS des taux qui nous
   * appartiennent : le jour où ce n'est plus vrai, ce test échoue et la
   * question se repose, au lieu de se perdre.
   */
  const brut = JSON.stringify(ACCOUNTS_COMMERCIAL);
  assert.match(brut, /commissionPct/, "le portefeuille doit encore porter notre part");
  const taux = [...brut.matchAll(/"commissionPct":(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(taux.length > 0);
  assert.ok(
    taux.some((t) => t < 100),
    "au moins un partenaire doit avoir une part < 100 % — c'est CE chiffre qui ne doit pas fuiter"
  );
});
