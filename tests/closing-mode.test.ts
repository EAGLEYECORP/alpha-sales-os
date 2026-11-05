import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { PROFIL_VIDE } from "../lib/profil-operateur";
import { etapesClosing, objectionsClosing } from "../lib/closing-mode";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MODE CLOSING D'UN INSCRIT N'EST PAS NOTRE PITCH (05/11/2026).
 * Il servait à tout inscrit « je ne suis pas là pour vous vendre un site »,
 * « ouvrir la maquette », « combien d'appels ratés ». Trouvé en écrivant le
 * guide du README, pas par un test : il n'y avait aucun module à tester.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const fiche = (o: Partial<Prospect> = {}): Prospect =>
  ({ ...prospectDefaults, id: "x", name: "Camille Durand", company: "MENUISERIE QUIXOTZ (DÉMO)", sector: "autre", city: "Lyon", stage: "rdv", tags: [], notes: "", ...o }) as Prospect;
const profil = { ...PROFIL_VIDE, metier: "la pose de fenêtres sur mesure", cibleSecteur: "particuliers", cibleRole: "propriétaire" };
const texte = (e: [string, string][]) => e.map(([t, x]) => `${t} ${x}`).join("\n");

const NOTRE_PITCH = /site|maquette|appels? rat[ée]s|en ligne ne vous trouvent|Taxe d'Ignorance|couleurs, votre carte/i;

test("⚠⚠ un inscrit ne reçoit JAMAIS notre pitch (site, maquette, appels ratés)", () => {
  for (const p of [fiche(), fiche({ ignoranceTax: 800, setupValue: 990, monthlyValue: 149 })]) {
    const t = texte(etapesClosing(p, false, profil));
    assert.doesNotMatch(t, NOTRE_PITCH);
  }
});

test("⚠⚠ …il reçoit une trame sur SON profil, qui garde la méthode : démonstration AVANT l'offre", () => {
  const e = etapesClosing(fiche(), false, profil);
  const titres = e.map(([t]) => t);
  assert.ok(titres.indexOf("Démonstration") < titres.indexOf("L'offre"), "le prix arrive après la démonstration");
  assert.match(texte(e), /la pose de fenêtres sur mesure/);
  assert.match(texte(e), /MENUISERIE QUIXOTZ/);
});

test("⚠ aucun montant inventé : sans offre ni montant sur la fiche, il dit d'annoncer SON prix", () => {
  const sans = texte(etapesClosing(fiche({ setupValue: 0, monthlyValue: 0, personalizedOffer: "" }), false, profil));
  assert.doesNotMatch(sans, /€/);
  assert.match(sans, /Annonce TON prix/);
  const avec = texte(etapesClosing(fiche({ setupValue: 1200, monthlyValue: 0 }), false, profil));
  assert.match(avec, /1 ?\s?200 € une fois/);
});

test("profil vide : un trou visible, jamais notre offre à la place", () => {
  const t = texte(etapesClosing(fiche(), false, PROFIL_VIDE));
  assert.match(t, /\[ce que vous vendez\]/);
  assert.doesNotMatch(t, NOTRE_PITCH);
});

test("le maître garde son script", () => {
  assert.match(texte(etapesClosing(fiche(), true, profil)), /vous vendre un site/);
});

test("⚠ les objections à un tap d'un inscrit sont les seules dont la réponse vaut pour toute offre", () => {
  const inscrit = objectionsClosing(false);
  assert.ok(inscrit.length > 0 && inscrit.every((o) => o.universel));
  assert.doesNotMatch(inscrit.map((o) => o.counter).join(" "), /Taxe d'Ignorance|garantie de résultat/i);
  assert.ok(objectionsClosing(true).length > inscrit.length);
});

test("⚠⚠ l'écran lit le verdict PROUVÉ (pessimiste) et le module, plus de texte en dur", () => {
  const src = readFileSync(join(RACINE, "components/training/closing-mode.tsx"), "utf8");
  assert.match(src, /useMaitreProuve\(\)/);
  assert.match(src, /etapesClosing\(p, maitre, profil\)/);
  assert.doesNotMatch(src, /vous vendre un site|maquette/);
});
