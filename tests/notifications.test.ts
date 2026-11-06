import test from "node:test";
import assert from "node:assert/strict";
import { bilanDuJour, fusionner, nonLues, notifsDuJournal, notifsDuSuivi } from "../lib/notifications";
import type { EntreeJournal } from "../lib/autopilote-inscrit";

/**
 * Le fil des notifications (06/11/2026) : il TRADUIT le journal du pilote et le
 * suivi d'ouvertures, il ne décide rien. Mesuré le jour même : 5 messages
 * partis, 3 ouverts, et l'utilisateur concluait « rien n'est parti » faute de
 * les voir quelque part.
 */

const suivi = [
  { id: "m1", subject: "ENTREPRISE A (DÉMO) — une question", createdAt: "2026-11-06T08:05:00Z", opens: 2, clicks: 0, lastOpenAt: "2026-11-06T09:28:00Z" },
  { id: "m2", subject: "ENTREPRISE B (DÉMO) — une question", createdAt: "2026-11-06T08:10:00Z", opens: 0, clicks: 1, lastClickAt: "2026-11-06T10:00:00Z" },
];

test("⚠⚠ chaque message parti se voit, avec ses ouvertures et ses clics", () => {
  const n = notifsDuSuivi(suivi);
  assert.equal(n.filter((x) => x.genre === "envoi").length, 2);
  const ouv = n.find((x) => x.genre === "ouverture")!;
  assert.match(ouv.titre, /Ouvert 2 fois/);
  assert.match(ouv.detail ?? "", /Indicatif/, "une ouverture n'est pas une lecture, et l'écran le dit");
  assert.equal(n.find((x) => x.genre === "clic")?.important, true);
});

test("une ouverture unique n'est pas importante ; une ouverture répétée l'est", () => {
  const une = notifsDuSuivi([{ ...suivi[0], opens: 1 }]).find((x) => x.genre === "ouverture")!;
  assert.equal(une.important, false);
  assert.equal(notifsDuSuivi(suivi).find((x) => x.genre === "ouverture")!.important, true);
});

const journal: EntreeJournal[] = [
  { le: "2026-11-06T10:15:00Z", type: "lit", texte: "Réponses non lues : l'hébergeur refuse la lecture." },
  { le: "2026-11-06T10:12:00Z", type: "rdv", texte: "Rendez-vous posé avec ENTREPRISE A (DÉMO)." },
  { le: "2026-11-06T10:10:00Z", type: "lit", texte: "Réponses non lues : l'hébergeur refuse la lecture." },
  { le: "2026-11-06T10:05:00Z", type: "ecrit", texte: "Premier message envoyé à ENTREPRISE C (DÉMO)." },
  { le: "2026-11-06T10:00:00Z", type: "lit", texte: "Réponses non lues : l'hébergeur refuse la lecture." },
];

test("⚠ une panne redite à chaque passage ne fait qu'UNE notification, avec son nombre", () => {
  const n = notifsDuJournal(journal);
  const pannes = n.filter((x) => x.titre.startsWith("Réponses non lues"));
  assert.equal(pannes.length, 1);
  assert.equal(pannes[0].quand, "2026-11-06T10:15:00Z", "la plus récente");
  assert.match(pannes[0].detail ?? "", /Répété 3 fois/);
});

test("un rendez-vous est important ; un envoi du journal n'est pas compté deux fois quand le suivi est lu", () => {
  assert.equal(notifsDuJournal(journal).find((x) => x.genre === "rdv")?.important, true);
  assert.equal(notifsDuJournal(journal, { sansEnvois: true }).some((x) => x.genre === "envoi"), false);
  assert.equal(notifsDuJournal(journal).some((x) => x.genre === "envoi"), true, "sans suivi, l'envoi vient du journal");
});

test("le fil : le plus récent en tête, sans doublon ; les non-lues se comptent depuis la dernière visite", () => {
  const f = fusionner([notifsDuSuivi(suivi), notifsDuJournal(journal, { sansEnvois: true }), notifsDuSuivi(suivi)]);
  assert.equal(new Set(f.map((x) => x.id)).size, f.length);
  assert.deepEqual([...f].sort((a, b) => b.quand.localeCompare(a.quand)), f);
  assert.equal(nonLues(f, null), f.length);
  assert.equal(nonLues(f, "2026-11-06T10:01:00Z"), f.filter((x) => x.quand > "2026-11-06T10:01:00Z").length);
  const b = bilanDuJour(f, "2026-11-06");
  assert.deepEqual([b.envois, b.ouvertures, b.clics, b.rdv], [2, 1, 1, 1]);
});
