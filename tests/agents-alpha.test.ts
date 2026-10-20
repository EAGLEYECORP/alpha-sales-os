import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_ALPHA, LIBELLE_CAMP, LIBELLE_DISPONIBILITE, type AgentAlpha, type DisponibiliteAgent } from "../lib/agents-alpha";
import { TYPES_PROPOSITION } from "../lib/propositions";
import { PORTEES_OAUTH } from "../lib/mcp-oauth";
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
  for (const attendu of ["ALPHA SCOUT", "ALPHA VOICE", "ALPHA ASSIST", "ALPHA CERVEAU", "ALPHA LIVE", "ALPHA CEO"]) {
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

/** La disponibilité d'un agent qu'on OUVRE, recalculée sur les VRAIES règles d'accès. */
function disponibiliteReelle(ecrans: string[]): DisponibiliteAgent {
  if (ecrans.some((e) => peutOuvrir(e, BRIQUES_GRATUITES))) return "en-ligne";
  if (ecrans.some((e) => cheminOuvertParCle(e, CAPACITES))) return "en-ligne-avec-vos-cles";
  return "chez-vous";
}

// Un agent qu'on BRANCHE ne se juge pas sur son écran : voir le test dédié plus bas.
const sEOuvre = (a: AgentAlpha) => (a.entree ?? "ecran") === "ecran";

test("⚠ la disponibilité annoncée est celle que le contrôle d'accès applique", () => {
  for (const a of AGENTS_ALPHA.filter(sEOuvre)) {
    assert.equal(a.disponibilite, disponibiliteReelle(a.ecrans), `${a.nom} : la vitrine annoncerait une porte que le serveur ne tient pas`);
    // « Chez vous » doit vraiment s'ouvrir sur l'installation du client.
    assert.ok(a.ecrans.some((e) => autorise(droitInstallationClient(null), e)), `${a.nom} ne s'ouvre pas chez le client`);
  }
});

test("⚠⚠ ALPHA ASSIST : sa porte est la clé de l'hôte, et l'écran ne prouve rien", () => {
  const assist = AGENTS_ALPHA.find((a) => a.nom === "ALPHA ASSIST");
  assert.ok(assist, "ALPHA ASSIST manque à l'ombrelle");
  assert.equal(assist.entree, "cle-de-l-hote");
  // Le piège : l'écran où l'on relit ses propositions est GRATUIT. Jugé sur lui,
  // l'agent serait annoncé « en ligne, gratuit » — c'est ce que ce test empêche.
  assert.equal(disponibiliteReelle(assist.ecrans), "en-ligne", "si /controle cessait d'être gratuit, ce garde-fou serait à repenser");
  assert.equal(assist.disponibilite, "chez-vous", "un inscrit en ligne ne peut pas brancher sa propre IA : la clé est dans l'environnement du serveur");
  // Et il s'ouvre bien chez le client, où la clé est la sienne.
  assert.ok(assist.ecrans.some((e) => autorise(droitInstallationClient(null), e)));
  // Ce qu'il n'a pas le droit de faire est une propriété du CODE, pas de la vitrine :
  // un jeton OAuth ne porte que la lecture et le dépôt (jamais `prospects.write`)…
  assert.deepEqual(
    [...PORTEES_OAUTH].filter((p) => p.endsWith(".write")),
    ["propositions.write"],
    "une portée d'écriture de plus donnerait à l'agent le pouvoir d'agir"
  );
  // …et le dépôt se fait dans une liste FERMÉE d'actes (un type ouvert ferait
  // de l'agent le concepteur de ses propres pouvoirs).
  assert.ok(TYPES_PROPOSITION.length > 0 && TYPES_PROPOSITION.length < 10);
  assert.doesNotMatch(assist.interdit + assist.fait, /\d/, "aucun nombre écrit à la main : il se périme (la liste fermée a sa propre source)");
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
