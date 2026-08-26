import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireJournee } from "../lib/priorites";
import { appeleAujourdhui, buildCallSession, verticalsWithTargets } from "../lib/call-session";
import { attemptsFromEvents } from "../lib/master-rappel";
import { aRefuseTouteRelance, DO_NOT_CALL_TAG } from "../lib/voice-script";
import { masterRappel } from "../lib/master-rappel";
import { vitalSigns } from "../lib/vital-signs";
import { RESULTATS_MANUELS } from "../lib/call-outcome";
import { importerFiches } from "../lib/sourcing-terrain-import";
import { importerProfils, ENTETE_MODELE } from "../lib/linkedin-import";
import { ENTETE_TERRAIN } from "../lib/sourcing-terrain";
import { prospectDefaults } from "../lib/seed";
import { prospect } from "./fixtures";
import type { Prospect, TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉCRAN DU MATIN — celui que l'opérateur suit vraiment.
 *
 * Trois défauts mesurés, tous dans `construireJournee` :
 *
 *  1. il PLANTAIT après un import terrain (`p.events[0]` sur un tableau
 *     absent) — écran blanc au moment précis où le pipe se remplit ;
 *  2. il demandait de rappeler quelqu'un qui avait dit « ne plus m'appeler »,
 *     alors que le robot, lui, s'arrêtait ;
 *  3. il contredisait MASTER RAPPEL sur les fiches saturées, et il ignorait
 *     complètement la file d'appels — mille numéros, zéro tâche.
 * ─────────────────────────────────────────────────────────────────────
 */

const NOW = new Date("2026-09-20T10:00:00.000Z");
const ilYA = (j: number) => new Date(NOW.getTime() - j * 86_400_000).toISOString();
const ev = (id: string, j: number, kind: TimelineEvent["kind"], summary: string): TimelineEvent => ({
  id,
  date: ilYA(j),
  kind,
  summary,
});

// ─────────── 1. LE SOCLE : un import ne doit rien laisser d'absent ───────────

test("le socle de fiche couvre TOUS les tableaux — leur absence est un plantage", () => {
  for (const champ of ["events", "objections", "obstacles", "attachments", "tags", "problems", "payments"] as const) {
    const v = (prospectDefaults as unknown as Record<string, unknown>)[champ];
    assert.ok(Array.isArray(v), `prospectDefaults.${champ} doit être un tableau, obtenu ${typeof v}`);
  }
  assert.ok(prospectDefaults.croyances, "croyances doit avoir une valeur neutre");
});

test("une fiche importée du terrain ne fait pas tomber l'écran du matin", () => {
  const lot = importerFiches(
    `${ENTETE_TERRAIN}\nCarrosserie des Lilas;carrosserie;Lyon 3e;04 78 12 34 56;;142;4,6;09:00–12:00, 14:00–18:00;"impossible de les joindre";45.20A;123456789`
  );
  const p = lot.retenus[0].prospect;
  // Les trois lecteurs qui tournent sur la fiche dès son arrivée.
  assert.doesNotThrow(() => construireJournee({ prospects: [p], meetings: [], now: NOW }));
  assert.doesNotThrow(() => masterRappel(p, { now: NOW }));
  assert.doesNotThrow(() => vitalSigns(p, NOW));
});

test("une fiche importée de LinkedIn non plus", () => {
  const li = importerProfils(
    `${ENTETE_MODELE}\nMarc Perrin;Gérant;Carrosserie du Rhône;Lyon;https://linkedin.com/in/x;garage;12`
  );
  const p = li.retenus[0]?.prospect;
  assert.ok(p, "le profil doit être retenu, sinon le test ne prouve rien");
  assert.doesNotThrow(() => construireJournee({ prospects: [p!], meetings: [], now: NOW }));
});

// ─────────── 2. L'OPPOSITION ───────────

test("on ne demande JAMAIS de rappeler quelqu'un qui a dit « ne plus m'appeler »", () => {
  // Le tag, posé par le bouton de la page /appels.
  const parTag = prospect({
    id: "opp1",
    phone: "0612345678",
    tags: ["terrain", "ne-pas-appeler"],
    events: [ev("e", 20, "appel", "Sans réponse")],
  });
  // Et la timeline, quand l'opposition vient d'une session vocale.
  const parTimeline = prospect({
    id: "opp2",
    phone: "0612345679",
    events: [ev("e", 20, "appel", RESULTATS_MANUELS.opposition.summary)],
  });

  const j = construireJournee({ prospects: [parTag, parTimeline], meetings: [], now: NOW });
  assert.equal(j.taches.length, 0, `aucune tâche attendue, obtenu : ${j.taches.map((t) => t.action).join(" | ")}`);
});

test("…mais une fiche ordinaire qui refroidit produit bien une tâche", () => {
  // Le contre-test : sans lui, une exclusion trop large passerait inaperçue.
  const froid = prospect({ id: "ok", phone: "0612345670", events: [ev("e", 20, "appel", "Sans réponse")] });
  const j = construireJournee({ prospects: [froid], meetings: [], now: NOW });
  assert.equal(j.taches.length, 1);
});

// ─────────── 3. LA CONTRADICTION AVEC MASTER RAPPEL ───────────

/** Cinq relances sortantes sans réponse : le prospect est saturé. */
const sature = () =>
  prospect({
    id: "sat",
    events: Array.from({ length: 5 }, (_, i) => ev(`s${i}`, 8 + i * 3, "email", "Relance envoyée")),
  });

test("un prospect SATURÉ ne reçoit pas de tâche « relancer » — les deux écrans disaient l'inverse", () => {
  const p = sature();
  const s = vitalSigns(p, NOW);
  assert.equal(s.fatigueLevel, "sature", "le fixture doit vraiment être saturé, sinon le test ne prouve rien");
  assert.ok(new Date(s.bestWindow.at).getTime() > NOW.getTime(), "sa fenêtre doit être dans le futur");

  const j = construireJournee({ prospects: [p], meetings: [], now: NOW });
  assert.equal(
    j.taches.length,
    0,
    `MASTER RAPPEL impose le silence jusqu'au ${s.bestWindow.at} ; la journée ne doit pas dire le contraire`
  );
});

test("quand la fenêtre s'ouvre, la tâche exige une RAISON NEUVE — pas « je me permets de relancer »", () => {
  const p = sature();
  const apres = new Date(new Date(vitalSigns(p, NOW).bestWindow.at).getTime() + 86_400_000);
  const j = construireJournee({ prospects: [p], meetings: [], now: apres });
  assert.equal(j.taches.length, 1);
  assert.match(j.taches[0].action, /raison NEUVE/i);
  assert.match(j.taches[0].why, /brûle la fiche|ignorée/i);
});

test("le canal de la tâche vient du plan de comms, il n'est plus écrit en dur", () => {
  // Trois touches ignorées : le plan bascule sur le terrain. La journée
  // écrivait « appel » quoi qu'il arrive.
  const p = prospect({
    id: "canal",
    events: [ev("a", 9, "email", "Relance"), ev("b", 12, "email", "Relance"), ev("c", 15, "email", "Relance")],
  });
  const comms = masterRappel(p, { now: NOW }).comms;
  assert.equal(comms.channel, "terrain", "le fixture doit bien déclencher le changement de canal");

  const j = construireJournee({ prospects: [p], meetings: [], now: NOW });
  assert.equal(j.taches.length, 1);
  assert.equal(j.taches[0].canal, "visite", "« terrain » côté plan = « visite » côté journée");
});

// ─────────── 4. LA FILE D'APPELS ───────────

function lotAppelable(n: number): Prospect[] {
  return Array.from({ length: n }, (_, i) =>
    prospect({
      id: `t${i}`,
      company: `Carrosserie ${i}`,
      stage: "prospect",
      phone: `04780000${String(i).padStart(2, "0")}`,
      tags: ["terrain", "garage-carrosserie"],
      events: [],
      nextStep: null,
    })
  );
}

test("des numéros sourcés et jamais appelés apparaissent enfin dans la journée", () => {
  const j = construireJournee({ prospects: lotAppelable(120), meetings: [], now: NOW });
  const file = j.taches.find((t) => t.id === "file-appels");
  assert.ok(file, "120 numéros jamais appelés produisaient ZÉRO tâche");
  assert.match(file!.action, /120/);
  assert.equal(file!.href, "/appels");
});

test("…en UNE seule tâche, pas une par fiche", () => {
  const j = construireJournee({ prospects: lotAppelable(120), meetings: [], now: NOW });
  assert.equal(j.taches.length, 1, "mille lignes « appeler X » ne sont pas une journée");
  // Et la durée annoncée est celle d'une session, pas celle du lot.
  assert.ok(j.taches[0].minutes <= 60, `${j.taches[0].minutes} min annoncées — on ne promet pas de vider le lot`);
});

test("la file d'appels nomme la verticale la plus fournie — une seule à la fois", () => {
  const melange = [
    ...lotAppelable(9),
    ...Array.from({ length: 3 }, (_, i) =>
      prospect({ id: `r${i}`, stage: "prospect", phone: `0478111${i}`, tags: ["terrain", "restauration"], events: [], nextStep: null })
    ),
  ];
  const file = construireJournee({ prospects: melange, meetings: [], now: NOW }).taches.find((t) => t.id === "file-appels")!;
  assert.match(file.why, /garage-carrosserie/);
  assert.match(file.why, /une verticale à la fois/);
});

test("une fiche sans téléphone n'entre pas dans la file d'appels", () => {
  const sansTel = prospect({ id: "nt", stage: "prospect", phone: undefined, events: [], nextStep: null });
  const j = construireJournee({ prospects: [sansTel], meetings: [], now: NOW });
  assert.equal(j.taches.find((t) => t.id === "file-appels"), undefined);
});

test("une fiche en opposition n'entre pas dans la file d'appels non plus", () => {
  const [p] = lotAppelable(1);
  const j = construireJournee({
    prospects: [{ ...p, tags: [...p.tags, "ne-pas-appeler"] }],
    meetings: [],
    now: NOW,
  });
  assert.equal(j.taches.length, 0);
});

// ─────────── 5. UN SEUL LECTEUR DE L'OPPOSITION ───────────

test("la file d'appels aussi écarte l'opposition — le troisième endroit qui l'ignorait", () => {
  const opp = prospect({
    id: "o",
    stage: "prospect",
    phone: "0478000000",
    sector: "restaurant",
    tags: [DO_NOT_CALL_TAG],
    events: [],
  });
  const ok = prospect({ id: "k", stage: "prospect", phone: "0478000001", sector: "restaurant", events: [] });

  const { targets } = buildCallSession([opp, ok], "restauration");
  assert.deepEqual(targets.map((t) => t.prospect.id), ["k"], "la fiche opposée revenait dans la file le lendemain");

  // Et le compteur d'onglet doit dire la même chose que la liste.
  const onglet = verticalsWithTargets([opp, ok]).find((v) => v.vertical.id === "restauration");
  assert.equal(onglet?.count, 1, "un onglet qui annonce 2 pour une liste de 1 passe pour un bug d'affichage");
});

test("les trois lecteurs de l'opposition sont d'accord sur les phrases réellement écrites", () => {
  /**
   * `aRefuseTouteRelance` duplique le motif d'opposition de
   * `attemptsFromEvents` pour éviter un cycle d'imports. Les deux doivent
   * donc rendre le même verdict sur CHAQUE phrase de `RESULTATS_MANUELS` —
   * sinon la journée et le robot divergent en silence.
   */
  for (const [cle, r] of Object.entries(RESULTATS_MANUELS)) {
    const p = prospect({ id: `x-${cle}`, events: [ev("e", 1, "appel", r.summary)] });
    const parCadence = attemptsFromEvents(p)[0].outcome === "opposition";
    const parPredicat = aRefuseTouteRelance(p);
    assert.equal(parPredicat, parCadence, `désaccord sur « ${r.summary} »`);
  }
});

test("le tag d'opposition n'est écrit qu'à un seul endroit", () => {
  // Test dérivé : la chaîne littérale se recopiait dans les pages. Une faute
  // de frappe y serait invisible — la fiche reviendrait simplement dans la file.
  const page = readFileSync(join(process.cwd(), "app/(app)/appels/page.tsx"), "utf8");
  assert.ok(page.includes("DO_NOT_CALL_TAG"), "la page doit utiliser la constante");
  assert.doesNotMatch(page, /"ne-pas-appeler"/, "aucun littéral en dur dans la page");
});

// ─────────── 6. LE STOCK DÉJÀ CASSÉ DANS LES NAVIGATEURS ───────────

test("les fiches partielles déjà persistées sont réparées à la réhydratation", () => {
  /**
   * Corriger `prospectDefaults` répare les imports FUTURS. Les fiches
   * écrites avant, elles, sont déjà dans le localStorage sous la version
   * courante — `migrate` est gated par la version et ne les reverra jamais.
   * C'est `merge` qui doit s'en charger, à chaque réhydratation.
   */
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  const merge = src.slice(src.indexOf("merge: (persisted"), src.indexOf("migrate: (persisted"));
  assert.ok(merge.length > 0, "le store doit définir un `merge`");
  assert.match(merge, /normalizeProspect/, "merge doit normaliser les fiches, pas seulement les recopier");
});

// ─────────── 7. LA PROGRESSION D'UNE SESSION D'APPELS ───────────

test("la progression d'appel survit au rechargement — elle se lit dans la timeline", () => {
  /**
   * La page promettait dans son propre commentaire que « rien ne se perd au
   * rechargement ». C'était vrai des données, faux de la progression : elle
   * vivait dans un `useState`. Sur cent numéros, un onglet fermé remettait
   * la liste à zéro, dans le même ordre, sans marquer ce qui était fait.
   */
  const fait = prospect({
    id: "fait",
    stage: "prospect",
    phone: "0478000001",
    sector: "restaurant",
    events: [ev("e", 0, "appel", RESULTATS_MANUELS.messagerie.summary)],
  });
  const aFaire = prospect({ id: "todo", stage: "prospect", phone: "0478000002", sector: "restaurant", events: [] });

  assert.equal(appeleAujourdhui(fait, NOW), true);
  assert.equal(appeleAujourdhui(aFaire, NOW), false);

  const { targets } = buildCallSession([fait, aFaire], "restauration", NOW);
  assert.deepEqual(
    targets.map((t) => t.prospect.id),
    ["todo", "fait"],
    "ce qui est fait descend, on travaille toujours depuis le haut"
  );
  assert.equal(targets.find((t) => t.prospect.id === "fait")!.faitAujourdhui, true);
});

test("un appel d'HIER ne compte pas comme fait aujourd'hui", () => {
  const hier = prospect({
    id: "h",
    stage: "prospect",
    phone: "0478000003",
    sector: "restaurant",
    events: [ev("e", 1, "appel", RESULTATS_MANUELS.messagerie.summary)],
  });
  assert.equal(appeleAujourdhui(hier, NOW), false);
});

test("la page ne recompte plus la progression à la main", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/appels/page.tsx"), "utf8");
  assert.ok(src.includes("faitAujourdhui"), "le compteur doit venir de la timeline");
  assert.doesNotMatch(
    src,
    /restants:\s*targets\.length\s*-\s*Object\.keys\(done\)\.length/,
    "le compteur ne doit plus dépendre du seul état local"
  );
});
