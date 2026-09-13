import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TOUTE VARIABLE LUE PAR LE CODE EST DOCUMENTÉE — sinon elle n'existe pas.
 *
 * Une variable d'environnement non documentée est une panne silencieuse en
 * attente : le code la lit, elle vaut `undefined`, la fonctionnalité se tait,
 * et rien nulle part ne dit qu'il fallait la poser.
 *
 * ⚠ CE QUE CE TEST A TROUVÉ EN ARRIVANT. Six variables étaient lues sans
 * figurer dans `.env.example`, dont les DEUX dont dépend toute la sécurité
 * depuis que `SITE_PASSWORD` ne garde plus que l'administration :
 *
 *   REQUIRE_AUTH · SUPABASE_JWT_SECRET   → le mur ne se lève que si elles
 *                                          sont posées ; sans elles, tout
 *                                          reste muré sans que rien le dise
 *   NEXT_PUBLIC_OWNER_EMAILS             → le pendant navigateur d'OWNER_EMAILS
 *   JSON2VIDEO_API_KEY · VIDEO_GEN_*     → le studio vidéo
 *
 * Elles vivaient dans `ENV_TEMPLATE` (le gabarit que l'assistant affiche),
 * pas dans `.env.example`. Deux listes, deux fichiers, et c'est la deuxième
 * qui était périmée — exactement le mode d'échec que ce dépôt collectionne.
 * ─────────────────────────────────────────────────────────────────────
 */

const racine = process.cwd();
const exemple = readFileSync(join(racine, ".env.example"), "utf8");

/** Les noms déclarés dans `.env.example`, en début de ligne. */
const documentees = new Set(
  [...exemple.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1])
);

/** Posées par le framework, jamais par nous. */
const FOURNIES_PAR_NEXT = new Set(["NODE_ENV"]);

function sources(dirs: string[]): string[] {
  const out: string[] = [];
  const visiter = (rel: string) => {
    for (const e of readdirSync(join(racine, rel), { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const chemin = join(rel, e.name);
      if (e.isDirectory()) visiter(chemin);
      /**
       * ⚠⚠ `.py` A ÉTÉ AJOUTÉ LE 13/09/2026, ET SON ABSENCE A COÛTÉ SEIZE
       * VARIABLES INVISIBLES. Le balayage ne lisait que le TypeScript, donc
       * tout `voice/agent.py` échappait au garde : `ALPHA_APP_URL`,
       * `FISH_API_KEY`, `SIP_OUTBOUND_TRUNK_ID`, `VOICE_BRAND_NAME`… aucune
       * n'était dans `.env.example`.
       *
       * Le test PASSAIT, et c'est le pire des cas : il affirmait « toute
       * variable lue est documentée » en ne regardant qu'une moitié du code.
       * Un garde dont le périmètre est plus petit que sa promesse ne protège
       * pas — il rassure.
       *
       * ⚠ Ces variables-là ne vont PAS sur Vercel : l'agent vocal tourne en
       * local. `.env.example` les documente quand même, parce que c'est le
       * seul endroit où l'on cherche « qu'est-ce qu'il faut poser ».
       */
      else if (/\.tsx?$/.test(e.name) || /\.py$/.test(e.name)) out.push(chemin);
    }
  };
  for (const d of dirs) visiter(d);
  return out;
}

/** Toutes les variables réellement lues, dans les deux syntaxes. */
function variablesLues(): Map<string, string> {
  const trouvees = new Map<string, string>();
  const fichiers = [...sources(["lib", "app", "components", "voice"]), "middleware.ts", "next.config.ts"];
  for (const f of fichiers) {
    const src = readFileSync(join(racine, f), "utf8");
    for (const m of src.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
      if (!trouvees.has(m[1])) trouvees.set(m[1], f);
    }
    // `process.env[NOM]` — la forme que `priceIdFor` utilise, et qu'un
    // balayage naïf sur `process.env.` rate complètement.
    for (const m of src.matchAll(/process\.env\[["']([A-Z_][A-Z0-9_]*)["']\]/g)) {
      if (!trouvees.has(m[1])) trouvees.set(m[1], f);
    }
    // Python : `os.getenv("NOM")` et `os.environ["NOM"]`.
    for (const m of src.matchAll(/os\.getenv\(\s*["']([A-Z_][A-Z0-9_]*)["']/g)) {
      if (!trouvees.has(m[1])) trouvees.set(m[1], f);
    }
    for (const m of src.matchAll(/os\.environ\[["']([A-Z_][A-Z0-9_]*)["']\]/g)) {
      if (!trouvees.has(m[1])) trouvees.set(m[1], f);
    }
  }
  return trouvees;
}

test("chaque variable lue par le code figure dans .env.example", () => {
  const lues = variablesLues();
  assert.ok(lues.size >= 40, `seulement ${lues.size} variables détectées — le balayage est cassé`);

  const orphelines = [...lues.entries()].filter(
    ([nom]) => !documentees.has(nom) && !FOURNIES_PAR_NEXT.has(nom)
  );
  assert.deepEqual(
    orphelines.map(([nom, f]) => `${nom} (lu dans ${f})`),
    [],
    "variables lues mais non documentées — elles vaudront `undefined` en silence"
  );
});

test("le gabarit de l'assistant ne connaît rien que .env.example ignore", () => {
  /**
   * `ENV_TEMPLATE` (components/settings/system-status.tsx) est ce qu'on
   * affiche à quelqu'un qui installe. `.env.example` est la référence du
   * dépôt. Le gabarit peut être un SOUS-ENSEMBLE — on ne montre pas tout à
   * l'installation — mais jamais un sur-ensemble : une variable connue du
   * gabarit et absente de la référence, c'est la référence qui est périmée.
   */
  const src = readFileSync(join(racine, "components/settings/system-status.tsx"), "utf8");
  const bloc = src.slice(src.indexOf("ENV_TEMPLATE"), src.indexOf("`;", src.indexOf("ENV_TEMPLATE")));
  const duGabarit = [...bloc.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]);
  assert.ok(duGabarit.length > 10, "le gabarit n'a pas été lu correctement");

  const inconnues = duGabarit.filter((n) => !documentees.has(n));
  assert.deepEqual(inconnues, [], ".env.example est en retard sur le gabarit affiché à l'installation");
});

// ─────────── Les variables qui gouvernent la sécurité ───────────

test("les deux variables qui LÈVENT le mur sont documentées, et ce qu'elles font est écrit", () => {
  /**
   * Depuis que `SITE_PASSWORD` ne garde plus que l'administration, c'est ce
   * couple qui protège tout le reste. Les documenter sans dire qu'elles sont
   * opt-in — et que sans elles tout reste muré — laisserait croire à une
   * panne le jour où le mur ne se lève pas.
   */
  for (const v of ["REQUIRE_AUTH", "SUPABASE_JWT_SECRET"]) {
    assert.ok(documentees.has(v), `${v} doit être dans .env.example`);
  }
  const bloc = exemple.slice(exemple.indexOf("LÈVENT LE MUR"), exemple.indexOf("SUPABASE_JWT_SECRET="));
  assert.match(bloc, /opt-in/i, "il faut dire que les deux sont opt-in");
  assert.match(bloc, /reste (derrière|muré)/i, "et ce qui se passe tant qu'elles ne sont pas posées");
  assert.match(bloc, /fail-closed|refus systématique/i, "REQUIRE_AUTH sans le secret doit refuser, et se dire");
});

test("les DEUX listes d'emails propriétaires sont documentées ensemble", () => {
  /**
   * `OWNER_EMAILS` est lu par le SERVEUR (la barrière du middleware),
   * `NEXT_PUBLIC_OWNER_EMAILS` par le NAVIGATEUR (ce que l'écran affiche).
   * Deux listes dans deux fichiers : si elles divergent, l'écran dit une
   * chose et le serveur en fait une autre. Documenter l'une sans l'autre,
   * c'est garantir la divergence.
   */
  assert.ok(documentees.has("OWNER_EMAILS"));
  assert.ok(documentees.has("NEXT_PUBLIC_OWNER_EMAILS"));

  const bloc = exemple.slice(
    exemple.indexOf("COMPTE PROPRIÉTAIRE"),
    exemple.indexOf("NEXT_PUBLIC_OWNER_EMAILS=")
  );
  assert.match(bloc, /MÊME LISTE|concorder/i, "la contrainte de concordance doit être écrite");
  assert.match(bloc, /PERSONNE N'EST MAÎTRE|403/i, "l'effet d'une variable vide doit être écrit");
  assert.match(bloc, /PUBLIC par construction|bundle/i, "le risque du préfixe NEXT_PUBLIC_ doit être dit");
});

test("aucune valeur réelle n'a été laissée dans .env.example", () => {
  /**
   * Le fichier est versionné. Une clé collée ici part sur GitHub, et un
   * `.env.example` est exactement l'endroit où on colle « juste pour tester ».
   *
   * ⚠ LES COMMENTAIRES SORTENT AVANT L'ANALYSE — ce test a échoué sur son
   * propre garde-fou à la première exécution : la ligne qui EXPLIQUE le
   * format (« sk_live_… en production ») contient le motif interdit. Sans ce
   * retrait, la seule façon de faire taire le test serait de supprimer
   * l'explication, ce qui est exactement l'inverse du but. Le dépôt a déjà
   * appris cette leçon deux fois (`sansCommentaires` dans vitrine-fuite et
   * linkedin) — troisième fois, même remède.
   */
  const valeurs = exemple
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  for (const motif of [/nvapi-[A-Za-z0-9_-]{10,}/, /sk-[A-Za-z0-9]{20,}/, /sk_live_/, /eyJhbGciOi/]) {
    assert.doesNotMatch(valeurs, motif, "une clé réelle traîne dans .env.example");
  }
  /**
   * ⚠ ET LA DEUXIÈME VERSION DE CE TEST ÉTAIT FAUSSE AUSSI. « Toute ligne
   * remplie est suspecte » attrapait `SMTP_PORT=587`, `NVIDIA_MODEL=…` et
   * quatre autres valeurs par défaut parfaitement légitimes — un gabarit a le
   * droit de proposer des défauts, c'est même son intérêt.
   *
   * On ne juge donc que les variables dont le NOM annonce un secret. Une clé
   * ne s'appelle jamais `SMTP_PORT`.
   */
  const SECRET = /(KEY|SECRET|TOKEN|PASSWORD|PWD)$/;
  const remplies = [...valeurs.matchAll(/^([A-Z_][A-Z0-9_]*)=(.+)$/gm)]
    .filter(([, nom, v]) => SECRET.test(nom) && !/^(choisis|le-m|ton@|xxx|price_xxx|eyJ…|TON-)/i.test(v.trim()));
  assert.deepEqual(
    remplies.map((m) => m[1]),
    [],
    "ces variables SECRÈTES portent une valeur — le fichier est versionné, il part sur GitHub"
  );
});
