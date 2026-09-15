import { test } from "node:test";
import assert from "node:assert/strict";
import { localTime, BUSINESS_TZ } from "../lib/business-hours";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MENTIONS_OBLIGATOIRES, fenetreOuverte, verifieMentions } from "../lib/conformite";
import { emailBody } from "../lib/mail-compose";
import { prospect } from "./fixtures";
import { callAllowedNow } from "../lib/voice-script";

/**
 * Ces tests valent surtout par ce qu'ils auraient attrapé.
 *
 * `getHours()` rend l'heure du PROCESSUS. En local ça ressemble à l'heure de
 * Lyon et tout paraît juste ; en production, une fonction serverless tourne
 * en UTC. La fenêtre « 9h–12h » devenait donc 11h–14h heure française :
 * l'autopilote refusait le meilleur créneau du matin et appelait en plein
 * déjeuner — celui qu'on avait explicitement décidé d'éviter. Le code disait
 * la bonne règle et faisait le contraire, sans jamais se plaindre.
 */

test("heure locale — lue dans le fuseau du métier, pas celui du serveur", () => {
  // 9h00 à Paris en été = 07:00 UTC. Un serveur en UTC y verrait 7h.
  const matin = new Date("2026-08-25T09:00:00+02:00");
  assert.equal(localTime(matin, BUSINESS_TZ).hour, 9);
  assert.equal(localTime(matin, "UTC").hour, 7);
});

test("heure locale — l'heure d'été est gérée, un décalage fixe serait faux", () => {
  // Même heure murale à Paris, de part et d'autre du changement d'heure.
  const ete = new Date("2026-08-25T10:00:00+02:00");
  const hiver = new Date("2026-01-20T10:00:00+01:00");
  assert.equal(localTime(ete, BUSINESS_TZ).hour, 10);
  assert.equal(localTime(hiver, BUSINESS_TZ).hour, 10);
});

test("heure locale — le jour de la semaine suit le fuseau", () => {
  // Lundi 00h30 à Paris = dimanche 23h30 UTC. Le week-end n'est pas le même
  // des deux côtés : c'est ce qui ferait appeler un dimanche soir.
  const lundiTot = new Date("2026-08-24T00:30:00+02:00");
  assert.equal(localTime(lundiTot, BUSINESS_TZ).weekday, 1);
  assert.equal(localTime(lundiTot, BUSINESS_TZ).weekend, false);
  assert.equal(localTime(lundiTot, "UTC").weekday, 0);
});

test("fenêtre d'appel — 9h heure de Lyon est ouverte, quel que soit le fuseau du serveur", () => {
  const neufHeuresLyon = new Date("2026-08-25T09:00:00+02:00");
  const f = fenetreOuverte(neufHeuresLyon);
  assert.equal(f.open, true, "le meilleur créneau chez les artisans ne doit pas être refusé");
  assert.equal(f.label, "Matin");
});

test("fenêtre d'appel — le déjeuner français est fermé, même vu d'UTC", () => {
  const midiLyon = new Date("2026-08-25T12:30:00+02:00");
  const f = fenetreOuverte(midiLyon);
  assert.equal(f.open, false);
  assert.match(f.label, /déjeuner/);
});

test("fenêtre d'appel — 14h à Lyon est ouverte (c'était 12h UTC, donc fermé avant)", () => {
  const f = fenetreOuverte(new Date("2026-08-25T14:00:00+02:00"));
  assert.equal(f.open, true);
  assert.equal(f.label, "Après-midi");
});

test("fenêtre d'appel — un autre fuseau se demande explicitement", () => {
  // Nuwacom se cadre sur Europe/Luxembourg : le paramètre existe pour ça.
  const t = new Date("2026-08-25T09:30:00+02:00");
  assert.equal(fenetreOuverte(t, "Europe/Luxembourg").open, true);
  // Le même instant est 07h30 à Londres — trop tôt.
  assert.equal(fenetreOuverte(t, "Europe/London").open, false);
});

test("agent vocal — même correction, mêmes bornes", () => {
  assert.equal(callAllowedNow(new Date("2026-08-25T09:00:00+02:00")).allowed, true);
  assert.equal(callAllowedNow(new Date("2026-08-25T12:30:00+02:00")).allowed, false);
  assert.equal(callAllowedNow(new Date("2026-08-25T19:00:00+02:00")).allowed, false);
  // Dimanche à Lyon, quelle que soit l'heure.
  assert.equal(callAllowedNow(new Date("2026-08-23T10:00:00+02:00")).allowed, false);
});

test("week-end — samedi et dimanche sont fermés des deux côtés", () => {
  assert.equal(fenetreOuverte(new Date("2026-08-22T10:00:00+02:00")).open, false); // samedi
  assert.equal(fenetreOuverte(new Date("2026-08-23T10:00:00+02:00")).open, false); // dimanche
  assert.equal(fenetreOuverte(new Date("2026-08-24T10:00:00+02:00")).open, true); // lundi
});

test("conformité — les DEUX chemins d'envoi portent le moyen de refus", () => {
  /**
   * `verifieMentions` existait depuis longtemps et n'était appelé NULLE PART.
   * Un contrôle de conformité que rien n'exécute ne protège de rien.
   *
   * Le brancher au runtime aurait coûté un appel par email pour vérifier une
   * ligne qui est DANS le gabarit. Le vrai risque n'est pas qu'un message
   * l'oublie aujourd'hui — c'est qu'on modifie un gabarit demain et qu'on la
   * supprime sans s'en apercevoir. C'est donc ici que le contrôle doit vivre.
   *
   * Les deux chemins comptent, et ils sont différents :
   *  · `emailBody` — l'opérateur colle dans Gmail et envoie de sa main ;
   *  · `email-html` — l'envoi automatique par SMTP.
   * Un seul des deux couvert laisserait une moitié des envois en faute.
   */
  const closer = "Zakaria Tazi";
  const agence = "EAGLEYE CORP";

  const manuel = emailBody(prospect({ company: "Test SARL" }), { closerName: closer, agencyName: agence });
  assert.deepEqual(
    verifieMentions(manuel, closer, agence, "suivant"),
    [],
    "le chemin MANUEL (Gmail / presse-papier) perd ses mentions obligatoires"
  );

  // Le gabarit HTML porte la ligne en dur : on la cherche dans le fichier,
  // parce que le rendu dépend de trop de réglages pour être reconstitué ici.
  const html = readFileSync(join(process.cwd(), "lib/email-html.ts"), "utf8");
  assert.match(html, /STOP/, "le gabarit HTML a perdu son moyen de refus");
  /**
   * ⚠ CE GARDE A MORDU LE 15/09/2026, et il avait raison de mordre : une
   * quatrième mention est entrée (la provenance de l'adresse, au PREMIER
   * message). Il demandait « vérifier que les gabarits suivent » — voici la
   * vérification, et sa réponse n'est pas celle qu'on attendait.
   *
   * ⚠⚠ **LA QUATRIÈME NE PEUT PAS VIVRE DANS UN GABARIT**, et ce n'est pas un
   * oubli. Les trois premières sont invariantes (qui écrit, sur quel sujet,
   * comment refuser) : un gabarit les porte une fois pour toutes. La
   * provenance, elle, CHANGE d'une fiche à l'autre — écrire « registre
   * public » en dur dans le gabarit mettrait cette phrase sur une adresse
   * prise ailleurs, c'est-à-dire une information FAUSSE. Or informer faux est
   * pire que ne pas informer : ça fabrique la preuve qu'on a menti.
   *
   * Elle se vérifie donc au RUNTIME, dans `/api/send`, sur le message réel —
   * pas ici sur un gabarit. Les gardes sont dans `tests/mentions-envoi`.
   */
  assert.ok(
    MENTIONS_OBLIGATOIRES.length === 4,
    "la liste des mentions a changé — vérifier que les gabarits suivent avant de toucher à ce test"
  );
  assert.ok(
    MENTIONS_OBLIGATOIRES.some((m) => /PREMIER message/.test(m)),
    "la mention de provenance doit rester annoncée comme CONDITIONNELLE : rendue inconditionnelle, elle refuserait toute relance licite"
  );
  /**
   * Et le contre-test qui protège les trois autres : elles restent
   * inconditionnelles. Si l'une d'elles devenait « premier message
   * seulement », un message de relance pourrait partir sans moyen de refus —
   * la seule mention qui n'est jamais négociable.
   */
  assert.equal(
    MENTIONS_OBLIGATOIRES.filter((m) => /PREMIER message/.test(m)).length,
    1,
    "une seule mention est conditionnelle ; les trois autres valent dans CHAQUE message"
  );
});
