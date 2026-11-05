import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « PO D'UNE IA » (05/11/2026) — gardé comme les autres films.
 *
 * Il montre trois propositions d'une IA refusées, trois décisions datées et
 * citées mot pour mot, et ce qui ne se délègue pas. Chaque élément du fond
 * est RELU ici dans le dépôt : si la doctrine change, le film tombe au lieu
 * de citer une décision qui n'existe plus.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const html = lire("scripts/video/compositions/po-ia/index.html");
const partition = JSON.parse(lire("scripts/video/partitions/po-ia.json")) as { duree: number; accords: [number, number[]][] };
const visible = visibleDe(html);
const doctrine = lire("CLAUDE.md");

test("⚠⚠ les trois décisions sont citées MOT POUR MOT, à la bonne date, depuis la doctrine", () => {
  for (const [date, cite, motif] of [
    ["30/10/2026", "« tout dans le cloud »", /30\/10\/2026, décision de Zakaria :\s*\n?\s*« tout dans le cloud »/],
    ["20/10/2026", "« le moins de friction possible »", /BRANCHER SES COMPTES EN DEUX CHAMPS \(20\/10\/2026\)[\s\S]{0,400}« le moins de friction possible »/],
    ["29/10/2026", "« même le closing »", /29\/10\/2026, décision de Zakaria : « même le closing »/],
  ] as [string, string, RegExp][]) {
    assert.ok(visible.includes(date) && visible.includes(cite), `${cite} (${date}) manque au film`);
    assert.match(doctrine, motif, `${cite} : la doctrine ne porte plus cette décision à cette date`);
  }
  assert.match(doctrine, /SANS N8N/, "« le pilote tourne sans n8n » n'est plus vrai");
  assert.match(doctrine, /n'invente jamais un prix/, "« sans jamais inventer un prix » n'est plus la règle du closing");
});

test("⚠⚠ les trois propositions refusées ont vraiment été écrites, et refusées pour la raison dite", () => {
  assert.match(lire("lib/part-resultat.ts"), /« Alpha a SOURCÉ la/);
  assert.match(lire("lib/circuit-alpha.ts"), /export function journalRecent\(activities: Activity\[\], limite = 12\)/, "« le journal garde 12 lignes » n'est plus vrai");
  assert.match(visible, /le journal garde 12 lignes/);
  assert.match(lire("tests/dossier-conformite.test.ts"), /aucune dépendance zod dans package\.json/);
  assert.equal(/"zod"/.test(lire("package.json")), false, "zod est entré dans le code : « Zod n'est pas dans le code » devient faux");
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif — et les seuls nombres viennent du dépôt", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  const attendus = new Set(["12", "30", "10", "2026", "20", "29", "8"]);
  for (const n of visible.match(/\d+/g) ?? []) assert.ok(attendus.has(n), `nombre inattendu dans l'image : ${n}`);
});

test("⚠⚠ chaque texte reste posé au moins 0,3 s par mot — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 20, `le test ne mesure plus rien (${mesures} textes)`);
  assert.deepEqual(fautifs, [], fautifs.join("\n"));
});

test("le son est calé sur l'image : même durée, un accord par scène, scènes jointives", () => {
  assert.equal(Number(html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 5);
  assert.deepEqual(partition.accords.map(([t]) => t), debuts);
  durees.forEach((d, i) => {
    const suite = i + 1 < debuts.length ? debuts[i + 1] : partition.duree;
    assert.ok(Math.abs(debuts[i] + d - suite) < 1e-6, `la scène ${i + 1} ne raccorde pas`);
  });
  assert.ok(partition.duree >= 15 && partition.duree <= 26);
});

test("aucune boucle, aucun rebond — le tampon arrive vite mais ne dépasse pas", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  assert.doesNotMatch(script, /repeat|yoyo|back\.|elastic|bounce/);
  assert.doesNotMatch(html, /@keyframes|transition:/);
  assert.match(script, /scale: 1\.12[\s\S]*?scale: 1,/, "le tampon part de 1,12 vers 1 : jamais depuis 0, jamais au-delà");
  assert.ok(tweens(html).length > 30);
});

test("le film rendu est dans public/media/linkedin, et le post existe", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/po-ia-2026-11-05.mp4")));
  const md = lire("marketing/post-po-ia-2026-11-05.md");
  const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(md)?.[1] ?? "";
  assert.ok(post.length > 400 && post.length <= 3000);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  assert.match(post, /Zéro client signé/);
  assert.match(post, /discipline, pas un verrou/);
});
