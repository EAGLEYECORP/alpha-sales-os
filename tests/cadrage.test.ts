import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SIEGES_MAX_ESTIMATION,
  estimationPublique,
  peutEmettreDevis,
  type EtatCadrage,
} from "../lib/cadrage";
import { PRIX_PUBLICS } from "../lib/public-catalogue";

const cadrage = (p: Partial<EtatCadrage> = {}): EtatCadrage => ({
  creneauIso: "2026-09-20T10:00:00.000Z",
  reelementTenu: true,
  validePar: "Zakaria",
  ...p,
});

test("⚠⚠ PAS DE DEVIS SANS CADRAGE — la règle était en PROSE, elle est exécutable", () => {
  /**
   * « Cadrage OBLIGATOIRE avant devis » vivait dans une CHAÎNE de
   * `lib/paliers.ts`, à l'intérieur d'une phrase de vente. Invisible pour le
   * code. Le défaut déjà payé par `forbidden`, `structuralPain` et la règle de
   * routage.
   */
  assert.equal(peutEmettreDevis(cadrage()).autorise, true);
  assert.equal(peutEmettreDevis(cadrage({ creneauIso: null })).autorise, false);
  assert.equal(peutEmettreDevis(cadrage({ reelementTenu: false })).autorise, false);
  assert.equal(peutEmettreDevis(cadrage({ validePar: null })).autorise, false);
});

test("⚠ LES TROIS CONDITIONS SONT DISTINCTES — les confondre produit le défaut", () => {
  /**
   * « Un rendez-vous est posé » n'est pas « le cadrage a eu lieu », et « le
   * cadrage a eu lieu » n'est pas « on a validé qu'on y va ». C'est cette
   * confusion qui produit un devis envoyé après un appel de dix minutes où
   * personne n'a rien décidé.
   */
  const posePasTenu = peutEmettreDevis(cadrage({ reelementTenu: false }));
  assert.match(posePasTenu.motif, /n'a pas encore eu lieu/);
  const tenuPasValide = peutEmettreDevis(cadrage({ validePar: "   " }));
  assert.equal(tenuPasValide.autorise, false, "un validePar blanc n'est pas une validation");
  assert.match(tenuPasValide.motif, /validée par personne/);
  // Et le motif NOMME ce qui manque : « non conforme » envoie chercher au hasard.
  assert.equal(peutEmettreDevis({ creneauIso: null, reelementTenu: false, validePar: null }).manquants.length, 3);
});

test("⚠⚠ UNE ESTIMATION NE PEUT PAS DEVENIR UN DEVIS — c'est le TYPE qui l'interdit", () => {
  /**
   * `estUnDevis` est typé `false` littéralement. Ce n'est pas de la prudence
   * rédactionnelle : une estimation ne peut pas se transformer en engagement
   * en changeant un booléen par distraction.
   */
  const e = estimationPublique(10)!;
  assert.equal(e.estUnDevis, false);
  const src = readFileSync(join(process.cwd(), "lib/cadrage.ts"), "utf8");
  assert.match(src, /estUnDevis:\s*false;/, "le type doit rendre le devis impossible, pas improbable");
});

test("⚠ LES RÉSERVES NE SONT JAMAIS VIDES — un chiffre nu se lit comme un prix ferme", () => {
  for (const n of [1, 5, 20, SIEGES_MAX_ESTIMATION]) {
    const e = estimationPublique(n)!;
    assert.ok(e.reserves.length >= 3, `${n} sièges : les réserves doivent voyager avec le chiffre`);
    assert.ok(
      e.reserves.some((r) => /pas un devis/i.test(r)),
      "la première réserve doit dire ce que ce n'est PAS",
    );
    assert.ok(
      e.reserves.some((r) => /Alpha Voice/.test(r)),
      "et que la voix n'est pas comprise — sinon le devis surprend",
    );
  }
});

test("l'estimation calcule sur la grille PUBLIQUE, et rien d'autre", () => {
  const e = estimationPublique(20)!;
  assert.equal(e.mensuelHT, PRIX_PUBLICS.packSocleHT + PRIX_PUBLICS.packSiegeHT * 20);
  assert.equal(e.setupHT, PRIX_PUBLICS.packSetupHT);
  assert.equal(e.annee1HT, e.setupHT + e.mensuelHT * 12);
  // À la taille de référence, elle DOIT retomber sur le prix affiché partout.
  assert.equal(estimationPublique(PRIX_PUBLICS.packSiegesReference)!.mensuelHT, PRIX_PUBLICS.packMensuelHT);
});

test("⚠ LE CATALOGUE BRIQUE PAR BRIQUE NE DESCEND PAS ICI", () => {
  // `tests/vitrine-fuite` refuse que la grille ligne à ligne atteigne un
  // navigateur. Une estimation publique qui l'emporterait serait une fuite
  // déguisée en service.
  const src = readFileSync(join(process.cwd(), "lib/cadrage.ts"), "utf8");
  assert.ok(!/from "\.\/bricks"/.test(src), "lib/bricks est SERVEUR — il porte nos marges");
  assert.ok(!/from "\.\/offres-publiques"/.test(src), "on passe par la vue publique, pas par la source");
  assert.match(src, /from "\.\/public-catalogue"/);
});

test("⚠ AU-DELÀ DE LA BORNE, ON NE CHIFFRE PAS — on ne prétend pas savoir", () => {
  /**
   * Au-delà de 50 commerciaux le dossier change de nature : achats, revue de
   * sécurité, pilote. Rendre un chiffre serait inventer une expérience qu'on
   * n'a pas — et la première mesure serait faite chez un client.
   */
  assert.equal(estimationPublique(SIEGES_MAX_ESTIMATION + 1), null);
  assert.ok(estimationPublique(SIEGES_MAX_ESTIMATION) !== null, "la borne elle-même reste chiffrable");
});

test("⚠ saisies invalides : null, jamais un chiffre de repli", () => {
  // Un `0` rendrait le socle seul — un abonnement sans utilisateur. Un arrondi
  // silencieux ferait afficher un prix que personne n'a demandé.
  for (const mauvais of [0, -3, 2.5, NaN, Infinity]) {
    assert.equal(estimationPublique(mauvais), null, `${mauvais} doit être refusé`);
  }
});

test("⚠⚠ L'ESTIMATION EST ATTEIGNABLE DEPUIS LA PAGE PUBLIQUE", () => {
  // Le défaut récurrent : un module juste, testé, que rien n'appelle. Ici il
  // serait invisible — la page continuerait d'afficher un prix de référence
  // sans que personne puisse l'appliquer à SON effectif.
  const page = readFileSync(join(process.cwd(), "app/vitrine/page.tsx"), "utf8");
  assert.match(page, /<EstimationPublique\b/, "la vitrine doit monter le composant");
  assert.match(page, /from "@\/components\/vitrine\/estimation-publique"/);

  const comp = readFileSync(join(process.cwd(), "components/vitrine/estimation-publique.tsx"), "utf8");
  assert.match(comp, /estimationPublique\(sieges\)/, "il doit DÉRIVER du module, jamais recalculer");
  // ⚠ Contre-test : aucune arithmétique de prix dans le composant. La recopier
  // ferait diverger l'affichage du calcul au premier ajustement de grille.
  const sansCommentaires = comp.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
  assert.ok(
    !/packSocleHT\s*\+|packSiegeHT\s*\*/.test(sansCommentaires),
    "le composant ne doit pas refaire le calcul : il affiche ce que le module rend",
  );
});

test("⚠ LES RÉSERVES AFFICHÉES VIENNENT DU MODULE, pas du composant", () => {
  // Les réécrire dans le JSX en ferait une seconde version — et c'est celle
  // qu'on ne relit pas qui finirait par mentir au visiteur.
  const comp = readFileSync(join(process.cwd(), "components/vitrine/estimation-publique.tsx"), "utf8");
  assert.match(comp, /e\.reserves\.map\(/, "les réserves se rendent depuis le module");
  assert.ok(
    !/Ce n'est pas un devis/.test(comp.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, "")),
    "aucune réserve recopiée en dur dans le JSX",
  );
});
