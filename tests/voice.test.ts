import test from "node:test";
import assert from "node:assert/strict";
import { extractDebrief, parseFrenchDate } from "../lib/debrief";
import { matchObjections, matchAlarms, MATCH_FLOOR } from "../lib/live-assist";
import { normalize, overlap, tokens } from "../lib/speech-text";
import { VERTICALS } from "../lib/playbook";

/**
 * La voix décide de ce qui est écrit dans le CRM. Une date mal comprise
 * devient un rendez-vous manqué ; une objection mal reconnue devient une
 * mauvaise réponse soufflée en plein appel. Ces deux moteurs doivent
 * être exacts ou se taire — jamais approximatifs.
 */

// Mercredi 12 août 2026, midi — repère fixe pour toutes les dates.
const NOW = new Date("2026-08-12T12:00:00Z");
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

// ─────────────────────────── Dates parlées ───────────────────────────

test("date — demain et après-demain", () => {
  assert.equal(day(parseFrenchDate("je repasse demain", NOW)), "2026-08-13");
  assert.equal(day(parseFrenchDate("après-demain sans faute", NOW)), "2026-08-14");
});

test("date — un jour de la semaine désigne la prochaine occurrence", () => {
  // NOW est un mercredi : « jeudi » = le lendemain.
  assert.equal(day(parseFrenchDate("je rappelle jeudi", NOW)), "2026-08-13");
  // « lundi » depuis un mercredi = le lundi suivant.
  assert.equal(day(parseFrenchDate("on se voit lundi", NOW)), "2026-08-17");
});

test("date — le même jour de la semaine renvoie à la semaine suivante", () => {
  // Dit un mercredi, « mercredi » ne peut pas vouloir dire aujourd'hui.
  assert.equal(day(parseFrenchDate("mercredi prochain", NOW)), "2026-08-19");
});

test("date — « dans N jours / semaines », en chiffres comme en lettres", () => {
  assert.equal(day(parseFrenchDate("dans 3 jours", NOW)), "2026-08-15");
  assert.equal(day(parseFrenchDate("dans deux semaines", NOW)), "2026-08-26");
  assert.equal(day(parseFrenchDate("la semaine prochaine", NOW)), "2026-08-19");
});

test("date — date explicite, et bascule sur l'année suivante si déjà passée", () => {
  assert.equal(day(parseFrenchDate("le 12 septembre", NOW)), "2026-09-12");
  // Mars 2026 est passé : c'est mars 2027 qui est visé.
  assert.equal(day(parseFrenchDate("le 3 mars", NOW)), "2027-03-03");
});

test("date — un jour cité en passant ne devient pas le rendez-vous", () => {
  // « ils ratent des appels le samedi » décrit une habitude, pas une date.
  // Sans ancrage sur le verbe d'action, le premier jour prononcé gagnerait
  // et on poserait le rappel un samedi.
  assert.equal(
    day(parseFrenchDate("ils ratent des appels le samedi, je rappelle jeudi", NOW)),
    "2026-08-13"
  );
  assert.equal(
    day(parseFrenchDate("il est fermé demain, je repasse lundi", NOW)),
    "2026-08-17"
  );
});

test("date — sans date dite, on ne devine RIEN", () => {
  // Le piège : renvoyer « aujourd'hui » par défaut créerait une fausse
  // prochaine étape, qui a l'air vraie. Mieux vaut null.
  assert.equal(parseFrenchDate("il faut que je le rappelle un de ces jours", NOW), null);
  assert.equal(parseFrenchDate("bon rendez-vous correct, il réfléchit", NOW), null);
});

// ─────────────────────── Extraction du débrief ───────────────────────

const REAL =
  "Garage Bouchon, j'ai vu Marc le gérant, ils ratent des appels le samedi, " +
  "il veut en parler à son associé, je rappelle jeudi.";

test("débrief — le cas réel : interlocuteur, frein, prochaine étape datée", () => {
  const d = extractDebrief(REAL, NOW);
  assert.equal(d.interlocutor, "Marc");
  assert.ok(
    d.objections.some((o) => o.id === "en-parler"),
    "le frein « il en parle à son associé » doit être reconnu"
  );
  assert.equal(day(d.nextStep!.date), "2026-08-13");
  assert.equal(d.nextStep!.action, "Rappeler");
  assert.equal(d.notes, REAL, "le transcript brut est conservé intact");
});

test("débrief — sans date, aucune prochaine étape et le manque est signalé", () => {
  const d = extractDebrief("Vu le patron du restaurant, il trouve ça trop cher.", NOW);
  assert.equal(d.nextStep, undefined);
  assert.ok(d.missing.some((m) => m.includes("date")));
  assert.ok(d.objections.some((o) => o.id === "trop-cher"));
});

test("débrief — le canal se devine, visite ou appel", () => {
  assert.equal(extractDebrief("je sors de chez eux, sur place", NOW).channel, "visite");
  assert.equal(extractDebrief("je viens de l'avoir au téléphone", NOW).channel, "appel");
});

test("débrief — l'étape suggérée reste une suggestion, jamais « signé »", () => {
  const perdu = extractDebrief("il m'a dit non, pas intéressé du tout", NOW);
  assert.equal(perdu.stageHint, "perdu");
  // Aucun mot ne doit pouvoir faire basculer une fiche en « signé » :
  // signer est un engagement, il se décide, il ne se dicte pas.
  const signe = extractDebrief("c'est bon il signe, il a dit oui, on est d'accord", NOW);
  assert.notEqual(signe.stageHint, "signe");
});

test("débrief — le résumé reste lisible dans une timeline", () => {
  const long = `${"une phrase très longue qui n'en finit pas ".repeat(20)}.`;
  assert.ok(extractDebrief(long, NOW).summary.length <= 160);
});

test("débrief — rien n'est inventé sur un transcript vide de faits", () => {
  const d = extractDebrief("euh bon voilà quoi c'était bien", NOW);
  assert.equal(d.interlocutor, undefined);
  assert.equal(d.nextStep, undefined);
  assert.equal(d.objections.length, 0);
  assert.equal(d.missing.length, 3, "les trois manques doivent être annoncés");
});

// ──────────────────── Assistant d'appel en direct ────────────────────

test("assistant — reconnaît les objections courantes du terrain", () => {
  const cases: [string, string][] = [
    ["ah non mais on a déjà une assistante ici", "deja-quelquun"],
    ["écoutez c'est trop cher pour nous", "trop-cher"],
    ["envoyez-moi un mail je regarderai", "envoyez-mail"],
    ["faut que j'en parle à mon associé", "en-parler"],
    ["un robot au téléphone ça fait fuir les clients", "robot"],
    ["non merci ça ne m'intéresse pas", "pas-interesse"],
  ];
  for (const [heard, id] of cases) {
    const m = matchObjections(heard);
    assert.ok(m.some((x) => x.id === id), `« ${heard} » devait matcher ${id} — obtenu : ${m.map((x) => x.id).join(",") || "rien"}`);
  }
});

test("assistant — se tait quand rien ne correspond", () => {
  // Souffler une réponse à côté en plein appel est pire que de se taire.
  assert.equal(matchObjections("oui bonjour je vous appelle de la part d'Eagleye").length, 0);
});

test("assistant — la réponse de la verticale l'emporte sur la générique", () => {
  const auto = VERTICALS.find((v) => v.id === "auto-ecole")!;
  const m = matchObjections("on a déjà un répondeur pour les appels", auto);
  assert.ok(m.length > 0);
  assert.equal(m[0].source, "verticale", "à score égal, le playbook du métier passe devant");
  assert.ok(m[0].answer.includes("répondeur"));
});

test("assistant — chaque réponse soufflée est utilisable telle quelle", () => {
  for (const heard of ["c'est trop cher", "on a déjà une secrétaire", "rappelez-moi plus tard"]) {
    for (const m of matchObjections(heard)) {
      assert.ok(m.answer.length > 40, `réponse trop courte pour ${m.id}`);
      assert.ok(m.score >= MATCH_FLOOR);
    }
  }
});

test("assistant — alerte quand l'opérateur casse la doctrine", () => {
  assert.ok(matchAlarms("alors ça coûte environ 200 euros par mois").some((a) => a.id === "prix-avant-demo"));
  assert.ok(matchAlarms("j'ai vu que vous fermez le week-end").some((a) => a.id === "observation-affirmee"));
  assert.ok(matchAlarms("j'appelle toutes les agences de Lyon").some((a) => a.id === "ciblage-volume"));
  assert.ok(matchAlarms("votre note Google est un peu basse").some((a) => a.id === "note-google"));
});

test("assistant — une conversation propre ne déclenche aucune alerte", () => {
  assert.equal(matchAlarms("vous fermez le week-end, c'est bien ça ?").length, 0);
  assert.equal(matchAlarms("je travaille avec les métiers où le téléphone est le chiffre d'affaires").length, 0);
});

// ───────────────────────── Texte parlé ─────────────────────────

test("texte — accents et apostrophes ne changent pas le sens", () => {
  assert.equal(normalize("J'ai déjà une assistante !"), "j ai deja une assistante");
  assert.ok(tokens("j'ai déjà une assistante").includes("assistante"));
  assert.ok(!tokens("j'ai déjà une assistante").includes("une"), "les mots vides sont écartés");
});

test("texte — le recouvrement mesure la référence retrouvée dans l'entendu", () => {
  assert.equal(overlap("j'ai déjà une assistante", "J'ai déjà une assistante."), 1);
  // Une phrase entendue plus longue n'est pas pénalisée.
  assert.equal(overlap("alors écoutez j'ai déjà une assistante ici merci", "J'ai déjà une assistante."), 1);
  assert.ok(overlap("il fait beau aujourd'hui", "J'ai déjà une assistante.") < MATCH_FLOOR);
});
