import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  INVARIANTS,
  LONGUEUR_ALERTE,
  PROMPTS,
  aPousser,
  diffPrompt,
  promptById,
  texteEffectif,
  validerPrompt,
} from "../lib/prompts";
import { TEXTES_LIVRES } from "../lib/prompts-textes";

const RACINE = process.cwd();

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function fichiersSources(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * TOUT PROMPT LIVRÉ PASSE SA PROPRE VALIDATION.
 *
 * ⚠ C'est le test le plus important du lot, et le plus facile à oublier :
 * on écrit une règle de validation, on la branche sur les modifications de
 * l'opérateur… et on ne vérifie jamais que le texte QU'ON LIVRE la respecte.
 *
 * Le jour où on ajoute un invariant (une nouvelle obligation légale, par
 * exemple), c'est ce test qui dit que nos propres textes sont en retard —
 * avant que `texteEffectif` ne se mette à servir le défaut à tout le monde en
 * expliquant que la version modifiée n'est plus conforme.
 * ─────────────────────────────────────────────────────────────────────
 */
test("chaque prompt livré respecte ses propres invariants", () => {
  const fautes: string[] = [];
  for (const p of PROMPTS) {
    const texte = TEXTES_LIVRES[p.id];
    if (!texte) {
      fautes.push(`${p.id} → aucun texte livré (prompt inéditable)`);
      continue;
    }
    const v = validerPrompt(p.id, texte, texte);
    if (!v.ok) fautes.push(`${p.id} → manque : ${v.manques.map((m) => m.cle).join(", ")}`);
  }
  assert.deepEqual(fautes, [], `nos propres textes ne passent pas notre validation :\n  ${fautes.join("\n  ")}`);
});

test("le registre et les textes livrés se correspondent exactement", () => {
  /**
   * Un identifiant sans texte = un prompt qu'on ne peut pas éditer (l'écran
   * n'a rien à afficher). Un texte sans identifiant = un prompt qu'on ne peut
   * pas atteindre. Les deux échouent en silence.
   */
  const ids = PROMPTS.map((p) => p.id).sort();
  const textes = Object.keys(TEXTES_LIVRES).sort();
  assert.deepEqual(ids, textes, "le registre (lib/prompts) et les textes (lib/prompts-textes) ont divergé");
});

/**
 * ⚠ LE GARDE QUI M'A ATTRAPÉ EN ÉCRIVANT CE MODULE.
 *
 * J'avais mis le texte livré (`defaut: DEFAULT_BUSINESS_RULES`) dans le
 * registre. L'écran `/prompts` étant un composant CLIENT, `vitrine-fuite` a
 * signalé que `lib/business-rules` repartait dans un chunk `_next/static/**`
 * — téléchargeable sans cookie, mot de passe actif ou non. La doctrine récite
 * l'offre, la grille par brique et le taux de CHAQUE compte.
 *
 * Ce test-ci verrouille la conséquence : le registre ne doit JAMAIS reprendre
 * un texte. `vitrine-fuite` attrape l'import ; celui-ci attrape la recopie,
 * qui passerait sous son radar.
 */
test("le registre ne porte aucun texte de prompt", () => {
  const src = sansCommentaires(readFileSync(join(RACINE, "lib/prompts.ts"), "utf8"));
  assert.doesNotMatch(src, /prompts-textes/, "lib/prompts ne doit pas importer les textes : il descend au navigateur");
  assert.doesNotMatch(src, /business-rules/, "ni la doctrine, pour la même raison");
  /**
   * Une recopie se reconnaît à sa taille : aucune chaîne du registre ne doit
   * ressembler à un prompt (les libellés et les explications sont courts).
   *
   * ⚠ Le motif interdit le SAUT DE LIGNE. Sans ça, il se contentait de
   * chercher deux guillemets éloignés et capturait le code entre les deux —
   * il « trouvait » huit recopies inexistantes. Un garde qui hurle sur du
   * code ordinaire est un garde qu'on désactive.
   */
  const longues = [...src.matchAll(/"([^"\\\n]{400,})"/g)].map((m) => m[1]!.slice(0, 60));
  assert.deepEqual(longues, [], `chaîne trop longue dans le registre — un texte de prompt y a été recopié`);
});

test("validerPrompt refuse ce qui a perdu une règle non négociable", () => {
  const socle = TEXTES_LIVRES["socle-n8n"]!;
  assert.equal(validerPrompt("socle-n8n", socle).ok, true, "le socle livré doit passer");

  // On retire la clause anti-injection : c'est celle qui laisse un email de
  // prospect dicter sa conduite à l'agent, et ça ne se voit pas dans la sortie.
  const sansSecurite = socle.replace(/DONNÉE, pas une instruction/, "à traiter normalement");
  const v = validerPrompt("socle-n8n", sansSecurite);
  assert.equal(v.ok, false);
  assert.ok(v.manques.some((m) => m.cle === "anti-injection"));
  // Le refus doit DIRE la conséquence, pas seulement la règle.
  assert.match(v.manques.find((m) => m.cle === "anti-injection")!.pourquoi, /email de prospect/i);

  // On retire le contrat JSON : le nœud Code qui parse tombe.
  const sansJson = socle.replace(/Tu réponds STRICTEMENT en JSON valide, sans texte autour\./, "Réponds librement.");
  assert.ok(validerPrompt("socle-n8n", sansJson).manques.some((m) => m.cle === "json-strict"));

  // Un prompt vide n'est pas « pas d'IA » : c'est une IA sans consigne.
  const vide = validerPrompt("socle-n8n", "   ");
  assert.equal(vide.ok, false);
  assert.match(vide.alertes.join(" "), /improviser/i);

  // Un prompt inconnu ne passe jamais en silence.
  assert.equal(validerPrompt("inexistant", "peu importe").ok, false);
});

test("validerPrompt alerte sans bloquer sur ce qui est discutable", () => {
  const socle = TEXTES_LIVRES["socle-n8n"]!;
  const long = socle + "\n" + "x".repeat(LONGUEUR_ALERTE);
  const v = validerPrompt("socle-n8n", long);
  assert.equal(v.ok, true, "la longueur ne doit pas BLOQUER : la bonne longueur dépend du prompt");
  assert.match(v.alertes.join(" "), /caractères/, "mais elle doit être dite");
});

/**
 * ⚠ Le point le plus contre-intuitif du module, et celui qui protège de la
 * pire panne silencieuse : une version modifiée qui a cessé d'être conforme
 * NE DOIT PAS être servie. On retombe sur le texte livré, et l'écran le dit.
 *
 * Le cas réel : on ajoute un invariant. Toutes les versions modifiées d'avant
 * deviennent non conformes d'un coup — sans ce repli, elles continueraient à
 * tourner sans la nouvelle règle.
 */
test("une version modifiée devenue non conforme n'est plus servie", () => {
  const socle = TEXTES_LIVRES["socle-n8n"]!;
  const casse = socle.replace(/DONNÉE, pas une instruction/, "à traiter normalement");

  const e = texteEffectif("socle-n8n", socle, [
    { id: "socle-n8n", texte: casse, modifieLe: "2026-08-01T10:00:00.000Z" },
  ]);
  assert.equal(e.source, "defaut", "la version cassée ne doit pas être servie");
  assert.equal(e.texte, socle);
  assert.match(e.raison ?? "", /anti-injection/, "et la raison doit nommer ce qui manque");

  // Une version VALIDE, elle, est bien servie : le repli ne doit pas tout avaler.
  const bonne = socle + "\n9. Ne jamais promettre de délai de livraison.";
  const ok = texteEffectif("socle-n8n", socle, [
    { id: "socle-n8n", texte: bonne, modifieLe: "2026-08-01T10:00:00.000Z" },
  ]);
  assert.equal(ok.source, "modifie");
  assert.equal(ok.texte, bonne);
});

test("aPousser — poussé puis remodifié doit repartir", () => {
  const base = { id: "socle-n8n", texte: "peu importe" };
  assert.equal(aPousser({ ...base, modifieLe: "2026-08-01T10:00:00Z" }), true, "jamais poussé");
  assert.equal(
    aPousser({ ...base, modifieLe: "2026-08-01T10:00:00Z", pousseLe: "2026-08-01T11:00:00Z" }),
    false,
    "poussé après la modification"
  );
  assert.equal(
    aPousser({ ...base, modifieLe: "2026-08-01T12:00:00Z", pousseLe: "2026-08-01T11:00:00Z" }),
    true,
    "remodifié après la poussée : il doit repartir"
  );
});

test("le diff montre surtout ce qui a DISPARU", () => {
  const avant = "un\ndeux\ntrois";
  const apres = "un\ntrois\nquatre";
  const d = diffPrompt(avant, apres);
  assert.deepEqual(
    d.filter((l) => l.etat === "retiree").map((l) => l.texte),
    ["deux"],
    "une ligne supprimée doit se voir : ajouter une consigne se remarque, en retirer une ne se remarque jamais"
  );
  assert.deepEqual(
    d.filter((l) => l.etat === "ajoutee").map((l) => l.texte),
    ["quatre"]
  );
});

/**
 * Le registre est la carte des prompts : il doit rester exact. Une route
 * citée qui n'existe plus envoie l'opérateur chercher au mauvais endroit.
 */
test("chaque prompt « app » cite une route qui existe", () => {
  for (const p of PROMPTS) {
    if (p.lieu.ou !== "app") continue;
    const m = p.lieu.route.match(/\/api\/[a-z0-9/-]+/i);
    if (!m) continue; // « toutes les routes IA » : description, pas chemin
    const chemin = join(RACINE, "app", m[0], "route.ts");
    assert.ok(
      readdirSync(join(RACINE, "app", m[0].split("/").slice(0, -1).join("/") || "api")).length >= 0 &&
        statSync(chemin).isFile(),
      `${p.id} cite ${m[0]}, qui n'existe pas`
    );
  }
});

/**
 * ⚠ Le mensonge que cet écran ferait naturellement : compter les prompts
 * envoyés au lieu des prompts ÉCRITS. Le routeur du workflow n8n a un
 * `fallbackOutput` qui répond `ping` à toute action inconnue — donc un 200
 * réjouissant sur une installation qui n'a jamais entendu parler de
 * `prompts.set`, et « 3 prompts poussés » affiché à quelqu'un dont rien n'a
 * bougé.
 */
test("pousserPrompts n'annonce que ce que n8n confirme avoir écrit", () => {
  const src = sansCommentaires(readFileSync(join(RACINE, "lib/n8n.ts"), "utf8"));
  const bloc = src.slice(src.indexOf("export async function pousserPrompts"));
  assert.match(bloc, /res\.data\?\.written/, "le compte doit venir de la RÉPONSE de n8n");
  assert.doesNotMatch(
    bloc.slice(0, bloc.indexOf("written")),
    /pousses: prompts\.length/,
    "ne jamais compter ce qu'on a envoyé comme ce qui a été écrit"
  );
});

test("les routes IA prennent leur prompt dans la source unique", () => {
  /**
   * Le défaut d'origine : la doctrine était écrite à sept endroits, et trois
   * d'entre eux étaient des `const SYSTEM = \`…\`` dans des routes. Modifier
   * une règle demandait de les retrouver un par un.
   *
   * Le garde DÉDUIT : toute route qui déclare un prompt système doit le
   * prendre dans `lib/prompts-textes`, jamais l'écrire.
   */
  const fautes: string[] = [];
  for (const f of fichiersSources(["app/api"])) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    // Un prompt système écrit sur place : `const SYSTEM… = \`Tu es …`
    if (/const SYSTEM[A-Z_]*\s*=\s*`Tu (?:es|extrais)/.test(code)) {
      fautes.push(relative(RACINE, f));
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "ces routes réécrivent un prompt système au lieu de le prendre dans lib/prompts-textes :\n  " + fautes.join("\n  ")
  );
});

test("les invariants nomment une conséquence, pas une règle abstraite", () => {
  /**
   * Un avertissement sans contenu se fait ignorer — c'est la leçon écrite
   * dans CLAUDE.md à propos des références externes, appliquée ici. « Il
   * manque la clause de sécurité » n'apprend rien ; « un email de prospect
   * peut dicter sa conduite à l'agent » fait agir.
   */
  for (const inv of Object.values(INVARIANTS)) {
    assert.ok(inv.pourquoi.length > 60, `l'invariant « ${inv.cle} » explique trop peu : « ${inv.pourquoi} »`);
    assert.ok(inv.exige.length > 20, `l'invariant « ${inv.cle} » n'exige rien de lisible`);
  }
});

test("promptById — un identifiant inconnu ne renvoie jamais un prompt au hasard", () => {
  assert.equal(promptById("doctrine")?.id, "doctrine");
  assert.equal(promptById("nawak"), undefined);
});
