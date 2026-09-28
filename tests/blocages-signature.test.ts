import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { signingBlockers } from "../lib/hormozi";
import { seedProspects } from "../lib/seed";

const RACINE = process.cwd();

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

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
 * LE DERNIER MÈTRE NE SE JOUE PAS DANS UNE BOÎTE DU NAVIGATEUR.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. Cliquer « ✍ Signer (3 blocages) »
 * ouvrait un `alert()` natif — « localhost:3000 indique / ⛔ Doctrine : … »
 * — et le SECOND appelant est `closing-mode`, l'écran ouvert DEVANT le
 * client.
 *
 * Le vrai défaut n'est pas l'esthétique : c'est que le contenu disparaît au
 * clic sur OK. Les blocages sont la seule information utile de cet instant —
 * les trois choses à aller chercher. `alert()` interrompt ; ici il faut
 * informer.
 *
 * Le garde est DÉDUIT : tout module qui lit `signingBlockers` doit les
 * afficher dans l'app. Un troisième chemin de closing écrit demain est
 * couvert le jour où il est écrit.
 * ─────────────────────────────────────────────────────────────────────
 */
test("aucun chemin de closing n'annonce ses blocages dans un dialogue natif", () => {
  const fautes: string[] = [];
  for (const f of fichiersSources(["app", "components"])) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("signingBlockers")) continue;
    const code = sansCommentaires(src);
    if (/\balert\s*\(/.test(code)) {
      // On ne condamne que l'alerte QUI PORTE les blocages : un autre alert()
      // dans le même fichier n'a rien à voir avec le closing.
      if (/alert\([^)]*signingBlockers|alert\([^)]*[Dd]octrine/.test(code)) {
        fautes.push(`${relative(RACINE, f)} → les blocages passent par alert()`);
      }
    }
    /**
     * ⚠ Ce test cherchait `/BlocagesSignature/` — l'IMPORT suffisait à le
     * satisfaire. La mutation « renommer la balise » est passée au vert.
     * On exige donc le MONTAGE, pas la mention.
     */
    if (!/<BlocagesSignature[\s/>]/.test(code)) {
      fautes.push(`${relative(RACINE, f)} → ne monte pas <BlocagesSignature>`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "le dernier mètre du closing passe encore par le navigateur :\n  " + fautes.join("\n  ")
  );
});

test("le panneau ne s'ouvre que s'il y a quelque chose à dire", () => {
  const src = readFileSync(join(RACINE, "components/blocages-signature.tsx"), "utf8");
  assert.match(
    src,
    /open=\{blocages\.length > 0\}/,
    "un panneau vide qui s'ouvre quand même apprend à le fermer sans lire"
  );
  // Et les blocages sont ÉNUMÉRÉS, pas résumés en un compte : c'est la liste
  // qui sert, pas le nombre — le nombre est déjà sur le bouton.
  assert.match(src, /blocages\.map\(/, "les blocages doivent être listés un par un");
});

test("le jeu de démonstration porte bien des fiches bloquées — sinon ce test ne garde rien", () => {
  const bloquees = seedProspects.filter((p) => signingBlockers(p).length > 0);
  assert.ok(bloquees.length > 0, "aucune fiche de démo n'a de blocage : le chemin n'est plus exercé");
  // Chaque blocage est une PHRASE lisible, pas un code : elle est montrée
  // telle quelle à l'opérateur, au moment le plus tendu du cycle.
  for (const p of bloquees) {
    for (const b of signingBlockers(p)) {
      assert.ok(b.trim().length > 12, `blocage illisible sur ${p.company} : « ${b} »`);
    }
  }
});
