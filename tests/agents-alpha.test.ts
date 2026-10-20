import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_ALPHA, LIBELLE_CAMP, LIBELLE_DISPONIBILITE, type DisponibiliteAgent } from "../lib/agents-alpha";
import { briquesPourChemin, peutOuvrir } from "../lib/bricks-access";
import { autorise, BRIQUES_GRATUITES, droitInstallationClient } from "../lib/entitlements";
import { CAPACITES, cheminOuvertParCle } from "../lib/capacites-cle";

/**
 * L'ombrelle des agents d'ALPHA (20/10/2026). Ce fichier tient les trois
 * façons dont elle mentirait sans bruit : un nom écrit autrement, un agent
 * qui désigne un écran qui n'existe pas, une disponibilité annoncée que le
 * contrôle d'accès refuse.
 */

const racine = process.cwd();

test("les noms sont TOUJOURS en capitales, et uniques", () => {
  for (const a of AGENTS_ALPHA) {
    assert.equal(a.nom, a.nom.toUpperCase(), `${a.nom} : la décision est « toujours en capitales »`);
    assert.match(a.nom, /^(ALPHA [A-ZÉÈ]+|AGENT ALPHA)$/, `${a.nom} : un nom de la famille ALPHA, rien d'autre`);
  }
  const noms = AGENTS_ALPHA.map((a) => a.nom);
  assert.equal(new Set(noms).size, noms.length);
  for (const attendu of ["ALPHA SCOUT", "ALPHA VOICE", "ALPHA CERVEAU", "ALPHA LIVE", "ALPHA CEO"]) {
    assert.ok(noms.includes(attendu), `${attendu} manque à l'ombrelle`);
  }
});

test("⚠ l'ombrelle ne renomme rien : chaque agent désigne des écrans qui EXISTENT", () => {
  for (const a of AGENTS_ALPHA) {
    assert.ok(a.ecrans.length > 0, `${a.nom} ne vit nulle part`);
    for (const e of a.ecrans) {
      // `undefined` = chemin non classé : un écran inventé, ou renommé sans le dire.
      assert.notEqual(briquesPourChemin(e), undefined, `${a.nom} → ${e} : écran inconnu du contrôle d'accès`);
    }
  }
});

test("chaque interdit nomme le fichier qui l'applique, et ce fichier existe", () => {
  for (const a of AGENTS_ALPHA) {
    assert.ok(a.interdit.length > 30, `${a.nom} : un interdit sans contenu ne garantit rien`);
    assert.ok(existsSync(join(racine, a.preuve)), `${a.nom} → ${a.preuve} : la preuve a disparu`);
  }
});

/** La disponibilité, recalculée sur les VRAIES règles d'accès. */
function disponibiliteReelle(ecrans: string[]): DisponibiliteAgent {
  if (ecrans.some((e) => peutOuvrir(e, BRIQUES_GRATUITES))) return "en-ligne";
  if (ecrans.some((e) => cheminOuvertParCle(e, CAPACITES))) return "en-ligne-avec-vos-cles";
  return "chez-vous";
}

test("⚠ la disponibilité annoncée est celle que le contrôle d'accès applique", () => {
  for (const a of AGENTS_ALPHA) {
    assert.equal(a.disponibilite, disponibiliteReelle(a.ecrans), `${a.nom} : la vitrine annoncerait une porte que le serveur ne tient pas`);
    // « Chez vous » doit vraiment s'ouvrir sur l'installation du client.
    assert.ok(a.ecrans.some((e) => autorise(droitInstallationClient(null), e)), `${a.nom} ne s'ouvre pas chez le client`);
  }
});

test("le module ne tire rien dans le navigateur, et la vitrine le BRANCHE", () => {
  const src = readFileSync(join(racine, "lib/agents-alpha.ts"), "utf8");
  assert.doesNotMatch(src, /^import /m, "la vitrine est un composant client : aucun import ici");
  const vitrine = readFileSync(join(racine, "app/vitrine/page.tsx"), "utf8");
  assert.match(vitrine, /from "@\/lib\/agents-alpha"/, "un module que rien n'importe est mort");
  assert.match(vitrine, /AGENTS_ALPHA\.map/);
  assert.match(vitrine, /REGLE_DES_AGENTS/);
  // Les libellés couvrent toutes les valeurs : aucun agent sans étiquette à l'écran.
  for (const a of AGENTS_ALPHA) {
    assert.ok(LIBELLE_CAMP[a.camp] && LIBELLE_DISPONIBILITE[a.disponibilite]);
  }
});

test("typographie : jamais un deux-points seul en début de ligne", () => {
  // Vu au rendu sur téléphone : « lisent / : vos documents ». Une espace
  // insécable avant « : » garde la ponctuation avec son mot.
  for (const a of AGENTS_ALPHA) {
    for (const texte of [a.fait, a.interdit]) {
      assert.doesNotMatch(texte, / :/, `${a.nom} : « ${texte} » — espace ordinaire avant un deux-points`);
    }
  }
});
