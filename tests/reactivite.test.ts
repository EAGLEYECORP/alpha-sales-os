import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELAI_SCANNER_MS,
  ENVOIS_MIN_POUR_CONCLURE,
  FENETRE_CHAUDE_H,
  lireReactivite,
  type EnvoiSuivi,
} from "../lib/reactivite";
import { masterRappel } from "../lib/master-rappel";
import { prospect } from "./fixtures";
import type { TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le quatrième maillon : l'ouverture et le clic reviennent dans le plan.
 *
 * Ce qui est protégé ici, dans l'ordre d'importance :
 *  1. « il ouvre » et « il ignore » ne produisent PLUS le même plan ;
 *  2. l'absence de données reste un angle mort déclaré, jamais un « il
 *     n'ouvre pas » supposé ;
 *  3. chaque phrase porte la réserve qui va avec — un taux d'ouverture est
 *     un plancher, pas une mesure.
 * ─────────────────────────────────────────────────────────────────────
 */

const T0 = "2026-08-20T09:00:00.000Z";
const NOW = new Date("2026-08-20T12:00:00.000Z");
const plus = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();

const envoi = (over: Partial<EnvoiSuivi> = {}): EnvoiSuivi => ({
  createdAt: T0,
  opens: 0,
  clicks: 0,
  ...over,
});

test("aucun envoi tracé : angle mort déclaré, pas une conclusion", () => {
  const r = lireReactivite([], NOW);
  assert.equal(r.lecture, "aucune-donnee");
  assert.equal(r.conseil, null, "sans donnée, aucun conseil — c'est le point");
  assert.match(r.phrase, /angle mort/i);
  assert.ok(!/ignore/i.test(r.phrase.replace(/n'est pas « il ignore »/i, "")), "on ne conclut pas à l'indifférence");
});

test("des envois sans ouverture : c'est un PLANCHER, et la phrase le dit", () => {
  const r = lireReactivite(Array.from({ length: ENVOIS_MIN_POUR_CONCLURE }, () => envoi()), NOW);
  assert.equal(r.lecture, "muet");
  assert.match(r.phrase, /plancher/i, "le blocage des images rend le taux d'ouverture non concluant");
  assert.match(r.conseil ?? "", /délivrabilité|spam/i, "l'hypothèse technique passe avant l'hypothèse commerciale");
});

test("trop peu d'envois : on ne conclut pas non plus", () => {
  const r = lireReactivite([envoi()], NOW);
  assert.equal(r.lecture, "muet");
  assert.equal(r.conseil, null, "1 envoi muet ne justifie aucun conseil");
});

test("il ouvre sans répondre : la demande coince, pas le canal", () => {
  const r = lireReactivite([envoi({ opens: 4, lastOpenAt: plus(2 * 3_600_000) })], NOW);
  assert.equal(r.lecture, "lu-sans-reponse");
  assert.equal(r.ouverturesTotales, 4);
  assert.match(r.conseil ?? "", /demande/i);
  assert.match(r.phrase, /ne prouve pas qu'un humain a lu/i, "les proxys de confidentialité doivent être nommés");
});

test("un clic simultané à l'envoi est un scanner, pas un prospect", () => {
  const scanner = lireReactivite(
    [envoi({ opens: 1, clicks: 1, lastOpenAt: T0, lastClickAt: plus(DELAI_SCANNER_MS - 1000) })],
    NOW
  );
  assert.equal(scanner.lecture, "lu-sans-reponse", "le clic machine ne doit pas passer pour de l'intérêt");
  assert.equal(scanner.clics, 0);

  const humain = lireReactivite(
    [envoi({ opens: 1, clicks: 1, lastOpenAt: T0, lastClickAt: plus(DELAI_SCANNER_MS + 60_000) })],
    NOW
  );
  assert.equal(humain.lecture, "clic");
  assert.equal(humain.clics, 1);
});

test("la fenêtre chaude se lit sur le dernier signal", () => {
  const frais = lireReactivite([envoi({ opens: 2, clicks: 1, lastClickAt: plus(3_600_000) })], NOW);
  assert.ok((frais.heuresDepuisSignal ?? 99) < FENETRE_CHAUDE_H);
  assert.match(frais.conseil ?? "", /MAINTENANT/);

  // Un envoi vieux de dix jours, cliqué une heure après son départ.
  const vieux = lireReactivite(
    [
      envoi({
        createdAt: plus(-10 * 24 * 3_600_000),
        opens: 2,
        clicks: 1,
        lastClickAt: plus(-10 * 24 * 3_600_000 + 3_600_000),
      }),
    ],
    NOW
  );
  assert.ok((vieux.heuresDepuisSignal ?? 0) > FENETRE_CHAUDE_H);
  assert.ok(!/MAINTENANT/.test(vieux.conseil ?? ""), "un clic d'il y a dix jours n'ouvre pas de fenêtre");
});

// ─────────────── L'EFFET SUR LE PLAN — le vrai enjeu ───────────────

const touche = (i: number): TimelineEvent => ({
  id: `t${i}`,
  date: new Date(Date.parse(T0) - (i + 1) * 86_400_000).toISOString(),
  kind: "email",
  summary: "Relance envoyée",
});

/** Trois emails sortants sans réponse : le seuil de changement de canal. */
const ignore3 = () => prospect({ events: [touche(0), touche(1), touche(2)] });

test("sans réactivité, trois touches sans réponse font changer de canal", () => {
  const plan = masterRappel(ignore3(), { now: NOW });
  assert.equal(plan.comms.channel, "terrain");
  assert.equal(plan.comms.reactivite, null, "aucune donnée fournie = null, pas un objet vide");
});

test("MAIS s'il OUVRE, on ne jette pas le seul canal dont on sait qu'il passe", () => {
  // C'était le défaut : ouvrir cinq fois et ignorer trois envois donnaient le
  // MÊME plan. Ce sont deux situations opposées.
  const plan = masterRappel(ignore3(), {
    now: NOW,
    reactivite: lireReactivite([envoi({ opens: 5, lastOpenAt: plus(-3_600_000) })], NOW),
  });
  assert.equal(plan.comms.channel, "email", "il ouvre : le canal marche");
  assert.ok(
    plan.comms.avoid.some((a) => /Abandonner l'email/.test(a)),
    "l'interdit doit être explicite, sinon le vendeur suit son réflexe"
  );
  assert.match(plan.comms.say, /demande/i, "l'angle du jour vient du signal frais");
});

test("et s'il n'ouvre RIEN, le conseil technique s'ajoute au changement de canal", () => {
  const plan = masterRappel(ignore3(), {
    now: NOW,
    reactivite: lireReactivite([envoi(), envoi(), envoi()], NOW),
  });
  assert.equal(plan.comms.channel, "terrain");
  assert.ok(
    plan.comms.avoid.some((a) => /délivrabilité|spam/i.test(a)),
    "zéro signal sur plusieurs envois : vérifier que le message ARRIVE avant de conclure"
  );
});

test("un prospect chaud reste en visio — la réactivité ne casse pas le closing", () => {
  const chaud = prospect({
    stage: "offre",
    trust: 90,
    likeness: 90,
    auditScore: 90,
    conviction: 10,
    demoShownBeforePrice: true,
    croyances: { produit: 9, soutien: 9, pourLui: 9 },
    nextStep: { date: plus(86_400_000), action: "Signer" },
  });
  const plan = masterRappel(chaud, {
    now: NOW,
    reactivite: lireReactivite([envoi({ opens: 3, lastOpenAt: plus(-3_600_000) })], NOW),
  });
  assert.equal(plan.comms.channel, "visio", "un prêt-à-signer ne repart pas en email");
});

test("le panneau lit vraiment le tracking, et sans lui le plan tient debout", () => {
  const src = readFileSync(join(process.cwd(), "components/prospects/master-panel.tsx"), "utf8");
  assert.ok(src.includes("lireReactivite"), "le panneau doit convertir les envois tracés en réactivité");
  assert.match(src, /catch\(\(\) => \{\}\)/, "un échec réseau ne doit pas casser le plan");
  // Le module reste pur : aucune requête réseau dans lib/master-rappel.ts.
  const lib = readFileSync(join(process.cwd(), "lib/master-rappel.ts"), "utf8");
  assert.ok(!/fetch\(/.test(lib), "le plan doit rester calculable hors ligne");
});
