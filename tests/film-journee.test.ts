import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMESSE_COURTE } from "../lib/promesse";
import { annonceCreneaux, classerReponse, TAG_A_TRAITER } from "../lib/reponses-inscrit";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « UNE JOURNÉE AVEC ALPHA » (05/11/2026) — ce qu'un dirigeant BTP à
 * équipe terrain verrait changer dans SA journée. Demande de Zakaria : « qu'ils
 * puissent se projeter : qu'est-ce que j'y gagne, comment je m'en sers au
 * quotidien ».
 *
 * Une scène illustrative a le droit d'inventer des HEURES, pas des COMPORTEMENTS :
 * chaque réponse de client montrée à l'écran est rejouée ici dans le VRAI
 * classement. Si le code cesse de traiter « 2 » comme un choix de créneau, le
 * film tombe au lieu de mentir.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const html = lire("scripts/video/compositions/journee/index.html");
const partition = JSON.parse(lire("scripts/video/partitions/journee.json")) as { duree: number; accords: [number, number[]][] };
const visible = visibleDe(html);
const texteDe = (id: string) => new RegExp(`id="${id}">([^<]+)<`).exec(html)?.[1] ?? "";
const sansGuillemets = (s: string) => s.replace(/^«\s*|\s*»$/g, "").replace(/…$/, "");

// Trois créneaux proposés, comme le pilote le fait.
const CRENEAUX = [new Date("2026-11-10T08:00:00Z"), new Date("2026-11-11T13:00:00Z"), new Date("2026-11-12T09:00:00Z")];

test("⚠⚠ 13:15 — « Oui, intéressé. » est lu comme un oui au rendez-vous, et ALPHA propose TROIS créneaux", () => {
  const bulle = sansGuillemets(texteDe("b3"));
  assert.equal(bulle, "Oui, intéressé.");
  assert.equal(classerReponse({ texte: bulle, autoReponse: false }).intention, "veut-rdv");
  assert.match(texteDe("f3"), /trois créneaux/);
  assert.equal(annonceCreneaux(CRENEAUX.length).annonce, "voici trois créneaux");
});

test("⚠⚠ 16:05 — « 2 » après trois créneaux est le choix du DEUXIÈME, et pose le rendez-vous", () => {
  const bulle = sansGuillemets(texteDe("b4"));
  assert.equal(bulle, "2");
  const c = classerReponse({ texte: bulle, autoReponse: false }, CRENEAUX);
  assert.equal(c.intention, "choix-creneau");
  assert.equal(c.creneau, 1);
  assert.match(texteDe("f4"), /agenda/);
});

test("⚠⚠ 18:30 — « On verra plus tard » est un DOUTE : ALPHA ne tranche pas, ça remonte à l'humain", () => {
  const bulle = sansGuillemets(texteDe("b5"));
  assert.equal(classerReponse({ texte: bulle, autoReponse: false }).intention, "objection");
  assert.match(texteDe("f5"), /ne tranche pas/);
  assert.equal(TAG_A_TRAITER, "reponse-a-traiter");
});

test("⚠⚠ 10:40 — « la relance part, avec une raison » : sans fait daté, le code dit de NE PAS relancer", () => {
  assert.match(visible, /la relance part, avec une raison/);
  const src = lire("lib/raison-neuve.ts");
  assert.match(src, /export const AUCUNE_RAISON/);
});

test("07:30 — la liste d'appels du jour est un écran réel (`buildCallSession`)", () => {
  assert.match(lire("lib/call-session.ts"), /export function buildCallSession/);
  assert.ok(existsSync(join(RACINE, "app/(app)/appels/page.tsx")));
});

test("la devise du film EST la promesse du dépôt, mot pour mot", () => {
  const d = /<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/.exec(html);
  assert.ok(d);
  assert.equal(`${d[1]} ${d[2]}`, PROMESSE_COURTE);
});

test("⚠ « SCÈNE ILLUSTRATIVE » à l'écran, et le film ne promet pas de TROUVER leurs clients", () => {
  assert.match(visible, /SCÈNE ILLUSTRATIVE/);
  assert.doesNotMatch(visible, /trouve|vos clients|leurs clients|prospects/i);
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif — les seuls nombres sont des HEURES et le choix « 2 »", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  const attendus = new Set(["07", "30", "10", "40", "13", "15", "16", "05", "18", "2"]);
  for (const n of visible.match(/\d+/g) ?? []) assert.ok(attendus.has(n), `nombre inattendu : ${n}`);
});

test("⚠⚠ chaque texte reste posé au moins 0,3 s par mot — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 18, `le test ne mesure plus rien (${mesures})`);
  assert.deepEqual(fautifs, [], fautifs.join("\n"));
});

test("le son est calé sur l'image, scènes jointives, aucune boucle ni rebond", () => {
  assert.equal(Number(html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(partition.accords.map(([t]) => t), debuts);
  durees.forEach((d, i) => assert.ok(Math.abs(debuts[i] + d - (debuts[i + 1] ?? partition.duree)) < 1e-6, `scène ${i + 1}`));
  assert.ok(partition.duree >= 15 && partition.duree <= 26);
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  assert.doesNotMatch(script, /repeat|yoyo|back\.|elastic|bounce/);
  assert.doesNotMatch(html, /@keyframes|transition:/);
  assert.ok(tweens(html).length > 25);
});

test("le film rendu est dans public/media/linkedin, et le post passe les mêmes interdits", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/journee-2026-11-05.mp4")));
  const md = lire("marketing/post-journee-2026-11-05.md");
  const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(md)?.[1] ?? "";
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /onglet/, "le post dit la frontière : en ligne, ALPHA travaille tant que l'onglet est ouvert");
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
  assert.doesNotMatch(post, /z[ée]ro (?:vente|client)/i, "demande de Zakaria : le post parle de ce que le lecteur y gagne");
});
