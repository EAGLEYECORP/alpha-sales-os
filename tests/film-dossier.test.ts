import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « LE DOSSIER QUI SE VÉRIFIE » (04/11/2026) — gardé comme les autres.
 *
 * Sujet : le dossier de conformité EU AI Act, falsifiable à chaque `npm test`
 * (`tests/dossier-conformite.test.ts`). Un film sur un dossier qui refuse les
 * phrases sans preuve ne peut pas, lui, en porter une : chaque citation, le
 * message d'erreur et le nombre de citations sont RELUS ici dans le dépôt.
 * Si le dossier change, le film tombe au lieu de mentir.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const html = lire("scripts/video/compositions/dossier/index.html");
const partition = JSON.parse(lire("scripts/video/partitions/dossier.json")) as { duree: number; accords: [number, number[]][] };
const visible = visibleDe(html);

const DOSSIER = ["docs/EU_AI_ACT.md", "docs/ARTICLE_15.md", "docs/FINOPS.md", "docs/SAFETY.md", "docs/RED_TEAMING.md", "docs/ARTICLE_15_ROBUSTNESS_CYBERSECURITY.md"];
const CITATION = /`([\w./()-]+\.(?:ts|tsx|mjs))#(\w+)`/g;
const exporte = (fichier: string, symbole: string) =>
  new RegExp(`export\\s+(async\\s+)?(function|const|type|interface|class)\\s+${symbole}\\b`).test(lire(fichier));

// ── 1 · CE QUE LE FILM AFFIRME DU DOSSIER EST VRAI DANS LE DOSSIER ──────

test("⚠⚠ le nombre de citations à l'écran est celui du dossier, recompté avec la regex du test qui le garde", () => {
  const n = DOSSIER.reduce((s, d) => s + [...lire(d).matchAll(CITATION)].length, 0);
  const affiche = Number(/<div id="compte"><b>(\d+)<\/b>/.exec(html)?.[1]);
  assert.equal(affiche, n, `le film dit ${affiche}, le dossier en porte ${n} : mettre le film à jour`);
  // La regex du film est celle du garde, mot pour mot.
  assert.ok(lire("tests/dossier-conformite.test.ts").includes(CITATION.source), "le garde a changé sa façon de compter");
});

test("⚠⚠ chaque citation montrée est DANS le dossier, et son symbole est réellement exporté", () => {
  const corpus = DOSSIER.map(lire).join("\n");
  const montrees = [...html.matchAll(/class="ou">([^<]+)</g)].map((m) => m[1]);
  assert.equal(montrees.length, 4);
  for (const c of montrees) {
    assert.ok(corpus.includes("`" + c + "`"), `${c} n'est pas cité par le dossier`);
    const [fichier, symbole] = c.split("#");
    assert.ok(exporte(fichier, symbole), `${fichier} n'exporte plus ${symbole}`);
  }
});

test("⚠⚠ la citation cassée et la sortie du test sont celles que le garde produit réellement", () => {
  // La citation intacte existe dans ARTICLE_15, et la cassée n'existe pas.
  assert.ok(lire("docs/ARTICLE_15.md").includes("`lib/presence-agent.ts#presenceAgent`"));
  assert.ok(exporte("lib/presence-agent.ts", "presenceAgent"));
  assert.ok(!exporte("lib/presence-agent.ts", "presenceAgen"), "la lettre retirée donne un symbole qui existe : la démonstration ne casse plus rien");
  // Le message affiché suit le gabarit du garde, et c'est bien le premier test du fichier.
  const garde = lire("tests/dossier-conformite.test.ts");
  assert.ok(garde.includes("`${doc} : ${fichier} n'exporte pas ${symbole}`"), "le garde a changé son message");
  assert.match(garde.match(/^test\(.*$/m)?.[0] ?? "", /^test\("chaque citation `fichier#symbole`/, "« not ok 1 » : ce n'est plus le premier test du fichier");
  assert.match(visible, /docs\/ARTICLE_15\.md : lib\/presence-agent\.ts n'exporte pas presenceAgen/);
  assert.match(visible, /not ok 1/);
  assert.match(visible, /# fail 1/);
});

test("les quatre affirmations « déjà retirées » sont celles que le garde refuse", () => {
  const garde = lire("tests/dossier-conformite.test.ts");
  for (const [film, motif] of [
    [/une bibliothèque absente du code/, /aucune dépendance zod/],
    [/des sous-agents qui n'existent pas/, /il n'y a pas de sous-agents/],
    [/un seuil de confiance inventé/, /aucun seuil de confiance n'existe/],
    [/une latence jamais mesurée/, /aucune latence vocale n'a été mesurée/],
  ] as [RegExp, RegExp][]) {
    assert.match(visible, film);
    assert.match(garde, motif, `le garde ne refuse plus ce que le film dit qu'il refuse (${film})`);
  }
});

test("la classification dite à l'écran est celle du dossier (risque limité, art. 50)", () => {
  assert.match(visible, /EU AI ACT · RISQUE LIMITÉ · ART\. 50/);
  const doc = lire("docs/EU_AI_ACT.md");
  assert.match(doc, /Haut risque \(annexe III\) \? \| \*\*Non\*\*/);
  assert.match(doc, /Obligations de transparence \(art\. 50\) \? \| \*\*Oui\*\*/);
  assert.match(visible, /EXTRAITS RÉELS DU DÉPÔT/);
});

// ── 2 · CE QU'UNE VIDÉO ALPHA N'A PAS LE DROIT DE DIRE ──────────────────

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif, aucune certification", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  assert.doesNotMatch(visible, /conforme\b|homologu/i, "le dossier décrit ce que fait le logiciel, il n'est pas un avis de conformité");
  verifierNomsEnCapitales(visible);
});

test("⚠ les seuls nombres de l'image sont relus par le dépôt", () => {
  const attendus = new Set(["59", "15", "1", "0", "50"]);
  for (const n of visible.match(/\d+/g) ?? []) assert.ok(attendus.has(n), `nombre inattendu dans l'image : ${n}`);
});

// ── 3 · LA LECTURE ET LE SON ────────────────────────────────────────────

test("⚠⚠ chaque texte reste posé au moins 0,3 s par mot (plancher 1,2 s) — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 25, `le test ne mesure plus rien (${mesures} textes)`);
  assert.deepEqual(fautifs, [], fautifs.join("\n"));
});

test("le son est calé sur l'image : même durée, un accord par scène", () => {
  const racine = html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1];
  assert.equal(Number(racine), partition.duree);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 5);
  assert.deepEqual(partition.accords.map(([t]) => t), debuts);
  durees.forEach((d, i) => {
    const suite = i + 1 < debuts.length ? debuts[i + 1] : partition.duree;
    assert.ok(Math.abs(debuts[i] + d - suite) < 1e-6, `la scène ${i + 1} ne raccorde pas`);
  });
  assert.ok(partition.duree >= 15 && partition.duree <= 26, "15–25 s : la règle des films courts");
});

test("aucune animation qui boucle, aucun rebond", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  assert.doesNotMatch(script, /repeat|yoyo|back\.|elastic|bounce/);
  assert.doesNotMatch(html, /@keyframes|transition:/);
  assert.ok(tweens(html).length > 30);
});

test("le film rendu est dans public/media/linkedin", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/dossier-2026-11-04.mp4")));
});

// ── 4 · LE POST ─────────────────────────────────────────────────────────

const postMd = lire("marketing/post-dossier-conformite-2026-11-04.md");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";

test("le post existe, tient dans LinkedIn, et passe par les MÊMES interdits que le film", () => {
  assert.ok(post.length > 400, "texte du post introuvable");
  assert.ok(post.length <= 3000, `${post.length} caractères : LinkedIn coupe à 3 000`);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
  // Il dit ce que le dossier ne prouve pas — sinon il vendrait plus que le dossier.
  assert.match(post, /pas un avis juridique/);
  assert.match(post, /n'est pas prouvé/);
});
