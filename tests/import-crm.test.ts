import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useAlpha } from "../lib/store";
import { csvToProspects } from "../lib/csv";
import {
  importerFiches, importerPourCrm, messageImport, ressembleAuTerrain,
} from "../lib/sourcing-terrain-import";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'IMPORT CRM — le tri terrain décide QUI ON APPELLE, pas QUI EXISTE.
 *
 * Reproduit le 20/10/2026 : trois PME lyonnaises, tout renseigné (téléphone,
 * email, site, secteur, audit) sauf « note » et « avis ». Deux marqueurs →
 * aiguillage vers le tri terrain → 20/100 pour un seuil de 45 → « écartées »
 * → « ✓ 0 nouveau(x) ». Rien n'était créé et l'écran affichait une coche.
 * ─────────────────────────────────────────────────────────────────────
 */

const ENTETE = "Entreprise,Site web,Téléphone,Email,Secteur,Ville,Note Google,Nombre d'avis,Extrait d'avis,Audit commercial,Prochaine action";
const PME = [
  "Cabinet Dupont Conseil,https://dupont-conseil.example.fr,0465713456,contact@dupont-conseil.example.fr,conseil,Lyon 6e,,,,Formulaire sans prise de RDV,Appeler mardi",
  "Atelier Moreau,https://moreau.example.fr,0465713457,info@moreau.example.fr,menuiserie,Villeurbanne,,,,Aucun suivi visible,Envoyer audit",
  "Garage du Rhône,https://garage-rhone.example.fr,0465713458,garage@garage-rhone.example.fr,garage,Lyon 3e,,,,Horaires incomplets,Appeler jeudi",
];
const csv = (...lignes: string[]) => [ENTETE, ...lignes].join("\n");

const snapshot = useAlpha.getState();
beforeEach(() => {
  useAlpha.setState({ ...snapshot, prospects: [], activities: [], auditLog: [] });
});

test("⚠ une PME complète SANS avis est créée, jamais écartée", () => {
  const texte = csv(...PME);
  // Le piège de départ existe bien : la feuille est aiguillée vers le tri terrain.
  assert.equal(ressembleAuTerrain(texte), true);
  // Et le tri, seul, écarte bien les trois — c'est SON verdict, il reste vrai.
  assert.equal(importerFiches(texte).retenus.length, 0);

  const r = importerPourCrm(texte);
  assert.equal(r.aCreer.length, 3, "les trois fiches doivent entrer dans le CRM");
  assert.deepEqual(r.horsSujet, []);
  assert.equal(r.nbAQualifier, 3);
  for (const p of r.aCreer) {
    assert.ok(p.tags.includes("a-qualifier"), `${p.company} : doit être marquée « à qualifier »`);
  }
});

test("la lecture générique garde ce que le parseur terrain ignorait : email, décideur", () => {
  const r = importerPourCrm(csv(...PME));
  const dupont = r.aCreer.find((p) => p.company === "Cabinet Dupont Conseil");
  assert.equal(dupont?.email, "contact@dupont-conseil.example.fr");
  assert.equal(dupont?.city, "Lyon 6e");
});

test("⚠ la donnée inconnue reste INCONNUE : pas d'avis ⇒ undefined, jamais 0", () => {
  const p = importerPourCrm(csv(PME[0])).aCreer[0];
  assert.equal(p.deepAudit.googleReviews, undefined);
  assert.equal(p.deepAudit.googleRating, undefined);
});

test("une fiche sans téléphone est à recollecter, pas jetée", () => {
  const r = importerPourCrm(csv("Studio Lumière,https://lumiere.example.fr,,pro@lumiere.example.fr,photographie,Lyon 2e,,,,Aucun,Écrire"));
  assert.equal(r.aCreer.length, 1);
  assert.equal(r.aCreer[0].email, "pro@lumiere.example.fr");
  assert.ok(r.aCreer[0].tags.includes("a-qualifier"));
});

test("SEULS les hors-sujet ne sont pas créés, et ils sont nommés avec leur motif", () => {
  const r = importerPourCrm(
    csv(PME[0], "Norauto Lyon Gerland,https://norauto.example.fr,0465713499,gerland@norauto.example.fr,garage,Lyon 7e,,,,Centre auto,Appeler")
  );
  assert.equal(r.aCreer.length, 1, "la franchise ne doit pas entrer");
  assert.equal(r.aCreer[0].company, "Cabinet Dupont Conseil");
  assert.equal(r.horsSujet.length, 1);
  assert.match(r.horsSujet[0].motif, /nationale/);
  assert.match(r.resume.join(" "), /Norauto Lyon Gerland/, "un refus doit se nommer, pas se compter en silence");
});

test("une fiche que le tri juge appelable gagne ses signaux SANS perdre son email", () => {
  const forte =
    "Carrosserie des Lilas,https://lilas.example.fr,0465713460,atelier@lilas.example.fr,carrosserie,Lyon 3e,4.6,142,\"impossible de les joindre\",Débordés,Appeler";
  const r = importerPourCrm(csv(forte));
  assert.equal(r.nbAppelables, 1);
  const p = r.aCreer[0];
  assert.equal(p.email, "atelier@lilas.example.fr", "l'email vient de la lecture générique");
  assert.ok(p.tags.includes("terrain") && p.tags.includes("injoignable"), "le tri ajoute ses tags");
  assert.equal(p.deepAudit.googleReviews, 142);
  assert.ok(!p.tags.includes("a-qualifier"));
});

test("« Audit commercial », « Problème probable », « Prochaine action » sont LUS, plus jetés", () => {
  const brut = "Entreprise,Site web,Téléphone,Email,Secteur,Ville,Note Google,Nombre d'avis,Audit commercial,Problème probable,Prochaine action\n" +
    "Cabinet Dupont Conseil,https://dupont-conseil.example.fr,0465713456,contact@dupont-conseil.example.fr,conseil,Lyon 6e,,,Formulaire sans prise de RDV,Suivi manuel des demandes,Appeler mardi";
  const p = importerPourCrm(brut).aCreer[0];
  assert.equal(p.deepAudit.currentProcess, "Formulaire sans prise de RDV");
  assert.deepEqual(p.problems, ["Suivi manuel des demandes"]);
  assert.equal(p.nextStep?.action, "Appeler mardi", "l'action écrite par l'humain ne doit pas être remplacée par le défaut");
});

test("⚠ « Nombre d'avis » et « Extrait d'avis » sont lus par le tri : une fiche forte reste forte", () => {
  // Avant : ces deux en-têtes (les plus naturels en français) ne figuraient pas
  // dans la table d'alias du tri, qui jugeait sur des colonnes vides.
  const fiche = importerFiches(csv(
    "Carrosserie des Lilas,https://lilas.example.fr,0465713460,atelier@lilas.example.fr,carrosserie,Lyon 3e,4.6,142,\"impossible de les joindre\",Débordés,Appeler"
  ));
  assert.equal(fiche.retenus.length, 1);
  assert.equal(fiche.retenus[0].prospect.deepAudit.googleReviews, 142);
});

test("⚠ les colonnes que personne ne lit sont NOMMÉES — celles que le tri lit ne le sont pas", () => {
  const brut = "Entreprise,Site web,Téléphone,Email,Note Google,Nombre d'avis,Score interne,Horaires\n" +
    "Cabinet Dupont Conseil,https://dupont-conseil.example.fr,0465713456,contact@dupont-conseil.example.fr,,,72,lun-ven 9h-18h";
  const r = importerPourCrm(brut);
  assert.deepEqual(r.colonnesIgnorees, ["Score interne"]);
  assert.match(r.resume.join(" "), /Colonnes NON lues \(ignorées\) : Score interne/);
  // Même constat côté import générique, qui l'ignorait aussi.
  assert.deepEqual(csvToProspects(brut).headersIgnored.sort(), ["Horaires", "Score interne"]);
});

test("⚠ le « ✓ » ne se pose que si quelque chose a été ÉCRIT", () => {
  const r = importerPourCrm(csv(PME[0]));
  const vide = messageImport({ added: 0, updated: 0 }, r);
  assert.equal(vide.ok, false);
  assert.doesNotMatch(vide.texte, /✓/, "une coche sur un import vide est une panne qui a l'air d'un succès");
  assert.match(vide.texte, /RIEN/);
  const plein = messageImport({ added: 1, updated: 0 }, r);
  assert.equal(plein.ok, true);
  assert.match(plein.texte, /^✓ Import : 1 nouveau/);
});

test("bout en bout : de la feuille au store, trois fiches y sont", () => {
  const r = importerPourCrm(csv(...PME));
  const ecrit = useAlpha.getState().importProspects(r.aCreer);
  assert.equal(ecrit.added, 3);
  assert.equal(useAlpha.getState().prospects.length, 3);
  assert.equal(messageImport(ecrit, r).ok, true);
});

test("l'écran d'import passe par importerPourCrm — le tri seul ne sert plus de porte", () => {
  const src = readFileSync(join(process.cwd(), "app/(app)/settings/page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /importerPourCrm\s*\(/);
  assert.doesNotMatch(src, /importerFiches\s*\(/, "l'import CRM ne doit plus dépendre du verdict du tri");
  // Et ce qui est écrit vient de aCreer, pas de r.retenus.
  assert.match(src, /importProspects\(r\.aCreer\)/);
  assert.doesNotMatch(src, /importProspects\(fiches\)/);
});
