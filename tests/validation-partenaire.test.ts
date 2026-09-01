import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANAUX,
  ciblesPrompts,
  estPartenaire,
  etatValidation,
  peutSortir,
  planValidation,
  poserValidation,
  validerTexte,
  type EtatValidation,
  type Validation,
} from "../lib/validation-partenaire";
import { PROMPTS } from "../lib/prompts";
import { ACCOUNTS } from "../lib/accounts";

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TRAME = "Tu appelles pour le compte de ScintIA. OBJECTIF UNIQUE : obtenir un rendez-vous court.";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE VALIDATION QUI SURVIT À LA RÉÉCRITURE DU TEXTE N'EST PAS UNE
 * VALIDATION.
 *
 * C'est le seul test qui compte vraiment ici. Le reste découle.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ modifier le texte PÉRIME la validation, et ça ferme la sortie", () => {
  const v = validerTexte("voix-froid", TRAME, "scintia", "Karim", "visio", new Date("2026-09-03T10:00:00Z"));
  const validations = [v];

  // Texte inchangé : l'accord porte.
  const avant = etatValidation("voix-froid", TRAME, "scintia", validations);
  assert.equal(avant.etat, "validee");
  assert.equal(peutSortir(avant.etat), true);
  assert.match(avant.pourquoi, /Karim/, "le nom de qui a validé doit être rendu");

  // Un seul mot change — et l'accord ne porte plus.
  const apres = etatValidation("voix-froid", TRAME.replace("court", "de trente minutes"), "scintia", validations);
  assert.equal(apres.etat, "perimee");
  assert.equal(peutSortir(apres.etat), false, "un texte périmé ne doit PAS pouvoir partir");
  assert.match(apres.pourquoi, /a changé depuis la validation/);
  assert.match(apres.pourquoi, /Karim/, "on doit savoir sur quelle version portait l'accord");

  // La validation reste attachée : on peut la montrer, on ne l'efface pas.
  assert.equal(apres.validation?.par, "Karim");
});

test("⚠ `peutSortir` — la liste des états qui autorisent est EXHAUSTIVE", () => {
  const tous: EtatValidation[] = ["non-requise", "jamais", "validee", "perimee"];
  assert.deepEqual(
    tous.filter(peutSortir).sort(),
    ["non-requise", "validee"],
    "un nouvel état qui autorise la sortie doit être une décision explicite"
  );
  assert.equal(peutSortir("jamais"), false);
  assert.equal(peutSortir("perimee"), false, "c'est CE cas qu'on croit couvert et qui ne l'est pas");
});

test("le compte MAÎTRE ne se valide pas lui-même", () => {
  /**
   * Sur EAGLEYE, c'est notre marque, notre risque. Exiger qu'on se valide
   * soi-même ne protégerait personne et transformerait le contrôle en case
   * qu'on apprend à cliquer sans lire — ce qui le tuerait aussi pour ScintIA.
   */
  const verdict = etatValidation("voix-froid", TRAME, "eagleye", []);
  assert.equal(verdict.etat, "non-requise");
  assert.equal(peutSortir(verdict.etat), true);

  assert.equal(estPartenaire("eagleye"), false);
  assert.equal(estPartenaire("scintia"), true);
  assert.equal(estPartenaire("nuwacom"), true);

  // Et la distinction vient du registre des comptes, pas d'une liste ici.
  for (const c of ACCOUNTS) {
    assert.equal(estPartenaire(c.id), c.kind !== "master", `${c.id} : l'état doit suivre son `.concat("`kind`"));
  }
});

test("rien n'est validé par défaut, et le refus dit quoi faire", () => {
  const verdict = etatValidation("voix-froid", TRAME, "scintia", []);
  assert.equal(verdict.etat, "jamais");
  assert.equal(peutSortir(verdict.etat), false);
  assert.match(verdict.pourquoi, /ScintIA/, "le partenaire doit être nommé");
  assert.match(verdict.pourquoi, /leur marque/, "et la raison doit être leur risque, pas notre process");
});

test("une validation porte un NOM de personne, pas une société", () => {
  /**
   * ⚠ Sans nom, une validation est une case qu'on coche soi-même. Le jour où
   * un appel dérape, « ScintIA a validé » ne vaut rien ; « Karim a validé le
   * 3 septembre en visio » se vérifie en un message.
   */
  const v = validerTexte("voix-froid", TRAME, "scintia", "  Karim  ", "visio");
  assert.equal(v.par, "Karim", "le nom est nettoyé, pas inventé");
  assert.equal(v.canal, "visio");
  assert.ok(v.le.endsWith("Z"), "la date est horodatée en ISO");
  assert.ok(v.empreinte.length > 0);

  // Le canal fait partie de la trace : « validé » sans savoir comment ne se
  // vérifie pas trois mois plus tard.
  assert.ok(CANAUX.some((c) => c.id === v.canal));
});

test("une même cible n'a jamais deux validations pour le même compte", () => {
  /**
   * Deux validations pour la même paire rendraient l'état dépendant de
   * l'ordre du tableau — donc de la façon dont il a été écrit sur le disque.
   */
  const v1 = validerTexte("voix-froid", TRAME, "scintia", "Karim", "visio", new Date("2026-09-03T10:00:00Z"));
  const v2 = validerTexte("voix-froid", "autre texte", "scintia", "Sofia", "email", new Date("2026-09-10T10:00:00Z"));

  const apres = poserValidation([v1], v2);
  assert.equal(apres.length, 1, "la seconde REMPLACE la première");
  assert.equal(apres[0].par, "Sofia");

  // Mais un autre compte cohabite : Nuwacom valide ses propres textes.
  const avecNuwacom = poserValidation(apres, validerTexte("voix-froid", TRAME, "nuwacom", "Christophe", "visio"));
  assert.equal(avecNuwacom.length, 2);
});

test("chaque compte valide POUR LUI — une validation ScintIA ne couvre pas Nuwacom", () => {
  const validations: Validation[] = [validerTexte("voix-froid", TRAME, "scintia", "Karim", "visio")];
  assert.equal(etatValidation("voix-froid", TRAME, "scintia", validations).etat, "validee");
  assert.equal(
    etatValidation("voix-froid", TRAME, "nuwacom", validations).etat,
    "jamais",
    "l'accord d'un partenaire n'engage pas l'autre"
  );
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON FAIT VALIDER SE DÉRIVE DU REGISTRE, JAMAIS D'UNE LISTE À LA MAIN.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la liste des textes sortants se DÉDUIT des prompts, elle ne se recopie pas", () => {
  const cibles = ciblesPrompts();
  assert.ok(cibles.length > 0, "au moins la trame d'appel à froid doit être soumise");
  assert.ok(cibles.some((c) => c.id === "voix-froid"));

  // Les prompts INTERNES n'y sont pas : les faire relire noierait ce qui
  // compte sous ce qui ne compte pas.
  for (const interne of ["copilote", "agent", "debrief", "doctrine"]) {
    assert.ok(!cibles.some((c) => c.id === interne), `${interne} tourne chez nous, pas chez le prospect`);
  }

  // Et la déduction porte sur les INVARIANTS du registre : un futur prompt
  // sortant sera pris sans qu'on touche à ce module.
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/validation-partenaire.ts"), "utf8"));
  assert.match(src, /PROMPTS\.filter/, "la liste doit se filtrer depuis le registre");

  /**
   * ⚠ LE FILTRE PORTE SUR CE QUE FAIT LE PROMPT, PAS SUR SON NOM. Filtrer par
   * identifiant reviendrait à écrire la liste à la main avec une boucle
   * autour : le prochain prompt sortant ajouté au registre ne serait pas
   * soumis au partenaire, et rien ne le dirait. La première version de ce test
   * cherchait `id: "voix-froid"` et laissait passer `p.id === "voix-froid"` —
   * un motif trop étroit ne garde que la faute qu'on avait imaginée.
   */
  assert.match(
    src,
    /p\.invariants\.some\(/,
    "la sélection doit se faire sur les invariants portés, jamais sur l'identifiant"
  );
  for (const p of PROMPTS) {
    assert.ok(
      !new RegExp(`["']${p.id}["']`).test(src),
      `l'identifiant « ${p.id} » est écrit en dur : le registre cesserait d'être la source`
    );
  }

  // Contrôle croisé : les cibles existent bien dans le registre.
  for (const c of cibles) assert.ok(PROMPTS.some((p) => p.id === c.id));
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PORTE EST DANS LA ROUTE, ET ELLE REFUSE AVANT DE COMPOSER.
 *
 * ⚠ Une mutation a déjà survécu dans ce dépôt sur exactement ce motif : le
 * refus de conformité désactivé, 1252 tests verts. Ce qui compte n'est pas la
 * présence du contrôle, c'est son ORDRE — un accord vérifié après le dispatch
 * ne protège personne.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la route REFUSE un appel partenaire non validé, AVANT de composer", () => {
  const code = sansCommentaires(readFileSync(join(process.cwd(), "app/api/voice/call/route.ts"), "utf8"));

  const iPorte = code.indexOf("estPartenaire(");
  assert.ok(iPorte > 0, "la route doit demander si le compte engage une marque partenaire");

  const bloc = code.slice(iPorte, iPorte + 900);

  /**
   * ⚠ ON VÉRIFIE LA CONDITION, PAS LA PRÉSENCE DU REFUS. Première version de
   * ce test : elle cherchait `status: 422` dans le bloc. La mutation
   * `if (!v || v.empreinte !== attendue)` → `if (false)` a SURVÉCU — le 422
   * était toujours là, simplement plus jamais atteint. C'est la troisième
   * fois que ce piège se referme dans cette session ; la comparaison
   * elle-même doit être dans l'assertion.
   */
  assert.match(
    bloc,
    /if\s*\(\s*!v\s*\|\|\s*v\.empreinte\s*!==\s*attendue\s*\)/,
    "le refus doit tester l'ABSENCE de preuve ET la divergence d'empreinte"
  );
  assert.match(bloc, /const attendue = empreinte\(/, "l'empreinte attendue se recalcule côté serveur");
  assert.match(bloc, /status:\s*422/, "un texte non validé se refuse, il ne se signale pas");
  assert.match(bloc, /return NextResponse\.json/, "le refus doit INTERROMPRE le traitement");
  assert.match(bloc, /quoiFaire/, "un refus sans porte de sortie fait contourner le contrôle");

  const iDispatch = code.indexOf("createDispatch(");
  assert.ok(iDispatch > 0, "le point de déclenchement de l'appel est introuvable");
  assert.ok(iPorte < iDispatch, "l'accord se vérifie AVANT le dispatch, jamais après");

  /**
   * ⚠ L'empreinte porte sur la TRAME, pas sur le script assemblé. Le script
   * contient le nom du prospect : son empreinte changerait à chaque appel, et
   * aucune validation ne tiendrait deux minutes — le contrôle serait rouge en
   * permanence, donc ignoré, donc retiré.
   */
  assert.match(bloc, /CORPS_APPEL_FROID/, "la trame est le texte validé");
  assert.ok(
    !/empreinte\(script\)/.test(bloc),
    "l'empreinte ne doit PAS porter sur le script assemblé : il change à chaque prospect"
  );
});

test("le compte maître traverse la porte sans validation", () => {
  /**
   * Le contrôle ne doit gêner personne là où il ne protège personne : sur
   * EAGLEYE, aucune preuve n'est réclamée. Un contrôle qui s'applique partout
   * est un contrôle qu'on apprend à contourner partout.
   */
  assert.equal(peutSortir(etatValidation("voix-froid", TRAME, "eagleye", []).etat), true);
  assert.equal(estPartenaire("eagleye"), false);
});

test("le plan d'onboarding compte ce qui bloque, et le dit en français", () => {
  const cible = { id: "voix-froid", label: "Trame d'appel", quoi: "ce qui se dit au téléphone", canal: "appel" as const };

  const rien = planValidation([{ cible, texte: TRAME }], "scintia", []);
  assert.equal(rien.restantes, 1);
  assert.match(rien.resume, /ne peuvent pas partir/);

  const fait = planValidation(
    [{ cible, texte: TRAME }],
    "scintia",
    [validerTexte("voix-froid", TRAME, "scintia", "Karim", "visio")]
  );
  assert.equal(fait.restantes, 0);
  assert.match(fait.resume, /a été validé/);

  // Sur le compte maître, le plan ne réclame rien.
  const maitre = planValidation([{ cible, texte: TRAME }], "eagleye", []);
  assert.equal(maitre.restantes, 0);
  assert.match(maitre.resume, /aucune validation partenaire/i);
});
