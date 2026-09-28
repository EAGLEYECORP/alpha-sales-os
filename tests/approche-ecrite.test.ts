import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approcheEcrite } from "../lib/approche-ecrite";
import { emailSubject, emailBody } from "../lib/mail-compose";
import { messageText } from "../lib/linkedin-sequence";
import { pickMagnet, LEAD_MAGNETS } from "../lib/lead-magnet";
import { seedProspects } from "../lib/seed";
import { deepDive } from "../lib/deep-dive";
import { VERTICALS } from "../lib/playbook";
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
   * Un compte revendeur est borné à SES offres. Une fiche qui crie « appels
   * manqués » lue depuis Nuwacom ne doit pas se voir proposer l'audit
   * téléphonique : ce serait promettre un document que le compte n'a pas le
   * droit de produire, au nom d'une marque qui n'est pas la nôtre.
   *
   * ⚠ Le compte qui servait d'exemple ici (le revendeur de l'accueil
   * téléphonique) a disparu, et son offre est revenue chez EAGLEYE. L'invariant
   * n'a pas bougé d'un pouce : c'est le COMPTE qui borne, pas l'offre.
   */
  const telephone = CAS[0].p;
  const servi = pickMagnet(telephone, "nuwacom");
  if (servi) {
    assert.notEqual(
      servi.magnet.offer,
      "alpha-voice",
      "Nuwacom ne vend pas notre agent vocal : il ne peut pas en promettre l'audit"
    );
    const corps = emailBody(telephone, { accountId: "nuwacom" });
    assert.ok(
      corps.includes(servi.magnet.title.toLowerCase()),
      "le message doit annoncer l'aimant réellement servi par le compte"
    );
  }

  // Et depuis EAGLEYE, qui porte l'offre, l'audit téléphonique est bien servi.
  const chezNous = pickMagnet(telephone, "eagleye");
  assert.ok(chezNous, "EAGLEYE doit avoir un aimant pour cette fiche");
  assert.equal(chezNous!.magnet.offer, "alpha-voice");
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

test("⚠ un message hors-Alpha Voice ne reparle pas du téléphone", () => {
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
    if (offre === "alpha-voice") continue;
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

test("une verticale SANS offre déclarée doit parler de téléphone — c'est le défaut", () => {
  /**
   * ⚠ CE TEST GARDAIT UNE RÈGLE QUI A CHANGÉ, ET IL A FAIT SON TRAVAIL.
   *
   * Il vérifiait que TOUS les critères du playbook parlent du téléphone, parce
   * que `approcheEcrite` en déduisait « la verticale n'enrichit que Alpha
   * Voice ». La verticale maîtrise d'ouvrage l'a fait tomber : elle sert l'OS
   * de vente, et son critère parle de réservations, pas de standard.
   *
   * La règle a donc été remplacée par la vraie question — la verticale et
   * l'aimant servent-ils la même offre ? — et ce test garde maintenant le
   * DÉFAUT de cette question : `offre` absente veut dire `alpha-voice`. Une
   * verticale qui ne déclare rien et ne parle pas du téléphone hériterait
   * silencieusement du mauvais angle.
   *
   * ⚠ Il lit `VERTICALS` et non plus le texte du fichier : il faut apparier
   * chaque critère avec l'offre de SA verticale, ce qu'une expression
   * régulière sur la source ne sait pas faire sans se tromper.
   */
  assert.ok(VERTICALS.length >= 8, `lecture du playbook cassée : ${VERTICALS.length} verticales`);

  const horsSujet = VERTICALS.filter(
    (v) => !v.offre && !/téléphone|décroch|standard|sonne|appel/i.test(v.criterion)
  ).map((v) => `${v.id} — ${v.criterion}`);

  assert.deepEqual(
    horsSujet,
    [],
    "ces verticales ne déclarent aucune offre et ne parlent pas du téléphone : elles vont hériter " +
      "d'alpha-voice par défaut, donc du mauvais angle. Déclarer `offre` :\n  " + horsSujet.join("\n  ")
  );

  // Et le pendant : celle qui déclare une autre offre doit vraiment exister,
  // sinon le test ci-dessus ne garde plus rien (il passerait sur zéro cas).
  assert.ok(
    VERTICALS.some((v) => v.offre && v.offre !== "alpha-voice"),
    "aucune verticale ne sert une autre offre : la règle des offres n'est plus exercée par ce test"
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
    assert.doesNotMatch(code, /audit de son accueil téléphonique/i, `${f} : l'angle Alpha Voice ne doit plus être en dur`);
    assert.doesNotMatch(
      code,
      /le téléphone est le premier point de contact/i,
      `${f} : le critère Alpha Voice ne doit plus être en dur`
    );
    assert.match(code, /approcheEcrite\(/, `${f} doit tirer son angle de l'aimant routé`);
  }
});

test("⚠⚠ TOUT CIBLAGE D'AIMANT SÉPARE LE CRITÈRE DES EXEMPLES", () => {
  /**
   * ⚠⚠ SANS CE SÉPARATEUR, LES EXEMPLES DEVIENNENT LE CRITÈRE — et le message
   * récite au prospect une liste de métiers qui ne sont pas le sien.
   *
   * `critereDepuisCiblage` coupe `targets` au deux-points : ce qui précède est
   * la RÈGLE (« les métiers où le téléphone EST le canal d'entrée »), ce qui
   * suit est une note interne (« garages, artisans, santé… »). Réciter la
   * seconde à un prospect donne l'impression d'un publipostage.
   *
   * ⚠ Mesuré le 11/09/2026 : l'aimant « visibilité » n'avait pas de
   * deux-points. Son ciblage entier — « Commerces et artisans invisibles en
   * ligne » — devenait donc le critère, et DEUX fiches de maîtrise d'ouvrage
   * du jeu de démonstration proposaient « je travaille avec les commerces et
   * artisans invisibles en ligne » à une société d'aménagement. Le marché
   * d'avant, dans un message sortant.
   *
   * Aucun test ne pouvait l'attraper : les deux autres aimants avaient leur
   * deux-points, donc le mécanisme marchait — sur deux cas sur trois.
   */
  assert.ok(LEAD_MAGNETS.length >= 3, `extraction cassée : ${LEAD_MAGNETS.length} aimant(s)`);
  for (const m of LEAD_MAGNETS) {
    assert.ok(
      m.targets.includes(":"),
      `l'aimant « ${m.title} » n'a pas de deux-points dans son ciblage — ses EXEMPLES deviendront le critère servi au prospect :\n  « ${m.targets} »`
    );
    const critere = m.targets.split(":")[0].trim();
    assert.ok(critere.length >= 12, `« ${m.title} » : critère trop court avant le deux-points (« ${critere} »)`);

    /**
     * ⚠ `approcheEcrite` écrit « je travaille avec **les** {critère} ». Le
     * critère doit donc être un groupe nominal pluriel SANS SON ARTICLE.
     * Deux rédactions fausses le même jour, sur le même aimant :
     *  · « Ceux qu'on ne trouve pas » → « je travaille avec les CEUX… » ;
     *  · « Les entreprises qu'on… »   → « je travaille avec les LES… ».
     * La première n'a été vue qu'en imprimant le rendu réel des huit fiches.
     */
    assert.doesNotMatch(
      critere,
      /^(?:les|la|le|des|du|un|une|ceux|celles|ce|cet|cette)\b/i,
      `« ${m.title} » : le ciblage commence par « ${critere.split(" ")[0]} » — le message dirait « je travaille avec les ${critere.toLowerCase()} »`
    );
  }
});

test("⚠ LA PHRASE DE CRITÈRE SE LIT EN FRANÇAIS, sur chaque fiche livrée", () => {
  /**
   * ⚠ LE TEST CI-DESSUS GARDE LA SOURCE ; CELUI-CI GARDE LE RÉSULTAT.
   *
   * Les deux sont nécessaires : le premier attrape la cause connue (l'article
   * dans le ciblage), le second attrape la faute quelle qu'en soit la cause —
   * un déterminant doublé dans la phrase réellement envoyée. C'est le seul qui
   * aurait vu « je travaille avec les ceux » sans qu'on sache pourquoi.
   */
  const fiches = seedProspects;
  assert.ok(fiches.length > 0, "aucune fiche — le test ne mesure rien");
  for (const p of fiches) {
    const phrase = `je travaille avec ${approcheEcrite(p).critere}`;
    assert.doesNotMatch(
      phrase,
      /\b(les|la|le|des|du|un|une)\s+(les|la|le|des|du|un|une|ceux|celles|ce|cet|cette)\b/i,
      `déterminant doublé pour ${p.company} : « ${phrase} »`
    );
  }
});
