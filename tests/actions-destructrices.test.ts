import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI DÉTRUIT DEMANDE. TOUJOURS, PAS UNE FOIS SUR DEUX.
 *
 * ⚠ TROUVÉ AU BALAYAGE NAVIGATEUR, PUIS CONFIRMÉ DANS LA SOURCE. Trois
 * actions irréversibles s'exécutaient sans rien demander, pendant que des
 * actions équivalentes — parfois LE MÊME APPEL, deux fichiers plus loin —
 * demandaient confirmation :
 *
 *   · `clearAllData()` dans l'assistant de configuration. Le bouton dit
 *     « vider la démo », mais l'appel ne distingue pas une fiche de démo d'un
 *     vrai client : il vide prospects, campagnes, RDV et intel. Et
 *     l'assistant se ROUVRE seul tant que `onboarded` est faux. Le même appel
 *     dans les réglages demandait confirmation en nommant ce qui part.
 *   · `importData()` — restaurer une sauvegarde REMPLACE l'état entier.
 *     Choisir le fichier suffisait à l'appliquer. C'est l'action la plus
 *     facile à déclencher par accident : un clic dans une liste de fichiers.
 *   · `deleteMeeting()` — bouton rouge, aucune question, alors que
 *     `deleteProspect()` (bouton rouge identique) demandait. Un rendez-vous
 *     est un engagement DATÉ : le perdre coûte un no-show, pas une ligne.
 *
 * Une garde appliquée une fois sur deux ne protège rien : c'est justement le
 * chemin NON gardé qu'on emprunte par accident.
 *
 * Ce test part des ACTIONS du store, pas d'une liste d'écrans : toute
 * nouvelle surface qui appelle l'une d'elles devra demander, sans que
 * personne ait à s'en souvenir.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const IGNORE = new Set(["node_modules", ".next", ".test-build"]);

function sources(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const e of readdirSync(d)) {
      if (IGNORE.has(e)) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/**
 * Les actions qui font disparaître du travail déjà fait.
 *
 * ⚠ `loadProspectsICP` n'y est PAS, et c'est un choix vérifiable : elle
 * FUSIONNE et n'efface rien (son propre libellé le dit). Exiger une
 * confirmation pour une action qui n'enlève rien apprend à cliquer « oui »
 * sans lire — ce qui vide de sens celles qui comptent.
 */
const DESTRUCTRICES = [
  "clearAllData",
  "resetToSeed",
  "importData",
  "loadPipelineJuillet",
  "deleteMeeting",
  "deleteProspect",
];

/** Y a-t-il un `confirm(` dans le gestionnaire qui précède cet appel ? */
function demandeAvant(code: string, appel: string): boolean[] {
  const out: boolean[] = [];
  for (const m of code.matchAll(new RegExp(`\\b${appel}\\s*\\(`, "g"))) {
    // On remonte jusqu'au début du gestionnaire, borné : une fenêtre trop
    // large attraperait le `confirm` du bouton d'à côté et rendrait le test
    // complaisant.
    const debut = Math.max(0, m.index - 900);
    out.push(/\bconfirm\s*\(/.test(code.slice(debut, m.index)));
  }
  return out;
}

test("⚠ aucune action irréversible ne s'exécute sans demander", () => {
  const fautes: string[] = [];
  let vus = 0;

  for (const f of sources(["app", "components"])) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    for (const action of DESTRUCTRICES) {
      // La déstructuration depuis le hook n'exécute rien : seul l'appel compte.
      const ligneDeHook = new RegExp(`\\{[^}]*\\b${action}\\b[^}]*\\}\\s*=\\s*useAlpha`);
      const sansHook = code.replace(ligneDeHook, "");
      for (const [i, ok] of demandeAvant(sansHook, action).entries()) {
        vus++;
        if (!ok) fautes.push(`${relative(RACINE, f)} → ${action}() (occurrence ${i + 1})`);
      }
    }
  }

  assert.ok(vus >= 6, `on n'a trouvé que ${vus} appel(s) destructeur(s) — le balayage est cassé`);
  assert.deepEqual(
    fautes,
    [],
    "ces appels détruisent du travail sans poser la question :\n  " + fautes.join("\n  ")
  );
});

test("la question NOMME ce qui disparaît", () => {
  /**
   * « Êtes-vous sûr ? » se clique sans lire. Ce qui fait réfléchir, c'est le
   * nombre : « effacer les 47 fiche(s) », « remplace 47 fiche(s) ». On vérifie
   * donc que les deux confirmations les plus lourdes citent un décompte réel
   * plutôt qu'une formule.
   */
  const wizard = readFileSync(join(RACINE, "components/setup-wizard.tsx"), "utf8");
  assert.match(wizard, /confirm\(/, "l'assistant doit demander avant de vider");
  assert.match(wizard, /prospects\.length\} fiche/, "et dire COMBIEN de fiches partent");
  assert.match(wizard, /pas seulement la démo/i, "et corriger la promesse du libellé");

  const reglages = readFileSync(join(RACINE, "app/(app)/settings/page.tsx"), "utf8");
  const bloc = reglages.slice(reglages.indexOf("const doImport ="), reglages.indexOf("const sync ="));
  assert.match(bloc, /confirm\(/, "restaurer une sauvegarde doit demander");
  assert.match(bloc, /file\.name/, "et nommer le fichier qu'on s'apprête à appliquer");
  assert.match(bloc, /prospects\.length/, "et dire ce qui est en jeu");
});
