import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OBJECTION_LIBRARY, OBSTACLE_LIBRARY, STAGES, ignoranceTaxTotal } from "../lib/hormozi";
import { demoDeDepart } from "../lib/demo-icp";
import { prospect } from "./fixtures";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA FICHE D'UN INSCRIT — vue au rendu le 22/10/2026, sur un serveur de
 * production en mode installation client (non maître prouvé) : notre segment
 * (« un commerce où chaque appel manqué est un client perdu »), « Brique
 * d'entrée : Alpha Voice », notre audit téléphonique, notre devis, notre deck,
 * des obstacles de NOTRE marché, et « −NaN € » dans l'en-tête.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠ « −NaN € » : une fiche sans date de création compte un mois, jamais NaN", () => {
  const sans = prospect({ ignoranceTax: 100, createdAt: undefined as unknown as string });
  assert.equal(ignoranceTaxTotal(sans), 100);
  for (const p of demoDeDepart()) assert.ok(!Number.isNaN(Date.parse(p.createdAt)), "les fiches générées portent leur date");
});

test("⚠⚠ inventaires GELÉS de ce qu'une fiche d'inscrit propose en un clic — chaque entrée relue", () => {
  assert.deepEqual(
    OBSTACLE_LIBRARY.filter((o) => o.universel).map((o) => o.label),
    [
      "« Pas le moment, c'est la haute saison »",
      "« La conjoncture est mauvaise »",
      "« Je dois en parler à mon associé »",
      "« Je suis nul avec la technologie »",
    ]
  );
  assert.deepEqual(
    OBJECTION_LIBRARY.filter((o) => o.universel).map((o) => o.label),
    ["« Je vais réfléchir »", "« Je dois valider avec le siège / la banque »"]
  );
  for (const o of OBJECTION_LIBRARY.filter((x) => x.universel)) {
    assert.doesNotMatch(o.counter, /téléphone|commerce|même secteur|chez nous|site/i, `réponse « universelle » qui parle de nous : ${o.label}`);
  }
});

test("l'étape de démonstration ne s'appelle plus « Démo mobile » (notre démonstration)", () => {
  assert.equal(STAGES.find((s) => s.id === "demo")?.label, "Démonstration");
});

test("⚠ la fiche branche le verdict PESSIMISTE dans ses trois onglets", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/prospects/[id]/page.tsx"), "utf8"));
  assert.match(src, /\{inscrit \? <OffreInscritCard profil=\{inscrit\.profil\} \/> : <SegmentCard p=\{p\} \/>\}/);
  assert.match(src, /OBSTACLE_LIBRARY\.filter\(\(o\) => \(!inscrit \|\| o\.universel\)/);
  assert.match(src, /OBJECTION_LIBRARY\.filter\(\(o\) => \(!inscrit \|\| o\.universel\)/);
  for (const composant of ["DeepdiveTools", "RecoveryProjection", "DealCalculator", "FundingEditor", "OfferRecommendation", "PreDevisPanel", "QuoteBuilder", "DeckButton"]) {
    assert.match(src, new RegExp(`\\{!inscrit && <${composant} `), `${composant} chiffre NOTRE offre : maître seul`);
  }
  assert.ok((src.match(/const inscrit = useExpediteurInscrit\(\);/g) ?? []).length >= 3, "les trois onglets lisent le verdict");
  assert.doesNotMatch(src, /Démo mobile montrée/);
});
