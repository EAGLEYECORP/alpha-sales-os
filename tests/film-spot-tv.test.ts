import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lireSignaux, exclusionPublique, momentFrais, type AnnonceBodacc } from "../lib/signaux-publics";
import { sirenValide } from "../lib/siren";
import { buildCallSession } from "../lib/call-session";
import { scriptOperateur } from "../lib/script-operateur";
import { raisonDeNePasEcrire } from "../lib/ne-pas-ecrire";
import { cheminOuvertParCle } from "../lib/capacites-cle";
import { PROMESSE_COURTE } from "../lib/promesse";
import { prospectDefaults } from "../lib/seed";
import type { ProfilOperateur } from "../lib/profil-operateur";
import type { Prospect } from "../lib/types";
import { INTERDITS, bloc, metriquesPolice, mots, plancher, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SPOT TV « FAÇON APPLE » (22/10/2026) — 30 s, 16:9, 25 images/s.
 *
 * Ce qui peut mentir dans un spot fait d'écrans réels, et que ce test refuse :
 *  · une SCÈNE que le code ne produirait plus (le tri, la remontée en tête, le
 *    message mis de côté) — rejouée ici dans les vraies fonctions, sur les
 *    annonces fictives du tournage ;
 *  · une promesse sans code derrière, un interdit, un nom d'agent mal écrit ;
 *  · une MENTION trop petite ou trop brève pour la télévision — la taille est
 *    calculée depuis la police elle-même, pas depuis un commentaire.
 *
 * ⚠⚠ Il a été utile avant d'exister : en tournant la relecture, la raison d'un
 * message mis de côté (liquidation, refus, démo) ne s'affichait jamais, et un
 * clic le remettait dans la pile à envoyer (`lib/ne-pas-ecrire.ts`).
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "scripts/video/compositions/spot-tv");
const html = readFileSync(join(DOSSIER, "index.html"), "utf8");
const visible = visibleDe(html);
const capturer = readFileSync(join(DOSSIER, "capturer.mjs"), "utf8");
const partition = JSON.parse(readFileSync(join(RACINE, "scripts/video/partitions/spot-tv.json"), "utf8")) as {
  duree: number;
  accords: [number, number[]][];
};
interface Donnees {
  tourneLe: string;
  profil: ProfilOperateur;
  fiches: { id: string; company: string; name: string; siren: string; phone: string; email: string; role: "neutre" | "exclue" | "moment" }[];
  annonces: Record<string, AnnonceBodacc[]>;
}
const D = JSON.parse(readFileSync(join(DOSSIER, "donnees.json"), "utf8")) as Donnees;
const TOURNAGE = new Date(D.tourneLe);

/** Les fiches telles que le tournage les a semées, APRÈS la lecture du BODACC. */
const fiches: Prospect[] = D.fiches.map((f) => ({
  ...prospectDefaults,
  id: f.id,
  name: f.name,
  company: f.company,
  sector: "restaurant",
  city: D.profil.cibleZone,
  phone: f.phone,
  email: f.email,
  siren: f.siren,
  stage: "prospect",
  signauxPublics: lireSignaux(f.siren, D.annonces[f.siren] ?? [], TOURNAGE),
  createdAt: D.tourneLe,
  updatedAt: D.tourneLe,
}));
const role = (r: Donnees["fiches"][number]["role"]) => fiches.find((p) => D.fiches.find((f) => f.id === p.id)?.role === r)!;

// ── 1 · CE QUE LE SPOT MONTRE, LE CODE LE FAIT ──────────────────────────

test("⚠⚠ la file que le spot montre est celle que le code produit : la liquidée sort, le moment frais monte en tête", () => {
  const { targets, ecartees } = buildCallSession(fiches, "restauration", TOURNAGE);
  assert.deepEqual(targets.map((t) => t.prospect.id), [role("moment").id, role("neutre").id], "l'ordre après tri n'est plus celui du film");
  assert.deepEqual(ecartees.map((e) => e.prospect.id), [role("exclue").id]);
  assert.match(exclusionPublique(role("exclue"))?.libelle ?? "", /^Liquidation judiciaire/);
  assert.equal(momentFrais(role("moment"), TOURNAGE)?.type, "nouvelle-direction");
  assert.ok(targets[0].hot, "la fiche au moment frais n'est plus « prioritaire »");
  // Le mouvement du film suit CET ordre : la ligne du moment monte de deux places, l'autre descend d'une.
  assert.match(html, /tl\.to\("#r-olv", \{ y: -409,/);
  assert.match(html, /tl\.to\("#r-bri", \{ y: 204\.5,/);
});

test("⚠⚠ le message vers la société liquidée ne part pas — et c'est la même raison que l'écran affiche", () => {
  assert.match(raisonDeNePasEcrire(role("exclue")) ?? "", /^annonce légale — Liquidation judiciaire/);
  assert.equal(raisonDeNePasEcrire(role("neutre")), null, "la fiche approuvée dans le film ne doit pas être verrouillée");
});

test("« Sur ce que vous vendez » : la première ligne du vrai script porte le métier surligné", () => {
  const ligne = scriptOperateur(D.profil).vertical.opener[0].line;
  assert.ok(ligne.includes(D.profil.metier), `« ${D.profil.metier} » n'est plus dans « ${ligne} » — refaire les captures et le surlignage`);
  assert.match(capturer, /D\.profil\.metier\);/, "le surligneur n'est plus placé sur la position MESURÉE du métier");
});

test("⚠ « Gratuit en ligne* » : tout ce que le spot montre s'ouvre en ligne, la campagne par le compte email du client", () => {
  assert.equal(cheminOuvertParCle("/campaigns", ["email"]), true, "la relecture de campagne ne s'ouvre plus avec la boîte du client : la mention ment");
  assert.match(visible, /Gratuit en ligne\*/);
  assert.match(visible, /\*Version en ligne gratuite, sans durée limite\. IA et emails : avec vos propres comptes\./);
});

test("la devise est la promesse du dépôt, mot pour mot (lib/promesse.ts)", () => {
  const t5 = bloc(html, "t5");
  assert.ok(t5);
  assert.equal(visibleDe(`<body>${t5}</body>`).trim(), PROMESSE_COURTE);
});

// ── 2 · LES ÉCRANS SONT RÉELS, LES DONNÉES FICTIVES ─────────────────────

test("⚠ le tournage sert l'app en mode INSCRIT, et ne remplace QUE la réponse du BODACC", () => {
  assert.match(capturer, /ALPHA_INSTALLATION=client/);
  const routes = [...capturer.matchAll(/ctx\.route\((\/[^,]+\/)/g)].map((m) => m[1]);
  assert.deepEqual(routes, ["/fonts\\.googleapis\\.com/", "/fonts\\.gstatic\\.com/", "/bodacc-datadila\\.opendatasoft\\.com/"], "une route de plus = une réponse de l'app fabriquée");
  assert.match(capturer, /getByRole\("button", \{ name: \/au BODACC\/ \}\)/, "le tri ne passe plus par le vrai bouton");
  assert.match(capturer, /approuver\.click\(\)/, "l'approbation ne passe plus par un vrai clic");
});

test("⚠ toutes les données du tournage sont fictives : « (démo) », RFC 2606, plage ARCEP de fiction, SIREN hors registre", () => {
  for (const f of D.fiches) {
    assert.match(f.company, /\(démo\)$/);
    assert.match(f.email, /\.example$/);
    assert.match(f.phone.replace(/\s/g, ""), /^063998/, "plage ARCEP réservée à la fiction (décision 2018-0881)");
    // Vérifiés au BODACC et au registre national le 22/10/2026 : zéro résultat.
    assert.ok(["000000018", "000000034", "000000042"].includes(f.siren), `${f.siren} : SIREN non vérifié hors registre`);
    assert.ok(sirenValide(f.siren));
  }
  for (const liste of Object.values(D.annonces)) for (const a of liste) assert.match(a.url_complete ?? "", /FICTION/);
  assert.match(visible, /Écrans réels · données fictives/);
});

test("la mention des écrans entre avant le premier écran et ne sort qu'avec le dernier", () => {
  const pas = tweens(html);
  const entree = pas.find((p) => p.cible === "#etiquette" && p.versOpacite === 1)!;
  const premierEcran = pas.find((p) => p.cible === "#r-bri" && p.versOpacite === 1)!;
  const sortie = pas.find((p) => p.cible === "#etiquette" && p.versOpacite === 0)!;
  const dernierEcran = pas.find((p) => p.cible === "#s4in" && p.versOpacite === 0)!;
  assert.ok(entree.t <= premierEcran.t);
  assert.ok(sortie.t >= dernierEcran.t);
});

// ── 3 · LA TÉLÉVISION ───────────────────────────────────────────────────

test("⚠⚠ MENTIONS LISIBLES (ARPP) : minuscule à tête plate ≥ 22 px réels en 1080 — calculé sur la POLICE", () => {
  const regle = /\.mention \{[^}]*font-weight: (\d+);[^}]*font-size: (\d+)px;/.exec(html);
  assert.ok(regle, "la règle .mention a changé de forme");
  const [, graisse, corps] = regle;
  const police = /@font-face \{ font-family: "Inter Tight"; font-weight: (\d+); src: url\(([^)]+)\)/g;
  const fichier = [...html.matchAll(police)].find((m) => m[1] === graisse)?.[2];
  assert.ok(fichier, `aucune police Inter Tight ${graisse} déclarée`);
  const { unitesParEm, hauteurX } = metriquesPolice(readFileSync(join(DOSSIER, fichier)));
  const px = (Number(corps) * hauteurX) / unitesParEm;
  assert.ok(px >= 22, `hauteur d'x des mentions : ${px.toFixed(2)} px réels, l'ARPP en demande 22 en HD`);
  // Aucune mention ne se rapetisse ailleurs.
  for (const id of ["etiquette", "legal"]) {
    const el = bloc(html, id)!;
    assert.match(el, /class="mention"/);
    assert.doesNotMatch(el, /font-size/);
    assert.doesNotMatch(new RegExp(`#${id} \\{[^}]*\\}`).exec(html)?.[0] ?? "", /font-size/);
  }
});

test("⚠ la mention légale reste assez longtemps pour être lue, et elle est seule à l'écran avec la fin", () => {
  const legal = bloc(html, "legal")!;
  const n = mots(legal);
  const pas = tweens(html);
  const entree = pas.find((p) => p.cible === "#legal" && p.versOpacite === 1)!;
  const tenue = partition.duree - (entree.t + entree.duree);
  assert.ok(tenue >= plancher(n), `${n} mots tenus ${tenue.toFixed(2)} s, il en faut ${plancher(n).toFixed(2)}`);
  assert.ok(!pas.some((p) => p.cible === "#legal" && p.versOpacite === 0), "la mention ne doit jamais sortir avant la fin");
  // Jamais deux jeux de mentions en même temps (« double niveau de lecture »).
  const sortieEtiquette = pas.find((p) => p.cible === "#etiquette" && p.versOpacite === 0)!;
  assert.ok(sortieEtiquette.t + sortieEtiquette.duree <= entree.t);
});

test("⚠ zone de sécurité graphique (EBU R95) : tout texte à plus de 5 % des bords", () => {
  for (const classe of ["titre", "centre", "mention"]) {
    const r = new RegExp(`\\.${classe} \\{[^}]*left: (\\d+)px; width: (\\d+)px;`).exec(html);
    assert.ok(r, `.${classe} a changé de forme`);
    assert.ok(Number(r[1]) >= 96 && Number(r[1]) + Number(r[2]) <= 1824, `.${classe} sort de la zone horizontale`);
  }
  const hauteurLigne = 42 * 1.24;
  const top = (id: string) => Number(new RegExp(`#${id} \\{[^}]*top: (\\d+)px;`).exec(html)?.[1]);
  assert.ok(top("etiquette") + hauteurLigne <= 1026, "l'étiquette déborde en bas");
  assert.ok(top("legal") + 2 * hauteurLigne <= 1026, "la mention légale déborde en bas");
  for (const m of html.matchAll(/class="titre" id="t\d" style="top: (\d+)px/g)) assert.ok(Number(m[1]) >= 54);
});

test("⚠ format de diffusion : 1920×1080, 30,0 s, scènes contiguës, son de la même durée", () => {
  assert.match(html, /data-composition-id="main" data-start="0" data-duration="30" data-width="1920" data-height="1080"/);
  assert.equal(partition.duree, 30);
  assert.equal(Number(html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1]), 30);
  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 6);
  assert.deepEqual(partition.accords.map(([t]) => t), debuts, "un accord par scène, posé sur son début");
  durees.forEach((d, i) => {
    const suite = i + 1 < debuts.length ? debuts[i + 1] : 30;
    assert.ok(Math.abs(debuts[i] + d - suite) < 1e-6, `la scène ${i + 1} ne s'enchaîne pas`);
  });
  assert.match(html, /<html lang="fr">/, "loi n° 94-665 : le texte à l'écran est en français");
});

// ── 4 · LA LECTURE ET LES INTERDITS ─────────────────────────────────────

test("⚠⚠ CHAQUE TEXTE RESTE POSÉ AU MOINS 0,3 s PAR MOT (plancher 1,2 s) — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 9, `le test ne mesure plus rien (${mesures} textes)`);
  assert.deepEqual(fautifs, [], `texte retiré trop tôt :\n${fautifs.join("\n")}`);
});

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif, aucune clientèle — et aucun nombre", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
  verifierNomsEnCapitales(visible);
  assert.deepEqual(visible.match(/\d+/g) ?? [], [], "aucun nombre dans le texte du spot : rien n'est mesuré");
});

test("⚠ rien ne boucle, rien ne dérive : aucune répétition, aucun mouvement d'ambiance", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)![1];
  assert.doesNotMatch(script, /repeat\s*:|yoyo|\.repeat\(/);
  assert.doesNotMatch(html, /@keyframes|animation:/);
});

test("le spot rendu est dans public/media/tv, et ses captures ne sont PAS commitées", () => {
  assert.ok(existsSync(join(RACINE, "public/media/tv/alpha-spot-30s-2026-10-22.mp4")));
  assert.match(readFileSync(join(DOSSIER, ".gitignore"), "utf8"), /^caps\/$/m);
  assert.ok(existsSync(join(RACINE, "docs/SPOT-TV.md")), "la procédure de livraison TV a disparu");
  // Le master TV commence sur la toile nue : publié tel quel sur le web, sa vignette est vide
  // (LinkedIn, 22/10/2026). La version web, image 0 = affiche, est un fichier à part.
  assert.ok(existsSync(join(RACINE, "public/media/linkedin/spot-tv-2026-10-22.mp4")), "la version web (image 0 = affiche) a disparu");
});

// ── 5 · LE POST ─────────────────────────────────────────────────────────

const postMd = readFileSync(join(RACINE, "marketing/post-spot-tv-2026-10-22.md"), "utf8");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";

test("le post tient dans LinkedIn, s'ouvre sur l'accroche du film, et passe par les MÊMES interdits", () => {
  assert.ok(post.length > 400 && post.length <= 3000, `${post.length} caractères`);
  assert.ok(post.startsWith("Qui appeler ce matin ?"));
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
  verifierNomsEnCapitales(post);
  assert.ok(post.includes(PROMESSE_COURTE), "la devise du film doit être celle du post, mot pour mot");
  assert.match(post, /données fictives/);
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);
});

test("⚠⚠ le post ne prétend ni une diffusion, ni une lecture de TOUTES les fiches, ni des données qui ne sortent jamais", () => {
  // Diffusé = un avis ARPP et une régie. Tant que le statut ne le dit pas, le post non plus.
  if (!/Statut : DIFFUSÉ/.test(postMd)) {
    assert.doesNotMatch(post, /\bbientôt (?:à la|en) télé|\bà l'antenne\b|\best diffusé\b/i, "aucune diffusion à annoncer");
    assert.match(post, /n'est pas diffusé/);
  }
  assert.match(post, /par le SIREN de la fiche/, "la lecture BODACC dépend du SIREN porté par la fiche : le dire");
  assert.match(post, /dans une campagne, rien ne part/, "« rien ne part » n'est vrai que DANS la relecture de campagne");
  assert.match(post, /CRM vit dans ton navigateur/);
  assert.match(post, /onglet est ouvert/);
  assert.doesNotMatch(post, /ne quitte(?:nt)? jamais|ne passe(?:nt)? (?:jamais )?par nos serveurs/i, "une clé d'IA envoie du texte à son fournisseur");
  assert.match(postMd, /\*\*Statut : (?:PRÊT, PAS PUBLIÉ|PUBLIÉ le \d{2}\/\d{2}\/\d{4}[^*]*\*\*[\s\S]{0,40}urn:li:ugcPost:\d+)/);
});
