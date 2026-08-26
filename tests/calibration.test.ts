import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CRITERES_TRI,
  ECHANTILLON_MIN,
  ECHANTILLON_MIN_BRAS,
  MARQUE_RDV,
  calibrer,
  tauxMesure,
  tauxPourPlan,
} from "../lib/calibration";
import { RESULTATS_MANUELS, type ResultatManuel } from "../lib/call-outcome";
import { attemptsFromEvents } from "../lib/master-rappel";
import { cadenceFor } from "../lib/call-cadence";
import { HYPOTHESE_DECROCHE, NOTE_EXCELLENTE, AVIS_DEMANDE_ELEVEE } from "../lib/sourcing-terrain";
import { prospect } from "./fixtures";
import type { Prospect, TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Ce fichier protège DEUX choses distinctes :
 *
 *  1. L'ALLER-RETOUR résultat → texte → résultat. C'est le maillon qui était
 *     cassé : la page /appels écrivait « à rappeler » et la cadence relisait
 *     « sans réponse », donc le robot rappelait des gens déjà joints.
 *  2. Le REFUS DE CHIFFRER SANS MESURE. Un module de calibration qui invente
 *     un taux est pire que pas de calibration : il a l'air d'une preuve.
 * ─────────────────────────────────────────────────────────────────────
 */

const J = 86_400_000;
const appel = (i: number, summary: string): TimelineEvent => ({
  id: `e${i}`,
  date: new Date(Date.parse("2026-08-01T09:00:00.000Z") + i * J).toISOString(),
  kind: "appel",
  summary,
});

/** n fiches appelées, dont `joints` qui décrochent au premier coup. */
function base(n: number, joints: number, over: Partial<Prospect> = {}): Prospect[] {
  return Array.from({ length: n }, (_, i) =>
    prospect({
      id: `p${i}`,
      events: [appel(i, i < joints ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
      ...over,
    })
  );
}

// ─────────────────────── 1. L'ALLER-RETOUR ───────────────────────

test("chaque résultat manuel est relu exactement comme il est déclaré", () => {
  for (const [cle, r] of Object.entries(RESULTATS_MANUELS)) {
    const p = prospect({ events: [appel(0, r.summary)] });
    const lu = attemptsFromEvents(p);
    assert.equal(lu.length, 1, `${cle} : l'événement doit produire une tentative`);
    assert.equal(lu[0].outcome, r.lecture, `${cle} : « ${r.summary} » relu « ${lu[0].outcome} »`);
  }
});

test("un décroché manuel arrête la cadence automatique — le bug qui rappelait les gens", () => {
  // Le cas exact : le vendeur a eu quelqu'un au téléphone et note « à rappeler ».
  // Avant correction, `attemptsFromEvents` lisait « sans réponse » et
  // `cadenceFor` renvoyait le prospect dans la file de rappel du robot.
  for (const cle of ["rdv", "rappeler", "non"] as ResultatManuel[]) {
    const p = prospect({ events: [appel(0, RESULTATS_MANUELS[cle].summary)] });
    const d = cadenceFor(attemptsFromEvents(p), new Date("2026-08-10T10:00:00Z"));
    assert.equal(d.callNow, false, `${cle} : le robot ne doit plus composer`);
    assert.equal(d.state, "repondu-passer-humain", `${cle} : la main passe à l'humain`);
  }
});

test("une messagerie laisse la cadence tourner — sinon on abandonne au premier essai", () => {
  const p = prospect({ events: [appel(0, RESULTATS_MANUELS.messagerie.summary)] });
  const d = cadenceFor(attemptsFromEvents(p), new Date("2026-08-10T10:00:00Z"), { siren: "123456789" });
  assert.equal(d.state, "en-cadence");
});

test("une opposition manuelle est définitive", () => {
  const p = prospect({ events: [appel(0, RESULTATS_MANUELS.opposition.summary)] });
  assert.equal(cadenceFor(attemptsFromEvents(p), new Date()).state, "stop-definitif");
});

test("le marqueur de RDV ne colle qu'au résultat « RDV », pas aux autres", () => {
  assert.ok(MARQUE_RDV.test(RESULTATS_MANUELS.rdv.summary));
  for (const cle of ["rappeler", "messagerie", "non", "opposition"] as ResultatManuel[]) {
    assert.ok(!MARQUE_RDV.test(RESULTATS_MANUELS[cle].summary), `${cle} ne doit pas compter comme un RDV`);
  }
});

test("la page /appels n'écrit plus ses propres phrases", () => {
  // Test dérivé : c'est la RÉGRESSION qu'on protège. Une phrase écrite en dur
  // dans la page échappe à l'aller-retour testé plus haut.
  const src = readFileSync(join(process.cwd(), "app/(app)/appels/page.tsx"), "utf8");
  assert.ok(src.includes("RESULTATS_MANUELS"), "la page doit lire la table partagée");
  assert.ok(
    !/summaries\s*:\s*Record</.test(src),
    "la page ne doit plus définir sa propre table de résumés"
  );
  assert.ok(
    !/"Appel sortant — /.test(src),
    "aucun résumé d'appel ne doit être écrit en dur dans la page"
  );
});

// ─────────────────────── 2. LE REFUS D'INVENTER ───────────────────────

test("base vide : aucun chiffre, et le motif est dit", () => {
  const cal = calibrer([]);
  assert.equal(cal.appeles, 0);
  assert.equal(cal.decrocheParTentative.source, "aucune");
  assert.equal(cal.decrocheParTentative.valeur, null, "null, jamais 0 — 0 % serait un résultat");
  assert.equal(cal.rdvParJoint.valeur, null);
  assert.ok(cal.lecture.some((l) => /aucun appel/i.test(l)));
  assert.ok(cal.manque.length > 0, "il faut dire ce qui manque, pas seulement se taire");
});

test("des fiches JAMAIS appelées ne comptent pas comme des échecs", () => {
  // Le piège : 1 000 fiches importées, 10 appelées. Diviser par 1 000 rendrait
  // un décroché ridicule et ferait condamner un ciblage qui n'a pas été testé.
  const cal = calibrer([...base(10, 4), ...Array.from({ length: 990 }, (_, i) => prospect({ id: `x${i}` }))]);
  assert.equal(cal.appeles, 10);
  assert.equal(cal.composes, 10);
  assert.equal(cal.joints, 4);
  assert.equal(cal.decrocheParTentative.valeur, 0.4);
});

test("un taux sous le seuil est marqué fragile et ne pilote pas le plan", () => {
  const cal = calibrer(base(10, 2));
  assert.equal(cal.decrocheParTentative.fragile, true);
  const t = tauxPourPlan(cal, HYPOTHESE_DECROCHE);
  assert.equal(t.source, "aucune", "10 appels ne remplacent pas l'hypothèse");
  assert.equal(t.taux, HYPOTHESE_DECROCHE);
  assert.ok(/jamais mesurée/.test(t.phrase));
});

test("au-dessus du seuil, la mesure remplace l'hypothèse — la boucle se ferme", () => {
  const cal = calibrer(base(ECHANTILLON_MIN + 10, 12));
  assert.equal(cal.decrocheParTentative.fragile, false);
  const t = tauxPourPlan(cal, HYPOTHESE_DECROCHE);
  assert.equal(t.source, "mesure");
  assert.equal(t.taux, 12 / (ECHANTILLON_MIN + 10));
  assert.ok(/MESURÉ/.test(t.phrase));
  assert.ok(/fourchette/.test(t.phrase), "un taux ne sort jamais nu");
});

test("Wilson : 0 succès sur 8 ne donne pas « 0 % ± 0 »", () => {
  const t = tauxMesure(0, 8, "x");
  assert.equal(t.valeur, 0);
  assert.ok((t.haut ?? 0) > 0.25, `la borne haute doit rester honnête, obtenu ${t.haut}`);
  assert.equal(t.bas, 0);
});

test("Wilson : les bornes restent dans [0,1] et encadrent la valeur", () => {
  for (const [s, n] of [[0, 5], [5, 5], [1, 3], [50, 200], [1, 1]]) {
    const t = tauxMesure(s, n, "x");
    assert.ok((t.bas ?? -1) >= 0 && (t.haut ?? 2) <= 1, `${s}/${n} hors bornes`);
    assert.ok((t.bas ?? 1) <= (t.valeur ?? 0) + 1e-9 && (t.valeur ?? 1) - 1e-9 <= (t.haut ?? 0), `${s}/${n} n'encadre pas`);
  }
});

// ─────────────────────── 3. LES VERDICTS PAR CRITÈRE ───────────────────────

test("un critère sans les deux bras fournis rend « insuffisant », pas « indécis »", () => {
  // Tous portent la plainte : il n'y a aucun bras « sans » à comparer.
  const cal = calibrer(base(40, 20, { tags: ["terrain", "injoignable"] }));
  const e = cal.ecarts.find((x) => x.critere.id === "plainte-injoignable")!;
  assert.equal(e.verdict, "insuffisant");
  assert.ok(/pas assez d'appels/.test(e.phrase));
  assert.ok(
    cal.manque.some((m) => /lot MÉLANGÉ/.test(m)),
    "il faut dire que n'appeler que les meilleurs scores empêche de mesurer le score"
  );
});

test("un écart franc et fourni est confirmé ; un écart inversé est infirmé", () => {
  const avec = Array.from({ length: 40 }, (_, i) =>
    prospect({
      id: `a${i}`,
      tags: ["terrain", "injoignable"],
      events: [appel(i, i < 34 ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
    })
  );
  const sans = Array.from({ length: 40 }, (_, i) =>
    prospect({
      id: `s${i}`,
      tags: ["terrain"],
      events: [appel(i, i < 4 ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
    })
  );
  const e = calibrer([...avec, ...sans]).ecarts.find((x) => x.critere.id === "plainte-injoignable")!;
  assert.equal(e.verdict, "confirme");
  assert.ok((e.lift ?? 0) > 5);

  // Le même écart, à l'envers : le signal joue contre nous et il faut le dire.
  const inverse = calibrer([
    ...avec.map((p) => ({ ...p, tags: ["terrain"] })),
    ...sans.map((p) => ({ ...p, tags: ["terrain", "injoignable"] })),
  ]).ecarts.find((x) => x.critere.id === "plainte-injoignable")!;
  assert.equal(inverse.verdict, "infirme");
  assert.ok(/ENVERS/.test(inverse.phrase));
});

test("un écart faible sur deux bras fournis reste indécis — pas de conclusion arrachée", () => {
  const avec = Array.from({ length: 30 }, (_, i) =>
    prospect({
      id: `a${i}`,
      tags: ["terrain", "injoignable"],
      events: [appel(i, i < 11 ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
    })
  );
  const sans = Array.from({ length: 30 }, (_, i) =>
    prospect({
      id: `s${i}`,
      tags: ["terrain"],
      events: [appel(i, i < 9 ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
    })
  );
  const e = calibrer([...avec, ...sans]).ecarts.find((x) => x.critere.id === "plainte-injoignable")!;
  assert.equal(e.verdict, "indecis");
});

test("l'axe RDV se compte sur ceux qui ont décroché, pas sur tout le monde", () => {
  const p = [
    ...Array.from({ length: 6 }, (_, i) => prospect({ id: `r${i}`, events: [appel(i, RESULTATS_MANUELS.rdv.summary)] })),
    ...Array.from({ length: 6 }, (_, i) => prospect({ id: `j${i}`, events: [appel(i, RESULTATS_MANUELS.rappeler.summary)] })),
    ...Array.from({ length: 8 }, (_, i) => prospect({ id: `m${i}`, events: [appel(i, RESULTATS_MANUELS.messagerie.summary)] })),
  ];
  const cal = calibrer(p, "rdv");
  assert.equal(cal.joints, 12);
  assert.equal(cal.rdv, 6);
  assert.equal(cal.rdvParJoint.valeur, 0.5, "6 RDV sur 12 joints — pas sur 20 appelés");
});

test("les critères mesurés sont ceux qui SURVIVENT à l'import terrain", () => {
  // Un critère dont la présence n'est plus lisible après l'import ne peut pas
  // être confronté au résultat. Chaque `present` doit donc réagir à quelque
  // chose que `ficheVersProspect` écrit réellement.
  const complet = prospect({
    tags: ["terrain", "injoignable", "restauration"],
    deepAudit: {
      websiteState: "aucun",
      socialState: "",
      localCompetition: "",
      currentProcess: "fermé sur la pause déjeuner",
      googleReviews: AVIS_DEMANDE_ELEVEE,
      googleRating: NOTE_EXCELLENTE,
    },
  });
  const vide = prospect({ tags: [], deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" } });
  for (const c of CRITERES_TRI) {
    assert.equal(c.present(complet), true, `${c.id} devrait être détecté sur une fiche complète`);
    assert.equal(c.present(vide), false, `${c.id} ne devrait pas être détecté sur une fiche vide`);
  }
});

test("le seuil par bras est plus bas que le seuil global, et les deux sont dits", () => {
  assert.ok(ECHANTILLON_MIN_BRAS < ECHANTILLON_MIN);
  const cal = calibrer([]);
  assert.ok(cal.manque.some((m) => m.includes(String(ECHANTILLON_MIN))));
  assert.ok(cal.manque.some((m) => m.includes(String(ECHANTILLON_MIN_BRAS))));
});

test("un décroché qui s'effondre entre le 1er et le 2e tour est signalé", () => {
  // 40 fiches : 20 décrochent au 1er coup ; les 20 autres sont rappelées et
  // 1 seule décroche. Le modèle géométrique du plan suppose un taux stable.
  const p = [
    ...Array.from({ length: 20 }, (_, i) => prospect({ id: `a${i}`, events: [appel(i, RESULTATS_MANUELS.rappeler.summary)] })),
    ...Array.from({ length: 20 }, (_, i) =>
      prospect({
        id: `b${i}`,
        events: [
          appel(i, RESULTATS_MANUELS.messagerie.summary),
          appel(i + 1, i < 1 ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary),
        ],
      })
    ),
  ];
  const cal = calibrer(p);
  assert.equal(cal.parTour.length, 2);
  assert.equal(cal.parTour[0].composes, 40);
  assert.equal(cal.parTour[1].composes, 20);
  assert.ok(
    cal.lecture.some((l) => /pas constant d'un tour à l'autre/.test(l)),
    "la projection du plan doit être signalée comme optimiste"
  );
});
