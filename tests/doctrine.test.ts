import { test } from "node:test";
import assert from "node:assert/strict";
import { SEED_PROSPECT_IDS, DEMO_PROSPECT_IDS, isDemoProspect, seedProspects } from "../lib/seed";
import { DEFAULT_BUSINESS_RULES } from "../lib/business-rules";
import { clipDoctrine, DOCTRINE_MAX_CHARS } from "../lib/identity";
import { NUWACOM_THRESHOLD_HT } from "../lib/accounts";
import { PACK_SETUP_HT, PACK_MONTHLY_HT, OUTBOUND_TIERS } from "../lib/bricks";

// La doctrine part dans TOUTES les routes IA. Ce qui est faux ici devient une
// phrase dite à un vrai prospect — et un prix faux devient un prix annoncé.
test("doctrine — les prix cités correspondent au catalogue réel", () => {
  const r = DEFAULT_BUSINESS_RULES;
  assert.match(r, new RegExp(`${PACK_SETUP_HT.toLocaleString("fr-FR").replace(/\s| /g, "\\s")}\\s*€`), "le pack doit être au prix du catalogue");
  assert.match(r, new RegExp(`${PACK_MONTHLY_HT.toLocaleString("fr-FR").replace(/\s| /g, "\\s")}\\s*€/mois`), "le mensuel du pack doit être au prix du catalogue");

  const entry = OUTBOUND_TIERS[0];
  assert.match(r, new RegExp(`${entry.monthlyHT}\\s*€/mois`), "le palier sortant d'entrée doit être cité au bon prix");

  // Le seuil Nuwacom porte une commission : se tromper coûte de l'argent réel.
  assert.match(r, /40\s*k/, `le seuil Nuwacom (${NUWACOM_THRESHOLD_HT} €) doit apparaître dans le routage`);
});

test("doctrine — l'ancien positionnement a disparu", () => {
  const r = DEFAULT_BUSINESS_RULES.toLowerCase();
  // L'ancienne grille (site premium + overlay, 1 200–2 400 € / 190–390 €/mois)
  // et l'ancien ciblage produiraient des scripts qui vendent un produit mort.
  assert.doesNotMatch(r, /overlay ia/, "l'offre « site premium + overlay IA » n'existe plus");
  assert.doesNotMatch(r, /restaurants, pubs/, "le ciblage ne se limite plus aux commerces lyonnais");
  assert.doesNotMatch(r, /390\s*€\/mois/, "ancien mensuel");
});

test("doctrine — les règles qui engagent sont en tête, avant toute troncature", () => {
  const lines = DEFAULT_BUSINESS_RULES.split("\n");
  const head = lines.slice(0, 3).join(" ").toLowerCase();
  assert.match(head, /prix avant la démo/, "la règle du prix est la plus chère à oublier");
  assert.match(head, /art\.?\s*50|ai act/, "la divulgation IA est une obligation légale, elle ne peut pas être tronquée");
});

test("clipDoctrine — coupe sur une règle entière, jamais au milieu d'une phrase", () => {
  const clipped = clipDoctrine(DEFAULT_BUSINESS_RULES, 300);
  assert.ok(clipped.length <= 300);
  // Chaque ligne conservée doit être une règle complète du texte d'origine.
  for (const line of clipped.split("\n")) {
    assert.ok(DEFAULT_BUSINESS_RULES.includes(line), `règle mutilée : ${line}`);
  }
  assert.ok(clipped.startsWith("1. "), "on garde les règles les plus graves");
});

test("clipDoctrine — le budget par défaut laisse passer la doctrine entière", () => {
  assert.ok(DEFAULT_BUSINESS_RULES.length <= DOCTRINE_MAX_CHARS, "la doctrine livrée doit tenir sans être coupée");
  assert.equal(clipDoctrine(DEFAULT_BUSINESS_RULES), DEFAULT_BUSINESS_RULES.trim());
});

test("clipDoctrine — plutôt rien qu'un fragment de règle", () => {
  // Aucune règle entière ne tient dans 10 caractères : on n'injecte rien.
  assert.equal(clipDoctrine(DEFAULT_BUSINESS_RULES, 10), "");
  assert.equal(clipDoctrine("", 500), "");
});

test("démo — la liste de garde couvre TOUTES les fiches de démonstration", () => {
  // Une fiche de démo oubliée = un email vers une adresse inventée = un rebond
  // dur qui compte contre le domaine pendant des mois.
  for (const p of seedProspects) {
    assert.ok(isDemoProspect(p.id), `fiche de démo non protégée : ${p.id}`);
  }
  assert.equal(DEMO_PROSPECT_IDS.size, SEED_PROSPECT_IDS.length, "les deux listes doivent rester dérivées l'une de l'autre");
  assert.equal(SEED_PROSPECT_IDS.length, seedProspects.length);
});
