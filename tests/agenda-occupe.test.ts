import { test } from "node:test";
import assert from "node:assert/strict";
import { adresseAgenda, fuseauDe, heureMuraleVersUtc, lireAgendaIcs, plageQuiGene, type Plage } from "../lib/agenda-occupe";
import { MARGE_AGENDA_MS, prochainsCreneaux } from "../lib/creneaux-rdv";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AGENDA RÉEL DE L'INSCRIT — 29/10/2026.
 *
 * Le pilote proposait trois créneaux en n'évitant que ses propres rendez-vous.
 * Ces tests partent de textes iCalendar tels que Google et Outlook les
 * publient (fuseau nommé, nom Windows, jour entier « disponible », série
 * hebdomadaire avec exception) et vont jusqu'au créneau proposé.
 * ─────────────────────────────────────────────────────────────────────
 */

const iso = (t: number) => new Date(t).toISOString();
const cal = (...evenements: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//FR", ...evenements, "END:VCALENDAR"].join("\r\n");
const ev = (...lignes: string[]) => ["BEGIN:VEVENT", ...lignes, "END:VEVENT"].join("\r\n");
/** Novembre 2026 : heure d'hiver à Paris (UTC+1). */
const FENETRE: Plage = { debut: Date.parse("2026-11-02T00:00:00Z"), fin: Date.parse("2026-11-30T00:00:00Z") };

test("une heure murale de Paris devient le bon instant UTC, été comme hiver", () => {
  assert.equal(iso(heureMuraleVersUtc(2026, 11, 3, 14, 0, 0, "Europe/Paris")), "2026-11-03T13:00:00.000Z");
  assert.equal(iso(heureMuraleVersUtc(2026, 7, 3, 14, 0, 0, "Europe/Paris")), "2026-07-03T12:00:00.000Z");
  // Le lendemain du passage à l'heure d'hiver (25/10/2026).
  assert.equal(iso(heureMuraleVersUtc(2026, 10, 26, 9, 0, 0, "Europe/Paris")), "2026-10-26T08:00:00.000Z");
});

test("Outlook écrit un nom Windows, Thunderbird un préfixe : le fuseau se retrouve", () => {
  assert.equal(fuseauDe("Romance Standard Time"), "Europe/Paris");
  assert.equal(fuseauDe("/mozilla.org/20050126_1/Europe/Paris"), "Europe/Paris");
  assert.equal(fuseauDe("Europe/Paris"), "Europe/Paris");
  assert.equal(fuseauDe("Fuseau Inventé"), null);
});

test("un événement simple, une ligne pliée, une alarme imbriquée : la plage est exacte", () => {
  const l = lireAgendaIcs(
    cal(
      ev(
        "UID:a1",
        "DTSTART;TZID=Europe/Paris:20261103T140000",
        "DTEND;TZID=Europe/Paris:20261103T153000",
        "SUMMARY:Chantier rue de la Démo — visite avec le",
        " client",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "DTSTART:20200101T000000Z",
        "END:VALARM"
      )
    ),
    FENETRE
  );
  assert.equal(l.evenements, 1);
  assert.deepEqual(l.plages.map((p) => [iso(p.debut), iso(p.fin)]), [["2026-11-03T13:00:00.000Z", "2026-11-03T14:30:00.000Z"]]);
});

test("⚠ le résultat ne porte QUE des plages : aucun titre, aucun lieu, aucun participant", () => {
  const l = lireAgendaIcs(
    cal(ev("UID:p", "DTSTART:20261104T090000Z", "DTEND:20261104T100000Z", "SUMMARY:Rendez-vous médical", "LOCATION:Cabinet", "ATTENDEE:mailto:x@exemple.invalid")),
    FENETRE
  );
  const texte = JSON.stringify(l);
  assert.doesNotMatch(texte, /médical|Cabinet|mailto|exemple/);
  assert.deepEqual(Object.keys(l.plages[0]).sort(), ["debut", "fin"]);
});

test("« disponible » et « annulé » libèrent la plage — c'est l'agenda qui le dit", () => {
  const l = lireAgendaIcs(
    cal(
      ev("UID:f", "DTSTART;VALUE=DATE:20261105", "DTEND;VALUE=DATE:20261106", "TRANSP:TRANSPARENT", "SUMMARY:Anniversaire"),
      ev("UID:c", "DTSTART:20261105T090000Z", "DTEND:20261105T100000Z", "STATUS:CANCELLED"),
      ev("UID:j", "DTSTART;VALUE=DATE:20261106", "DTEND;VALUE=DATE:20261107", "SUMMARY:Congé")
    ),
    FENETRE
  );
  assert.equal(l.ignores, 2);
  assert.deepEqual(l.plages.map((p) => [iso(p.debut), iso(p.fin)]), [["2026-11-05T23:00:00.000Z", "2026-11-06T23:00:00.000Z"]], "le jour de congé bloque toute la journée, minuit de Paris");
});

test("une série hebdomadaire se déplie, sans ses exceptions, et l'occurrence déplacée prend sa nouvelle heure", () => {
  const l = lireAgendaIcs(
    cal(
      ev(
        "UID:serie",
        "DTSTART;TZID=Europe/Paris:20261005T100000",
        "DTEND;TZID=Europe/Paris:20261005T110000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20261119T235959Z",
        "EXDATE;TZID=Europe/Paris:20261109T100000"
      ),
      ev("UID:serie", "RECURRENCE-ID;TZID=Europe/Paris:20261112T100000", "DTSTART;TZID=Europe/Paris:20261112T160000", "DTEND;TZID=Europe/Paris:20261112T170000")
    ),
    FENETRE
  );
  assert.deepEqual(
    l.plages.map((p) => iso(p.debut)),
    [
      "2026-11-02T09:00:00.000Z", // lun. 2
      "2026-11-05T09:00:00.000Z", // jeu. 5
      // lun. 9 : EXDATE
      "2026-11-12T15:00:00.000Z", // jeu. 12 déplacé à 16 h
      "2026-11-16T09:00:00.000Z", // lun. 16
      "2026-11-19T09:00:00.000Z", // jeu. 19, dernier avant UNTIL
    ]
  );
  assert.equal(l.approximes, 0);
});

test("COUNT compte depuis le DÉPART, pas depuis la fenêtre ; MONTHLY par jour ordinal", () => {
  const l = lireAgendaIcs(
    cal(
      ev("UID:n", "DTSTART:20261028T080000Z", "DURATION:PT1H", "RRULE:FREQ=DAILY;COUNT=7"),
      ev("UID:m", "DTSTART;TZID=Europe/Paris:20260904T090000", "DURATION:PT2H", "RRULE:FREQ=MONTHLY;BYDAY=1FR")
    ),
    FENETRE
  );
  const debuts = l.plages.map((p) => iso(p.debut));
  // 28/10 → 03/11 : sept occurrences, dont deux dans la fenêtre (2 et 3 nov.).
  assert.ok(debuts.includes("2026-11-02T08:00:00.000Z") && debuts.includes("2026-11-03T08:00:00.000Z"));
  assert.ok(!debuts.includes("2026-11-04T08:00:00.000Z"), "la huitième n'existe pas");
  assert.ok(debuts.includes("2026-11-06T08:00:00.000Z"), "premier vendredi de novembre, 9 h de Paris");
});

test("⚠⚠ une règle qu'on ne sait pas déplier BLOQUE chaque jour à la même heure — jamais rien", () => {
  const l = lireAgendaIcs(cal(ev("UID:x", "DTSTART:20261001T130000Z", "DTEND:20261001T140000Z", "RRULE:FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=-1")), FENETRE);
  assert.ok(l.approximes >= 1, "l'approximation se compte");
  assert.ok(l.plages.length >= 25, `trop large plutôt que trop étroit (${l.plages.length} jours bloqués)`);
  assert.ok(l.plages.every((p) => new Date(p.debut).getUTCHours() === 13));
});

test("un fuseau inconnu se lit dans celui du métier, et se compte", () => {
  const l = lireAgendaIcs(cal(ev("UID:z", "DTSTART;TZID=Fuseau Inventé:20261110T100000", "DTEND;TZID=Fuseau Inventé:20261110T110000")), FENETRE);
  assert.equal(l.approximes, 1);
  assert.equal(iso(l.plages[0].debut), "2026-11-10T09:00:00.000Z");
});

test("seule une adresse https (ou webcal) est acceptée", () => {
  assert.equal(adresseAgenda("webcal://p01-calendars.example.com/x.ics"), "https://p01-calendars.example.com/x.ics");
  assert.equal(adresseAgenda("https://calendar.example.com/private-abc/basic.ics"), "https://calendar.example.com/private-abc/basic.ics");
  assert.equal(adresseAgenda("http://calendar.example.com/basic.ics"), null, "une adresse secrète en clair n'est plus secrète");
  assert.equal(adresseAgenda("javascript:alert(1)"), null);
  assert.equal(adresseAgenda(""), null);
});

test("une plage gêne un créneau qui la chevauche ou la frôle, pas un créneau loin d'elle", () => {
  const p = [{ debut: Date.parse("2026-11-03T13:00:00Z"), fin: Date.parse("2026-11-03T14:30:00Z") }];
  const h = 3_600_000;
  assert.ok(plageQuiGene(Date.parse("2026-11-03T13:30:00Z"), h, p, MARGE_AGENDA_MS), "chevauche");
  assert.ok(plageQuiGene(Date.parse("2026-11-03T14:45:00Z"), h, p, MARGE_AGENDA_MS), "colle à la fin");
  assert.equal(plageQuiGene(Date.parse("2026-11-03T15:00:00Z"), h, p, MARGE_AGENDA_MS), null, "battement respecté");
});

test("⚠⚠ DE L'AGENDA AU CRÉNEAU PROPOSÉ : aucun des trois ne tombe sur une plage occupée", () => {
  const maintenant = new Date("2026-11-02T08:00:00Z");
  const sans = prochainsCreneaux(maintenant, { n: 3 });
  // Son agenda bloque exactement les trois créneaux qu'on aurait proposés.
  const l = lireAgendaIcs(
    cal(...sans.map((d, i) => ev(`UID:b${i}`, `DTSTART:${iso(d.getTime()).replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, "DURATION:PT2H"))),
    FENETRE
  );
  const avec = prochainsCreneaux(maintenant, { n: 3, indisponibles: l.plages, dureeMs: 45 * 60_000 });
  assert.equal(avec.length, 3);
  for (const d of avec) {
    assert.equal(plageQuiGene(d.getTime(), 45 * 60_000, l.plages, MARGE_AGENDA_MS), null, `${iso(d.getTime())} tombe sur une plage occupée`);
  }
  assert.notDeepEqual(avec.map((d) => d.getTime()), sans.map((d) => d.getTime()), "l'agenda a changé la proposition");
});

// ══════════ LA ROUTE ══════════

test("⚠⚠ /api/agenda exige un compte, et refuse une adresse qui n'est pas https", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../app/api/agenda/route");
  const appel = (url: string) =>
    POST(new NextRequest("https://alpha.example/api/agenda", { method: "POST", body: JSON.stringify({ url }) }));
  const avant = { ...process.env };
  try {
    // Comptes configurés, aucune session : personne ne fait lire un agenda par notre serveur.
    Object.assign(process.env, { SUPABASE_JWT_SECRET: "secret-de-test-hs256-0123456789abcdef", NEXT_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co" });
    delete process.env.SITE_PASSWORD;
    assert.equal((await appel("https://calendar.example.com/basic.ics")).status, 401);
  } finally {
    process.env = avant;
  }
  // En solo (développement), la forme de l'adresse est contrôlée AVANT toute requête.
  const http = await appel("http://calendar.example.com/basic.ics");
  assert.equal(http.status, 400);
  assert.equal(((await http.json()) as { etat: string }).etat, "non-lu");
});

test("⚠ l'agenda se lit par le garde-fou réseau : jamais une adresse interne", async () => {
  const { fetchCalendrier } = await import("../lib/site-fetch");
  for (const url of ["https://127.0.0.1/cal.ics", "https://localhost/cal.ics", "https://169.254.169.254/latest", "http://calendar.example.com/x.ics"]) {
    await assert.rejects(fetchCalendrier(url), /non valide|https uniquement/, url);
  }
});

test("⚠⚠ côté navigateur, tout ce qui n'est pas un « lu » bien formé est NON-LU — jamais « libre toute la semaine »", async () => {
  const { lireReponseAgenda } = await import("../lib/agenda-occupe");
  const ok = lireReponseAgenda({ etat: "lu", plages: [{ debut: "2026-11-03T13:00:00.000Z", fin: "2026-11-03T14:00:00.000Z" }], approximes: 1 }, 200);
  assert.equal(ok.etat, "lu");
  assert.equal(ok.etat === "lu" && ok.plages.length, 1);
  assert.equal(lireReponseAgenda({ etat: "lu", plages: [{ debut: "pas une date", fin: "2026-11-03T14:00:00.000Z" }] }, 200).etat, "non-lu", "une plage illisible ne disparaît pas en silence");
  assert.equal(lireReponseAgenda({ etat: "lu" }, 200).etat, "non-lu");
  assert.equal(lireReponseAgenda(null, 502).etat, "non-lu");
  const panne = lireReponseAgenda({ etat: "non-lu", raison: "Agenda injoignable (HTTP 503)." }, 200);
  assert.equal(panne.etat === "non-lu" && panne.raison, "Agenda injoignable (HTTP 503).");
});

test("le message annonce le nombre de créneaux réellement proposés — jamais « 1, 2 ou 3 » sur une liste de deux", async () => {
  const { propositionCreneaux, introRenseignement } = await import("../lib/reponses-inscrit");
  const exp = { closerName: "Julie Martin", agencyName: "Dupont Conseil SAS" };
  const deux = propositionCreneaux({ name: "Camille" }, [new Date("2026-11-04T09:00:00Z"), new Date("2026-11-05T13:00:00Z")], exp, "Une question");
  assert.match(deux.body, /deux créneaux/);
  assert.match(deux.body, /Répondez simplement 1 ou 2 /);
  assert.doesNotMatch(deux.body, /trois|1, 2 ou 3/);
  const un = propositionCreneaux({ name: "Camille" }, [new Date("2026-11-04T09:00:00Z")], exp, "Une question");
  assert.match(un.body, /voici un créneau/);
  assert.doesNotMatch(un.body, /1 ou 2|1, 2 ou 3/);
  const trois = propositionCreneaux({ name: "Camille" }, [1, 2, 3].map((j) => new Date(Date.UTC(2026, 10, 3 + j, 9))), exp, "Une question");
  assert.match(trois.body, /trois créneaux[\s\S]*Répondez simplement 1, 2 ou 3/);
  assert.match(introRenseignement({ metier: "Plomberie et chauffage." } as never, 2) ?? "", /deux créneaux :$/);
});
