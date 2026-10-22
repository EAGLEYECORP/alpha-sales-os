import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_ALPHA } from "../lib/agents-alpha";
import { PROMESSE_COURTE } from "../lib/promesse";
import { INTERDITS, textesRetiresTropTot, tweens, verifierNomsEnCapitales, visibleDe } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILM « LE CYCLE, AGENT PAR AGENT » (21/10/2026) — gardé comme le reste.
 *
 * Une vidéo se PUBLIE : elle engage la marque et ne se corrige plus. Les
 * règles de `.claude/skills/alpha-motion/SKILL.md` §4 et §6 vivaient en prose ;
 * ici elles s'exécutent sur la composition (`scripts/video/compositions/cycle`).
 *
 * ⚠⚠ LE PLANCHER DE LECTURE SE MESURE SUR LA VRAIE TIMELINE. « Toute ligne à
 * lire reste posée au moins 0,3 s par mot » était cochée à l'œil. Le test joue
 * le script de la composition avec un GSAP SIMULÉ (il enregistre les tweens,
 * rien d'autre), puis compte, pour chaque texte, le temps où il est réellement
 * entré ET pas encore sorti. Mesuré à la première exécution : deux textes
 * tenaient moins que leur plancher (la dernière carte de l'écran « humain » et
 * la dernière bande de l'écran « agents »), sur une composition que je
 * croyais conforme.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "scripts/video/compositions/cycle");
const html = readFileSync(join(DOSSIER, "index.html"), "utf8");
const partition = JSON.parse(readFileSync(join(RACINE, "scripts/video/partitions/cycle.json"), "utf8")) as {
  duree: number;
  accords: [number, number[]][];
};

const visible = visibleDe(html);

// ── 1 · LES NOMS : une seule définition, en capitales ───────────────────

test("⚠⚠ LES HUIT AGENTS SONT DANS LE FILM, sous le nom EXACT de l'ombrelle", () => {
  assert.equal(AGENTS_ALPHA.length, 8, "l'ombrelle a changé : le film doit suivre (et son texte)");
  for (const a of AGENTS_ALPHA) {
    assert.ok(visible.includes(a.nom), `${a.nom} n'apparaît pas dans le film — il prétend parler « du début à la fin »`);
  }
});

test("aucun nom d'agent écrit autrement qu'en capitales (le post du 20/10 avait écrit « Alpha Voice »)", () => {
  verifierNomsEnCapitales(visible);
});

test("les agents arrivent dans l'ORDRE DU CYCLE — et le film ne dit pas autre chose que la chaîne qu'il montre", () => {
  const ordre = ["ALPHA SCOUT", "AGENT ALPHA", "ALPHA CAMPAGNES", "ALPHA VOICE", "ALPHA LIVE"];
  const positions = ordre.map((n) => visible.indexOf(n));
  assert.ok(positions.every((p) => p >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, `ordre du cycle brisé : ${ordre.join(" → ")}`);
});

// ── 2 · CHAQUE PHRASE EST VRAIE DANS LE CODE ────────────────────────────

test("⚠⚠ ce que le film cite de l'interface EXISTE dans l'interface", () => {
  const presence = readFileSync(join(RACINE, "lib/presence-alpha.ts"), "utf8");
  const bande = readFileSync(join(RACINE, "components/shell/alpha-presence.tsx"), "utf8");
  // La phrase de la bande ET celle de la notification.
  assert.match(visible, /ALPHA a besoin de toi/);
  assert.ok(bande.includes("ALPHA a besoin de toi") && presence.includes("ALPHA a besoin de toi"));
  // Les quatre conditions de la notification, chacune ancrée dans son code.
  assert.match(visible, /seulement l'urgent/);
  assert.match(presence, /r\.priority === "haute"/, "« seulement l'urgent » : plus rien ne filtre sur la priorité haute");
  assert.match(visible, /aux heures utiles/);
  assert.match(presence, /fenetreOuverte\(maintenant\)/, "« aux heures utiles » : la fenêtre n'est plus consultée");
  assert.match(visible, /une à la fois/);
  assert.match(presence, /UNE notification par passage/);
  assert.match(visible, /uniquement si l'onglet reste ouvert/);
  // Le journal : ce que le film en dit doit rester ce que `journalRecent` fait réellement.
  const circuit = readFileSync(join(RACINE, "lib/circuit-alpha.ts"), "utf8");
  assert.match(visible, /Le journal dit ce qui s'est fait/);
  assert.match(circuit, /export function journalRecent\(activities: Activity\[\], limite = 12\)/, "le journal n'est plus « les derniers événements du CRM » : la phrase du film est à revoir");
  assert.match(bande, /elles ne partent que si l&apos;onglet reste ouvert|elles ne partent que si l'onglet reste ouvert/, "l'application ne dit plus cette limite : le film non plus");
  // Le « (3) » de l'onglet est le préfixe que la présence produit.
  assert.match(presence, /prefixeOnglet: `\(\$\{/);
});

test("les moments qui reviennent à l'humain correspondent à une règle exécutable", () => {
  const cadrage = readFileSync(join(RACINE, "lib/cadrage.ts"), "utf8");
  assert.match(visible, /pas de devis sans cadrage/);
  assert.match(cadrage, /export function peutEmettreDevis/, "« pas de devis sans cadrage » : la règle a disparu");
  const cadence = readFileSync(join(RACINE, "lib/call-cadence.ts"), "utf8");
  assert.match(visible, /On vous passe la main/);
  assert.match(visible, /sur intérêt qualifié, jamais avant/);
  assert.match(cadence, /handoffToHuman/, "« on vous passe la main » : le passage de main n'existe plus");
  assert.match(cadence, /interesse/, "« sur intérêt qualifié » : le résultat `interesse` n'existe plus");
});

test("la devise du film EST la promesse du dépôt, mot pour mot (lib/promesse.ts)", () => {
  const devise = [...html.matchAll(/<span class="ligne">([^<]+)<\/span><b class="ligne">([^<]+)<\/b>/g)][0];
  assert.ok(devise, "la devise a changé de forme dans la composition");
  assert.equal(`${devise[1]} ${devise[2]}`, PROMESSE_COURTE);
});

// ── 3 · CE QU'UNE VIDÉO ALPHA N'A PAS LE DROIT DE DIRE ──────────────────

test("⚠ aucun prix, aucun chiffre de performance, aucun superlatif, aucune clientèle affirmée", () => {
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(visible, motif, raison);
});

test("⚠⚠ les seuls NOMBRES de l'image sont ceux d'une interface dessinée — et « SCÈNE ILLUSTRATIVE » est à l'écran quand ils apparaissent", () => {
  const nombres = visible.match(/\d+/g) ?? [];
  // Rangs 01–05 des cartes, « 3 » de la bande et de l'onglet.
  const attendus = new Set(["01", "02", "03", "04", "05", "3"]);
  for (const n of nombres) {
    assert.ok(attendus.has(n), `nombre inattendu dans l'image : ${n} — une mesure inventée est une preuve fabriquée`);
  }
  assert.match(visible, /SCÈNE ILLUSTRATIVE/);
  // L'étiquette entre AVANT le premier nombre dessiné (la bande), et reste jusqu'au bout.
  const pas = tweens(html);
  const entree = pas.find((p) => p.cible === "#illustr" && p.versOpacite === 1);
  const bande = pas.find((p) => p.cible === "#bandeUI" && p.versOpacite === 1);
  assert.ok(entree && bande && entree.t <= bande.t, "« SCÈNE ILLUSTRATIVE » doit entrer avant la première interface chiffrée");
  assert.ok(!pas.some((p) => p.cible === "#illustr" && p.versOpacite === 0), "l'étiquette ne doit jamais sortir");
});

// ── 4 · LA LECTURE : le plancher se MESURE ──────────────────────────────

test("⚠⚠ CHAQUE TEXTE RESTE POSÉ AU MOINS 0,3 s PAR MOT (plancher 1,2 s) — mesuré sur la timeline jouée", () => {
  const { fautifs, mesures } = textesRetiresTropTot(html, partition.duree);
  assert.ok(mesures >= 30, `le test ne mesure plus rien (${mesures} textes) : le script a changé de forme`);
  assert.deepEqual(fautifs, [], `texte retiré trop tôt — la solution est d'allonger la scène, pas de raccourcir la phrase :\n${fautifs.join("\n")}`);
});

// ── 5 · L'IMAGE ET LE SON RACONTENT LA MÊME CHOSE ───────────────────────

test("le son est calé sur l'image : même durée, un accord par scène, au bon instant", () => {
  const racine = html.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1];
  assert.equal(Number(racine), partition.duree, "durée du film ≠ durée de la partition");
  const piste = html.match(/<audio[^>]*data-duration="([\d.]+)"/)?.[1];
  assert.equal(Number(piste), partition.duree, "durée de la piste ≠ durée du film");

  const debuts = [...html.matchAll(/<section id="s\d"[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(debuts.length, 5, "cinq scènes attendues");
  assert.deepEqual(partition.accords.map(([t]) => t), debuts, "chaque scène change d'accord à son premier instant");

  // Les scènes se suivent sans trou ni chevauchement, et finissent avec le film.
  const durees = [...html.matchAll(/<section id="s\d"[^>]*data-duration="([\d.]+)"/g)].map((m) => Number(m[1]));
  durees.forEach((d, i) => {
    const fin = debuts[i] + d;
    const suite = i + 1 < debuts.length ? debuts[i + 1] : partition.duree;
    assert.ok(Math.abs(fin - suite) < 1e-6, `la scène ${i + 1} finit à ${fin} s, la suivante commence à ${suite} s`);
  });
});

test("le film rendu est dans public/media/linkedin (le chemin éprouvé pour le publier)", () => {
  const f = join(RACINE, "public/media/linkedin/cycle-agents-2026-10-21.mp4");
  assert.ok(existsSync(f), "le MP4 a été supprimé ou renommé : le post pointerait dans le vide");
});

// ── 6 · LE POST : mêmes interdits, mêmes noms, et une frontière dite ────

const postMd = readFileSync(join(RACINE, "marketing/post-cycle-agents-2026-10-21.md"), "utf8");
const post = /## Texte du post[\s\S]*?```\n([\s\S]*?)\n```/.exec(postMd)?.[1] ?? "";

test("le post existe, tient dans LinkedIn, et s'ouvre sur l'accroche du film", () => {
  assert.ok(post.length > 500, "le texte du post est introuvable dans marketing/post-cycle-agents-2026-10-21.md");
  assert.ok(post.length <= 3000, `${post.length} caractères : LinkedIn coupe à 3 000`);
  assert.ok(post.startsWith("Les agents travaillent. Vous décidez."), "le post ne s'ouvre plus sur l'accroche du film");
  // Ce que LinkedIn montre avant « voir plus » doit déjà porter l'idée, pas l'introduction.
  assert.match(post.slice(0, 260), /huit agents/);
});

test("⚠⚠ le post nomme les huit agents en capitales et passe par les MÊMES interdits que le film", () => {
  for (const a of AGENTS_ALPHA) assert.ok(post.includes(a.nom), `${a.nom} manque au post`);
  verifierNomsEnCapitales(post);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(post, motif, raison);
});

test("⚠⚠ LA FRONTIÈRE EST DITE DANS LE POST — et la phrase de disponibilité suit l'ombrelle", () => {
  assert.match(post, /onglet ouvert/);
  assert.match(post, /ne vit pas chez nous/);
  assert.match(post, /alertes ne partent que si l'onglet reste ouvert/);
  assert.match(post, /Scène illustrative/);
  assert.match(post, /alphasalesos\.eagleyecorp\.fr\/vitrine/);

  // La disponibilité n'est pas écrite à la main : elle est celle de `AGENTS_ALPHA`.
  const phrase = /Ce que ça ne fait pas[^\n]*/.exec(post)?.[0] ?? "";
  const [chezVous, cles] = phrase.split(";");
  for (const a of AGENTS_ALPHA) {
    const dans = (s: string) => s.includes(a.nom);
    assert.equal(dans(chezVous), a.disponibilite === "chez-vous", `${a.nom} : le post et lib/agents-alpha.ts ne disent pas la même disponibilité`);
    assert.equal(dans(cles), a.disponibilite === "en-ligne-avec-vos-cles", `${a.nom} : « avec vos clés » ne correspond plus à l'ombrelle`);
  }
});

test("les cinq moments qui reviennent à l'humain sont les mêmes dans le film et dans le post", () => {
  for (const [filmMotif, postMotif] of [
    [/Vous apportez la liste/, /apporter la liste/],
    [/Vous relisez/, /relire/],
    [/On vous passe la main/, /prendre la main sur un intérêt qualifié/],
    [/Vous cadrez/, /cadrer avant tout devis/],
    [/Vous signez/, /signer/],
  ] as [RegExp, RegExp][]) {
    assert.match(visible, filmMotif);
    assert.match(post, postMotif);
  }
});
