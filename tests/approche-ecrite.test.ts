import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approcheEcrite } from "../lib/approche-ecrite";
import { emailSubject, emailBody } from "../lib/mail-compose";
import { messageText } from "../lib/linkedin-sequence";
import { pickMagnet, LEAD_MAGNETS } from "../lib/lead-magnet";
import { deepDive } from "../lib/deep-dive";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON ÉCRIT DOIT ÊTRE CE QU'ON ENVOIE.
 *
 * ⚠ DEUX DÉFAUTS, ET C'EST LE MÊME QUE CÔTÉ VOIX.
 *
 * 1. `mail-compose` et `linkedin-sequence` annonçaient tous les deux, en dur :
 *    « je travaille avec les métiers où le téléphone est le premier point de
 *    contact » et « un audit de son accueil téléphonique ». L'angle Callflow,
 *    sur toutes les fiches, quel que soit le routage.
 *
 *    Sur un prospect classé « invisible en ligne », le message proposait donc
 *    un audit TÉLÉPHONIQUE pendant que l'aimant réellement servi par
 *    `pickMagnet` s'appelle « Audit de votre visibilité locale ». Le message
 *    vendait une chose, la pièce jointe une autre.
 *
 * 2. Les trois phrases étaient DUPLIQUÉES MOT POUR MOT dans les deux
 *    fichiers : corriger l'un laissait l'autre mentir.
 *
 * Ce qui rend ce défaut instructif : `pickMagnet` portait déjà le commentaire
 * « même logique de routage, donc jamais de contradiction entre ce qu'on
 * envoie et ce qu'on proposera ensuite ». La promesse était juste ; le corps
 * du message ne consultait simplement pas la fonction qui la tenait.
 * ─────────────────────────────────────────────────────────────────────
 */

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc",
    company: "Carrosserie Test",
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
    email: "marc@test.fr",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

/** Trois fiches qui routent vers trois offres différentes. */
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
  // Sinon les tests ci-dessous passeraient sans rien éprouver.
  const offres = new Set(CAS.map(({ p }) => deepDive(p).offer));
  assert.equal(offres.size, 3, `routage attendu sur 3 offres, obtenu : ${[...offres].join(", ")}`);
});

test("⚠ l'email annonce l'audit QU'ON ENVERRA, et aucun autre", () => {
  for (const { quoi, p } of CAS) {
    const attendu = pickMagnet(p, "eagleye")!.magnet;
    const corps = emailBody(p, { accountId: "eagleye" });

    assert.ok(
      corps.includes(attendu.title.toLowerCase()),
      `${quoi} : le message doit nommer « ${attendu.title} »`
    );
    for (const autre of LEAD_MAGNETS.filter((m) => m.id !== attendu.id)) {
      assert.ok(
        !corps.includes(autre.title.toLowerCase()),
        `${quoi} : « ${autre.title} » n'a rien à faire dans ce message`
      );
    }
  }
});

test("⚠ l'OBJET et le CORPS annoncent le même audit", () => {
  // Ils étaient calculés séparément : l'objet disait « une question sur vos
  // appels » dès qu'une verticale existait, le corps disait autre chose.
  for (const { quoi, p } of CAS) {
    const titre = pickMagnet(p, "eagleye")!.magnet.title.toLowerCase();
    assert.ok(emailSubject(p, "eagleye").includes(titre), `${quoi} : l'objet doit porter le bon sujet`);
    assert.ok(emailBody(p, { accountId: "eagleye" }).includes(titre), `${quoi} : le corps aussi`);
  }
});

test("⚠ l'email et le message LinkedIn ne peuvent plus se contredire", () => {
  /**
   * Les trois phrases étaient recopiées d'un fichier à l'autre. Elles
   * viennent maintenant du même calcul — ce test le vérifie sur le contenu,
   * pas sur la forme, pour que la garde survive à une réécriture de style.
   */
  for (const { quoi, p } of CAS) {
    const a = approcheEcrite(p, "eagleye");
    const mail = emailBody(p, { accountId: "eagleye" });
    const li = messageText(p, undefined, "eagleye");

    assert.ok(mail.includes(a.critere), `${quoi} : l'email doit porter le critère routé`);
    assert.ok(li.includes(a.critere), `${quoi} : LinkedIn aussi, et le MÊME`);
    assert.ok(mail.includes(a.question), `${quoi} : même question à l'email`);
    assert.ok(li.includes(a.question), `${quoi} : et sur LinkedIn`);
    assert.ok(a.signal && mail.includes(a.signal) && li.includes(a.signal), `${quoi} : même audit annoncé`);
  }
});

test("⚠ un compte ne peut pas annoncer un audit qu'il ne sert pas", () => {
  /**
   * ScintIA ne vend QUE Callflow. Une fiche « invisible en ligne » lue depuis
   * ce compte ne doit pas se voir proposer un audit de visibilité : ce serait
   * promettre un document que le compte n'a pas le droit de produire.
   */
  const invisible = CAS[1].p;
  const servi = pickMagnet(invisible, "scintia");
  assert.ok(servi, "ScintIA doit tout de même avoir un aimant");
  const corps = emailBody(invisible, { accountId: "scintia" });
  assert.ok(
    corps.includes(servi!.magnet.title.toLowerCase()),
    "le message doit annoncer l'aimant réellement servi par le compte"
  );
  assert.equal(servi!.magnet.offer, "callflow", "et pour ScintIA, c'est Callflow");
});

test("sans aimant disponible, on n'annonce AUCUN audit", () => {
  // Même doctrine que côté voix : annoncer le mauvais document coûte plus
  // cher que de n'en annoncer aucun. On vérifie la forme rendue, pas un
  // compte particulier — le portefeuille peut changer.
  const a = approcheEcrite(CAS[0].p, "compte-qui-n-existe-pas-et-ne-vend-rien");
  if (a.signal === null) {
    assert.equal(a.objet, "une question", "sans aimant, l'objet ne promet rien");
  } else {
    // Le compte inconnu retombe sur le maître : c'est légitime, mais alors
    // l'audit annoncé doit être un VRAI aimant, pas une phrase inventée.
    assert.ok(
      LEAD_MAGNETS.some((m) => a.signal!.includes(m.title.toLowerCase())),
      "tout audit annoncé doit correspondre à un aimant réel"
    );
  }
});

test("⚠ un message hors-Callflow ne reparle pas du téléphone", () => {
  /**
   * ⚠ CE DÉFAUT A SURVÉCU À LA PREMIÈRE CORRECTION, et il n'a été vu qu'en
   * LISANT le message rendu — les tests passaient.
   *
   * Le critère routé était bon, mais la ligne suivante ajoutait sans
   * condition l'observation de métier du playbook :
   *
   *   « je travaille avec les commerces et artisans invisibles en ligne.
   *     Les métiers où l'artisan est sur le chantier toute la journée —
   *     donc jamais près du téléphone. »
   *
   * Et la question posée restait « Quand vous êtes sur un chantier et que ça
   * sonne, il se passe quoi ? » sur une fiche routée visibilité. Le bon angle,
   * contredit deux lignes plus bas.
   */
  for (const { quoi, p } of CAS) {
    const offre = deepDive(p).offer;
    if (offre === "callflow") continue;
    for (const texte of [emailBody(p, { accountId: "eagleye" }), messageText(p, undefined, "eagleye")]) {
      const sansAudit = texte.replace(/Il m'arrive de préparer[\s\S]*/, "");
      assert.doesNotMatch(
        sansAudit,
        /téléphone|ça sonne|décroch|appels? manqué/i,
        `${quoi} (${offre}) : le message ramène le téléphone alors qu'il vend autre chose`
      );
    }
  }
});

test("le playbook parle bien de téléphone partout — c'est ce qui justifie la règle", () => {
  /**
   * La règle « la verticale n'enrichit que Callflow » repose sur un FAIT
   * vérifiable, pas sur un avis : les critères du playbook sont tous écrits
   * autour du téléphone. Le jour où quelqu'un en ajoute un qui ne l'est pas,
   * ce test échoue et la règle se rediscute — au lieu de rester appliquée
   * pour une raison devenue fausse.
   */
  const src = readFileSync(join(process.cwd(), "lib/playbook.ts"), "utf8");
  const criteres = [...src.matchAll(/criterion:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(criteres.length >= 8, `lecture du playbook cassée : ${criteres.length} critères`);
  const horsSujet = criteres.filter((c) => !/téléphone|décroch|standard|sonne|appel/i.test(c));
  assert.deepEqual(
    horsSujet,
    [],
    "ces critères ne parlent plus du téléphone — la règle « la verticale n'enrichit que Callflow » " +
      "doit être rediscutée :\n  " + horsSujet.join("\n  ")
  );
});

test("la phrase d'audit reste à la deuxième personne d'un bout à l'autre", () => {
  /**
   * Le texte d'origine disait « un audit de SON accueil — ce qu'ELLE capte ».
   * En y injectant le titre réel de l'aimant, écrit « Audit de VOTRE accueil »,
   * on obtenait « un audit de votre accueil — ce qu'elle capte ». Vu au
   * rendu, pas déduit : ça se remarque à la première lecture.
   */
  for (const { quoi, p } of CAS) {
    const a = approcheEcrite(p, "eagleye");
    assert.ok(a.signal, `${quoi} : un audit doit être annoncé`);
    assert.doesNotMatch(a.signal!, /ce qu'elle capte|ce qui lui échappe/i, `${quoi} : mélange de personnes`);
    assert.match(a.signal!, /ce que vous captez/i, `${quoi} : la phrase doit rester en « vous »`);
  }
});

test("⚠ plus aucun angle d'offre n'est écrit en dur dans les deux rédacteurs", () => {
  /**
   * La formulation exacte qui a causé le défaut — et qui existait en double.
   * Les commentaires sont retirés : ce dépôt explique ses erreurs, et une
   * garde qui punit l'explication se fait contourner par le silence.
   */
  for (const f of ["lib/mail-compose.ts", "lib/linkedin-sequence.ts"]) {
    const code = readFileSync(join(process.cwd(), f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /audit de son accueil téléphonique/i, `${f} : l'angle Callflow ne doit plus être en dur`);
    assert.doesNotMatch(
      code,
      /le téléphone est le premier point de contact/i,
      `${f} : le critère Callflow ne doit plus être en dur`
    );
    assert.match(code, /approcheEcrite\(/, `${f} doit tirer son angle de l'aimant routé`);
  }
});
