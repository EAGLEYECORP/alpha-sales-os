import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scriptOperateur } from "../lib/script-operateur";
import { REGLES_DE_METHODE } from "../lib/business-rules";
import { PROMESSE_COURTE } from "../lib/promesse";
import type { ProfilOperateur } from "../lib/profil-operateur";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « TU VENDS QUOI ? » (22/10/2026) — gardé comme le premier.
 *
 * Il montre l'app RÉELLE (captures faites par `capturer.mjs`, en mode inscrit)
 * écrire un script différent pour trois métiers. Ce qui peut mentir dans un
 * tel film, et que ce test refuse :
 *  · une CITATION qui ne sortirait plus du vrai script (le code change, la
 *    vidéo reste) — elle est recalculée ici avec `scriptOperateur` ;
 *  · une frappe « simulée » : il faut une capture par lettre, dans l'ordre ;
 *  · un texte retiré trop tôt, un interdit, une promesse sans code derrière.
 *
 * Il a été trouvé UTILE avant même d'exister : en préparant les captures, le
 * vrai script écrivait « parler de des cuisines » (corrigé dans
 * `lib/script-operateur.ts`), et `/appels` servait NOTRE script à un inscrit
 * tant que le serveur n'avait pas répondu (corrigé : `useMaitreProuve`).
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "scripts/video/compositions/tu-vends-quoi");
const html = readFileSync(join(DOSSIER, "index.html"), "utf8");
const visible = visibleDe(html);
const partition = JSON.parse(readFileSync(join(RACINE, "scripts/video/partitions/tu-vends-quoi.json"), "utf8")) as {
  duree: number;
  accords: [number, number[]][];
};
type ProfilFilm = ProfilOperateur & { id: string; ligne: number; citation: string };
const profils = JSON.parse(readFileSync(join(DOSSIER, "profils.json"), "utf8")) as ProfilFilm[];

// ── 1 · CE QUE LE FILM CITE SORT DU VRAI SCRIPT ─────────────────────────

test("⚠⚠ chaque citation est un extrait EXACT de la ligne que l'app écrit pour ce métier", () => {
  assert.equal(profils.length, 3);
  for (const p of profils) {
    const ligne = scriptOperateur(p).vertical.opener[p.ligne - 1].line;
    assert.ok(ligne.includes(p.citation), `${p.id} : « ${p.citation} » ne sort plus du script (« ${ligne} ») — refaire les captures et le film`);
    assert.ok(html.includes(`id="${p.id}c">«&nbsp;${p.citation}&nbsp;»`), `${p.id} : la citation à l'écran n'est plus celle de profils.json`);
    // La citation porte ce qui CHANGE d'un métier à l'autre — sinon le film ne prouve rien.
    assert.ok(p.citation.includes(p.metier.replace(/^(?:des|du)\s/, "")) || p.citation.includes(p.cibleRole), `${p.id} : la citation ne porte ni le métier ni la cible`);
  }
  assert.equal(new Set(profils.map((p) => p.citation)).size, 3, "trois métiers, trois phrases différentes");
});

test("les métiers du film sont des EXEMPLES : aucune société, aucune personne", () => {
  for (const p of profils) {
    for (const v of [p.metier, p.cibleSecteur, p.cibleRole, p.cibleZone]) {
      assert.doesNotMatch(v, /\b(?:SAS|SARL|SA|SCCV|EURL|Groupe)\b|[A-Z][a-z]+ [A-Z][a-z]+/, `« ${v} » ressemble à un nom propre`);
    }
  }
  assert.match(visible, /ÉCRANS RÉELS · EXEMPLES ILLUSTRATIFS/);
});

// ── 2 · LA FRAPPE EST RÉELLE : une capture par lettre, dans l'ordre ─────

test("⚠ la frappe montre une capture du vrai champ PAR LETTRE, dans l'ordre, avant l'arrivée du script", () => {
  const capturer = readFileSync(join(DOSSIER, "capturer.mjs"), "utf8");
  assert.match(capturer, /placeholder\^="logiciel de paie"/, "la capture ne vise plus le vrai champ « Ce que tu vends »");
  assert.match(capturer, /ALPHA_INSTALLATION=client/, "les écrans doivent être ceux d'un INSCRIT (verdict serveur `maitre: false`)");
  const pas = tweens(html);
  for (const p of profils) {
    const images = [...html.matchAll(new RegExp(`id="${p.id}f(\\d{2})" src="caps/${p.id}-frappe-(\\d{2})\\.png"`, "g"))];
    assert.equal(images.length, p.metier.length + 1, `${p.id} : ${images.length} images pour « ${p.metier} » — une par lettre, plus le champ vide`);
    const apparitions = pas.filter((x) => x.cible.startsWith(`#${p.id}f`) && x.versOpacite === 1).map((x) => x.t);
    assert.equal(apparitions.length, p.metier.length);
    assert.deepEqual([...apparitions].sort((a, b) => a - b), apparitions, `${p.id} : les lettres n'arrivent pas dans l'ordre`);
    const script = pas.find((x) => x.cible === `#${p.id}b` && x.versOpacite === 1);
    assert.ok(script && apparitions.at(-1)! < script.t, `${p.id} : le script arrive avant la fin de la frappe`);
  }
});

// ── 3 · CHAQUE PROMESSE A SON CODE ──────────────────────────────────────

test("⚠⚠ « Alpha n'invente rien » : chaque ligne est tenue par une règle exécutable", () => {
  assert.match(visible, /Aucun prix inventé\./);
  assert.match(visible, /Aucun client inventé\./);
  assert.match(REGLES_DE_METHODE, /n'invente ni prix, ni client/, "la règle de méthode qui fonde ces deux lignes a disparu");
  for (const p of profils) {
    const s = scriptOperateur(p).vertical;
    const dit = [...s.opener.map((o) => o.line), ...s.diagnostic, s.mirror].join(" ");
    assert.doesNotMatch(dit, /€|\beuros?\b|\d+\s?%/, `${p.id} : le script cite un prix`);
  }
  assert.match(visible, /Ton nom\. Jamais le nôtre\./);
  const expediteur = readFileSync(join(RACINE, "lib/expediteur.ts"), "utf8");
  assert.match(expediteur, /estMarqueDuPortefeuille\(saisie\) \? "portefeuille"/, "le refus d'envoyer sous notre marque a disparu");
});

test("la devise du film EST la promesse du dépôt, mot pour mot (lib/promesse.ts)", () => {
  const devise = [...html.matchAll(/<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/g)][0];
  assert.ok(devise, "la devise a changé de forme dans la composition");
  assert.equal(`${devise[1]} ${devise[2]}`, PROMESSE_COURTE);
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif, aucune clientèle affirmée — et les noms en capitales", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  assert.deepEqual(visible.match(/\d+/g) ?? [], [], "aucun nombre dans l'image : rien n'est mesuré");
});

test("l'étiquette « ÉCRANS RÉELS · EXEMPLES ILLUSTRATIFS » entre avant le premier écran et ne sort jamais", () => {
  const pas = tweens(html);
  const entree = pas.find((p) => p.cible === "#illustr" && p.versOpacite === 1);
  const ecran = pas.find((p) => p.cible === `#${profils[0].id}a` && p.versOpacite === 1);
  assert.ok(entree && ecran && entree.t <= ecran.t);
  assert.ok(!pas.some((p) => p.cible === "#illustr" && p.versOpacite === 0));
});

// ── 4 · LA LECTURE ET LE SON ────────────────────────────────────────────

test("⚠⚠ CHAQUE TEXTE RESTE POSÉ AU MOINS 0,3 s PAR MOT (plancher 1,2 s) — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 15, `le test ne mesure plus rien (${mesures} textes) : le script a changé de forme`);
  assert.deepEqual(fautifs, [], `texte retiré trop tôt — allonger la scène, pas raccourcir la phrase :\n${fautifs.join("\n")}`);
});

test("le son est calé sur l'image : même durée, un accord par scène, scènes contiguës", () => {
  const racine = html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1];
  assert.equal(Number(racine), partition.duree);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), partition.duree);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 6);
  assert.deepEqual(partition.accords.map(([t]) => t), debuts);
  durees.forEach((d, i) => {
    const suite = i + 1 < debuts.length ? debuts[i + 1] : partition.duree;
    assert.ok(Math.abs(debuts[i] + d - suite) < 1e-6, `la scène ${i + 1} ne s'enchaîne pas`);
  });
  assert.ok(partition.duree <= 26, "court : un film LinkedIn tient sous 26 s");
});

test("le film rendu est dans public/media/linkedin, et ses captures ne sont PAS commitées", () => {
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/tu-vends-quoi-2026-10-22.mp4")));
  assert.match(readFileSync(join(DOSSIER, ".gitignore"), "utf8"), /^caps\/$/m);
});

// ── 5 · LE POST ─────────────────────────────────────────────────────────

const postMd = readFileSync(join(RACINE, "marketing/post-tu-vends-quoi-2026-10-22.md"), "utf8");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";

test("le post tient dans LinkedIn, s'ouvre sur l'accroche du film, et passe par les MÊMES interdits", () => {
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  assert.ok(post.startsWith("Tu vends quoi ?"));
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.match(post, /Écrans réels/);
  assert.match(post, /exemple/);
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
  // Les trois métiers du film sont ceux du post.
  for (const p of profils) assert.ok(post.includes(p.metier), `« ${p.metier} » manque au post`);
});

test("⚠⚠ le post dit la frontière et refuse la promesse fausse sur les données", () => {
  assert.match(post, /onglet est ouvert/);
  assert.match(post, /CRM vit dans ton navigateur/);
  assert.doesNotMatch(post, /ne quitte(?:nt)? jamais|ne passe(?:nt)? (?:jamais )?par nos serveurs/i, "une clé d'IA envoie du texte à son fournisseur");
  // Le statut se DIT : prêt et non publié, ou publié avec sa date et son identifiant.
  assert.match(postMd, /\*\*Statut : (?:PRÊT, PAS PUBLIÉ|PUBLIÉ le \d{2}\/\d{2}\/\d{4}[^*]*\*\*[\s\S]{0,40}urn:li:ugcPost:\d+)/);
});
