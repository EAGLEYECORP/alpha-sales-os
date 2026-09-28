import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCosts, defaultVolume } from "../lib/voice-costs";
import { devisVoix, PRIX_PALIER_HT, VOLUME_PALIER } from "../lib/pricing-briques";
import { BRICKS, outboundPrice } from "../lib/bricks";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DOC DE PRIX NE PEUT PAS SE CONTREDIRE — c'est celui qu'on ouvre AVANT
 * un rendez-vous, et un chiffre faux s'y annonce à voix haute.
 *
 * ⚠ CE QU'IL DISAIT : « 1 000 composés · 855 min · Coût 96 € · ×3,79 ».
 * Les 96 € dataient d'AVANT la mesure Fish du 27/08, et ils étaient calculés
 * sur 2,00 min alors que la ligne annonce 855 minutes — c'est-à-dire
 * 2,85 min. Deux hypothèses mélangées dans le même encadré. Le résumé § 6
 * reprenait les mêmes 96 €, et c'est LUI qu'on lit dix minutes avant l'appel.
 *
 * ⚠⚠ ET MA PREMIÈRE CORRECTION ÉTAIT FAUSSE AUSSI. J'ai divisé le prix par
 * le coût TOTAL, trouvé ×3,44, et écrit que la règle ×4 n'était plus tenue —
 * en recommandant d'envisager 436 €. Le plancher se calcule
 * `variable × 4 + fixe`, soit 252 € : le fixe est mutualisé sur tous les
 * clients et le multiplier reviendrait à facturer dix fois le même serveur.
 * `devisVoix` le faisait correctement depuis le début ; je ne l'avais pas lu.
 * La règle EST tenue, avec 112 € de marge au-dessus du plancher.
 *
 * C'est pour ça que ces tests lisent `devisVoix` et ne recalculent plus rien
 * eux-mêmes : le modèle sait, moi je me trompe.
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
  const palier = devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER);
  assert.ok(doc.includes(`${Math.round(c2.totalEur)} €`), `le coût à 2,00 min (${Math.round(c2.totalEur)} €) doit apparaître`);
  assert.ok(doc.includes(`${Math.round(palier.coutTotalEur)} €`), `le coût du palier (${Math.round(palier.coutTotalEur)} €) doit apparaître`);
  // L'ancien chiffre, calculé avant la mesure Fish, ne doit plus traîner.
  assert.doesNotMatch(doc, /Coût fournisseurs \.+ 96 €/, "96 € datait d'avant la mesure Fish");
});

test("⚠ le PLANCHER de la règle ×4 vient du modèle, pas d'une division", () => {
  /**
   * ⚠ J'AI ÉCRIT L'INVERSE DANS CE FICHIER, ET C'ÉTAIT FAUX.
   *
   * J'avais divisé le prix par le coût TOTAL, trouvé ×3,44, et conclu que la
   * règle ×4 n'était pas tenue. Le module dit autre chose, et il a raison :
   * le ×4 porte sur la CONSOMMATION seule. Le fixe — hébergement,
   * supervision, numéro — est mutualisé sur tous les clients ; le multiplier
   * reviendrait à facturer dix fois le même serveur.
   *
   *   plancher = variable × 4 + fixe = 252 €, et non coût × 4 = 436 €.
   *
   * Le prix de 364 € est donc 112 € AU-DESSUS du plancher. Ce test lit le
   * plancher dans `devisVoix` pour que la confusion ne puisse pas revenir.
   */
  const d = devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER);
  assert.ok(d.prixAfficheEur >= d.plancherEur, "le prix public doit rester au-dessus du plancher");
  assert.ok(doc.includes(String(Math.round(d.plancherEur))), `le plancher (${Math.round(d.plancherEur)} €) doit figurer dans le doc`);
  assert.match(doc, /La règle ×4 est tenue/i, "le verdict doit être écrit");
  assert.match(doc, /mutualisé/i, "et la raison — le fixe ne se multiplie pas — doit être écrite");
});

test("le doc met en garde contre le multiple naïf prix ÷ coût total", () => {
  /**
   * C'est le piège exact dans lequel je suis tombé, et il se rejoue en
   * rendez-vous : quelqu'un divise, trouve ×3,4, et annonce que la règle
   * n'est pas tenue. Les deux grandeurs ne sont pas comparables.
   */
  const d = devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER);
  assert.ok(d.multipleReel < 4, "si ce multiple repassait au-dessus de 4, la mise en garde change");
  assert.ok(doc.includes(String(d.multipleReel).replace(".", ",")), "le multiple naïf doit être cité pour être désamorcé");
  assert.match(doc, /ne veut rien dire|pas la même grandeur/i);
});

test("le résumé de rendez-vous porte le MÊME coût que le corps du document", () => {
  /**
   * C'est le bloc qu'on lit dix minutes avant l'appel. S'il annonce un autre
   * chiffre que la section qui le calcule, c'est lui qui sera dit à voix
   * haute — et c'est le faux.
   */
  const resume = doc.slice(doc.indexOf("## 6."));
  const attendu = Math.round(devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER).coutTotalEur);
  assert.ok(resume.includes(String(attendu)), `le résumé doit annoncer ${attendu} €`);
  assert.doesNotMatch(resume, /~96 €/, "l'ancien chiffre ne doit plus être dans le résumé");
});

test("le résumé dit ce qu'il ne faut PAS annoncer en rendez-vous", () => {
  // « on est à ×4 » est la phrase la plus tentante et la plus fausse. Le
  // chiffre défendable est la marge, pas le multiple.
  const resume = doc.slice(doc.indexOf("## 6."));
  assert.match(resume, /Le chiffre à défendre est la MARGE/i);
  assert.match(resume, /71 %/, "le chiffre solide doit être nommé");
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

test("⚠⚠ LE TABLEAU DU README EST CELUI DU CATALOGUE, brique par brique", () => {
  /**
   * ─────────────────────────────────────────────────────────────────
   * ⚠⚠ IL A DÉRIVÉ SUR TROIS LIGNES EN UNE JOURNÉE, ET RIEN NE L'A DIT.
   *
   * Le 12/09, trois prix ont bougé dans `lib/bricks.ts` après un relevé de
   * marché : Agent ALPHA 220 → 490, Closer OS 140 → 190, tracking 140 → 120.
   * Le tableau du README, recopié à la main, est resté sur les anciens. Il
   * annonçait donc l'Agent à 220 € — moins de la moitié du prix réel — dans
   * le premier fichier qu'un partenaire, un candidat ou un client ouvre.
   *
   * Un écart de prix dans un README ne casse rien et ne prévient personne :
   * il se découvre au moment où quelqu'un le cite, c'est-à-dire dans une
   * conversation commerciale, face à quelqu'un qui a le devis sous les yeux.
   *
   * ⚠ Le test ne compare pas des chaînes de mise en forme : il EXTRAIT les
   * deux montants de chaque ligne du tableau et les confronte au catalogue.
   * Reformuler un libellé reste libre ; changer un prix d'un seul côté, non.
   * ─────────────────────────────────────────────────────────────────
   */
  /**
   * ⚠ ON BORNE AU TABLEAU DES PRIX, et la première rédaction ne le faisait
   * pas : elle cherchait le libellé dans TOUT le README. Or « **Alpha Voice** »
   * apparaît aussi dans le tableau des segments et dans celui de la pile
   * technique — le garde lisait donc la mauvaise ligne et rendait `null` sur
   * deux briques, en accusant le catalogue. Un garde qui désigne le mauvais
   * coupable est pire qu'un garde absent : on corrige ce qui était juste.
   */
  const readmeEntier = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const debut = readmeEntier.indexOf("### Les briques vendables");
  assert.ok(debut > 0, "la section « Les briques vendables » a disparu du README");
  const fin = readmeEntier.indexOf("\n### ", debut + 10);
  const readme = readmeEntier.slice(debut, fin > 0 ? fin : undefined);

  /** « 2 200 € » → 2200. L'espace insécable des milliers est la norme FR. */
  const montant = (txt: string): number | null => {
    const m = txt.match(/([\d\s  ]+)\s*€/);
    return m ? Number(m[1].replace(/[\s  ]/g, "")) : null;
  };

  const ecarts: string[] = [];
  for (const b of BRICKS) {
    // La ligne du tableau qui porte le libellé de cette brique, en gras.
    const ligne = readme
      .split("\n")
      .find((l) => l.startsWith("|") && l.includes(`**${b.label}**`));
    if (!ligne) {
      ecarts.push(`${b.id} — absente du tableau du README`);
      continue;
    }
    const cellules = ligne.split("|").map((c) => c.trim());
    const setup = montant(cellules[2] ?? "");
    const mensuel = montant(cellules[3] ?? "");
    if (setup !== b.setupHT) ecarts.push(`${b.id} — installation : README ${setup} ≠ catalogue ${b.setupHT}`);
    if (mensuel !== b.monthlyHT) ecarts.push(`${b.id} — mensuel : README ${mensuel} ≠ catalogue ${b.monthlyHT}`);
  }

  assert.deepEqual(
    ecarts,
    [],
    "le tableau du README a divergé du catalogue — c'est le chiffre qu'on cite en rendez-vous :\n  " +
      ecarts.join("\n  ")
  );
});
