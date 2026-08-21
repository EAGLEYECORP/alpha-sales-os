import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLive, durationSec, formatDuration, transcriptText, conversationContext,
  extractInsights, liveSessions, type CallSession,
} from "../lib/call-log";

const T0 = "2026-08-21T09:00:00.000Z";
const NOW = new Date("2026-08-21T09:05:00.000Z");
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();

function session(over: Partial<CallSession> = {}): CallSession {
  return {
    id: "s1",
    room: "inbound_abc",
    direction: "entrant",
    startedAt: T0,
    state: "en-cours",
    turns: [],
    ...over,
  };
}

test("call-log — une session récente est vivante, une session terminée ne l'est pas", () => {
  assert.equal(isLive(session({ turns: [{ at: at(4), speaker: "agent", text: "bonjour" }] }), NOW), true);
  assert.equal(isLive(session({ state: "terminee" }), NOW), false);
});

test("call-log — une session « en cours » trop vieille n'est plus affichée comme vivante", () => {
  // Agent crashé : la fin n'est jamais arrivée. On ne ment pas à l'écran.
  const zombie = session({ startedAt: "2026-08-21T07:00:00.000Z" });
  assert.equal(isLive(zombie, NOW), false);
});

test("call-log — durée et format", () => {
  assert.equal(durationSec(session({ endedAt: at(2) })), 120);
  assert.equal(durationSec(session(), NOW), 300); // en cours = depuis le début
  assert.equal(formatDuration(125), "2:05");
});

test("call-log — la transcription se relit avec les locuteurs nommés", () => {
  const s = session({
    turns: [
      { at: at(0), speaker: "agent", text: "Bonjour, je suis Alpha." },
      { at: at(1), speaker: "prospect", text: "Oui bonjour." },
    ],
  });
  const txt = transcriptText(s);
  assert.match(txt, /^Alpha : Bonjour/m);
  assert.match(txt, /^Prospect : Oui bonjour/m);
});

test("call-log — le contexte garde les appels RÉCENTS d'abord et respecte la limite", () => {
  const vieux = session({ id: "old", startedAt: "2026-08-01T09:00:00.000Z", turns: [{ at: at(0), speaker: "prospect", text: "vieux propos" }] });
  const recent = session({ id: "new", startedAt: "2026-08-20T09:00:00.000Z", turns: [{ at: at(0), speaker: "prospect", text: "propos récent" }] });
  const ctx = conversationContext([vieux, recent]);
  assert.ok(ctx.indexOf("propos récent") < ctx.indexOf("vieux propos"), "le récent passe devant");

  // Limite serrée : on coupe le vieux, jamais le récent.
  const court = conversationContext([vieux, recent], 90);
  assert.match(court, /propos récent/);
  assert.doesNotMatch(court, /vieux propos/);
});

test("call-log — on extrait ce que LUI dit, pas ce que l'agent dit", () => {
  const s = session({
    turns: [
      { at: at(0), speaker: "agent", text: "C'est trop cher ? Je comprends." },
      { at: at(1), speaker: "prospect", text: "Franchement c'est trop cher pour nous." },
      { at: at(2), speaker: "prospect", text: "Rappelez-moi en septembre." },
      { at: at(3), speaker: "prospect", text: "On rate des appels tous les jours." },
    ],
  });
  const ins = extractInsights(s);
  const kinds = ins.map((i) => i.kind);
  assert.ok(kinds.includes("objection"));
  assert.ok(kinds.includes("delai"));
  assert.ok(kinds.includes("besoin"));
  // La phrase de l'AGENT ne doit jamais devenir une objection du prospect.
  assert.equal(ins.some((i) => /Je comprends/.test(i.quote)), false);
});

test("call-log — les sessions vivantes sortent triées, les mortes sont exclues", () => {
  const live1 = session({ id: "a", startedAt: at(1), turns: [{ at: at(4), speaker: "agent", text: "…" }] });
  const live2 = session({ id: "b", startedAt: at(3), turns: [{ at: at(4), speaker: "agent", text: "…" }] });
  const dead = session({ id: "c", state: "terminee" });
  const out = liveSessions([live1, dead, live2], NOW);
  assert.deepEqual(out.map((s) => s.id), ["b", "a"]);
});
