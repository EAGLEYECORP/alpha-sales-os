import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMESSE_COURTE } from "../lib/promesse";
import { notifsDuJournal, notifsDuSuivi, type LigneSuivi } from "../lib/notifications";
import type { EntreeJournal } from "../lib/autopilote-inscrit";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « NOTIFICATIONS » (06/11/2026), thème clair. Écrans réels
 * (`capturer.mjs`), données fictives (`donnees.json`). Une scène illustrative a
 * le droit d'inventer des HEURES et des NOMS de démo, pas des COMPORTEMENTS :
 * le test fait passer les données dans le vrai `lib/notifications.ts` et exige
 * que chaque étiquette du film corresponde à ce que l'écran affiche.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const DIR = "scripts/video/compositions/notifications";
const html = lire(`${DIR}/index.html`);
const D = JSON.parse(lire(`${DIR}/donnees.json`)) as { suivi: LigneSuivi[]; journal: EntreeJournal[] };
const partition = JSON.parse(lire("scripts/video/partitions/notifications.json")) as { duree: number; accords: [number, number[]][] };
const visible = visibleDe(html);
const heureParis = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const etiquette = (id: string) => new RegExp(`id="${id}"[^>]*><b>([^<]+)</b>\\s*([^<]+)<`).exec(html)!;

test("⚠⚠ chaque étiquette du film tombe à l'heure de l'événement qu'elle nomme, recalculé par le vrai code", () => {
  const n = [...notifsDuSuivi(D.suivi), ...notifsDuJournal(D.journal, { sansEnvois: true })];
  const premierEnvoi = n.filter((x) => x.genre === "envoi").map((x) => x.quand).sort()[0];
  assert.equal(etiquette("l1")[1], heureParis(premierEnvoi));
  const clic = n.find((x) => x.genre === "clic")!;
  assert.equal(etiquette("l2")[1], heureParis(clic.quand));
  assert.match(clic.titre, /^Lien cliqué/);
  assert.equal(etiquette("l3")[1], heureParis(n.find((x) => x.genre === "reponse")!.quand));
  assert.equal(etiquette("l4")[1], heureParis(n.find((x) => x.genre === "rdv")!.quand));
  assert.match(n.find((x) => x.genre === "ouverture" && x.titre.includes("2 fois"))?.detail ?? "", /Indicatif/);
});

test("⚠ le journal fictif suit mot pour mot les gabarits du pilote, et ne nomme que des fiches de démo", () => {
  const src = lire("lib/pilote-executeur.ts");
  assert.ok(src.includes("est intéressé : ${nb(creneaux.length"));
  assert.ok(src.includes("texte: `Rendez-vous avec ${p.company} : ${labelCreneau(creneau)}. L'invitation est aussi dans ta boîte.${relu}`"));
  assert.match(D.journal.find((e) => e.type === "repond")!.texte, /^.+ est intéressé : 3 créneaux proposés\.$/);
  assert.match(D.journal.find((e) => e.type === "rdv")!.texte, /^Rendez-vous avec .+ : \w+ \d+ \w+ à \d\d:\d\d\. L'invitation est aussi dans ta boîte\.$/);
  for (const s of [...D.suivi.map((r) => r.subject ?? ""), ...D.journal.map((e) => e.texte)]) assert.match(s, /\(DÉMO\)/);
});

test("⚠ ce que le film dit des ouvertures est ce que l'écran dit", () => {
  assert.match(visible, /Une ouverture : indicatif\./);
  assert.match(lire("lib/notifications.ts"), /une messagerie ou un antivirus peut ouvrir un message/);
  assert.match(lire("components/notifications/use-notifications.ts"), /PERIODE_MS = 30_000/);
});

test("la devise est la promesse du dépôt ; « SCÈNE ILLUSTRATIVE » à l'écran ; thème clair", () => {
  const d = /<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/.exec(html)!;
  assert.equal(`${d[1]} ${d[2]}`, PROMESSE_COURTE);
  assert.match(visible, /SCÈNE ILLUSTRATIVE/);
  assert.match(html, /background: #f3eee4/);
  assert.match(lire(`${DIR}/capturer.mjs`), /alpha_theme", "light"/);
});

test("⚠ aucun prix, aucune performance, aucun superlatif ; les seuls nombres sont des heures", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  const attendus = new Set(["09", "05", "55", "10", "12", "11", "30"]);
  for (const n of visible.match(/\d+/g) ?? []) assert.ok(attendus.has(n), `nombre inattendu : ${n}`);
});

test("⚠⚠ chaque texte reste posé au moins 0,3 s par mot — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 14, `le test ne mesure plus rien (${mesures})`);
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
  assert.ok(tweens(html).length > 20);
});

test("le film rendu est dans public/media/linkedin, et le post passe les mêmes interdits", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/notifications-2026-11-06.mp4")));
  const md = lire("marketing/post-notifications-2026-11-06.md");
  const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(md)?.[1] ?? "";
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /indicati/, "le post dit qu'une ouverture n'est pas une lecture");
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
  assert.doesNotMatch(post, /z[ée]ro (?:vente|client)/i);
});
