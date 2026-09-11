import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerReleve, ancienneté, ouvertes, resoluesDepuis, type EntreeHistorique } from "../lib/ceo-historique";
import { SANS_SONDE_POSSIBLE, PANNES, diagnostiquer, type Alerte, type EtatSysteme } from "../lib/alpha-ceo";
import { ciblesAuPlafond, etatDepuisSondes } from "../lib/ceo-sondes";
import { prospect } from "./fixtures";
import type { Prospect, TimelineEvent } from "../lib/types";

const alerte = (id: string): Alerte => ({
  id,
  quoi: "peu importe",
  gravite: "urgent",
  action: "agir",
  ecran: "/ceo",
  humain: false,
});

// ═══════════ L'HISTORIQUE ═══════════

test("une panne vue pour la première fois s'ouvre, datée du relevé", () => {
  const h = appliquerReleve([], { a: "2026-09-01T09:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });
  assert.equal(h.length, 1);
  assert.equal(h[0].apparueLe, "2026-09-01T09:00:00.000Z");
  assert.equal(h[0].resolueLe, null);
  assert.equal(h[0].occurrences, 1);
});

test("revue au relevé suivant, elle garde sa date d'apparition et compte une occurrence", () => {
  let h = appliquerReleve([], { a: "2026-09-01T09:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });
  h = appliquerReleve(h, { a: "2026-09-05T09:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });
  assert.equal(h[0].apparueLe, "2026-09-01T09:00:00.000Z", "l'ancienneté est toute l'information");
  assert.equal(h[0].vueLe, "2026-09-05T09:00:00.000Z");
  assert.equal(h[0].occurrences, 2);
});

test("⚠⚠ UN RELEVÉ PARTIEL NE FERME RIEN — une sonde muette n'est pas une panne résolue", () => {
  /**
   * LA règle du module, et elle vient directement de la doctrine de mesure :
   * « je n'ai pas regardé » ≠ « tout va bien ». Sans elle, la panne la plus
   * grave disparaît de l'écran le jour où sa sonde tombe — c'est-à-dire
   * exactement le jour où on en a besoin.
   */
  let h = appliquerReleve([], { a: "2026-09-01T09:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });
  h = appliquerReleve(h, { a: "2026-09-02T09:00:00.000Z", alertes: [], complet: false });
  assert.equal(h[0].resolueLe, null, "un relevé borgne laisse la panne OUVERTE");

  // …et un relevé complet, lui, ferme.
  h = appliquerReleve(h, { a: "2026-09-03T09:00:00.000Z", alertes: [], complet: true });
  assert.equal(h[0].resolueLe, "2026-09-03T09:00:00.000Z");
});

test("⚠ une panne partielle peut quand même OUVRIR — ce qu'elle a vu est réel", () => {
  /**
   * L'asymétrie est voulue : un relevé borgne ne prouve pas une absence, mais
   * ce qu'il a effectivement observé reste vrai. Refuser d'ouvrir sur un
   * relevé partiel perdrait des pannes constatées.
   */
  const h = appliquerReleve([], { a: "2026-09-01T09:00:00.000Z", alertes: [alerte("agent-absent")], complet: false });
  assert.equal(h.length, 1);
  assert.equal(h[0].resolueLe, null);
});

test("⚠ une panne qui REVIENT repart à zéro", () => {
  /**
   * Garder la date d'origine afficherait « ouverte depuis 3 semaines » pour
   * quelque chose qui a été corrigé puis cassé à nouveau. Deux histoires
   * différentes fondues en une, et celle qui compte — « ça vient de
   * recasser » — serait perdue.
   */
  let h = appliquerReleve([], { a: "2026-09-01T00:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });
  h = appliquerReleve(h, { a: "2026-09-02T00:00:00.000Z", alertes: [], complet: true });
  h = appliquerReleve(h, { a: "2026-09-20T00:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });

  assert.equal(h[0].apparueLe, "2026-09-20T00:00:00.000Z", "la nouvelle apparition fait foi");
  assert.equal(h[0].resolueLe, null, "et elle rouvre l'entrée");
  assert.equal(h[0].occurrences, 1, "le compteur repart");
});

test("ancienneté — dit « depuis quand », et distingue l'incident de la décision", () => {
  const base: EntreeHistorique = {
    id: "x",
    apparueLe: "2026-09-01T00:00:00.000Z",
    vueLe: "2026-09-01T00:00:00.000Z",
    resolueLe: null,
    gravite: "urgent",
    occurrences: 1,
  };

  const jour0 = ancienneté(base, new Date("2026-09-01T12:00:00.000Z"));
  assert.equal(jour0.depuisJours, 0);
  assert.match(jour0.phrase, /aujourd'hui/, "une panne du jour renvoie vers ce qui vient de changer");

  const vieille = ancienneté(base, new Date("2026-09-20T00:00:00.000Z"));
  assert.equal(vieille.depuisJours, 19);
  assert.match(
    vieille.phrase,
    /décision qui n'a pas été prise/,
    "au-delà d'une semaine ce n'est plus un incident, et le dire change le geste"
  );
});

test("⚠ une date illisible rend null, JAMAIS 0", () => {
  /**
   * Un `0` s'affiche « apparue aujourd'hui » — une affirmation qu'on n'a pas,
   * et qui ferait chercher la cause dans le déploiement du jour.
   */
  const r = ancienneté({
    id: "x",
    apparueLe: "pas une date",
    vueLe: "",
    resolueLe: null,
    gravite: "urgent",
    occurrences: 1,
  });
  assert.equal(r.depuisJours, null);
  assert.match(r.phrase, /on ne le devine pas/);
});

test("ouvertes / resoluesDepuis — la plus ancienne d'abord, et le signal « ça a marché »", () => {
  let h = appliquerReleve([], {
    a: "2026-09-01T00:00:00.000Z",
    alertes: [alerte("smtp-absent"), alerte("agent-absent")],
    complet: true,
  });
  h = appliquerReleve(h, { a: "2026-09-10T00:00:00.000Z", alertes: [alerte("smtp-absent")], complet: true });

  assert.deepEqual(ouvertes(h).map((e) => e.id), ["smtp-absent"]);
  assert.deepEqual(
    resoluesDepuis(h, "2026-09-05T00:00:00.000Z").map((e) => e.id),
    ["agent-absent"],
    "un écran qui ne montre que ce qui va mal ne dit jamais qu'un correctif a marché"
  );
});

// ═══════════ LES DEUX SONDES BRANCHÉES ═══════════

const ETAT_MUET: EtatSysteme = {
  smtpConfigure: null,
  prixStripeConfigures: null,
  stockage: null,
  pipeSynchronisable: null,
  brouillonsEnAttente: 0,
  fichesSansProchaineAction: 0,
  palierEnAttente: false,
  autopilote: null,
  agentVocal: null,
  ciblesAuPlafond: null,
};

test("⚠⚠ agent-absent n'alerte QUE si l'autopilote est armé", () => {
  /**
   * La condition est la moitié de la sonde. Un agent éteint pendant que rien
   * ne compose est un poste de travail fermé — l'état normal la nuit et le
   * week-end. Alerter dessus remplirait l'écran de rouge en permanence, et on
   * apprendrait à ne plus le lire : donc à rater le jour où ça compte.
   */
  const eteintEtCalme = diagnostiquer({ ...ETAT_MUET, autopilote: "non-configure", agentVocal: "inconnu" });
  assert.ok(!eteintEtCalme.some((a) => a.id === "agent-absent"), "pas d'alerte : rien ne compose");

  for (const etatAgent of ["silencieux", "inconnu"] as const) {
    const arme = diagnostiquer({ ...ETAT_MUET, autopilote: "arme", agentVocal: etatAgent });
    assert.ok(
      arme.some((a) => a.id === "agent-absent"),
      `armé + agent ${etatAgent} : chaque appel composé sonne dans le vide`
    );
  }

  const bon = diagnostiquer({ ...ETAT_MUET, autopilote: "arme", agentVocal: "vivant" });
  assert.ok(!bon.some((a) => a.id === "agent-absent"));
});

test("⚠ agentVocal null n'alerte pas — mais se DIT", () => {
  const muet = diagnostiquer({ ...ETAT_MUET, autopilote: "arme", agentVocal: null });
  assert.ok(!muet.some((a) => a.id === "agent-absent"), "une sonde qui n'a pas répondu n'est pas une panne");
});

test("ciblesAuPlafond — compte les SOLLICITATIONS, pas les rendez-vous acceptés", () => {
  const now = new Date("2026-09-20T00:00:00.000Z");
  const ev = (kind: TimelineEvent["kind"], jours: number): TimelineEvent => ({
    id: `${kind}-${jours}`,
    date: new Date(now.getTime() - jours * 86_400_000).toISOString(),
    kind,
    summary: "",
  });

  /**
   * ⚠ Une `visite`, une `demo`, un `meeting` sont des rendez-vous ACCEPTÉS.
   * Les compter ferait dépasser le plafond au client le plus engagé —
   * exactement celui qu'on veut pouvoir rappeler.
   */
  const engage: Prospect = prospect({
    id: "engage",
    phone: "06 39 98 00 01",
    notes: "",
    events: [ev("appel", 1), ev("demo", 2), ev("meeting", 3), ev("visite", 4), ev("note", 5)],
  });
  assert.equal(ciblesAuPlafond([engage], now), 0, "un seul vrai contact sortant");

  const sature: Prospect = prospect({
    id: "sature",
    phone: "06 39 98 00 02",
    notes: "",
    events: [ev("appel", 1), ev("email", 2), ev("whatsapp", 3), ev("linkedin", 4)],
  });
  assert.equal(ciblesAuPlafond([sature], now), 1, "quatre sollicitations = au plafond du décret");

  // ⚠ GLISSANT : les mêmes quatre, mais hors fenêtre, ne comptent plus.
  const ancien: Prospect = prospect({
    id: "ancien",
    phone: "06 39 98 00 03",
    notes: "",
    events: [ev("appel", 40), ev("email", 41), ev("whatsapp", 42), ev("linkedin", 43)],
  });
  assert.equal(ciblesAuPlafond([ancien], now), 0, "30 jours GLISSANTS, pas depuis toujours");
});

test("⚠ une cible AVEC SIREN est hors du champ du décret", () => {
  /**
   * La question « cette cible est-elle plafonnée ? » ne se pose qu'à un
   * endroit — `plafondRappels`. La recopier ici ferait une alerte permanente
   * sur des entreprises inscrites, que rien ne ferait baisser.
   */
  const now = new Date("2026-09-20T00:00:00.000Z");
  const ev = (kind: TimelineEvent["kind"], i: number): TimelineEvent => ({
    id: `e${i}`,
    date: new Date(now.getTime() - i * 86_400_000).toISOString(),
    kind,
    summary: "",
  });
  const inscrite = prospect({
    id: "siren",
    phone: "06 39 98 00 04",
    notes: "SIREN 552100554 — société inscrite",
    events: [ev("appel", 1), ev("email", 2), ev("whatsapp", 3), ev("linkedin", 4)],
  });
  assert.equal(ciblesAuPlafond([inscrite], now), 0);
});

test("⚠ 0 et null sont deux choses — mesuré vs non mesuré", () => {
  const mesureZero = etatDepuisSondes({
    sante: null,
    stockage: null,
    pipeServeur: false,
    hydratation: "locale",
    brouillons: [],
    prospects: [],
    palierPret: false,
    moniteur: null,
    presence: null,
  });
  assert.equal(mesureZero.ciblesAuPlafond, 0, "une liste vide se COMPTE : zéro fiche au plafond");
  assert.ok(!diagnostiquer(mesureZero).some((a) => a.id === "plafond-decret"), "zéro n'alerte pas");

  // Et une seule fiche au plafond alerte — le risque est juridique, pas
  // statistique : « seulement une » n'existe pas quand on porte le risque.
  assert.ok(
    diagnostiquer({ ...ETAT_MUET, ciblesAuPlafond: 1 }).some((a) => a.id === "plafond-decret"),
    "une seule suffit"
  );
});

test("⚠ SANS_SONDE_POSSIBLE nomme de VRAIES pannes, et dit comment les vérifier", () => {
  /**
   * La liste est rangée à part de `anglesMorts` exprès : une entrée qui ne se
   * referme jamais transformerait cette liste-là en fond permanent, et une
   * liste qui ne descend jamais à zéro est une liste qu'on cesse de lire.
   *
   * ⚠ Chaque entrée doit désigner une panne RÉELLE du relevé — sinon la liste
   * dérive et décrit des pannes qui n'existent plus, ce qui est exactement le
   * défaut de doc que ce dépôt paie en boucle.
   */
  const ids = new Set(PANNES.map((p) => p.id));
  for (const s of SANS_SONDE_POSSIBLE) {
    assert.ok(ids.has(s.id), `« ${s.id} » n'est pas une panne du relevé`);
    assert.ok(s.pourquoi.length > 40, `« ${s.id} » : un angle mort sans motif se referme au hasard`);
    assert.ok(s.commentVerifier.length > 10, `« ${s.id} » : dire qu'on ne sonde pas sans dire comment vérifier ne sert à rien`);
  }

  /**
   * ⚠ ET AUCUNE D'ELLES NE DOIT ÊTRE SONDABLE. Le jour où l'une le devient, il
   * faut la brancher et la retirer d'ici — pas la laisser en « connue ».
   */
  const levees = new Set(
    diagnostiquer({
      ...ETAT_MUET,
      smtpConfigure: false,
      prixStripeConfigures: false,
      stockage: "sature",
      pipeSynchronisable: false,
      autopilote: "arme",
      agentVocal: "inconnu",
      ciblesAuPlafond: 3,
    }).map((a) => a.id)
  );
  for (const s of SANS_SONDE_POSSIBLE) {
    assert.ok(!levees.has(s.id), `« ${s.id} » est en fait sondable : branche-la et retire-la de la liste`);
  }
});
