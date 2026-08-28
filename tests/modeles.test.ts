import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MODELE_NIM_DEFAUT, MODELES_MORTS, estModeleMort, expliquerModele } from "../lib/modeles";

const RACINE = process.cwd();

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*#.*$/gm, "");

function fichiers(dirs: string[], exts: RegExp): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".venv" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) visite(p);
      else if (exts.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN IDENTIFIANT DE MODÈLE EST UN ACTIF DATÉ.
 *
 * ⚠ TROUVÉ EN PRODUCTION, PAS EN TEST — et aucun test ne pouvait le trouver :
 * personne ici ne connaît la date de fin de vie d'un modèle tiers.
 *
 * Le 28/08/2026, l'agent vocal a prononcé sa phrase d'ouverture (elle est dans
 * le CODE, art. 50) puis s'est tu :
 *
 *   410 Gone — "The model 'meta/llama-3.3-70b-instruct' has reached its end of
 *   life on 2026-08-26T09:00:00Z and is no longer available."
 *
 * Le même identifiant était le DÉFAUT de `lib/nvidia.ts` : toute l'IA de l'app
 * web était morte avec, depuis deux jours, sans que rien ne le dise.
 *
 * Ce que ce test peut garder — et c'est tout ce qu'il prétend garder : qu'un
 * modèle qu'on SAIT mort ne redevienne jamais un défaut, et que l'erreur dise
 * quoi faire.
 * ─────────────────────────────────────────────────────────────────────
 */
test("aucun modèle connu comme mort ne sert de valeur par défaut", () => {
  const fautes: string[] = [];
  const cibles = [
    ...fichiers(["lib", "app", "components"], /\.tsx?$/),
    ...fichiers(["voice"], /\.py$/),
  ];

  for (const f of cibles) {
    // `lib/modeles.ts` est le registre : c'est SA raison d'être de les nommer.
    if (f.endsWith(join("lib", "modeles.ts"))) continue;
    const code = sansCommentaires(readFileSync(f, "utf8"));
    for (const mort of MODELES_MORTS) {
      if (code.includes(`"${mort.id}"`) || code.includes(`'${mort.id}'`)) {
        fautes.push(`${relative(RACINE, f)} → « ${mort.id} » (mort le ${mort.finDeVie.slice(0, 10)})`);
      }
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "ces fichiers nomment encore un modèle retiré par son fournisseur :\n  " + fautes.join("\n  ")
  );
});

test("le fichier d'exemple d'environnement ne propose pas un modèle mort", () => {
  /**
   * `.env.example` est ce qu'on copie pour démarrer. Un identifiant mort
   * dedans, c'est une installation neuve qui ne fonctionne pas — et le
   * nouvel opérateur conclut que le produit est cassé, pas le modèle.
   */
  const env = readFileSync(join(RACINE, ".env.example"), "utf8");
  const lignes = env.split("\n").filter((l) => /^\s*[A-Z_]*MODEL\s*=/.test(l));
  assert.ok(lignes.length > 0, "aucune ligne MODEL dans .env.example — le test ne garde plus rien");
  for (const l of lignes) {
    const valeur = l.split("=").slice(1).join("=").trim();
    if (!valeur) continue;
    assert.equal(
      estModeleMort(valeur),
      undefined,
      `.env.example propose « ${valeur} », qui est en fin de vie`
    );
  }
});

test("le défaut de l'app et celui de l'agent vocal sont le MÊME modèle", () => {
  /**
   * Ils ont divergé : `voice/agent.py` était déjà passé à `openai/gpt-oss-20b`
   * (CLAUDE.md le documente depuis la mise au point de la latence), et
   * `lib/nvidia.ts` était resté sur le 70B. Le jour où le 70B est mort, la voix
   * aurait dû survivre — c'est le `.env` qui l'a fait tomber, mais l'app web,
   * elle, n'avait aucune chance : son défaut était mort.
   *
   * Deux moteurs qui ne parlent pas au même modèle, c'est deux comportements à
   * déboguer et deux dates d'expiration à surveiller.
   */
  const agent = readFileSync(join(RACINE, "voice/agent.py"), "utf8");
  assert.ok(
    agent.includes(`"${MODELE_NIM_DEFAUT}"`),
    `voice/agent.py ne prend plus « ${MODELE_NIM_DEFAUT} » comme défaut NIM`
  );
  const nvidia = readFileSync(join(RACINE, "lib/nvidia.ts"), "utf8");
  assert.match(
    sansCommentaires(nvidia),
    /MODELE_NIM_DEFAUT/,
    "lib/nvidia.ts doit prendre son défaut dans lib/modeles.ts, pas en dur"
  );
});

test("l'erreur explique quoi changer, pas seulement que ça a échoué", () => {
  const mort = MODELES_MORTS[0]!;
  const msg = expliquerModele(mort.id, 410);
  assert.ok(msg, "un modèle mort doit produire une explication");
  assert.match(msg!, /fin de vie/i, "elle doit nommer la cause");
  assert.match(msg!, /NVIDIA_MODEL/, "et le réglage à changer côté app");
  assert.match(msg!, /VOICE_MODEL/, "et celui côté voix — les deux se posent séparément");
  assert.ok(msg!.includes(mort.remplacePar), "et par quoi remplacer");

  // Le piège du namespace manquant : 404 systématique sur NIM.
  const sansNamespace = expliquerModele("gpt-oss-20b", 404);
  assert.ok(sansNamespace, "un id sans namespace sur un 404 doit être expliqué");
  assert.match(sansNamespace!, /namespace/i);

  // Un modèle vivant sur une erreur banale ne produit pas de bruit.
  assert.equal(expliquerModele(MODELE_NIM_DEFAUT, 401), null);
  assert.equal(expliquerModele(MODELE_NIM_DEFAUT, 429), null);
});
