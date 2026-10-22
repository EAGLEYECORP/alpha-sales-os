import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GROUPES_INSCRIT, modelesInscrit } from "../lib/modeles-inscrit";
import { STAGE_GROUPS, buildTemplates } from "../lib/templates";
import { VERTICALS } from "../lib/playbook";
import { PROFIL_VIDE, type ProfilOperateur } from "../lib/profil-operateur";
import { sansCommentaires } from "./citations-alpha";

/**
 * Mesuré le 22/10/2026 : `/templates` servait à tout compte 108 gabarits écrits
 * pour vendre NOTRE offre (« des appels ratés pendant le service », « un truc à
 * vous montrer sur mon téléphone »). Un inscrit les copiait tels quels.
 */

const PROFIL: ProfilOperateur = { ...PROFIL_VIDE, metier: "un logiciel de paie", cibleSecteur: "restaurants", cibleRole: "gérants", cibleZone: "Lyon" };
const NOTRE = /eagleye|nuwacom|alpha|accueil|décroch|appels? (ratés|manqu)|téléphone|démo mobile|audit gratuit|taxe d'ignorance|{taxe|tables vides|en ligne/i;

test("la bibliothèque d'un inscrit couvre les six moments × trois formats — et parle de SON offre", () => {
  const t = modelesInscrit(PROFIL, "Dupont Conseil SAS");
  assert.equal(t.length, GROUPES_INSCRIT.length * 3);
  assert.deepEqual(GROUPES_INSCRIT.map((g) => g.id), STAGE_GROUPS.map((g) => g.id), "mêmes moments que la bibliothèque maître");
  const premier = t.find((x) => x.id === "inscrit-premier-contact-email")!;
  assert.match(premier.body, /un logiciel de paie/);
  assert.match(premier.body, /gérants/);
  assert.match(premier.body, /\{closer\} — Dupont Conseil SAS/);
});

test("⚠⚠ aucun modèle d'inscrit ne porte notre marque, notre offre, un prix ou la formule interdite", () => {
  for (const x of [...modelesInscrit(PROFIL, "Dupont Conseil SAS"), ...modelesInscrit(null, "")]) {
    const texte = `${x.title}\n${x.body}\n${x.tip}`;
    assert.doesNotMatch(texte, NOTRE, `${x.id} : « ${texte} »`);
    assert.doesNotMatch(x.body, /\d[\d\s  ]*\s*€|\beuros?\b|\bHT\b/i, `${x.id} : un montant`);
    assert.doesNotMatch(x.body, /je me permets/i, x.id);
    for (const v of VERTICALS) for (const i of v.forbidden ?? []) if (i.motif) assert.doesNotMatch(x.body, i.motif, `${x.id} — ${v.id}`);
  }
  for (const g of GROUPES_INSCRIT) assert.doesNotMatch(`${g.label} ${g.goal}`, NOTRE, g.id);
});

test("un profil vide : les modèles ÉCRITS n'ont jamais de crochets (ils partiraient avec le texte)", () => {
  for (const x of modelesInscrit(null, "").filter((m) => m.format !== "appel")) {
    assert.doesNotMatch(x.body, /\[|\]/, x.id);
    assert.doesNotMatch(x.body, /— $|—\n/m, `${x.id} : signature orpheline sans société`);
  }
});

test("la bibliothèque maître est inchangée (sinon ce test ne prouve rien)", () => {
  assert.ok(buildTemplates({ agency: "EAGLEYE CORP" }).some((x) => NOTRE.test(x.body)));
});

test("⚠ /templates sert la bibliothèque d'un inscrit sur le verdict PESSIMISTE", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/templates/page.tsx"), "utf8"));
  assert.match(src, /const inscrit = useExpediteurInscrit\(\)/);
  assert.match(src, /inscrit\s*\?\s*modelesInscrit\(inscrit\.profil, inscrit\.agencyName\)/);
  assert.match(src, /const groupes = inscrit \? GROUPES_INSCRIT : STAGE_GROUPS/);
});
