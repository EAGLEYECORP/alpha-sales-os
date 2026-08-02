import test from "node:test";
import assert from "node:assert/strict";
import { prospect, daysAgo } from "./fixtures";
import type { TimelineEvent } from "../lib/types";
import {
  buildOutbox,
  clipboardText,
  composeFitsInUrl,
  COMPOSE_URL_LIMIT,
  emailBody,
  emailSubject,
  gmailComposeUrl,
  mailtoUrl,
} from "../lib/mail-compose";

/**
 * L'envoi manuel touche à deux choses fragiles : une URL qui part vers
 * Gmail (donc l'échappement), et la file du jour (donc le plafond). Une
 * erreur ici, ce sont des messages tronqués ou envoyés deux fois.
 */

const draft = { to: "gerant@garage-bouchon.fr", subject: "Objet & test", body: "Bonjour,\nUne question ?" };

test("compose — l'URL Gmail encode tout ce qui casserait la requête", () => {
  const url = gmailComposeUrl(draft);
  assert.ok(url.startsWith("https://mail.google.com/mail/?"));
  // Une esperluette ou un point d'interrogation non échappé couperait le
  // message en deux : Gmail n'afficherait qu'un morceau, sans prévenir.
  assert.doesNotMatch(url.split("?")[1], /&su=Objet & test/);
  const q = new URLSearchParams(url.split("?")[1]);
  assert.equal(q.get("su"), "Objet & test");
  assert.equal(q.get("body"), "Bonjour,\nUne question ?");
  assert.equal(q.get("to"), draft.to);
  assert.equal(q.get("view"), "cm");
});

test("compose — le compte expéditeur est transmis, ou omis proprement", () => {
  const withUser = new URLSearchParams(gmailComposeUrl(draft, "eagleyecorp.ad@gmail.com").split("?")[1]);
  assert.equal(withUser.get("authuser"), "eagleyecorp.ad@gmail.com");

  // Un champ vide ne doit pas produire authuser= : Gmail choisirait mal.
  assert.equal(new URLSearchParams(gmailComposeUrl(draft, "   ").split("?")[1]).has("authuser"), false);
  assert.equal(new URLSearchParams(gmailComposeUrl(draft).split("?")[1]).has("authuser"), false);
});

test("compose — mailto encode aussi le destinataire", () => {
  const url = mailtoUrl({ ...draft, to: "a+b@test.fr" });
  assert.ok(url.startsWith("mailto:a%2Bb%40test.fr?"));
  assert.equal(new URLSearchParams(url.split("?")[1]).get("subject"), draft.subject);
});

test("compose — un message trop long est détecté AVANT d'être tronqué en silence", () => {
  const long = { ...draft, body: "x".repeat(COMPOSE_URL_LIMIT) };
  assert.equal(composeFitsInUrl(long), false);
  assert.equal(composeFitsInUrl(draft), true);
});

test("compose — le presse-papier porte l'objet, sinon il se perd", () => {
  assert.match(clipboardText(draft), /^Objet : Objet & test\n\nBonjour,/);
});

test("compose — le corps est personnalisé et porte la sortie STOP", () => {
  const p = prospect({ name: "Marc Perrin", company: "Garage Bouchon", sector: "artisan" });
  const body = emailBody(p, { closerName: "Zakaria", agencyName: "EAGLEYE CORP" });
  assert.match(body, /^Bonjour Marc,/);
  assert.match(body, /Garage Bouchon/);
  assert.match(body, /Zakaria — EAGLEYE CORP, Lyon/);
  assert.match(body, /répondez STOP/, "la sortie doit être offerte dans chaque message");
  assert.match(emailSubject(p), /Garage Bouchon/);
});

test("compose — sans prénom, on ne fabrique pas un « Bonjour undefined »", () => {
  assert.match(emailBody(prospect({ name: "" })), /^Bonjour,/);
});

test("compose — le lien de réservation n'apparaît que s'il existe", () => {
  const p = prospect();
  assert.doesNotMatch(emailBody(p), /agenda est ouvert/);
  assert.match(emailBody(p, { bookingUrl: "https://cal.com/eagleye" }), /https:\/\/cal\.com\/eagleye/);
});

// ─────────────────────────── La file du jour ───────────────────────────

const emailEvent = (daysBack: number): TimelineEvent => ({
  id: `e${daysBack}`,
  date: daysAgo(daysBack),
  kind: "email",
  summary: "envoi",
});

test("outbox — la file s'arrête au palier, jamais au-delà", () => {
  const many = Array.from({ length: 50 }, (_, i) =>
    prospect({ id: `p${i}`, email: `c${i}@test.fr` })
  );
  assert.equal(buildOutbox(many, 5).length, 5);
  assert.equal(buildOutbox(many, 0).length, 0, "palier à zéro = file vide");
});

test("outbox — les fiches sans email exploitable sont écartées", () => {
  const list = [
    prospect({ id: "ok", email: "vrai@test.fr" }),
    prospect({ id: "vide", email: "" }),
    prospect({ id: "casse", email: "pas-une-adresse" }),
    prospect({ id: "espace", email: "   " }),
  ];
  const out = buildOutbox(list, 10);
  assert.deepEqual(out.map((t) => t.prospect.id), ["ok"]);
});

test("outbox — une fiche déjà écrite AUJOURD'HUI ne revient pas", () => {
  const today = prospect({ id: "aujourdhui", email: "a@test.fr", events: [emailEvent(0)] });
  const hier = prospect({ id: "hier", email: "b@test.fr", events: [emailEvent(1)] });
  const ids = buildOutbox([today, hier], 10).map((t) => t.prospect.id);
  assert.deepEqual(ids, ["hier"], "l'anti-doublon du jour est la protection minimale");
});

test("outbox — signés et perdus ne sont pas du carburant", () => {
  const list = [
    prospect({ id: "signe", email: "a@test.fr", stage: "signe" }),
    prospect({ id: "perdu", email: "b@test.fr", stage: "perdu" }),
    prospect({ id: "actif", email: "c@test.fr", stage: "contact" }),
  ];
  assert.deepEqual(buildOutbox(list, 10).map((t) => t.prospect.id), ["actif"]);
});

test("outbox — à volume réduit, l'ordre compte : les plus chaudes d'abord", () => {
  const list = [
    prospect({ id: "froid", email: "a@test.fr", probability: 10, trust: 20 }),
    prospect({ id: "chaud", email: "b@test.fr", probability: 80, trust: 70 }),
    prospect({ id: "tiede", email: "c@test.fr", probability: 40, trust: 90 }),
  ];
  assert.deepEqual(buildOutbox(list, 2).map((t) => t.prospect.id), ["chaud", "tiede"]);
});

test("outbox — chaque cible arrive avec un brouillon prêt et une raison", () => {
  const [t] = buildOutbox([prospect({ email: "a@test.fr", company: "Garage Bouchon" })], 1);
  assert.equal(t.draft.to, "a@test.fr");
  assert.ok(t.draft.subject.length > 0);
  assert.ok(t.draft.body.length > 100);
  assert.equal(t.reason, "jamais contactée");
});
