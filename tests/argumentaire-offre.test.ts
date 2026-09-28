import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildArgumentaire } from "../lib/argumentaire";
import { deepDive } from "../lib/deep-dive";
import { OFFRES, type EagleyeOffer } from "../lib/offer-match";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ARGUMENTAIRE SUIT L'OFFRE — SINON IL ANNULE LA CORRECTION DU DESSUS.
 *
 * ⚠ CE DÉFAUT SE CACHAIT SOUS UNE CORRECTION DÉJÀ FAITE.
 *
 * Le script vocal avait été rendu conforme à l'offre routée. Mais
 * `campaign-runner` colle `argu.questions` dans le même brief, sous
 * « Questions qui font constater » — et ces questions étaient TOUTES écrites
 * au téléphone. Une fiche routée visibilité recevait donc :
 *
 *   Offre représentée : Visibilité / Growth
 *   Questions : « Quand vous êtes en intervention et que le téléphone
 *                 sonne, il se passe quoi ? »
 *
 * La même contradiction, d'un cran plus bas. Corriger la couche visible sans
 * descendre d'un étage n'aurait rien réglé du tout.
 * ─────────────────────────────────────────────────────────────────────
 */

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc",
    company: "Régie Test",
    sector: "artisan",
    city: "Lyon 6e",
    stage: "contact",
    trust: 40,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

const CAS: { quoi: string; p: Prospect }[] = [
  {
    quoi: "téléphone qui déborde",
    p: fixture({ deepAudit: { websiteState: "ok", socialState: "actif", localCompetition: "", currentProcess: "", missedCallsPerWeek: 9 } }),
  },
  {
    quoi: "invisible en ligne",
    p: fixture({ deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "", googleReviews: 2 } }),
  },
  {
    quoi: "du deal à outiller",
    p: fixture({ sector: "autre", monthlyValue: 4000, deepAudit: { websiteState: "ok", socialState: "actif", localCompetition: "", currentProcess: "" } }),
  },
];

test("les trois fiches routent bien vers trois offres différentes", () => {
  const offres = new Set(CAS.map(({ p }) => deepDive(p).offer));
  assert.equal(offres.size, 3, `routage attendu sur 3 offres, obtenu : ${[...offres].join(", ")}`);
});

test("⚠ les questions de l'argumentaire suivent l'offre routée", () => {
  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    const q = buildArgumentaire(p).questions.join(" | ");

    assert.ok(q.includes(OFFRES[offre].question), `${quoi} : l'ouverture de ${offre} doit y être`);
    assert.ok(
      q.includes(OFFRES[offre].consequence),
      `${quoi} : la question de conséquence de ${offre} doit y être`
    );

    // Et surtout : pas celles des autres offres.
    for (const autre of (Object.keys(OFFRES) as EagleyeOffer[]).filter((x) => x !== offre)) {
      assert.ok(!q.includes(OFFRES[autre].question), `${quoi} : l'ouverture de ${autre} n'a rien à y faire`);
      assert.ok(!q.includes(OFFRES[autre].consequence), `${quoi} : ni sa question de conséquence`);
    }
  }
});

test("⚠ un argumentaire hors-Alpha Voice ne pose aucune question sur le téléphone", () => {
  /**
   * C'est la formulation exacte du défaut : « Quand vous êtes en intervention
   * et que le téléphone sonne… » posée à quelqu'un à qui on vend de la
   * visibilité.
   */
  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    if (offre === "alpha-voice") continue;
    const a = buildArgumentaire(p);
    for (const bloc of [a.questions.join(" "), a.marketStandard.join(" ")]) {
      assert.doesNotMatch(
        bloc,
        /téléphone|ça sonne|décroch|appels? manqué|rappellent/i,
        `${quoi} (${offre}) : l'argumentaire ramène le téléphone`
      );
    }
  }
});

test("⚠ la NORME DU MARCHÉ n'est pas inventée pour une offre jamais vendue", () => {
  /**
   * La tentation était d'écrire trois lignes équivalentes pour la visibilité
   * et pour Alpha Sales OS. Ce sont des affirmations sur le MARCHÉ, dites à un
   * prospect — CLAUDE.md pose que sans vente ni mesure, les produire revient à
   * fabriquer de la preuve. Zéro client sur ces deux offres.
   *
   * Ce test verrouille l'ABSENCE. Le jour où ces lignes existeront, il
   * échouera — et c'est bien : il faudra alors dire d'où elles viennent.
   */
  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    const norme = buildArgumentaire(p).marketStandard;
    if (offre === "alpha-voice") {
      assert.ok(norme.length >= 3, `${quoi} : Alpha Voice garde ses lignes`);
    } else {
      assert.deepEqual(norme, [], `${quoi} (${offre}) : aucune norme de marché ne doit être affirmée`);
    }
  }
});

test("l'écran DIT l'absence au lieu de laisser un titre suivi de blanc", () => {
  // Un vide muet se lit comme un bug : l'opérateur cherche ce qu'il a cassé
  // au lieu de passer à la question suivante.
  const src = readFileSync(join(process.cwd(), "components/prospects/master-panel.tsx"), "utf8");
  assert.match(src, /marketStandard\.length \?/, "le rendu doit distinguer le cas vide");
  assert.match(src, /on n&apos;invente pas une norme de marché/i, "et expliquer pourquoi il est vide");
});

test("⚠ ce que l'agent doit APPRENDRE suit aussi l'offre", () => {
  /**
   * ⚠ TROISIÈME COUCHE DU MÊME DÉFAUT, et la plus sournoise.
   *
   * Les `gaps` du deep-dive partent dans le brief sous « Ce que tu dois
   * APPRENDRE » : ce ne sont pas des notes, ce sont des CONSIGNES. Sur une
   * fiche routée visibilité, l'agent recevait l'ordre d'aller chercher « le
   * volume d'appels manqués » et « comment ils gèrent les appels ».
   *
   * Ça ne se lit pas comme un argumentaire hors sujet — ça se lit comme un
   * objectif — donc personne ne l'aurait remarqué en relisant le script.
   */
  for (const { quoi, p } of CAS) {
    const d = deepDive(p);
    const g = d.gaps.join(" | ");
    if (d.offer === "alpha-voice") {
      assert.match(g, /appels/i, `${quoi} : Alpha Voice garde ses trous téléphone`);
      continue;
    }
    assert.doesNotMatch(
      g,
      /appels manqués|gèrent les appels/i,
      `${quoi} (${d.offer}) : on envoie l'agent chercher un chiffre qui ne concerne pas cette offre`
    );
    assert.ok(g.includes(OFFRES[d.offer].perte), `${quoi} : le constat de SON offre doit être demandé`);
  }
});

test("on n'annonce pas un « chiffre » là où la question est fermée", () => {
  /**
   * `perte` est un nombre pour Callflow (« combien d'appels ») et une question
   * fermée pour la visibilité (« il vous trouve ? »). Étiqueter les deux
   * « le chiffre qui fait mal » envoie l'agent chercher ce qui n'existe pas.
   */
  const visi = CAS.find(({ p }) => deepDive(p).offer === "visibilite-growth")!;
  const g = deepDive(visi.p).gaps.join(" | ");
  assert.doesNotMatch(g, /le chiffre qui fait mal : « Quelqu'un qui cherche/);
  assert.match(g, /faire constater/i, "l'étiquette doit dire ce que c'est vraiment");
});

test("⚠ plus aucune question n'est écrite en dur dans l'argumentaire", () => {
  const code = readFileSync(join(process.cwd(), "lib/argumentaire.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(
    code,
    /Quand vous êtes en intervention et que le téléphone sonne/,
    "l'ouverture Alpha Voice ne doit plus être en dur"
  );
  assert.match(code, /OFFRES\[offre\]/, "les questions doivent venir du catalogue d'offres");
  assert.match(code, /deepDive\(p, accountId\)\.offer/, "et l'offre du même calcul que partout ailleurs");
});
