import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creerLimiteur } from "../lib/limiteur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE LIMITEUR DE DÉBIT SOUS UN AFFLUX (21/10/2026).
 *
 * L'ancienne version balayait toute la table à chaque NOUVELLE IP au-delà de
 * 10 000 entrées. Mesuré en rejouant sa logique à l'identique :
 * 1,4 µs par requête à 10 000 IP distinctes, 226 µs à 30 000, 925 µs à 100 000.
 * Quadratique — et précisément sous le trafic qu'on espère.
 *
 * ⚠⚠ LE TEST NE MESURE PAS UN TEMPS (il serait fragile sur une machine
 * chargée) : il COMPTE LES BALAYAGES, qui sont la cause. Quadratique = un
 * balayage par requête ; réparé = un par intervalle. Ça ne dépend d'aucune
 * horloge murale — l'horloge est injectée.
 * ─────────────────────────────────────────────────────────────────────
 */

const FENETRE = 60_000;

test("⚠⚠ UN AFFLUX D'IP DISTINCTES NE DÉCLENCHE PAS UN BALAYAGE PAR REQUÊTE", () => {
  const l = creerLimiteur({ fenetreMs: FENETRE });
  const t0 = 1_000_000;
  // 100 000 visiteurs distincts, dans la MÊME fenêtre : rien n'expire, rien ne se libère.
  for (let i = 0; i < 100_000; i++) l.bump(`ip${i}`, 1200, t0 + Math.floor(i / 50)); // ≈ 2 s de trafic
  assert.ok(
    l.balayages() <= 3,
    `${l.balayages()} balayages pour 100 000 requêtes : l'ancienne version en faisait ~90 000 (un par nouvelle IP)`,
  );
});

test("⚠ le plafond dur borne la table sous un flot d'IP toutes fraîches", () => {
  const l = creerLimiteur({ fenetreMs: FENETRE, plafond: 20_000, seuilBalayage: 5_000, balayageMs: 1_000 });
  let maxVu = 0;
  for (let i = 0; i < 200_000; i++) {
    l.bump(`ip${i}`, 1200, 1_000_000 + i); // 1 ms entre deux visiteurs : 200 s de flot, toutes dans la fenêtre de 60 s ou presque
    if (l.taille() > maxVu) maxVu = l.taille();
  }
  // Entre deux balayages la table peut dépasser le plafond (≈ 1 s de trafic = 1 000 IP) ; jamais bien au-delà.
  assert.ok(maxVu < 20_000 + 2_000, `la table a atteint ${maxVu} entrées : le plafond ne borne rien`);
});

test("la fenêtre : un visiteur légitime est limité, puis libéré", () => {
  const l = creerLimiteur({ fenetreMs: FENETRE });
  const t = 5_000_000;
  for (let i = 0; i < 3; i++) assert.equal(l.bump("a", 3, t + i), false, "les trois premières passent");
  assert.equal(l.bump("a", 3, t + 10), true, "la quatrième dans la fenêtre est refusée");
  assert.equal(l.bump("b", 3, t + 11), false, "une autre IP n'est pas touchée");
  assert.equal(l.bump("a", 3, t + FENETRE + 1), false, "la fenêtre passée, il repart de zéro");
});

test("⚠ perdre la mémoire par saturation ne bloque JAMAIS quelqu'un à tort", () => {
  const l = creerLimiteur({ fenetreMs: FENETRE, plafond: 100, seuilBalayage: 50, balayageMs: 1 });
  for (let i = 0; i < 1_000; i++) l.bump(`ip${i}`, 5, 10_000_000 + i * 2);
  // Après des vidages, une IP quelconque repart de 1 : elle n'est pas refusée sur un compte périmé.
  assert.equal(l.bump("ip-neuve", 5, 10_100_000), false);
  assert.equal(l.bump("ip5", 5, 10_100_001), false);
});

test("⚠ le middleware utilise CE limiteur, et ne garde plus l'ancien balayage à chaque IP", () => {
  const src = readFileSync(join(process.cwd(), "middleware.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(src, /import \{ creerLimiteur \} from "@\/lib\/limiteur"/);
  assert.match(src, /hits\.bump\(ip, MAX_PER_WINDOW\)/);
  assert.match(src, /gateHits\.bump\(ip, MAX_GATE_PER_WINDOW\)/);
  assert.doesNotMatch(src, /for \(const \[k, v\] of map\)/, "la boucle de balayage ne doit plus vivre dans le middleware");
  // Les budgets sont ceux d'avant : changer le limiteur ne change pas ce qu'on autorise.
  assert.match(src, /MAX_PER_WINDOW = 1200/);
  assert.match(src, /MAX_GATE_PER_WINDOW = 20/);
});
