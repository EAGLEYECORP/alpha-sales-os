import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DOSSIER DE CONFORMITÉ EST EXÉCUTABLE (04/11/2026).
 *
 * `docs/EU_AI_ACT.md`, `ARTICLE_15.md`, `FINOPS.md`, `SAFETY.md` et
 * `RED_TEAMING.md` sont ce qu'un auditeur, un client ou un recruteur lit pour
 * juger le produit. Leur première version (31/10) affirmait des « schémas
 * Zod » (la dépendance n'existe pas), des « sous-agents MCP », un seuil de
 * confiance « < 0,75 », renvoyait vers un fichier inexistant, et s'appuyait
 * sur trois tests qui ne compilaient pas. Rien n'échouait : une prose qui
 * ment ne casse aucun build. C'est le défaut que ce dépôt a payé le plus
 * souvent (cf. `lib/promesse.ts`, `lib/alpha-ici.ts`).
 *
 * Ce test rend le dossier falsifiable :
 *  · chaque citation `fichier#symbole` doit pointer vers un fichier qui
 *    EXPORTE ce symbole ;
 *  · chaque chemin cité et chaque lien relatif doit exister ;
 *  · chaque case cochée du red teaming doit nommer un test qui existe ;
 *  · les affirmations déjà prises en défaut sont refusées.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const DOSSIER = ["docs/EU_AI_ACT.md", "docs/ARTICLE_15.md", "docs/FINOPS.md", "docs/SAFETY.md", "docs/RED_TEAMING.md", "docs/ARTICLE_15_ROBUSTNESS_CYBERSECURITY.md"];
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

const exporte = (fichier: string, symbole: string) =>
  new RegExp(`export\\s+(async\\s+)?(function|const|type|interface|class)\\s+${symbole}\\b`).test(lire(fichier));

test("chaque citation `fichier#symbole` pointe vers un symbole EXPORTÉ par ce fichier", () => {
  const fautes: string[] = [];
  let n = 0;
  for (const doc of DOSSIER) {
    for (const [, fichier, symbole] of lire(doc).matchAll(/`([\w./()-]+\.(?:ts|tsx|mjs))#(\w+)`/g)) {
      n++;
      if (!existsSync(join(RACINE, fichier))) fautes.push(`${doc} : ${fichier} n'existe pas`);
      else if (!exporte(fichier, symbole)) fautes.push(`${doc} : ${fichier} n'exporte pas ${symbole}`);
    }
  }
  assert.deepEqual(fautes, []);
  assert.ok(n >= 40, `le dossier doit rester sourcé (${n} citations)`);
});

test("chaque chemin cité et chaque lien relatif existe", () => {
  const fautes: string[] = [];
  for (const doc of DOSSIER) {
    const texte = lire(doc);
    for (const [, chemin] of texte.matchAll(/`((?:lib|app|tests|docs|supabase|components)\/[\w./()[\]-]+|README\.md|middleware\.ts)`/g)) {
      if (!existsSync(join(RACINE, chemin))) fautes.push(`${doc} : ${chemin}`);
    }
    for (const [, lien] of texte.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
      if (!existsSync(join(RACINE, dirname(doc), lien))) fautes.push(`${doc} : lien ${lien}`);
    }
  }
  assert.deepEqual(fautes, []);
});

test("une case cochée du red teaming nomme le test qui la tient, et ce test existe", () => {
  const fautes: string[] = [];
  for (const ligne of lire("docs/RED_TEAMING.md").split("\n").filter((l) => /^- \[x\]/i.test(l))) {
    const t = ligne.match(/`(tests\/[\w.-]+\.test\.ts)`/);
    if (!t) fautes.push(`sans test : ${ligne}`);
    else if (!existsSync(join(RACINE, t[1]))) fautes.push(`test absent : ${t[1]}`);
  }
  assert.deepEqual(fautes, []);
});

test("⚠ les affirmations déjà prises en défaut ne reviennent pas", () => {
  const INTERDITS: [RegExp, string][] = [
    [/\bzod\b/i, "aucune dépendance zod dans package.json"],
    [/sous-agents?|sub-agents?/i, "il n'y a pas de sous-agents : le pilote est du code déterministe"],
    [/0[.,]75/, "aucun seuil de confiance n'existe dans le code"],
    [/certifi[ée]|marquage CE appos|déclaration UE de conformité (signée|établie)/i, "aucune certification ni déclaration n'a été faite"],
    [/<\s*500\s*ms|sub-500/i, "aucune latence vocale n'a été mesurée en production"],
  ];
  const fautes: string[] = [];
  for (const doc of DOSSIER) {
    for (const ligne of lire(doc).split("\n")) {
      for (const [re, pourquoi] of INTERDITS) if (re.test(ligne)) fautes.push(`${doc} : « ${ligne.trim().slice(0, 80)} » — ${pourquoi}`);
    }
  }
  assert.deepEqual(fautes, []);
  assert.equal(/"zod"/.test(lire("package.json")), false, "si zod entre un jour, ce garde se rediscute");
});

test("le README ouvre le dossier, et le dossier dit ce qui n'est PAS prouvé", () => {
  const readme = lire("README.md");
  for (const doc of DOSSIER.slice(0, 4)) assert.ok(readme.includes(doc), `README → ${doc}`);
  assert.match(lire("docs/EU_AI_ACT.md"), /## 4\. Ce qui n'est pas prouvé/);
  assert.match(lire("docs/ARTICLE_15.md"), /## Ouvert/);
});
