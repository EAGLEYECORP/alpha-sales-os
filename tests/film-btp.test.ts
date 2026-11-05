import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMESSE_COURTE } from "../lib/promesse";
import { PLAFOND_SOLLICITATIONS_B2C } from "../lib/call-cadence";
import { fenetreOuverte } from "../lib/conformite";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « BTP, ÉQUIPES TERRAIN » (05/11/2026) — gardé comme les autres films.
 *
 * Chaque règle montrée est rejouée sur le code de production ; et le film ne
 * dit pas qu'ALPHA trouve leurs clients : ce sont surtout des particuliers, et
 * ALPHA cherche des entreprises au registre.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const html = lire("scripts/video/compositions/btp/index.html");
const partition = JSON.parse(lire("scripts/video/partitions/btp.json")) as { duree: number; accords: [number, number[]][] };
const visible = visibleDe(html);

test("⚠⚠ « 4 sollicitations au plus sur 30 jours » est le plafond que le code applique, sous le décret cité", () => {
  assert.match(visible, /4 sollicitations au plus sur 30 jours/);
  assert.equal(PLAFOND_SOLLICITATIONS_B2C, 4);
  assert.match(visible, /décret n° 2022-1313/);
  assert.match(lire("lib/call-cadence.ts"), /2022-1313/);
});

test("⚠⚠ « pas d'appel pendant la pause déjeuner » : la fenêtre est réellement fermée de 12 h à 14 h (Paris)", () => {
  // Mardi 3 novembre 2026 : 12 h 30 et 13 h 30 à Paris (UTC+1), puis 14 h 30.
  for (const iso of ["2026-11-03T11:30:00Z", "2026-11-03T12:30:00Z"]) assert.equal(fenetreOuverte(new Date(iso)).open, false, iso);
  assert.equal(fenetreOuverte(new Date("2026-11-03T13:30:00Z")).open, true, "14 h 30 doit être ouvert");
});

test("⚠⚠ « une relance a une raison, ou elle ne part pas » : sans fait daté, le code dit de NE PAS relancer", () => {
  const src = lire("lib/raison-neuve.ts");
  assert.match(src, /export const AUCUNE_RAISON/);
  assert.match(src, /je me permets de relancer/);
});

test("la devise du film EST la promesse du dépôt, mot pour mot", () => {
  const d = /<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/.exec(html);
  assert.ok(d);
  assert.equal(`${d[1]} ${d[2]}`, PROMESSE_COURTE);
});

test("⚠⚠ le film ne promet pas de TROUVER leurs clients (des particuliers, qu'ALPHA ne cherche pas)", () => {
  assert.doesNotMatch(visible, /trouve|vos clients|leurs clients|prospects/i);
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif — et les seuls nombres sont des règles du code", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  const attendus = new Set(["4", "30", "2022", "1313", "12", "14"]);
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
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/btp-2026-11-05.mp4")));
  const md = lire("marketing/post-btp-2026-11-05.md");
  const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(md)?.[1] ?? "";
  assert.ok(post.length > 400 && post.length <= 3000);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /particuliers/, "le post dit ce qu'ALPHA ne fait pas : trouver leurs clients particuliers");
  assert.match(post, /2020-901/, "le post dit la règle de la rénovation énergétique");
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
});
