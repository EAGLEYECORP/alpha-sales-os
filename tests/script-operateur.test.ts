import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scriptOperateur, scriptAServir, ID_SCRIPT_OPERATEUR } from "../lib/script-operateur";
import { approcheInscrit } from "../lib/approche-ecrite";
import { buildCallSession, callAngle } from "../lib/call-session";
import { matchObjections, OBJECTION_CUES } from "../lib/live-assist";
import { VERTICALS, verticalById, type VerticalPlaybook } from "../lib/playbook";
import { PROFIL_VIDE, type ProfilOperateur } from "../lib/profil-operateur";
import { prospect } from "./fixtures";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN INSCRIT PRONONCE SON OFFRE, JAMAIS LA NÔTRE.
 *
 * Mesuré le 21/10/2026 en exécutant le vrai code : un inscrit qui vend un
 * logiciel de paie à des restaurants lisait sur `/appels` « On installe un
 * accueil qui décroche quand vous ne pouvez pas » — l'argumentaire d'ALPHA
 * VOICE. Et l'assistant d'appel lui soufflait « elle ne prend qu'un appel à
 * la fois ». Nos verticales et notre catalogue d'objections ont été écrits
 * pour qu'EAGLEYE vende Alpha ; ils ne servent qu'au compte maître.
 * ─────────────────────────────────────────────────────────────────────
 */

const PAIE: ProfilOperateur = {
  ...PROFIL_VIDE,
  metier: "un logiciel de paie",
  cibleSecteur: "restaurants",
  cibleRole: "gérants",
  cibleZone: "Lyon",
};

/** Tout ce qu'un script fait dire ou lire à l'appelant. */
function textesDuScript(v: VerticalPlaybook): string[] {
  return [
    v.label,
    v.criterion,
    v.structuralPain,
    v.mirror,
    ...v.opener.flatMap((o) => [o.line, o.note ?? ""]),
    ...v.diagnostic,
    ...v.forbidden.map((f) => f.regle),
    ...v.objections.flatMap((o) => [o.q, o.a]),
  ];
}

/**
 * Ce qui trahit NOTRE offre dans un texte. Un garde par motif n'attrape que ce
 * qu'on a déjà vu : il est doublé, plus bas, d'un garde STRUCTUREL (aucune
 * réplique d'une de nos verticales n'est servie mot pour mot).
 */
const NOTRE_PITCH =
  /accueil|décroch|appels? manqu|rate[rz]? des appels|un appel à la fois|dans le vide|téléphone|standard|secrétar|robot|alpha|eagleye|démo mobile/i;

/**
 * ⚠⚠ INVENTAIRE GELÉ des réponses servies hors du compte maître.
 *
 * Le motif ci-dessus a laissé passer la mutation qui rendait « universelle »
 * la réponse « elle ne prend qu'un appel à la fois… » avant qu'on y ajoute
 * « un appel à la fois » — un garde par motif n'attrape que ce qu'on a déjà
 * vu. Celui-ci ne devine rien : chaque entrée a été RELUE et ne dit rien de
 * l'offre. En ajouter une se fait ici, à la main, et se voit au diff.
 */
const UNIVERSELLES_RELUES = ["envoyez-mail", "en-parler", "rappelez-moi", "essai"];

test("le script d'un inscrit parle de SON offre, à SA cible", () => {
  const { vertical, manques } = scriptOperateur(PAIE);
  assert.deepEqual(manques, []);
  assert.equal(vertical.id, ID_SCRIPT_OPERATEUR);
  const tout = textesDuScript(vertical).join("\n");
  assert.ok(tout.includes("un logiciel de paie"), "ce qu'il vend doit être dit à la bascule");
  assert.ok(tout.includes("gérants"), "le poste visé doit être dans le ciblage");
  assert.ok(tout.includes("restaurants, Lyon"), "le secteur et la zone doivent être dans le ciblage");
});

test("⚠⚠ aucune phrase de notre pitch dans le script d'un inscrit", () => {
  for (const profil of [PAIE, PROFIL_VIDE, null]) {
    const { vertical } = scriptOperateur(profil);
    for (const t of textesDuScript(vertical)) {
      assert.doesNotMatch(t, NOTRE_PITCH, `« ${t} » est notre argumentaire, servi à un inscrit`);
    }
  }
});

test("⚠⚠ garde STRUCTUREL : aucune réplique d'une de nos verticales n'est recopiée", () => {
  /**
   * La phrase de PERMISSION est de la méthode, pas de l'offre : elle est la
   * même pour tout le monde, par construction. Tout le reste — ce qui dit
   * quoi, à qui, pourquoi — doit être propre à l'inscrit.
   */
  const methode = (v: VerticalPlaybook) => v.opener.filter((o) => o.label === "Permission").map((o) => o.line);
  const nos = new Set(VERTICALS.flatMap(textesDuScript).filter((t) => t.length > 20));
  const script = scriptOperateur(PAIE).vertical;
  const permises = new Set(methode(script));
  for (const t of textesDuScript(script).filter((x) => !permises.has(x))) {
    assert.ok(!nos.has(t), `réplique recopiée d'une verticale EAGLEYE : « ${t} »`);
  }
});

test("le script d'un inscrit n'invente rien sur le prospect : pas de chiffre de perte, pas de prix", () => {
  const { vertical } = scriptOperateur(PAIE);
  assert.equal(vertical.leak, undefined, "zéro donnée, zéro chiffre");
  for (const t of textesDuScript(vertical)) {
    assert.doesNotMatch(t, /\d[\d\s]*(€|euros?)/i, `montant affirmé : « ${t} »`);
  }
});

test("un profil vide se VOIT : crochets dans le script, manques nommés", () => {
  const { vertical, manques } = scriptOperateur(PROFIL_VIDE);
  assert.equal(manques.length, 3);
  assert.equal(vertical.label, "Ton offre (à renseigner)");
  const tout = textesDuScript(vertical).join("\n");
  assert.ok(tout.includes("[ce que vous vendez]"), "un trou rempli par défaut ne se voit jamais");
  assert.ok(tout.includes("[le poste que vous visez]"));
  assert.deepEqual(scriptOperateur(null).manques, manques, "pas de profil = profil vide, jamais une exception");
});

test("le maître garde nos verticales et tout le catalogue ; tout autre compte reçoit son script", () => {
  const resto = verticalById("restauration");
  assert.ok(resto);

  const maitre = scriptAServir(true, PAIE, resto);
  assert.equal(maitre.vertical, resto, "le compte maître vend Alpha : il garde nos scripts");
  assert.equal(maitre.catalogue, "complet");
  assert.deepEqual(maitre.manques, []);

  const inscrit = scriptAServir(false, PAIE, resto);
  assert.equal(inscrit.vertical?.id, ID_SCRIPT_OPERATEUR, "quel que soit le métier du prospect appelé");
  assert.equal(inscrit.catalogue, "universel");

  // Même sans verticale reconnue pour le prospect, l'inscrit a un script.
  assert.equal(scriptAServir(false, PAIE, null).vertical?.id, ID_SCRIPT_OPERATEUR);
});

test("la session d'appels sert le script de l'inscrit, mais regroupe toujours par métier du prospect", () => {
  const p = prospect({ id: "r1", stage: "prospect", phone: "0465710000", sector: "restaurant", events: [] });
  const servi = scriptAServir(false, PAIE, verticalById("restauration"));
  const s = buildCallSession([p], "restauration", new Date(), servi.vertical);

  assert.equal(s.vertical?.id, "restauration", "la file et les leçons restent celles du métier du prospect");
  assert.equal(s.script?.id, ID_SCRIPT_OPERATEUR, "ce que l'appelant lit est son script");
  assert.equal(s.targets.length, 1);
  assert.doesNotMatch(s.targets[0].angle, NOTRE_PITCH, `angle : « ${s.targets[0].angle} »`);

  // Sans script servi, rien ne change pour le maître : le script EST la verticale.
  const m = buildCallSession([p], "restauration");
  assert.equal(m.script, m.vertical);
});

test("l'angle « réputation » d'ALPHA VOICE n'est pas servi sur le script d'un inscrit", () => {
  const p = prospect({
    id: "r2",
    stage: "prospect",
    phone: "0465710001",
    sector: "restaurant",
    events: [],
    deepAudit: { ...prospect({}).deepAudit, currentProcess: "à la main", googleRating: 4.9, googleReviews: 300 },
  });
  const resto = verticalById("restauration");
  assert.match(callAngle(p, resto, null).angle, /réputation/, "le maître garde son angle (sinon le test ne prouve rien)");
  const inscrit = callAngle(p, scriptOperateur(PAIE).vertical, null).angle;
  assert.doesNotMatch(inscrit, /réputation|sonnent dans le vide/, `angle servi à un inscrit : « ${inscrit} »`);
});

test("⚠⚠ l'assistant d'appel ne souffle à un inscrit que la part UNIVERSELLE du catalogue", () => {
  const universelles = OBJECTION_CUES.filter((o) => o.universel);
  assert.deepEqual(
    universelles.map((o) => o.id).sort(),
    [...UNIVERSELLES_RELUES].sort(),
    "une réponse devenue « universelle » sans relecture serait soufflée à tous les inscrits"
  );
  for (const o of universelles) {
    assert.doesNotMatch(o.answer, NOTRE_PITCH, `réponse « universelle » qui vend Alpha : ${o.id}`);
  }

  // Ce qu'un prospect dit à N'IMPORTE quel vendeur.
  const script = scriptOperateur(PAIE).vertical;
  for (const heard of [
    "ah non mais on a déjà une assistante ici",
    "écoutez c'est trop cher pour nous",
    "je n'ai pas le temps je suis en réunion",
    "un robot au téléphone ça fait fuir",
    "non merci ça ne m'intéresse pas",
    "ça coûte combien votre truc",
  ]) {
    for (const m of matchObjections(heard, script, "universel")) {
      assert.doesNotMatch(m.answer, NOTRE_PITCH, `« ${heard} » → soufflé à un inscrit : « ${m.answer} »`);
    }
  }

  // Et la part universelle est bien servie : se taire n'est pas réussir.
  assert.ok(matchObjections("envoyez-moi un mail", script, "universel").some((m) => m.id === "envoyez-mail"));
  assert.ok(matchObjections("faut que j'en parle à mon associé", script, "universel").some((m) => m.id === "en-parler"));
});

test("le maître garde tout le catalogue (le défaut reste « complet »)", () => {
  assert.ok(matchObjections("un robot au téléphone ça fait fuir").some((m) => m.id === "robot"));
  assert.ok(matchObjections("un robot au téléphone ça fait fuir", null, "complet").some((m) => m.id === "robot"));
});

/**
 * Les écrans ne se rendent pas dans node:test : on vérifie le CÂBLAGE sur la
 * source sans ses commentaires (une explication qui nomme `scriptAServir`
 * satisferait sinon le garde — c'est arrivé ailleurs dans ce dépôt).
 */
test("les deux écrans qui soufflent pendant un appel passent par scriptAServir", () => {
  const lire = (f: string) => sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));

  const appels = lire("app/(app)/appels/page.tsx");
  assert.match(appels, /scriptAServir\(\s*maitre\s*,\s*profil/);
  assert.match(appels, /buildCallSession\(prospects,\s*verticalId,\s*new Date\(\),\s*servi\.vertical\)/, "la session doit recevoir le script servi");
  assert.match(appels, /catalogue=\{servi\.catalogue\}/, "l'assistant doit recevoir le catalogue servi");
  assert.doesNotMatch(appels, /vertical\.(opener|objections|diagnostic|mirror|criterion)/, "l'écran relit la verticale au lieu du script");

  const live = lire("components/live/alpha-live.tsx");
  assert.match(live, /scriptAServir\(\s*maitre\s*,\s*profil/);
  assert.match(live, /matchObjections\([^)]*servi\.catalogue\)/);
  assert.match(live, /!prospect\s*\|\|\s*!maitre/, "l'offre à pousser vient de NOTRE catalogue : maître seul");

  const assist = lire("components/voice/live-assist.tsx");
  assert.match(assist, /matchObjections\(heard,\s*vertical,\s*catalogue\)/);
});

test("« parler de » se contracte comme on le dit — la première phrase de l'appel", () => {
  const barrage = (metier: string) =>
    scriptOperateur({ ...PROFIL_VIDE, metier, cibleSecteur: "x", cibleRole: "y" }).vertical.opener[0].line;
  assert.match(barrage("un logiciel de paie"), /parler d'un logiciel de paie/);
  assert.match(barrage("le recrutement"), /parler du recrutement/);
  assert.match(barrage("les assurances"), /parler des assurances/);
  assert.match(barrage("formation"), /parler de formation/);
  // L'article partitif ou pluriel tombe derrière « de » (trouvé en préparant
  // un film : « parler de des cuisines », la phrase qui ouvre l'appel).
  assert.match(barrage("des cuisines sur mesure"), /parler de cuisines sur mesure/);
  assert.match(barrage("du recrutement de commerciaux"), /parler de recrutement de commerciaux/);
  assert.match(barrage("de la formation"), /parler de la formation/);
  assert.match(barrage("de l'isolation"), /parler de l'isolation/);
  for (const m of ["des cuisines", "du conseil", "de la formation", "un logiciel", "le recrutement"]) {
    assert.doesNotMatch(barrage(m), /\bde (?:des|du|de|un|une|le|les)\b/, `« ${m} »`);
  }
});

test("la question écrite d'un inscrit s'accorde avec un métier pluriel", () => {
  const q = (metier: string) => approcheInscrit({ ...PROFIL_VIDE, metier }).question;
  assert.equal(q("des cuisines sur mesure"), "Est-ce que des cuisines sur mesure, c'est un sujet chez vous en ce moment ?");
  assert.equal(q("un logiciel de paie"), "Est-ce qu'un logiciel de paie, c'est un sujet chez vous en ce moment ?");
  assert.doesNotMatch(q("des cuisines sur mesure"), /mesure est un sujet/);
});

/**
 * ⚠⚠ LE VERDICT QUI CHOISIT LE SCRIPT EST CELUI QUE LE SERVEUR A PROUVÉ.
 * Vu le 22/10/2026 en filmant l'écran d'un inscrit : `/appels` lisait
 * `useDroits()`, optimiste (« maître » tant que la réponse n'est pas arrivée,
 * et pour de bon si elle échoue). Selon le moment, l'inscrit recevait NOTRE
 * script. La garde ne liste pas les écrans : elle les TROUVE — tout fichier qui
 * appelle `scriptAServir` ou `apercuInscrit` est concerné, y compris le suivant.
 */
test("⚠⚠ tout écran qui choisit le script (ou l'aperçu) d'un inscrit lit le verdict PROUVÉ, jamais l'optimiste", () => {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(n)) fichiers.push(p);
    }
  };
  for (const d of ["app", "components"]) parcourir(join(process.cwd(), d));
  const concernes = fichiers.filter((f) => /\b(?:scriptAServir|apercuInscrit)\(/.test(sansCommentaires(readFileSync(f, "utf8"))));
  assert.ok(concernes.length >= 3, `la garde ne trouve plus ses écrans (${concernes.length})`);
  for (const f of concernes) {
    const src = sansCommentaires(readFileSync(f, "utf8"));
    assert.match(src, /useMaitreProuve\(\)/, `${f} : verdict prouvé absent`);
    assert.doesNotMatch(src, /useDroits\(\)/, `${f} : useDroits() est optimiste — il sert notre script pendant le chargement`);
  }
});
