import { test } from "node:test";
import assert from "node:assert/strict";
import { icsDate, icsEscape, foldLine, icsEvent, icsCalendar, meetingToIcs } from "../lib/ics";
import { meeting, prospect } from "./fixtures";

test("horodatage — toujours en UTC, format compact", () => {
  assert.equal(icsDate("2026-08-25T14:00:00+02:00"), "20260825T120000Z");
  assert.equal(icsDate("2026-01-20T09:30:00Z"), "20260120T093000Z");
  // Une date invalide doit JETER, pas produire « NaN » dans un fichier que
  // l'agenda rejettera sans rien expliquer.
  assert.throws(() => icsDate("pas une date"), /Date invalide/);
});

test("échappement — l'ordre des remplacements n'est pas négociable", () => {
  // La barre oblique inverse en premier, sinon on ré-échappe celles qu'on
  // vient d'introduire.
  assert.equal(icsEscape("a\\b"), "a\\\\b");
  assert.equal(icsEscape("Toitures, Rhône & Fils"), "Toitures\\, Rhône & Fils");
  assert.equal(icsEscape("a;b"), "a\\;b");
  assert.equal(icsEscape("ligne1\nligne2"), "ligne1\\nligne2");
  assert.equal(icsEscape("ligne1\r\nligne2"), "ligne1\\nligne2");
});

test("pliage — à 75 OCTETS, jamais au milieu d'un caractère", () => {
  // « é » pèse deux octets en UTF-8 : plier en comptant les caractères
  // couperait une séquence en deux, et certains agendas rejettent alors le
  // fichier entier.
  const accents = "é".repeat(60);
  const plie = foldLine(`SUMMARY:${accents}`);
  for (const l of plie.split("\r\n")) {
    assert.ok(new TextEncoder().encode(l).length <= 75, `ligne de ${new TextEncoder().encode(l).length} octets`);
  }
  // Le contenu doit survivre au dépliage.
  assert.equal(plie.split("\r\n ").join(""), `SUMMARY:${accents}`);
  // Une ligne courte n'est pas touchée.
  assert.equal(foldLine("UID:abc"), "UID:abc");
});

test("événement — les champs qui font qu'un agenda l'accepte", () => {
  const e = icsEvent(
    { uid: "m1@alpha", start: "2026-08-25T14:00:00+02:00", durationMin: 45, title: "Audit sur place" },
    new Date("2026-08-22T10:00:00Z")
  );
  assert.match(e, /^BEGIN:VEVENT\r\n/);
  assert.match(e, /\r\nEND:VEVENT$/);
  assert.match(e, /UID:m1@alpha/);
  // DTSTAMP est obligatoire : sans lui, la plupart des agendas refusent.
  assert.match(e, /DTSTAMP:20260822T100000Z/);
  assert.match(e, /DTSTART:20260825T120000Z/);
  // 14h00 + 45 min = 14h45 Paris = 12h45 UTC.
  assert.match(e, /DTEND:20260825T124500Z/);
  assert.match(e, /STATUS:CONFIRMED/);
});

test("événement — un rendez-vous annulé est POUSSÉ comme annulé", () => {
  // Le retirer du flux le laisserait affiché dans l'agenda de l'abonné : un
  // rendez-vous fantôme est pire que pas de synchro du tout.
  const e = icsEvent({ uid: "x", start: "2026-08-25T14:00:00Z", durationMin: 30, title: "Annulé", cancelled: true });
  assert.match(e, /STATUS:CANCELLED/);
});

test("événement — le rappel est une VALARM avec un déclencheur négatif", () => {
  const e = icsEvent({ uid: "x", start: "2026-08-25T14:00:00Z", durationMin: 30, title: "T", alarmMin: 30 });
  assert.match(e, /BEGIN:VALARM/);
  assert.match(e, /TRIGGER:-PT30M/);
  assert.match(e, /ACTION:DISPLAY/);
  // Zéro ou absent : pas d'alarme du tout.
  assert.doesNotMatch(icsEvent({ uid: "x", start: "2026-08-25T14:00:00Z", durationMin: 30, title: "T" }), /VALARM/);
});

test("calendrier — PUBLISH, pas REQUEST", () => {
  const cal = icsCalendar([icsEvent({ uid: "x", start: "2026-08-25T14:00:00Z", durationMin: 30, title: "T" })]);
  // REQUEST déclencherait des réponses « accepté / refusé » vers une adresse
  // d'organisateur qui n'existe pas.
  assert.match(cal, /METHOD:PUBLISH/);
  assert.doesNotMatch(cal, /METHOD:REQUEST/);
  assert.match(cal, /^BEGIN:VCALENDAR\r\n/);
  assert.match(cal, /\r\nEND:VCALENDAR$/);
  assert.match(cal, /VERSION:2\.0/);
  // Toutes les lignes se terminent par CRLF — la RFC l'exige, et Outlook
  // est le plus strict là-dessus.
  assert.ok(!/[^\r]\n/.test(cal), "aucun saut de ligne isolé");
});

test("rendez-vous — l'UID est stable, sinon chaque rafraîchissement crée un doublon", () => {
  const m = meeting({ id: "m-42", title: "Cadrage", date: "2026-08-25T14:00:00+02:00", durationMin: 30 });
  const a = meetingToIcs(m);
  const b = meetingToIcs({ ...m, title: "Cadrage (déplacé)" });
  const uid = (s: string) => s.match(/UID:(.+)/)![1];
  assert.equal(uid(a), uid(b));
  assert.match(uid(a), /^m-42@alpha-sales-os/);
});

test("rendez-vous — la description porte de quoi préparer depuis un téléphone", () => {
  const p = prospect({ company: "Toitures du Rhône", name: "Marc Perrin", phone: "04 78 12 34 56" });
  const m = meeting({ id: "m-1", title: "Audit", date: "2026-08-25T14:00:00+02:00", location: "Lyon 6e" });
  const e = meetingToIcs(m, p, "https://alphasalesos.vercel.app");

  assert.match(e, /Toitures du Rhône/);
  assert.match(e, /Marc Perrin/);
  assert.match(e, /04 78 12 34 56/);
  // Le lien vers la fiche : c'est lui qui transforme une ligne d'agenda en
  // préparation d'entretien, en salle d'attente.
  assert.match(e, new RegExp(`prospects/${p.id}`));
  assert.match(e, /LOCATION:Lyon 6e/);
});

test("rendez-vous — un lien visio devient le lieu ET l'URL", () => {
  const m = meeting({ id: "m-2", title: "Visio", date: "2026-08-25T14:00:00Z", calLink: "https://meet.google.com/abc-defg-hij" });
  const e = meetingToIcs(m);
  // Sur mobile, le lieu est ce qu'on tape : y mettre le lien le rend cliquable.
  assert.match(e, /LOCATION:https:\/\/meet\.google\.com/);
  assert.match(e, /URL:https:\/\/meet\.google\.com/);
});
