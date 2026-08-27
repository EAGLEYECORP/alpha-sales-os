import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCosts, defaultVolume } from "../lib/voice-costs";
import { outboundPrice } from "../lib/bricks";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DOC DE PRIX NE PEUT PAS SE CONTREDIRE — c'est celui qu'on ouvre AVANT
 * un rendez-vous, et un chiffre faux s'y annonce à voix haute.
 *
 * ⚠ CE QU'IL DISAIT, ET QUI ÉTAIT FAUX SUR TROIS POINTS À LA FOIS :
 *
 *   « 1 000 composés · 855 min · Coût 96 € · ×3,79 · la règle ×4 est tenue »
 *
 *  1. les 96 € dataient d'AVANT la mesure Fish du 27/08 ;
 *  2. ils étaient calculés sur 2,00 min alors que la ligne annonce 855 min,
 *     c'est-à-dire 2,85 min — deux hypothèses mélangées dans le même bloc ;
 *  3. et la conclusion « la règle ×4 est tenue » est fausse dans les deux
 *     cas de figure.
 *
 * Le résumé § 6 reprenait les mêmes 96 €. Un doc de prix qui se contredit
 * entre son corps et son résumé fait dire un chiffre faux en réunion.
 * ─────────────────────────────────────────────────────────────────────
 */

const doc = readFileSync(join(process.cwd(), "docs/PRICING.md"), "utf8");
const PRIX = outboundPrice(1000).monthlyHT;

/** Le coût réel, recalculé par le MODÈLE — jamais recopié. */
const cout = (minutes: number) =>
  computeCosts({ ...defaultVolume, avgMinutesAnswered: minutes }, PRIX);

test("le coût annoncé pour le palier 1 000 est celui que le modèle calcule", () => {
  /**
   * On relit le modèle plutôt que de figer un nombre : le jour où une
   * constante fournisseur bouge, c'est le DOC qui doit échouer, pas le test.
   */
  const c2 = cout(2);
  const c285 = cout(2.85);
  assert.ok(doc.includes(`${Math.round(c2.totalEur)} €`), `le coût à 2,00 min (${Math.round(c2.totalEur)} €) doit apparaître`);
  assert.ok(doc.includes(`${Math.round(c285.totalEur)} €`), `le coût à 2,85 min (${Math.round(c285.totalEur)} €) doit apparaître`);
  // L'ancien chiffre, calculé avant la mesure Fish, ne doit plus traîner.
  assert.doesNotMatch(doc, /Coût fournisseurs \.+ 96 €/, "96 € datait d'avant la mesure Fish");
});

test("⚠ le doc ne prétend PAS que la règle ×4 est tenue sur ce palier", () => {
  /**
   * Elle ne l'est pas : ×3,84 à 2,00 min, ×3,34 à la durée réelle annoncée
   * par Zakaria. Le dire tenu, c'est justifier un prix par une règle que le
   * calcul contredit — et se faire reprendre par un acheteur qui compte.
   */
  const c = cout(2.85);
  assert.ok(PRIX / c.totalEur < 4, "si le multiple repassait au-dessus de 4, ce test doit être réécrit");
  assert.doesNotMatch(doc, /\*\*Verdict : la règle ×4 est tenue\.\*\*/);
  assert.match(doc, /la règle ×4 N'EST PAS tenue/i, "le verdict doit être écrit, pas suggéré");
});

test("le résumé de rendez-vous porte le MÊME coût que le corps du document", () => {
  /**
   * C'est le bloc qu'on lit dix minutes avant l'appel. S'il annonce un autre
   * chiffre que la section qui le calcule, c'est lui qui sera dit à voix
   * haute — et c'est le faux.
   */
  const resume = doc.slice(doc.indexOf("## 6."));
  const attendu = Math.round(cout(2.85).totalEur);
  assert.ok(resume.includes(String(attendu)), `le résumé doit annoncer ${attendu} €`);
  assert.doesNotMatch(resume, /~96 €/, "l'ancien chiffre ne doit plus être dans le résumé");
});

test("le résumé dit ce qu'il ne faut PAS annoncer en rendez-vous", () => {
  // « on est à ×4 » est la phrase la plus tentante et la plus fausse. Le
  // chiffre défendable est la marge, pas le multiple.
  const resume = doc.slice(doc.indexOf("## 6."));
  assert.match(resume, /Ce qu'il ne faut PAS dire/i);
  assert.match(resume, /70 % de\s*\n?\s*marge/i, "le chiffre solide doit être nommé");
});

test("les scénarios sont ÉTIQUETÉS par leur durée d'appel", () => {
  /**
   * L'erreur d'origine : un bloc annonçait 855 minutes et un coût calculé
   * sur 600. Deux hypothèses dans le même encadré, sans que rien ne le dise.
   */
  const bloc = doc.slice(doc.indexOf("## 2."), doc.indexOf("### Les jetons"));
  assert.match(bloc, /2,00 min/);
  assert.match(bloc, /2,85 min/);
  assert.match(bloc, /ta durée réelle/i, "la durée qui vient du terrain doit être signalée comme telle");
});

test("la réserve sur Telnyx survit — c'est elle qui interdit de bouger le prix", () => {
  /**
   * La recommandation « attendre l'export CDR avant de bouger le prix » ne
   * tient que si le doc rappelle que cette ligne est encore supposée. Sans
   * ça, quelqu'un remonte le palier à 436 € sur un modèle à moitié mesuré.
   */
  assert.match(doc, /export CDR/i);
  assert.match(doc, /bouger deux fois|encore supposée|non vérifiée/i);
});
