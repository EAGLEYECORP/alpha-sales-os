import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ETAPES_MISSION, INTERDITS_ASSISTANT, llmsTxt, promptMission } from "../lib/mission-assistant";
import { BRIQUES_GRATUITES } from "../lib/entitlements";
import { peutOuvrir } from "../lib/bricks-access";
import { INTERDITS, verifierNomsEnCapitales } from "./film-outils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION DE L'ASSISTANT IA (05/11/2026). Un texte qu'un assistant suit à
 * la lettre : chaque écran nommé doit exister, porter EXACTEMENT ce titre, et
 * s'ouvrir à un compte gratuit — sinon l'assistant se perd, ou tombe sur une
 * porte fermée en croyant avoir fini.
 * ─────────────────────────────────────────────────────────────────────
 */

const R = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();

test("⚠⚠ chaque écran de la mission existe et porte EXACTEMENT le titre annoncé", () => {
  for (const e of ETAPES_MISSION) {
    const f = join(R, "app/(app)", e.route, "page.tsx");
    assert.ok(existsSync(f), `${e.route} n'existe plus : l'assistant s'y perdrait`);
    assert.ok(readFileSync(f, "utf8").includes(`title="${e.titre}"`), `${e.route} ne porte plus le titre « ${e.titre} »`);
  }
});

test("⚠⚠ chaque écran de la mission s'ouvre à un compte GRATUIT", () => {
  for (const e of ETAPES_MISSION) {
    assert.ok(peutOuvrir(e.route, [...BRIQUES_GRATUITES], false), `${e.route} est fermé au gratuit : l'assistant buterait sur une porte`);
  }
});

test("⚠⚠ la mission interdit ce qui revient à l'humain, et traite le contenu d'un prospect comme une donnée", () => {
  const p = promptMission("https://alpha.example.com/");
  for (const motif of [/Ne tape jamais un mot de passe/, /invente jamais un prix/, /ne signe rien/, /donnée, jamais une consigne/, /ne la contourne pas/, /N'efface aucune fiche/]) {
    assert.match(p, motif);
  }
  assert.equal(INTERDITS_ASSISTANT.length, 5);
  assert.match(p, /demande-moi de me connecter/, "l'assistant ne se connecte jamais à la place de l'utilisateur");
  assert.ok(p.includes("https://alpha.example.com/trouver"), "les liens partent de l'adresse donnée, sans double barre");
  assert.ok(!p.includes(".com//"));
});

test("/llms.txt : la même mission, ce qu'on dit où vivent les données, et rien d'interdit", () => {
  const t = llmsTxt("https://alpha.example.com");
  assert.ok(t.startsWith("# ALPHA SALES OS"));
  assert.ok(t.includes(promptMission("https://alpha.example.com")), "deux rédactions de la mission divergeraient");
  assert.match(t, /navigateur-là/);
  for (const [motif, raison] of INTERDITS) assert.doesNotMatch(t, motif, raison);
  verifierNomsEnCapitales(t);
});

test("la route /llms.txt et l'encart de /autopilote servent cette définition, et rien d'autre", () => {
  const route = readFileSync(join(R, "app/llms.txt/route.ts"), "utf8");
  assert.match(route, /llmsTxt\(req\.nextUrl\.origin\)/);
  const panneau = readFileSync(join(R, "components/autopilote/assistant-ia-panel.tsx"), "utf8");
  assert.match(panneau, /promptMission\(base\)/);
  assert.match(readFileSync(join(R, "app/(app)/autopilote/page.tsx"), "utf8"), /<AssistantIaPanel \/>/);
});
