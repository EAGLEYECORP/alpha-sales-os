import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { raisonNeuve, AUCUNE_RAISON, FENETRE_SA_DATE_JOURS } from "../lib/raison-neuve";
import { raisonRelance } from "../lib/relance-mail";
import { etapeASaDate } from "../lib/call-outcome";
import { VERTICALS } from "../lib/playbook";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SEULE RAISON DE RELANCE QUI VAILLE POUR N'IMPORTE QUEL MÉTIER :
 * LA DATE QU'IL A DONNÉE.
 *
 * Mesuré le 21/10/2026 : depuis le 18/10, le cycle de relance était à l'arrêt.
 * La source « prix honoré » a expiré le 17/10 et n'avait jamais valu que pour
 * NOTRE grille ; l'autre (ouverture tracée) n'existe que côté serveur. Zéro
 * raison sur le jeu de démo, zéro pour tout inscrit.
 * ─────────────────────────────────────────────────────────────────────
 */

const JOUR = 86_400_000;
const SA_DATE = etapeASaDate("2026-11-16")!;
const T = Date.parse(SA_DATE.date);

/** Une fiche neutre — SANS prix périmé, sans ouverture : seule sa date peut parler. */
const fiche = (patch: Partial<Prospect> = {}): Prospect =>
  ({
    ...prospectDefaults,
    id: "f1",
    name: "Léa Vasseur",
    company: "Société test",
    sector: "autre",
    city: "",
    stage: "contact",
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    events: [{ id: "e1", date: "2026-10-22T10:00:00.000Z", kind: "appel", summary: "Appel sortant — il a décroché, à rappeler plus tard" }],
    ...patch,
  }) as Prospect;

test("etapeASaDate pose SA date, à 9 h locales, marquée comme la sienne ; une saisie invalide ne pose rien", () => {
  assert.equal(SA_DATE.demandePar, "prospect");
  const d = new Date(SA_DATE.date);
  assert.equal(d.getDate(), 16, "le jour saisi est le jour posé, quel que soit le fuseau");
  assert.equal(d.getHours(), 9);
  assert.equal(etapeASaDate(""), null);
  assert.equal(etapeASaDate("16/11/2026"), null, "pas une valeur d'<input type=date>");
});

test("⚠⚠ SA date arrivée → une raison, datée, avec sa provenance", () => {
  const r = raisonNeuve(fiche({ nextStep: SA_DATE }), T + JOUR);
  assert.ok(r, "il a fixé le moment : c'est un fait daté");
  assert.equal(r.source, "sa-date");
  assert.match(r.phrase, /16 novembre/, "la phrase rend SA date, pas la nôtre");
  assert.match(r.fait, /16\/11\/2026/);
  assert.equal(r.provenance, "lib/call-outcome.ts");
  // Elle remonte aussi à la relance automatique : c'est la même définition.
  assert.equal(raisonRelance(fiche({ nextStep: SA_DATE }), T + JOUR)?.source, "sa-date");
});

test("⚠⚠ NOTRE délai par défaut n'est JAMAIS lu comme sa demande", () => {
  const nous = { date: SA_DATE.date, action: "Rappeler — reprendre là où on s'est arrêtés" };
  assert.equal(raisonNeuve(fiche({ nextStep: nous }), T + JOUR), null, "sans `demandePar`, ce n'est pas sa parole");
});

test("hors de la fenêtre, pas de raison : trop tôt, ou trop tard pour dire « vous m'aviez dit »", () => {
  const f = fiche({ nextStep: SA_DATE });
  assert.equal(raisonNeuve(f, T - (FENETRE_SA_DATE_JOURS.avant + 1) * JOUR), null, "trop tôt");
  assert.equal(raisonNeuve(f, T + (FENETRE_SA_DATE_JOURS.apres + 1) * JOUR), null, "trop tard : ce serait un oubli de notre part");
  assert.equal(raisonNeuve(f, T - FENETRE_SA_DATE_JOURS.avant * JOUR)?.source, "sa-date", "la veille : on prépare");
});

test("⚠ SA date passe devant le prix honoré et l'ouverture : c'est lui qui a fixé le moment", () => {
  const r = raisonNeuve(fiche({ nextStep: SA_DATE }), T, { derniereOuverture: new Date(T - JOUR).toISOString() });
  assert.equal(r?.source, "sa-date");
});

test("⚠⚠ la phrase ne contient ni la formule interdite, ni un montant, ni un interdit de verticale", () => {
  const phrase = raisonNeuve(fiche({ nextStep: SA_DATE }), T)!.phrase;
  assert.doesNotMatch(phrase, /je me permets|je me permet/i);
  assert.doesNotMatch(phrase, /\d[\d\s  ]*\s*€|\beuros?\b|\bHT\b/i);
  for (const v of VERTICALS) {
    for (const i of v.forbidden ?? []) {
      if (i.motif) assert.doesNotMatch(phrase, i.motif, `verticale ${v.id} — « ${i.regle} »`);
    }
  }
  assert.match(AUCUNE_RAISON, /il te donne une date/, "l'écran dit qu'elle existe, quand il n'y a rien");
});

test("⚠ l'écran d'appels consigne SA date avec etapeASaDate — jamais une date déduite", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/appels/page.tsx"), "utf8"));
  // Ancré DANS poserSaDate : `record()` contient aussi un setNextStep, et la
  // mutation qui retirait celui-ci passait le premier motif écrit.
  assert.match(src, /const step = etapeASaDate\(jour\);\s*if \(!step\) return;\s*setNextStep\(p\.id, step\);/);
  assert.match(src, /type="date"[\s\S]{0,200}onChange=\{\(e\) => poserSaDate\(p, e\.target\.value\)\}/);
});
