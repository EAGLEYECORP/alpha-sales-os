import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateLeak, verticalForProspect, verticalForSector, VERTICALS } from "../lib/playbook";
import { proofStats } from "../lib/proof";
import { RAMP_START } from "../lib/email-ramp";
import { buildDailyPlan, touchesToday, EMAIL_DAILY_SAFE, CALL_DAILY_SAFE } from "../lib/daily-plan";
import { heat, heatTone } from "../lib/closer";
import { LINKEDIN_DAILY_SAFE } from "../lib/linkedin";
import { prospect, daysAgo, todayAt } from "./fixtures";

/* ────────────────────────────────────────────────────────────────────
   Les fonctions qui portent l'argent. Si l'une d'elles ment, on annonce
   un faux chiffre à un prospect ou on facture à côté.
   ──────────────────────────────────────────────────────────────────── */

test("estimateLeak — le calcul de la fuite est celui annoncé au prospect", () => {
  const carrosserie = VERTICALS.find((v) => v.id === "garage-carrosserie")!;
  const l = estimateLeak(carrosserie);
  // 160 appels × 25 % manqués = 40 ; 40 × 700 € × 18 % = 5 040 €/mois.
  // Chiffre repris tel quel du deep-dive terrain d'origine.
  assert.equal(l.missedPerMonth, 40);
  assert.equal(l.monthly, 5040);
  assert.match(l.basis, /160 appels\/mois/);
});

test("estimateLeak — cohérent sur toutes les verticales, jamais négatif", () => {
  for (const v of VERTICALS) {
    const l = estimateLeak(v);
    assert.ok(l.monthly > 0, `${v.id} : fuite nulle ou négative`);
    assert.ok(l.missedPerMonth > 0, `${v.id} : appels manqués nuls`);
    assert.equal(l.missedPerMonth, Math.round(v.leak.callsPerMonth * v.leak.missRate));
  }
});

test("playbook — chaque secteur de l'app tombe dans une verticale", () => {
  for (const s of ["restaurant", "pub", "ambulance", "artisan", "autre"] as const) {
    assert.ok(verticalForSector(s), `secteur ${s} sans verticale`);
  }
});

test("playbook — les mots-clés de la fiche priment sur le secteur", () => {
  assert.equal(verticalForProspect(prospect({ sector: "autre", notes: "agence immobilière, mandats" }))?.id, "immobilier");
  assert.equal(verticalForProspect(prospect({ sector: "autre", notes: "auto-école, permis B" }))?.id, "auto-ecole");
  assert.equal(verticalForProspect(prospect({ sector: "autre", notes: "carrosserie peinture" }))?.id, "garage-carrosserie");
  assert.equal(verticalForProspect(prospect({ sector: "autre", notes: "cabinet dentaire" }))?.id, "sante-cabinet");
  // Sans mot-clé, on retombe sur le secteur.
  assert.equal(verticalForProspect(prospect({ sector: "pub", notes: "" }))?.id, "bar-pub");
});

test("proofStats — n'additionne que les paiements réellement encaissés", () => {
  const s = proofStats(
    [
      prospect({
        id: "a",
        stage: "signe",
        ignoranceTax: 1500,
        contract: { status: "signe", signedAt: daysAgo(10) },
        events: [{ id: "e", date: daysAgo(40), kind: "appel", summary: "1er contact" }],
        payments: [
          { id: "p1", label: "setup", amount: 1200, dueDate: daysAgo(5), status: "paye" },
          { id: "p2", label: "M1", amount: 190, dueDate: daysAgo(1), status: "en-attente" },
          { id: "p3", label: "M2", amount: 190, dueDate: daysAgo(0), status: "retard" },
        ],
      }),
      prospect({ id: "b", stage: "perdu" }),
    ],
    [],
    30
  );
  assert.equal(s.encaisse, 1200, "seuls les « payé » comptent");
  assert.equal(s.enAttente, 380, "en-attente + retard");
  assert.equal(s.commission, 360, "30 % de 1200");
  assert.equal(s.taxeRendueMensuelle, 1500, "taxe des signés uniquement");
  assert.equal(s.signes, 1);
  assert.equal(s.perdus, 1);
  assert.equal(s.closingRate, 50);
  assert.equal(s.cycleJours, 30, "1er contact J-40 → signature J-10");
});

test("proofStats — aucune issue tranchée : pas de taux inventé", () => {
  const s = proofStats([prospect({ stage: "contact" })], [], 30);
  assert.equal(s.closingRate, null, "un taux sans issue serait un mensonge");
  assert.equal(s.cycleJours, null);
  assert.equal(s.encaisse, 0);
});

test("proofStats — ne compte que les vraies touches, pas les notes", () => {
  const s = proofStats(
    [
      prospect({
        events: [
          { id: "1", date: daysAgo(1), kind: "appel", summary: "" },
          { id: "2", date: daysAgo(1), kind: "email", summary: "" },
          { id: "3", date: daysAgo(1), kind: "linkedin", summary: "" },
          { id: "4", date: daysAgo(1), kind: "note", summary: "" },
          { id: "5", date: daysAgo(1), kind: "stage", summary: "" },
        ],
      }),
    ],
    [],
    30
  );
  assert.equal(s.touchesTotal, 3, "note et stage ne sont pas des touches");
  assert.equal(s.touches.appel, 1);
  assert.equal(s.touches.email, 1);
  assert.equal(s.touches.linkedin, 1);
});

test("touchesToday — ne compte que la journée en cours", () => {
  const p = prospect({
    events: [
      { id: "1", date: todayAt(9), kind: "appel", summary: "" },
      { id: "2", date: todayAt(11), kind: "email", summary: "" },
      { id: "3", date: daysAgo(1), kind: "appel", summary: "" },
      { id: "4", date: todayAt(14), kind: "note", summary: "" },
    ],
  });
  assert.equal(touchesToday([p]), 2);
});

test("buildDailyPlan — les plafonds ne sont jamais dépassés", () => {
  // 200 fiches disponibles : largement au-dessus de tous les plafonds.
  const many = Array.from({ length: 200 }, (_, i) =>
    prospect({ id: `p${i}`, email: `c${i}@test.fr`, stage: "contact" })
  );
  const plan = buildDailyPlan(many, 60);
  for (const c of plan.channels) {
    assert.ok(c.todo <= c.capacity, `${c.label} : ${c.todo} > plafond ${c.capacity}`);
  }
  assert.equal(plan.channels.find((c) => c.id === "linkedin")!.capacity, LINKEDIN_DAILY_SAFE);
  assert.equal(plan.channels.find((c) => c.id === "appel")!.capacity, CALL_DAILY_SAFE);
  // L'email n'a pas de plafond fixe : il suit la montée en charge réelle de
  // la boîte. Ici aucun envoi n'a jamais été consigné, donc palier de départ.
  assert.equal(plan.channels.find((c) => c.id === "email")!.capacity, RAMP_START);
  assert.ok(RAMP_START < EMAIL_DAILY_SAFE, "le palier de départ reste sous le plafond de croisière");
});

test("buildDailyPlan — le plafond restant décroît avec ce qui est déjà fait", () => {
  const fiches = Array.from({ length: 60 }, (_, i) =>
    prospect({
      id: `p${i}`,
      email: `c${i}@test.fr`,
      // 10 emails déjà envoyés aujourd'hui sur les 10 premières fiches
      events: i < 10 ? [{ id: `e${i}`, date: todayAt(9), kind: "email", summary: "" }] : [],
    })
  );
  const plan = buildDailyPlan(fiches, 60);
  const email = plan.channels.find((c) => c.id === "email")!;
  assert.equal(email.done, 10);
  // Le premier envoi datant d'aujourd'hui, la boîte est au palier de départ.
  // Dix envois déjà partis dépassent déjà ce palier : il ne reste rien, et
  // l'app ne doit surtout pas en proposer davantage.
  assert.equal(email.capacity, RAMP_START);
  assert.equal(email.todo, 0, "au-delà du palier du jour, on n'en propose plus");
});

test("buildDailyPlan — un pipe vide dit que l'objectif est hors de portée", () => {
  const plan = buildDailyPlan([], 60);
  assert.equal(plan.fuel, 0);
  assert.equal(plan.todo, 0);
  assert.equal(plan.reachable, false, "sans carburant, on ne promet pas l'objectif");
});

test("buildDailyPlan — les fiches signées et perdues ne sont pas du carburant", () => {
  const plan = buildDailyPlan(
    [
      prospect({ id: "a", stage: "signe" }),
      prospect({ id: "b", stage: "perdu" }),
      prospect({ id: "c", stage: "contact" }),
    ],
    60
  );
  assert.equal(plan.fuel, 1);
});

test("heat — bornée 0–100 et ordonnée par probabilité puis confiance", () => {
  const froid = heat(prospect({ probability: 0, trust: 0, likeness: 0 }));
  const chaud = heat(prospect({ probability: 100, trust: 100, likeness: 100 }));
  assert.equal(froid, 0);
  assert.equal(chaud, 100);
  // 0.45×80 + 0.35×60 + 0.20×50 = 36 + 21 + 10 = 67
  assert.equal(heat(prospect({ probability: 80, trust: 60, likeness: 50 })), 67);
  assert.equal(heatTone(85), "green");
  assert.equal(heatTone(70), "amber");
  assert.equal(heatTone(40), "red");
});
