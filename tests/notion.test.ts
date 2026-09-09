import { test } from "node:test";
import assert from "node:assert/strict";
import { prospectProperties, NOTION_SCHEMA, NOTION_VERSION } from "../lib/notion";
import { prospect } from "./fixtures";

test("propriétés — le format Notion est respecté type par type", () => {
  const p = prospect({
    company: "Toitures du Rhône",
    name: "Marc Perrin",
    city: "Lyon 6e",
    phone: "04 65 71 34 56",
    email: "marc@toitures.fr",
    probability: 65,
    setupValue: 3500,
    monthlyValue: 364,
    nextStep: { date: "2026-08-25T14:00:00+02:00", action: "Envoyer le devis" },
  });
  const props = prospectProperties(p) as Record<string, Record<string, unknown>>;

  // Notion refuse une propriété mal typée : le titre est un tableau de blocs,
  // pas une chaîne. C'est l'erreur qui fait échouer tout un envoi.
  assert.deepEqual(props["Société"].title, [{ text: { content: "Toitures du Rhône" } }]);
  assert.equal((props["Téléphone"] as { phone_number: string }).phone_number, "04 65 71 34 56");
  assert.equal((props["Email"] as { email: string }).email, "marc@toitures.fr");
  assert.equal((props["Probabilité"] as { number: number }).number, 65);
  assert.equal((props["Prochain pas"] as { date: { start: string } }).date.start, "2026-08-25T14:00:00+02:00");
});

test("propriétés — un champ vide devient null, pas une chaîne vide", () => {
  // Notion rejette `{ email: "" }` : il veut `null`. Un prospect sans email
  // est le cas le plus courant à l'import — donc l'échec le plus courant.
  const p = prospect({ phone: undefined, email: undefined, nextStep: null });
  const props = prospectProperties(p) as Record<string, Record<string, unknown>>;
  assert.equal(props["Téléphone"].phone_number, null);
  assert.equal(props["Email"].email, null);
  assert.equal(props["Prochain pas"].date, null);
});

test("propriétés — l'ID Alpha est toujours présent : c'est lui qui évite les doublons", () => {
  const p = prospect({ id: "p-toitures" });
  const props = prospectProperties(p) as Record<string, { rich_text: { text: { content: string } }[] }>;
  assert.equal(props["ID Alpha"].rich_text[0].text.content, "p-toitures");
  // Et il figure dans le schéma documenté, marqué comme obligatoire.
  const col = NOTION_SCHEMA.find((c) => c.name === "ID Alpha");
  assert.match(col!.note ?? "", /OBLIGATOIRE/);
});

test("propriétés — les textes longs sont coupés avant que Notion ne refuse", () => {
  const p = prospect({ company: "A".repeat(5000), nextStep: { date: "2026-08-25T14:00:00Z", action: "B".repeat(5000) } });
  const props = prospectProperties(p) as Record<string, { title?: { text: { content: string } }[]; rich_text?: { text: { content: string } }[] }>;
  assert.ok(props["Société"].title![0].text.content.length <= 200);
  assert.ok(props["Action"].rich_text![0].text.content.length <= 1900);
});

test("propriétés — ni notes libres ni transcriptions ne partent", () => {
  // Elles contiennent ce que des gens ont dit au téléphone. Les recopier dans
  // un espace partagé change qui peut les lire, sans que personne ne l'ait
  // décidé.
  const p = prospect({ notes: "Le gérant traverse un divorce, ne pas appeler le lundi." });
  const brut = JSON.stringify(prospectProperties(p));
  assert.doesNotMatch(brut, /divorce/);
  assert.doesNotMatch(brut, /Notes/);
});

test("schéma — chaque propriété envoyée est documentée, et l'inverse", () => {
  // Notion REFUSE une propriété inconnue au lieu de l'ignorer : une colonne
  // manquante fait échouer tout l'envoi avec un message peu parlant. Le
  // schéma doit donc décrire exactement ce qu'on envoie.
  const envoyees = Object.keys(prospectProperties(prospect()));
  const documentees = NOTION_SCHEMA.map((c) => c.name);
  assert.deepEqual([...envoyees].sort(), [...documentees].sort());
});

test("version d'API épinglée — Notion casse ses formats entre versions", () => {
  assert.match(NOTION_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
