import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireJournee, pourEcran, PLAFOND_FAIRE, PLAFOND_AUTRES } from "../lib/priorites";
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

/**
 * ⚠ LE TROU QUE LE TEST PRÉCÉDENT NE POUVAIT PAS VOIR : il passe `meetings: []`.
 *
 * Trouvé en pilotant un vrai navigateur, pas ici : on clique « Ne plus
 * appeler » sur une fiche qui a déjà un closing calé, et le plan du matin
 * affiche toujours en TÊTE de liste « Closing — <client> aujourd'hui 20:35 »,
 * canal « appel », urgence 100. La garde d'opposition existait — vingt lignes
 * plus bas. Les rendez-vous passaient avant elle.
 *
 * La règle retenue : on NE SUPPRIME PAS le rendez-vous (l'effacer en silence
 * ferait poser un lapin sans témoin), on refuse seulement que l'écran donne
 * l'ordre sans dire ce qu'il sait.
 */
const rdv = (prospectId: string, date: string) => ({
  id: `m-${prospectId}`,
  prospectId,
  title: "Closing",
  date,
  durationMin: 45,
  kind: "closing" as const,
  channel: "appel" as const,
  location: "",
  reminded: false,
  done: false,
});

test("un rendez-vous avec une fiche en opposition n'est PAS effacé du plan", () => {
  const p = prospect({ id: "opp3", phone: "0612345671", tags: ["terrain", DO_NOT_CALL_TAG] });
  const j = construireJournee({
    prospects: [p],
    meetings: [rdv("opp3", new Date(NOW.getTime() + 3 * 3_600_000).toISOString())],
    now: NOW,
  });
  const t = j.taches.find((x) => x.prospectId === "opp3");
  assert.ok(t, "le rendez-vous doit rester : c'est un engagement pris, pas une relance");
});

test("…mais il DIT que la personne a demandé à ne plus être appelée", () => {
  const p = prospect({ id: "opp4", phone: "0612345672", tags: ["terrain", DO_NOT_CALL_TAG] });
  const j = construireJournee({
    prospects: [p],
    meetings: [rdv("opp4", new Date(NOW.getTime() + 3 * 3_600_000).toISOString())],
    now: NOW,
  });
  const t = j.taches.find((x) => x.prospectId === "opp4")!;
  assert.match(t.action, /^⚠/, "l'ordre doit être marqué, pas rendu tel quel");
  assert.match(t.why, /ne plus appeler/i, "et la raison doit nommer l'opposition");
  assert.match(t.why, /écrit|annule/i, "elle doit aussi dire quoi faire à la place de composer");
});

test("l'opposition lue dans la TIMELINE marque le rendez-vous elle aussi", () => {
  // Le bouton pose un tag ; une session vocale, elle, écrit dans la timeline.
  // Les deux doivent produire le même avertissement, sinon la moitié des
  // oppositions passe à travers.
  const p = prospect({
    id: "opp5",
    phone: "0612345673",
    events: [ev("e", 1, "appel", RESULTATS_MANUELS.opposition.summary)],
  });
  const j = construireJournee({
    prospects: [p],
    meetings: [rdv("opp5", new Date(NOW.getTime() + 3 * 3_600_000).toISOString())],
    now: NOW,
  });
  assert.match(j.taches.find((x) => x.prospectId === "opp5")!.action, /^⚠/);
});

test("un rendez-vous ORDINAIRE ne porte aucun avertissement", () => {
  // Le contre-test : sans lui, marquer tout le monde passerait pour une réussite.
  const p = prospect({ id: "sain", phone: "0612345674" });
  const j = construireJournee({
    prospects: [p],
    meetings: [rdv("sain", new Date(NOW.getTime() + 3 * 3_600_000).toISOString())],
    now: NOW,
  });
  const t = j.taches.find((x) => x.prospectId === "sain")!;
  assert.doesNotMatch(t.action, /⚠/);
  assert.doesNotMatch(t.why, /ne plus appeler/i);
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

// ─────────── 8. UNE JOURNÉE SE PLAFONNE ───────────

test("mille fiches refroidies ne produisent pas mille lignes à l'écran", () => {
  // Mesuré avant correction : 1 000 fiches → 1 000 tâches affichées, sous un
  // pied de page promettant que « l'écran doit rester lisible ».
  const froids = Array.from({ length: 300 }, (_, i) =>
    prospect({
      id: `f${i}`,
      company: `Boîte ${i}`,
      monthlyValue: 200,
      setupValue: 1500,
      events: [ev(`e${i}`, 10 + (i % 20), "appel", "Sans réponse")],
    })
  );
  const j = construireJournee({ prospects: froids, meetings: [], now: NOW });
  assert.ok(j.taches.length > 100, "le calcul reste complet — c'est l'affichage qu'on plafonne");

  for (const q of ["faire", "planifier", "deleguer", "abandonner"] as const) {
    const e = pourEcran(j, q);
    const plafond = q === "faire" ? PLAFOND_FAIRE : PLAFOND_AUTRES;
    assert.ok(e.visibles.length <= plafond, `${q} : ${e.visibles.length} lignes affichées`);
  }
});

test("ce qui est replié est COMPTÉ — minutes et argent —, jamais escamoté", () => {
  const froids = Array.from({ length: 300 }, (_, i) =>
    prospect({
      id: `f${i}`,
      monthlyValue: 200,
      setupValue: 1500,
      probability: 40,
      events: [ev(`e${i}`, 10 + (i % 20), "appel", "Sans réponse")],
    })
  );
  const j = construireJournee({ prospects: froids, meetings: [], now: NOW });

  let vus = 0;
  let restes = 0;
  for (const q of ["faire", "planifier", "deleguer", "abandonner"] as const) {
    const e = pourEcran(j, q);
    vus += e.visibles.length;
    restes += e.reste;
    if (e.reste > 0) {
      assert.ok(e.note, "un repli sans ligne de comptage serait un escamotage");
      assert.match(e.note!, new RegExp(`${e.reste}`), "la note doit dire COMBIEN");
      assert.ok(e.resteMinutes > 0, "les minutes repliées doivent être comptées");
      assert.ok(e.resteValeur > 0, "l'argent replié doit être compté");
    }
  }
  assert.equal(vus + restes, j.taches.length, "aucune tâche ne doit disparaître du décompte");
});

test("le cadran urgent-ET-important dit que le débordement EST l'information", () => {
  const urgents = Array.from({ length: 40 }, (_, i) =>
    prospect({
      id: `u${i}`,
      stage: "offre",
      monthlyValue: 400,
      setupValue: 3000,
      probability: 70,
      nextStep: { date: ilYA(3), action: "Relancer la décision" },
      events: [ev(`e${i}`, 5, "appel", "Sans réponse")],
    })
  );
  const e = pourEcran(construireJournee({ prospects: urgents, meetings: [], now: NOW }), "faire");
  assert.ok(e.reste > 0, "le fixture doit vraiment déborder");
  assert.match(e.note!, /pipe qu'on a laissé s'accumuler/);
});

test("une petite journée n'est pas plafonnée du tout", () => {
  const j = construireJournee({
    prospects: [prospect({ id: "a", events: [ev("e", 20, "appel", "Sans réponse")] })],
    meetings: [],
    now: NOW,
  });
  for (const q of ["faire", "planifier", "deleguer", "abandonner"] as const) {
    assert.equal(pourEcran(j, q).note, null, `${q} ne doit afficher aucune note de repli`);
  }
});

test("la page affiche la vue plafonnée, pas la liste complète", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/aujourdhui/page.tsx"), "utf8");
  assert.ok(src.includes("pourEcran"), "la page doit passer par la vue plafonnée");
  assert.doesNotMatch(src, /\{list\.map\(\(t\) =>/, "elle ne doit plus dérouler la liste entière");
});

// ─────────── 9. LES ÉCRANS QUI DÉROULAIENT TOUT ───────────

test("le pipeline se pagine — 1 000 fiches, ce n'est pas 1 000 lignes de tableau", () => {
  /**
   * Objectif affiche du produit : 1 000 numeros terrain. Ils atterrissent
   * TOUS au stade « prospect ». Le tableau deroulait chaque ligne avec sa
   * case a cocher, ses badges et ses liens ; le kanban, chaque carte avec sa
   * poignee de glisser-deposer.
   */
  const page = readFileSync(join(process.cwd(), "app/(app)/pipeline/page.tsx"), "utf8");
  assert.ok(page.includes("getPaginationRowModel"), "le tableau doit paginer");
  assert.match(page, /TAILLE_PAGE\s*=\s*(\d+)/, "la taille de page doit être une constante nommée");
  const taille = Number(page.match(/TAILLE_PAGE\s*=\s*(\d+)/)![1]);
  assert.ok(taille > 0 && taille <= 100, `${taille} lignes par page`);

  const kanban = readFileSync(join(process.cwd(), "components/pipeline/kanban.tsx"), "utf8");
  assert.match(kanban, /CARTES_MAX\s*=\s*\d+/, "la colonne kanban doit être bornée");
  assert.ok(
    kanban.includes("items.length - visibles.length"),
    "ce qui n'est pas affiché doit être compté à l'écran, pas escamoté"
  );
  assert.ok(
    kanban.includes("items.length") && kanban.includes("colValue"),
    "le total en tête de colonne reste calculé sur la colonne ENTIÈRE"
  );
});
