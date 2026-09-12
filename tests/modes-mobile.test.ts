import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MODES,
  MODE_DEFAUT,
  MAX_ENTREES_BARRE,
  CLE_MODE,
  modeActif,
  modesVisibles,
} from "../lib/modes-mobile";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BARRE DU POUCE N'ATTEIGNAIT NI LE PIPELINE, NI LES CAMPAGNES, NI LE CEO.
 *
 * ⚠⚠ CE QUE LA BARRE FIGÉE COÛTAIT, ET ÇA NE RESSEMBLAIT PAS À UN DÉFAUT.
 * Cinq entrées choisies pour le commercial en tournée — aujourd'hui, à
 * décider, closer, moniteur, débrief — avec un motif écrit dans le rail :
 * « on règle depuis un ordinateur, on regarde depuis un téléphone ».
 *
 * Cette phrase a cessé d'être vraie le 09/09, quand l'autopilote est passé sur
 * le serveur : il n'y a plus de machine à laisser allumée, et le téléphone
 * n'est plus un écran de consultation. Trois des écrans les plus utilisés du
 * produit imposaient donc d'ouvrir la palette et de taper.
 *
 * Le shell est un composant client : on lit sa SOURCE pour vérifier le
 * câblage, et on importe le module pur pour vérifier les règles. Un module
 * `lib/` que rien n'importe est mort, pas « prêt » — c'est le défaut le plus
 * fréquent de ce dépôt, et ce fichier le refuse explicitement.
 * ─────────────────────────────────────────────────────────────────────
 */

const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");
const routesDuNav = new Set([...shell.matchAll(/href:\s*"(\/[a-z-]*)"/g)].map((m) => m[1]));

test("⚠⚠ CHAQUE ROUTE D'UN MODE EXISTE DANS LA NAVIGATION", () => {
  /**
   * ⚠ LE TEST QUI EMPÊCHE D'INVENTER UNE DEUXIÈME NAVIGATION. Les modes ne
   * créent aucun écran : ils réordonnent l'accès à ceux du rail. Une route
   * mal tapée ici ne planterait pas — `barreDuMode` la filtre — elle
   * produirait silencieusement une barre à quatre entrées, ou à trois, sans
   * que rien ne le dise.
   */
  for (const m of MODES) {
    for (const r of m.routes) {
      assert.ok(
        routesDuNav.has(r),
        `le mode « ${m.label} » pointe vers ${r}, absent de la navigation — la barre perdrait cette entrée en silence`
      );
    }
  }
});

test("⚠ un mode tient dans la largeur d'un pouce : 3 à 5 entrées", () => {
  // La contrainte est physique, pas esthétique : au-delà de cinq, la cible de
  // doigt passe sous le seuil où on vise juste, et on ouvre l'écran d'à côté.
  for (const m of MODES) {
    assert.ok(
      m.routes.length >= 3 && m.routes.length <= MAX_ENTREES_BARRE,
      `le mode « ${m.label} » a ${m.routes.length} entrées`
    );
    assert.equal(new Set(m.routes).size, m.routes.length, `${m.label} : une route en double occupe deux places pour rien`);
  }
});

test("⚠⚠ LE MODE PAR DÉFAUT EST L'ANCIENNE BARRE, À L'IDENTIQUE", () => {
  /**
   * ⚠⚠ LA PROMESSE QUE CE TEST TIENT : quelqu'un qui ne touche jamais au
   * sélecteur retrouve EXACTEMENT ce qu'il avait avant. Une nouveauté qui
   * déplace ce que les gens savent déjà faire se paie en désorientation, pas
   * en adoption — et sur une barre de pouce, on clique par mémoire
   * musculaire, pas en lisant.
   */
  const defaut = MODES.find((m) => m.id === MODE_DEFAUT);
  assert.ok(defaut, `le mode par défaut « ${MODE_DEFAUT} » n'existe pas`);
  assert.deepEqual(
    defaut!.routes,
    ["/aujourdhui", "/decisions", "/closer", "/moniteur", "/debrief"],
    "le mode par défaut ne reprend plus l'ancienne barre : les habitudes de tous les jours changent de place"
  );
});

test("⚠⚠ LE PIPELINE, LES CAMPAGNES ET ALPHA CEO SONT ATTEIGNABLES AU POUCE", () => {
  /**
   * Les trois écrans que la barre figée n'atteignait pas. Le test les nomme un
   * par un : c'est la demande d'origine, et une régression ici se lirait comme
   * un simple remaniement de modes.
   */
  const toutes = new Set(MODES.flatMap((m) => m.routes));
  for (const r of ["/pipeline", "/campaigns", "/ceo"]) {
    assert.ok(toutes.has(r), `${r} n'est dans aucun mode — il reste inatteignable depuis un téléphone`);
  }
});

test("⚠⚠ ALPHA CEO EST MASQUÉ AUX NON-MAÎTRES, PAS GRISÉ", () => {
  /**
   * ⚠ La doctrine du rail, reprise mot pour mot : « on grise ce qui est à
   * vendre, on masque ce qui est à nous ». Alpha CEO parle de NOTRE
   * exploitation. Le griser reviendrait à annoncer à un client qu'il existe
   * une console qu'il ne pourra jamais acheter, et à l'inviter à demander
   * laquelle.
   */
  const client = modesVisibles(false).map((m) => m.id);
  const maitre = modesVisibles(true).map((m) => m.id);

  assert.ok(!client.includes("machine"), "le mode Alpha CEO est proposé à un compte client");
  assert.ok(maitre.includes("machine"), "le mode Alpha CEO a disparu, y compris pour le maître");
  assert.ok(client.length >= 3, "un compte client doit garder de vrais modes, pas un seul");
});

test("⚠ un mode PAYANT reste visible — il se grise, il ne disparaît pas", () => {
  /**
   * Le contre-test du précédent, et la distinction est toute la règle. Les
   * campagnes sont à VENDRE : masquer le mode empêcherait de vouloir ce qu'on
   * ne voit pas. `maitreSeul` masque, `brique` n'a jamais ce pouvoir.
   */
  const campagnes = MODES.find((m) => m.id === "campagnes");
  assert.ok(campagnes, "le mode campagnes a disparu");
  assert.equal(campagnes!.brique, "campagnes", "le mode doit dire à quel titre il existe");
  assert.ok(
    modesVisibles(false).some((m) => m.id === "campagnes"),
    "un mode payant a été masqué à un compte gratuit — il doit être grisé et cliquable vers son explication"
  );
});

test("⚠⚠ UN MODE MÉMORISÉ QUI N'EST PLUS VISIBLE NE VIDE PAS LA BARRE", () => {
  /**
   * ⚠⚠ LE CAS EST RÉEL, pas théorique : le propriétaire choisit « Alpha CEO »
   * sur son téléphone, puis ouvre l'app avec un compte client dans le même
   * navigateur. Le mode mémorisé n'existe plus pour lui.
   *
   * Sans repli, `barreDuMode` recevrait `undefined` et la barre du bas
   * n'aurait AUCUNE entrée. Une barre vide ne ressemble pas à un droit
   * manquant — elle ressemble à une panne, et c'est le pire des deux.
   */
  const repli = modeActif("machine", false);
  assert.ok(repli, "aucun mode rendu — la barre du bas serait vide");
  assert.equal(repli.id, MODE_DEFAUT, "le repli doit ramener au mode par défaut, pas à n'importe lequel");

  // Et les cas bêtes, qui arrivent aussi : rien de mémorisé, valeur inconnue.
  assert.equal(modeActif(null, false).id, MODE_DEFAUT);
  assert.equal(modeActif("mode-qui-nexiste-pas", true).id, MODE_DEFAUT);
  // Le maître, lui, garde son choix.
  assert.equal(modeActif("machine", true).id, "machine");
});

test("⚠ chaque mode dit CE QU'IL SERT, pas seulement son nom", () => {
  // Un sélecteur d'intitulés seuls oblige à tous les essayer pour comprendre.
  for (const m of MODES) {
    assert.ok(m.label.length > 0 && m.label.length <= 12, `« ${m.label} » ne tient pas dans une pastille`);
    assert.ok(m.quoi.length > 30, `le mode « ${m.label} » n'explique pas ce qu'il sert`);
  }
  assert.equal(new Set(MODES.map((m) => m.id)).size, MODES.length, "deux modes partagent un identifiant");
});

test("⚠⚠ LE MODULE EST BRANCHÉ — un export que rien n'importe est mort", () => {
  /**
   * ⚠ LE DÉFAUT LE PLUS FRÉQUENT DE CE DÉPÔT, et il ne ressemble pas à un
   * bug : un mécanisme juste, testé, correct — branché nulle part. Les tests
   * ci-dessus passeraient parfaitement sur un module que la coquille
   * n'importe pas, pendant que le téléphone garderait sa barre figée.
   */
  assert.match(shell, /from "@\/lib\/modes-mobile"/, "la coquille n'importe pas les modes");
  assert.match(shell, /barreDuMode\(mode\)/, "la barre du bas ne suit pas le mode actif");
  assert.match(shell, /modesVisibles\(droits\.maitre\)/, "le sélecteur ne filtre pas selon le compte");
  /**
   * ⚠ ON CHERCHE LA CONSTANTE, PAS SA VALEUR — et la première rédaction
   * cherchait la valeur, donc elle a fait tomber un câblage CORRECT. Exiger
   * la chaîne « alpha_mode_mobile » dans la coquille aurait poussé à l'y
   * recopier, c'est-à-dire à créer la deuxième définition qu'on veut
   * justement éviter. Le module reste la seule source de la clé.
   */
  assert.ok(CLE_MODE.length > 0, "la clé de persistance est vide");
  assert.match(shell, /\bCLE_MODE\b/, "le mode choisi n'est pas mémorisé");
  // Et la liste figée ne doit pas survivre à côté : deux barres divergeraient.
  assert.doesNotMatch(
    shell.replace(/\/\*[\s\S]*?\*\//g, ""),
    /const MOBILE_NAV\s*=/,
    "l'ancienne barre figée est encore là — deux définitions de « ce que le pouce atteint »"
  );
});
