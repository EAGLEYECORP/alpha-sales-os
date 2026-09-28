import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALPHABET_CODE, LONGUEUR_CODE, PARAM_PARRAINAGE,
  attribuer, codeDepuisUrl, engendreCode, normaliseCode,
  memoriseParrainage, parrainageMemorise, oublieParrainage, CLE_PARRAINAGE,
  type CodeApporteur,
} from "../lib/apporteur-attribution";
import { statutApporteur } from "../lib/apporteur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ATTRIBUTION — ce que le modèle de commission n'avait pas.
 *
 * `lib/apporteur.ts` calculait COMBIEN revient à un apporteur et s'il peut
 * être payé. Il ne savait pas À QUI : rien ne reliait un client à celui qui
 * l'a amené. Un calcul juste sur un lien inexistant.
 * ─────────────────────────────────────────────────────────────────────
 */

const REGISTRE: CodeApporteur[] = [
  { code: "A1B2C3D4", apporteurId: "apporteur-1", actif: true },
  { code: "RETIRE00", apporteurId: "apporteur-2", actif: false },
];

test("normaliseCode — corrige les confusions de lecture, pas la saisie du client", () => {
  /**
   * Un code d'apport se DICTE au téléphone et se recopie depuis une capture
   * d'écran. `I`/`L` se lisent `1`, `O` se lit `0`. Rendre « code inconnu »
   * sur ces fautes-là fait abandonner quelqu'un sans qu'on sache jamais
   * qu'il a essayé — et la commission part à personne.
   */
  assert.equal(normaliseCode("a1b2c3d4"), "A1B2C3D4", "la casse ne compte pas");
  assert.equal(normaliseCode("A1B2-C3D4"), "A1B2C3D4", "les tirets de lisibilité sautent");
  assert.equal(normaliseCode(" A1B2 C3D4 "), "A1B2C3D4", "les espaces aussi");
  assert.equal(normaliseCode("AIB2C3D4"), "A1B2C3D4", "« I » lu pour « 1 »");
  assert.equal(normaliseCode("ALB2C3D4"), "A1B2C3D4", "« L » lu pour « 1 »");
  assert.equal(normaliseCode("A1B2C3D0"), "A1B2C3D0");
  assert.equal(normaliseCode("A1B2C3DO"), "A1B2C3D0", "« O » lu pour « 0 »");

  assert.equal(normaliseCode("TROPCOURT"), null, "9 caractères");
  assert.equal(normaliseCode("A1B2C3D"), null, "7 caractères");
  assert.equal(normaliseCode(""), null);
  assert.equal(normaliseCode(null), null);
  assert.equal(normaliseCode("A1B2C3D!"), null, "un caractère hors alphabet");
});

test("⚠ l'alphabet ne contient AUCUN caractère ambigu", () => {
  /**
   * La garde qui empêche de « compléter » l'alphabet un jour par commodité.
   * Rajouter `O` ou `I` casserait `normaliseCode`, qui les réécrit : deux
   * codes différents deviendraient le même, et l'attribution partirait au
   * mauvais apporteur sans que rien n'échoue.
   */
  for (const c of ["I", "L", "O", "U"]) {
    assert.ok(!ALPHABET_CODE.includes(c), `« ${c} » ne doit pas être dans l'alphabet`);
  }
  assert.equal(new Set(ALPHABET_CODE).size, ALPHABET_CODE.length, "aucun doublon");
});

test("engendreCode — reste dans l'alphabet, même sur un aléa aux bornes", () => {
  assert.equal(engendreCode(() => 0), ALPHABET_CODE[0].repeat(LONGUEUR_CODE));
  // ⚠ Un `Math.random()` rend [0,1[ mais une source injectée peut rendre 1 :
  // sans la borne, l'index sortirait du tableau et le code porterait
  // « undefined ».
  const auMax = engendreCode(() => 1);
  assert.equal(auMax.length, LONGUEUR_CODE);
  assert.ok([...auMax].every((c) => ALPHABET_CODE.includes(c)), `« ${auMax} » sort de l'alphabet`);
  assert.ok(normaliseCode(engendreCode(Math.random)), "un code engendré doit se renormaliser");
});

test("attribuer — le cas normal", () => {
  const r = attribuer({ codeBrut: "a1b2-c3d4", nouveauCompteId: "client-9", registre: REGISTRE });
  assert.equal(r.apporteurId, "apporteur-1");
  assert.equal(r.code, "A1B2C3D4", "le code stocké est normalisé, pas celui qui a été tapé");
  assert.equal(r.refus, null);
});

test("⚠ PREMIÈRE ATTRIBUTION GAGNE — et la porte est la PREMIÈRE testée", () => {
  /**
   * L'ordre des gardes est le correctif. Tester le code avant l'existant
   * laisserait croire qu'un code valide « aurait pu » réattribuer ; ici un
   * compte déjà attribué est clos, quoi qu'il arrive ensuite.
   *
   * Ce n'est pas de la rigidité : une attribution modifiable est une
   * attribution VOLABLE. Il suffirait d'envoyer son lien à un client déjà
   * signé pour capter la commission de quelqu'un d'autre, et rien ne le
   * signalerait.
   */
  const r = attribuer({
    codeBrut: "A1B2C3D4",
    nouveauCompteId: "client-9",
    attributionExistante: "ZZZZ9999",
    registre: REGISTRE,
  });
  assert.equal(r.refus, "deja-attribue");
  assert.equal(r.apporteurId, null, "aucun nouvel apporteur ne doit ressortir");
  assert.equal(r.code, "ZZZZ9999", "l'attribution existante est rendue telle quelle");
});

test("⚠ ON NE S'ATTRIBUE PAS SOI-MÊME", () => {
  const r = attribuer({ codeBrut: "A1B2C3D4", nouveauCompteId: "apporteur-1", registre: REGISTRE });
  assert.equal(r.refus, "auto-attribution");
  assert.equal(r.apporteurId, null, "sinon un apporteur se commissionne sur son propre compte");
});

test("⚠ UN CODE INCONNU OU RETIRÉ NE VAUT PAS ATTRIBUTION — jamais de repli", () => {
  /**
   * Une mauvaise attribution coûte plus cher que pas d'attribution : elle paie
   * la mauvaise personne ET fâche la bonne, et rien ne la signale. Le repli
   * « au premier apporteur du registre » est le raccourci à ne jamais prendre.
   */
  const inconnu = attribuer({ codeBrut: "ZZZZ0000", nouveauCompteId: "c", registre: REGISTRE });
  assert.equal(inconnu.refus, "code-inconnu");
  assert.equal(inconnu.apporteurId, null);

  const retire = attribuer({ codeBrut: "RETIRE00", nouveauCompteId: "c", registre: REGISTRE });
  assert.equal(retire.refus, "code-inconnu", "un code retiré n'attribue plus les NOUVEAUX comptes");
  assert.equal(retire.apporteurId, null);

  const vide = attribuer({ codeBrut: null, nouveauCompteId: "c", registre: REGISTRE });
  assert.equal(vide.refus, "aucun-code", "une inscription directe n'est pas une erreur");
  assert.equal(vide.apporteurId, null);
});

test("⚠ tout refus porte un MESSAGE — un refus muet se lit comme un succès", () => {
  for (const entree of [
    { codeBrut: "ZZZZ0000", nouveauCompteId: "c" },
    { codeBrut: "A1B2C3D4", nouveauCompteId: "apporteur-1" },
    { codeBrut: "pasuncode", nouveauCompteId: "c" },
    { codeBrut: null, nouveauCompteId: "c" },
  ]) {
    const r = attribuer({ ...entree, registre: REGISTRE });
    assert.ok(r.message.length > 20, `refus « ${r.refus} » sans explication utilisable`);
  }
});

test("⚠⚠ L'ATTRIBUTION N'EST PAS UNE AUTORISATION DE VERSEMENT", () => {
  /**
   * LA règle qui empêche qu'une chaîne de huit caractères devienne un moyen
   * de se faire payer. Attribuer et pouvoir verser sont deux questions, et la
   * seconde reste gouvernée par `statutApporteur` : SIRET bien formé ET
   * contrat signé. Un code n'ouvre rien.
   */
  const r = attribuer({ codeBrut: "A1B2C3D4", nouveauCompteId: "client-9", registre: REGISTRE });
  assert.equal(r.apporteurId, "apporteur-1", "l'attribution a bien eu lieu");

  // Et pourtant, rien n'est versable.
  assert.equal(statutApporteur({ id: "apporteur-1", siret: null, contratSigne: false }), "sans-statut");
  assert.equal(statutApporteur({ id: "apporteur-1", siret: "73282932000074", contratSigne: false }), "sans-contrat");

  // La route ne doit jamais toucher aux droits.
  const route = readFileSync(join(process.cwd(), "app/api/apporteur/attribution/route.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  assert.doesNotMatch(route, /\bbricks\b/, "l'attribution n'ouvre aucune brique");
  assert.doesNotMatch(route, /statut:\s*["']/, "et ne change aucun statut d'abonnement");
});

test("⚠ le compte attribué vient du JETON, jamais du corps de requête", () => {
  /**
   * Accepter un `tenantId` du client laisserait n'importe qui attribuer
   * n'importe quel compte à n'importe quel apporteur — à commencer par le
   * sien. Même règle que `estMaitre()`.
   */
  const route = readFileSync(join(process.cwd(), "app/api/apporteur/attribution/route.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  assert.match(route, /getTenantId\(\s*req\s*\)/, "le compte se lit dans la session");
  assert.doesNotMatch(route, /corps\.(tenant|tenantId|compte)/, "jamais un identifiant de compte fourni par le client");
  // Le corps ne porte QUE le code.
  assert.match(route, /corps:\s*\{\s*code\?:\s*string\s*\}/, "le client ne transmet que le code");
});

test("codeDepuisUrl — lit le paramètre, et ne jette jamais", () => {
  assert.equal(codeDepuisUrl(`https://x.invalid/vitrine?${PARAM_PARRAINAGE}=a1b2c3d4`), "A1B2C3D4");
  assert.equal(codeDepuisUrl(`/vitrine?${PARAM_PARRAINAGE}=A1B2-C3D4&autre=1`), "A1B2C3D4");
  assert.equal(codeDepuisUrl("https://x.invalid/vitrine"), null, "aucun paramètre");
  assert.equal(codeDepuisUrl(`https://x.invalid/?${PARAM_PARRAINAGE}=tronque`), null, "code mal formé");
  // ⚠ Une URL illisible ne doit pas faire tomber la page d'arrivée d'un
  // prospect : perdre une commission coûte moins cher que perdre le visiteur.
  assert.equal(codeDepuisUrl("::pas une url::"), null);
  assert.equal(codeDepuisUrl(null), null);
});

/** Un `Storage` minimal, pour tester la capture sans navigateur. */
function stockageFactice(initial: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
}

test("⚠ LE PREMIER CODE VU GAGNE, côté navigateur aussi", () => {
  /**
   * Le pendant local de l'immuabilité serveur, et il est NÉCESSAIRE : entre le
   * clic et l'inscription, le compte n'existe pas encore — le serveur n'a
   * rien à protéger. Sans ce garde, un prospect arrivé par l'apporteur A qui
   * retombe sur un lien de B avant de s'inscrire serait attribué à B.
   */
  const s = stockageFactice();
  assert.equal(memoriseParrainage(`/vitrine?${PARAM_PARRAINAGE}=A1B2C3D4`, s), "memorise");
  assert.equal(parrainageMemorise(s), "A1B2C3D4");

  assert.equal(memoriseParrainage(`/vitrine?${PARAM_PARRAINAGE}=ZZZZ9999`, s), "deja");
  assert.equal(parrainageMemorise(s), "A1B2C3D4", "le second lien ne doit pas écraser le premier");

  oublieParrainage(s);
  assert.equal(parrainageMemorise(s), null);
});

test("⚠ un stockage qui jette ne fait pas tomber la page", () => {
  /**
   * `localStorage` jette en navigation privée sur certains navigateurs. Une
   * capture d'attribution ratée ne doit jamais coûter le visiteur.
   */
  const casse = {
    getItem: () => {
      throw new Error("refusé");
    },
    setItem: () => {
      throw new Error("refusé");
    },
    removeItem: () => {
      throw new Error("refusé");
    },
  } as unknown as Storage;

  assert.equal(memoriseParrainage(`/x?${PARAM_PARRAINAGE}=A1B2C3D4`, casse), "aucun");
  assert.equal(parrainageMemorise(casse), null);
  assert.doesNotThrow(() => oublieParrainage(casse));
});

test("⚠ la capture est montée dans la RACINE, pas dans la coquille applicative", () => {
  /**
   * LE test qui aurait vu le défaut le plus probable. Un prospect amené par un
   * apporteur arrive sur `/vitrine`, qui vit HORS de `app/(app)/layout`. Monter
   * la capture dans la coquille — le réflexe, puisque les autres moteurs y
   * sont — l'aurait rendue inerte pour le seul public qu'elle concerne.
   */
  const racine = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
  assert.match(racine, /<CaptureParrainage\s*\/>/, "la capture doit être montée dans app/layout.tsx");
  assert.equal(CLE_PARRAINAGE, "alpha-parrainage", "la clé est stable : la changer perd les captures en cours");
});

test("⚠ la migration 007 pose l'immuabilité EN BASE, pas seulement dans le code", () => {
  /**
   * Une règle qui ne vit que dans une route se contourne par la route
   * suivante, ou par une main dans le SQL Editor. L'immuabilité est le seul
   * invariant ici dont la violation ne se voit jamais après coup.
   */
  const mig = readFileSync(join(process.cwd(), "supabase/migrations/007-attribution-apporteurs.sql"), "utf8");
  assert.match(mig, /create table if not exists public\.apporteur_codes/);
  assert.match(mig, /add column apporteur_code/);
  assert.match(mig, /add column apporteur_depuis/, "sans date, on sait à qui verser mais pas jusqu'à quand");
  assert.match(mig, /create trigger entitlements_attribution_immuable/, "l'immuabilité doit être un trigger");
  assert.match(mig, /raise exception/, "le trigger doit REFUSER, pas ignorer en silence");
  assert.match(mig, /enable row level security/, "un registre de commissionnement sans RLS est public");
  assert.doesNotMatch(mig, /for (insert|update|delete)/, "aucun utilisateur ne crée son propre code d'apport");
  assert.ok(mig.includes("begin;") && mig.includes("commit;"), "la migration doit être transactionnelle");
});
