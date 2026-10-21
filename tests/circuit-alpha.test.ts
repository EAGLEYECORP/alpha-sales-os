import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CIRCUIT, LIBELLE_KIND, gardesArmes, ilYa, journalRecent, libelleOuverture, lireCircuit, pouls,
} from "../lib/circuit-alpha";
import { STAGES } from "../lib/hormozi";
import { PLAFOND_SOLLICITATIONS_B2C } from "../lib/call-cadence";
import { DO_NOT_CALL_TAG } from "../lib/voice-script";
import { attendentUnHumain, presenceAlpha } from "../lib/presence-alpha";
import { prospectDefaults } from "../lib/seed";
import type { Activity, Prospect, Stage } from "../lib/types";
import type { Routine } from "../lib/routines";
import { citationFausse, sansCommentaires } from "./citations-alpha";

const R = process.cwd();
const lire = (f: string) => readFileSync(join(R, f), "utf8");

/**
 * ─────────────────────────────────────────────────
 * « ALPHA AU TRAVAIL » — le circuit, le pouls, les garde-fous, le journal.
 *
 * Ce qu'on protège :
 *  · une DESCRIPTION qui dérive du code (chaque règle citée doit exister) ;
 *  · une deuxième définition de « ce qui attend un humain » ;
 *  · un nombre qui compte des routines là où il annonce des fiches ;
 *  · un chiffre légal recopié dans une phrase ;
 *  · une animation qui boucle — du mouvement sans fait derrière (une petite
 *    preuve fabriquée) ;
 *  · un composant écrit mais monté nulle part (le défaut récurrent du dépôt).
 * ─────────────────────────────────────────────────
 */

const fiche = (id: string, stage: Stage, over: Partial<Prospect> = {}): Prospect =>
  ({ ...prospectDefaults, id, company: `Société ${id}`, stage, createdAt: "", updatedAt: "", ...over }) as Prospect;

const routine = (id: string, priority: Routine["priority"], href: string): Routine => ({
  id, priority, category: "relance", title: `Tâche ${id}`, detail: "", href,
});

// Mardi 20 octobre 2026, 10 h à Paris : fenêtre ouverte.
const OUVERT = new Date("2026-10-20T08:30:00.000Z");
// Samedi 24 octobre 2026, 11 h à Paris : week-end.
const WEEKEND = new Date("2026-10-24T09:00:00.000Z");

/* ───────────── le circuit épouse STAGES ───────────── */

test("le circuit couvre exactement les étapes de STAGES, dans le même ordre", () => {
  assert.deepEqual(CIRCUIT.map((e) => e.stage), STAGES.map((s) => s.id));
});

test("chaque étape dit ce qu'ALPHA y fait ET ce qu'il refuse d'y faire", () => {
  for (const e of CIRCUIT) {
    assert.ok(e.fait.length > 0, `${e.stage} : rien n'est dit de ce qu'ALPHA y fait`);
    assert.ok(e.nePasFaire.length > 20, `${e.stage} : « ce qu'ALPHA ne fait pas » est vide ou trop court pour dire quoi que ce soit`);
  }
});

test("le plafond de sollicitations s'écrit depuis sa CONSTANTE, jamais recopié", () => {
  const phrase = CIRCUIT.flatMap((e) => e.fait).find((r) => r.symbole === "PLAFOND_SOLLICITATIONS_B2C");
  assert.ok(phrase, "la règle du plafond a disparu du circuit");
  assert.ok(phrase.quoi.includes(String(PLAFOND_SOLLICITATIONS_B2C)));
  // Le source ne doit pas porter le nombre en dur à côté du mot « contacts ».
  const code = sansCommentaires(lire("lib/circuit-alpha.ts"));
  assert.ok(!/plus de \d+ contacts/.test(code), "un plafond écrit en dur dans une phrase se périme sans bruit");
});

/* ───────────── ⚠⚠ chaque citation désigne quelque chose qui existe ───────────── */

test("⚠⚠ chaque règle du circuit et chaque garde-fou NOMMENT un fichier et un symbole réels", () => {
  const fautes: string[] = [];
  const regles = [
    ...CIRCUIT.flatMap((e) => e.fait),
    ...gardesArmes([], OUVERT).map((g) => g.regle),
  ];
  for (const r of regles) {
    const f = citationFausse(r.fichier, r.symbole);
    if (f) fautes.push(f);
  }
  assert.deepEqual(fautes, [], "une description qui ne désigne plus rien est une description qui ment :\n  " + fautes.join("\n  "));
});

test("la vérification de citation MORD : un symbole inventé est refusé", () => {
  assert.ok(citationFausse("lib/routines.ts", "fonctionQuiNExistePas"));
  assert.ok(citationFausse("lib/fichier-fantome.ts", "computeRoutines"));
  assert.equal(citationFausse("lib/routines.ts", "computeRoutines"), null);
});

test("la vérification ignore les COMMENTAIRES : un nom cité en prose ne suffit pas", () => {
  // `lib/circuit-alpha.ts` cite `ActionsMission` en commentaire ET en donnée ; on exige la DÉCLARATION chez le propriétaire.
  assert.ok(citationFausse("lib/circuit-alpha.ts", "triageImport"), "triageImport n'est pas déclaré dans circuit-alpha, seulement cité");
});

/* ───────────── lireCircuit ───────────── */

test("les fiches se comptent par étape", () => {
  const c = lireCircuit([fiche("a", "prospect"), fiche("b", "prospect"), fiche("c", "offre")], []);
  const n = (s: Stage) => c.lignes.find((l) => l.stage === s)!.fiches;
  assert.equal(n("prospect"), 2);
  assert.equal(n("offre"), 1);
  assert.equal(n("signe"), 0);
});

test("« à toi » compte des FICHES, pas des routines : trois choses sur une fiche = une fiche", () => {
  const prospects = [fiche("a", "contact"), fiche("b", "contact")];
  const routines = [
    routine("1", "haute", "/prospects/a"),
    routine("2", "haute", "/prospects/a"),
    routine("3", "moyenne", "/prospects/a"),
    routine("4", "haute", "/prospects/b"),
  ];
  const c = lireCircuit(prospects, routines);
  assert.equal(c.lignes.find((l) => l.stage === "contact")!.attendent, 2);
});

test("⚠ une routine de priorité BASSE n'attend personne — la définition est celle de la bande", () => {
  const prospects = [fiche("a", "contact")];
  const routines = [routine("1", "basse", "/prospects/a")];
  assert.equal(lireCircuit(prospects, routines).lignes.find((l) => l.stage === "contact")!.attendent, 0);
  // Et la bande est d'accord : même entrée, même réponse.
  assert.equal(presenceAlpha(routines).aToi, 0);
});

test("ce qui n'est pas rattaché à une fiche se compte à part, sans disparaître", () => {
  const prospects = [fiche("a", "contact")];
  const routines = [
    routine("1", "haute", "/campaigns"),
    routine("2", "moyenne", "/meetings"),
    routine("3", "haute", "/prospects/inconnu"),
    routine("4", "haute", "/prospects/a"),
  ];
  const c = lireCircuit(prospects, routines);
  assert.equal(c.attendentHorsFiche, 3);
  assert.equal(c.lignes.find((l) => l.stage === "contact")!.attendent, 1);
});

test("le total « à toi » du circuit ne dépasse jamais ce que dit la bande", () => {
  const prospects = [fiche("a", "contact"), fiche("b", "offre"), fiche("c", "redzone")];
  const routines = [
    routine("1", "haute", "/prospects/a"), routine("2", "haute", "/prospects/b"),
    routine("3", "moyenne", "/prospects/c"), routine("4", "haute", "/campaigns"),
  ];
  const c = lireCircuit(prospects, routines);
  const sommeCircuit = c.lignes.reduce((s, l) => s + l.attendent, 0) + c.attendentHorsFiche;
  assert.equal(sommeCircuit, attendentUnHumain(routines).length);
  assert.equal(sommeCircuit, presenceAlpha(routines).aToi);
});

/* ───────────── pouls ───────────── */

test("pipe vide : la phrase le dit et ne prétend rien surveiller", () => {
  const p = pouls([], [], OUVERT);
  assert.equal(p.ouvertes, 0);
  assert.match(p.phrase, /vide/);
});

test("le pouls compte les fiches OUVERTES — ni les signées ni les perdues", () => {
  const p = pouls([fiche("a", "contact"), fiche("b", "signe"), fiche("c", "perdu")], [], OUVERT);
  assert.equal(p.ouvertes, 1);
});

test("⚠ « ont dit non » ne compte que les fiches OUVERTES qui ont refusé", () => {
  const refus = (id: string, stage: Stage) => fiche(id, stage, { tags: [DO_NOT_CALL_TAG] });
  const p = pouls([refus("a", "contact"), refus("b", "perdu"), fiche("c", "contact")], [], OUVERT);
  assert.equal(p.refuses, 1);
});

test("la fenêtre d'appel suit l'horloge INJECTÉE, et annonce la prochaine ouverture quand elle est fermée", () => {
  const ouvert = pouls([], [], OUVERT).fenetre;
  assert.equal(ouvert.ouverte, true);
  assert.equal(ouvert.prochaine, null);

  const ferme = pouls([], [], WEEKEND).fenetre;
  assert.equal(ferme.ouverte, false);
  assert.ok(ferme.prochaine instanceof Date && ferme.prochaine.getTime() > WEEKEND.getTime());
  assert.match(libelleOuverture(ferme.prochaine!), /lundi/);
});

test("la phrase reprend celle de la bande — une seule formulation de « ce qui attend »", () => {
  const routines = [routine("1", "haute", "/prospects/a")];
  const p = pouls([fiche("a", "contact")], routines, OUVERT);
  assert.ok(p.phrase.includes(presenceAlpha(routines).phrase));
});

/* ───────────── garde-fous armés ───────────── */

test("les garde-fous portent la VALEUR du moment, pas un principe", () => {
  const g = gardesArmes([fiche("a", "contact", { tags: [DO_NOT_CALL_TAG] })], WEEKEND);
  const par = Object.fromEntries(g.map((x) => [x.id, x.etat]));
  assert.match(par.fenetre, /fermée/);
  assert.match(par.fenetre, /prochaine ouverture/);
  assert.ok(par.plafond.includes(String(PLAFOND_SOLLICITATIONS_B2C)));
  assert.match(par.refus, /1 fiche écartée/);

  const ouvert = Object.fromEntries(gardesArmes([], OUVERT).map((x) => [x.id, x.etat]));
  assert.match(ouvert.fenetre, /ouverte/);
  assert.match(ouvert.refus, /personne n'a dit non/);
});

/* ───────────── journal ───────────── */

const act = (id: string, date: string, kind: Activity["kind"] = "systeme"): Activity => ({ id, date, kind, message: `m-${id}` });

test("le journal rend la trace la plus récente d'abord, plafonne l'AFFICHAGE, et nomme le genre", () => {
  const a = [act("vieille", "2026-10-01T10:00:00Z"), act("neuve", "2026-10-20T10:00:00Z", "campagne"), act("milieu", "2026-10-10T10:00:00Z")];
  const j = journalRecent(a, 2);
  assert.deepEqual(j.map((x) => x.id), ["neuve", "milieu"]);
  assert.equal(j[0].libelleKind, LIBELLE_KIND.campagne);
  assert.equal(a.length, 3, "le journal d'origine n'est pas amputé");
  assert.equal(a[0].id, "vieille", "le tri ne réordonne pas l'entrée");
});

test("chaque genre d'activité a son libellé", () => {
  for (const k of ["prospect", "stage", "meeting", "campagne", "ia", "systeme", "signe", "perdu"] as const) {
    assert.ok(LIBELLE_KIND[k], k);
  }
});

test("ilYa : à la minute, pas au jour", () => {
  const t = (s: number) => new Date(OUVERT.getTime() - s * 1000).toISOString();
  assert.equal(ilYa(t(5), OUVERT), "à l'instant");
  assert.equal(ilYa(t(5 * 60), OUVERT), "il y a 5 min");
  assert.equal(ilYa(t(3 * 3600), OUVERT), "il y a 3 h");
  assert.equal(ilYa(t(26 * 3600), OUVERT), "hier");
  assert.equal(ilYa(t(72 * 3600), OUVERT), "il y a 3 j");
  assert.equal(ilYa(new Date(OUVERT.getTime() + 60_000).toISOString(), OUVERT), "à l'instant", "une date future ne rend pas un temps négatif");
});

/* ───────────── une seule définition ───────────── */

test("⚠ le circuit ne refiltre JAMAIS les routines par priorité : il passe par `attendentUnHumain`", () => {
  const code = sansCommentaires(lire("lib/circuit-alpha.ts"));
  assert.ok(!/priority\s*[!=]==?\s*["']/.test(code), "une deuxième définition de « ce qui attend un humain » s'est glissée dans circuit-alpha");
  assert.match(code, /attendentUnHumain\(/);
  assert.match(sansCommentaires(lire("lib/presence-alpha.ts")), /attendentUnHumain\(routines\)/, "la bande doit lire la même fonction");
});

/* ───────────── le mouvement n'accompagne que des faits ───────────── */

test("⚠ aucune animation qui BOUCLE dans les composants d'« ALPHA au travail »", () => {
  const fichiers = [
    ...readdirSync(join(R, "components/alpha")).map((f) => `components/alpha/${f}`),
    "components/shell/alpha-ici.tsx",
    "app/(app)/travail/page.tsx",
  ];
  const BOUCLE = /animate-(?:pulse|spin|ping|bounce|floaty|shimmer)|pulse-ring|\binfinite\b|requestAnimationFrame\(\s*\(\)\s*=>\s*requestAnimationFrame/;
  const fautes = fichiers.filter((f) => BOUCLE.test(sansCommentaires(lire(f))));
  assert.deepEqual(fautes, [], "du mouvement sans fait derrière est une petite preuve fabriquée");
});

test("les nombres s'animent en JavaScript : le réglage « réduire les animations » doit les atteindre", () => {
  const code = sansCommentaires(lire("components/alpha/mouvement.tsx"));
  assert.match(code, /prefers-reduced-motion: reduce/);
  assert.match(code, /if \(reduit\)/, "en mouvement réduit, le nombre doit sauter à sa valeur");
});

/* ───────────── câblage : écrit ET branché ───────────── */

test("⚠ l'écran est BRANCHÉ : page, entrée de menu, droit d'accès — un module que rien n'atteint est mort", () => {
  const page = sansCommentaires(lire("app/(app)/travail/page.tsx"));
  for (const brique of ["lireCircuit(", "pouls(", "gardesArmes(", "journalRecent(", "<CircuitAlpha", "<GardesAlpha", "<JournalAlpha"]) {
    assert.ok(page.includes(brique), `la page ne branche pas ${brique}`);
  }
  const coquille = sansCommentaires(lire("components/shell/app-shell.tsx"));
  assert.match(coquille, /href: "\/travail"/, "l'écran n'a pas d'entrée de menu");
  assert.match(coquille, /<AlphaIci \/>/, "« Ce qu'ALPHA fait ici » n'est monté nulle part");
  assert.match(sansCommentaires(lire("lib/bricks-access.ts")), /"\/travail":\s*\["crm"\]/, "le contrôle d'accès ne connaît pas /travail");
});
