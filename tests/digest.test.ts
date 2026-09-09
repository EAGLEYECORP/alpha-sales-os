import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrgentDigest } from "../lib/digest";
import { csvToProspects } from "../lib/csv";
import { verticalForProspect } from "../lib/playbook";
import type { Meeting, Prospect } from "../lib/types";
import { prospectDefaults } from "../lib/seed";

const NOW = new Date("2026-08-07T08:00:00");
const iso = (dayOffset: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};

function fiche(over: Partial<Prospect>): Prospect {
  return {
    ...prospectDefaults,
    id: over.id ?? "p",
    company: over.company ?? "Test",
    city: "Lyon",
    events: [],
    objections: [],
    obstacles: [],
    nextStep: null,
    probability: 50,
    monthlyValue: 0,
    setupValue: 990,
    createdAt: "",
    updatedAt: "",
    ...over,
  } as Prospect;
}

test("buildUrgentDigest — vide quand rien n'est critique", () => {
  const d = buildUrgentDigest([fiche({ stage: "prospect", nextStep: null, events: [] })], [], NOW);
  assert.equal(d.count, 0);
  assert.match(d.sms, /rien de critique/i);
});

test("buildUrgentDigest — une étape EN RETARD sur un deal avancé remonte en critique", () => {
  const p = fiche({
    id: "a",
    company: "Garage du Parc",
    stage: "offre",
    monthlyValue: 300,
    setupValue: 990,
    nextStep: { date: iso(-2), action: "Rappeler pour la décision" },
    events: [{ id: "e1", date: iso(-2), kind: "appel", summary: "relance" }],
  });
  const d = buildUrgentDigest([p], [], NOW);
  assert.ok(d.count >= 1, "au moins une tâche critique");
  assert.match(d.sms, /Garage du Parc/);
  assert.ok(d.sms.length <= 600, "le SMS reste court");
  assert.ok(d.emailBody.length > d.sms.length, "l'email développe le pourquoi");
});

test("buildUrgentDigest — un RDV aujourd'hui est toujours critique", () => {
  const p = fiche({ id: "b", company: "Vauban", stage: "demo", monthlyValue: 200, setupValue: 990 });
  const m: Meeting = { id: "m1", prospectId: "b", title: "Démo Vauban", date: iso(0), channel: "physique", done: false } as Meeting;
  const d = buildUrgentDigest([p], [m], NOW);
  assert.ok(d.count >= 1);
  assert.match(d.sms, /Vauban/);
  assert.ok(d.value >= 0);
});

test("CSV — un métier hors enum (auto-école, immobilier) garde sa verticale via les notes", () => {
  const csv = [
    "company;sector;city;phone;notes",
    '"Auto-École Rive Gauche";auto-école;Lyon 7;04 65 71 11 22;"moniteur souvent en leçon"',
    '"Régie du Centre";immobilier;Lyon 2;04 65 71 00 00;""',
    '"Plomberie Éclair";plombier;Villeurbanne;06 39 98 56 78;""',
  ].join("\n");
  const { prospects } = csvToProspects(csv);
  const byName = (n: string) => prospects.find((p) => p.company.includes(n))!;
  assert.equal(verticalForProspect(byName("Auto-École"))?.id, "auto-ecole");
  assert.equal(verticalForProspect(byName("Régie"))?.id, "immobilier");
  assert.equal(verticalForProspect(byName("Plomberie"))?.id, "artisan-batiment");
});
