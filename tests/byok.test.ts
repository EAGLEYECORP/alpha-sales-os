import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_SANS_COUT,
  AUCUN_MOTEUR,
  CAPACITES_PAR_API,
  CAPACITES,
  cheminOuvertParCle,
  moteurUtilisable,
} from "../lib/credentials";
import {
  chiffrer,
  dechiffrer,
  empreinteVisible,
  moteurDepuisValeurs,
  resoudreMoteurIA,
} from "../lib/credentials-secret";
import { autorise, DROIT_SOLO, droitGratuit } from "../lib/entitlements";
import { CHEMIN_PAR_API, MAITRE_SEULEMENT } from "../lib/api-access";

const racine = process.cwd();
const lire = (f: string) => readFileSync(join(racine, f), "utf8");

/**
 * ⚠ Les commentaires sont retirés AVANT toute recherche. Ce dépôt a déjà payé
 * deux fois un garde satisfait par sa propre PROSE — dont une fois dans cette
 * session, sur une mention de `/api/send` dans un bloc doctrinaire.
 */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CLE_TEST = "0".repeat(64); // 32 octets en hex

// ══════════ LE CHIFFREMENT ══════════

test("⚠ chiffrer/déchiffrer fait l'aller-retour, et refuse sans clé maître", () => {
  const avant = process.env.CREDENTIALS_MASTER_KEY;
  try {
    process.env.CREDENTIALS_MASTER_KEY = CLE_TEST;
    const c = chiffrer({ ANTHROPIC_API_KEY: "valeur-de-test-abcd" });
    assert.ok(c, "avec une clé maître, le chiffrement doit aboutir");
    assert.deepEqual(dechiffrer(c.secretChiffre, c.nonce), { ANTHROPIC_API_KEY: "valeur-de-test-abcd" });

    /**
     * ⚠⚠ SANS CLÉ MAÎTRE, ON REFUSE — on ne stocke pas « en attendant ».
     * Une clé de repli écrite dans le dépôt donnerait un chiffrement qui a
     * l'air fait et ne protège rien ; un secret de client rangé en clair ne
     * se rattrape jamais.
     */
    delete process.env.CREDENTIALS_MASTER_KEY;
    assert.equal(chiffrer({ X: "y" }), null);
    assert.equal(dechiffrer(c.secretChiffre, c.nonce), null, "sans clé, on ne déchiffre pas non plus");
  } finally {
    if (avant === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = avant;
  }
});

test("⚠ une ligne modifiée en base ne se déchiffre pas — GCM authentifie", () => {
  const avant = process.env.CREDENTIALS_MASTER_KEY;
  try {
    process.env.CREDENTIALS_MASTER_KEY = CLE_TEST;
    const c = chiffrer({ ANTHROPIC_API_KEY: "valeur-de-test-abcd" })!;
    // On altère un octet du chiffré : sans tag d'authentification, on rendrait
    // du charabia ; avec, on rend `null`.
    const octets = Buffer.from(c.secretChiffre, "base64");
    octets[0] = octets[0] ^ 0xff;
    assert.equal(dechiffrer(octets.toString("base64"), c.nonce), null);
  } finally {
    if (avant === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = avant;
  }
});

test("l'empreinte ne montre que la fin, jamais le secret", () => {
  /**
   * ⚠ La valeur de test ne porte PAS le préfixe d'un vrai fournisseur
   * (`sk-ant-…`, `nvapi-…`). Elle est inventée, mais un dépôt se clone et un
   * scanner de secrets — le nôtre compris — ne lit pas les intentions. Même
   * raison que les plages ARCEP de fiction pour les numéros : on choisit une
   * forme qu'on ne peut pas confondre avec la vraie.
   */
  assert.equal(empreinteVisible("valeur-de-test-non-valide-a4f2"), "…a4f2");
  assert.ok(!empreinteVisible("valeur-de-test-non-valide-a4f2").includes("non-valide"));
  assert.equal(empreinteVisible("abc"), "…", "un secret trop court ne se montre pas du tout");
});

// ══════════ L'ORDRE DE RÉSOLUTION — QUI PAIE ══════════

test("⚠⚠ SANS DROIT ET SANS CLÉ, AUCUN MOTEUR — même si NOS clés sont posées", async () => {
  /**
   * Le cœur du module. Un compte gratuit ne doit JAMAIS atteindre nos clés :
   * « pas de clé locataire ⇒ on prend la nôtre » sans vérifier le droit, et
   * tout inscrit dépense sur notre compte — invisible jusqu'à la facture, un
   * mois plus tard.
   *
   * ⚠ Sans Supabase configuré, `identifiantsDu` rend `null` : on mesure donc
   * bien la marche 2 (le droit), pas la marche 1.
   */
  const avant = process.env.ANTHROPIC_API_KEY;
  try {
    process.env.ANTHROPIC_API_KEY = "valeur-maison-de-test";
    const gratuit = droitGratuit("t-neuf");
    const m = await resoudreMoteurIA("t-neuf", gratuit);
    assert.equal(m.origine, "aucune", "un gratuit sans clé ne doit atteindre aucun moteur");
    assert.equal(moteurUtilisable(m), false);
    assert.equal(m.anthropic, undefined, "NOTRE clé ne doit pas fuiter dans le moteur rendu");
  } finally {
    if (avant === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = avant;
  }
});

test("⚠ AVEC le droit, c'est la MAISON qui paie — et l'origine le dit", async () => {
  const avant = process.env.ANTHROPIC_API_KEY;
  try {
    process.env.ANTHROPIC_API_KEY = "valeur-maison-de-test";
    const m = await resoudreMoteurIA("t-maitre", DROIT_SOLO);
    assert.equal(m.origine, "maison");
    assert.equal(m.anthropic?.key, "valeur-maison-de-test");
    /**
     * ⚠ `origine` n'est pas décoratif : c'est la seule information qui
     * permettra un jour de savoir ce qu'un locataire nous coûte vraiment.
     * Aujourd'hui personne ne le sait.
     */
    assert.notEqual(m.origine, "locataire");
  } finally {
    if (avant === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = avant;
  }
});

test("⚠ aucune de NOS clés posée ⇒ aucune origine « maison » fabriquée", async () => {
  const a = process.env.ANTHROPIC_API_KEY;
  const n = process.env.NVIDIA_API_KEY;
  const o = process.env.OLLAMA_MODEL;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OLLAMA_MODEL;
    const m = await resoudreMoteurIA("t-maitre", DROIT_SOLO);
    assert.deepEqual(m, AUCUN_MOTEUR, "un droit sans clé derrière ne vaut pas un moteur");
  } finally {
    if (a !== undefined) process.env.ANTHROPIC_API_KEY = a;
    if (n !== undefined) process.env.NVIDIA_API_KEY = n;
    if (o !== undefined) process.env.OLLAMA_MODEL = o;
  }
});

test("des valeurs de locataire vides ne construisent pas de moteur", () => {
  assert.deepEqual(moteurDepuisValeurs({}), AUCUN_MOTEUR);
  assert.deepEqual(moteurDepuisValeurs({ ANTHROPIC_API_KEY: "   " }), AUCUN_MOTEUR);
  const m = moteurDepuisValeurs({ ANTHROPIC_API_KEY: "valeur-locataire-de-test" });
  assert.equal(m.origine, "locataire");
  assert.equal(m.anthropic?.key, "valeur-locataire-de-test");
});

// ══════════ CE QU'UNE CLÉ OUVRE — ET CE QU'ELLE N'OUVRE PAS ══════════

test("⚠⚠ UNE CLÉ IA N'OUVRE QUE CE DONT ELLE PAIE LA TOTALITÉ", () => {
  /**
   * `/agent` n'est servi que par des API dont le seul coût est le modèle :
   * elle s'ouvre. `/audits` est servi par `/api/icp` (IA) ET `/api/audit`,
   * qui récupère des sites tiers DEPUIS NOTRE SERVEUR — notre egress, notre
   * exposition à l'abus. `/social` est servi par `/api/social` (IA) ET
   * `/api/video`, qui rend de la vidéo sur notre calcul.
   *
   * Un `some` au lieu d'un `every` les ouvrirait toutes les trois : le
   * locataire paierait ses jetons, et nous le reste, sans que rien ne le
   * dise. C'est le même défaut que « classer par famille au lieu de classer
   * par dépense », que le freemium a déjà payé.
   */
  assert.equal(cheminOuvertParCle("/agent", ["ia"]), true, "/agent est entièrement payé par la clé");
  assert.equal(cheminOuvertParCle("/audits", ["ia"]), false, "/api/audit sort de notre serveur : pas couvert");
  assert.equal(cheminOuvertParCle("/social", ["ia"]), false, "/api/video coûte notre calcul : pas couvert");
  assert.equal(cheminOuvertParCle("/voice", ["ia"]), false, "la téléphonie n'est pas une capacité apportée");
  assert.equal(cheminOuvertParCle("/campaigns", ["ia"]), false, "notre SMTP n'est pas payé par une clé IA");

  // Sans capacité, rien ne s'ouvre — la non-vacuité du test.
  assert.equal(cheminOuvertParCle("/agent", []), false);
  // Un chemin que personne ne sert ne s'ouvre pas par défaut.
  assert.equal(cheminOuvertParCle("/chemin-qui-n-existe-pas", ["ia"]), false);
});

test("⚠ `/api/audit` est ABSENTE de la table des capacités, et ce n'est pas un oubli", () => {
  /**
   * Elle appelle bien l'IA. Mais elle récupère aussi des sites tiers depuis
   * notre serveur. La ranger ici « parce qu'elle fait de l'IA » serait
   * classer par FAMILLE au lieu de classer par DÉPENSE.
   */
  assert.equal(CAPACITES_PAR_API["/api/audit"], undefined);
  assert.equal(CAPACITES_PAR_API["/api/video"], undefined);
  assert.equal(CAPACITES_PAR_API["/api/voice"], undefined);
  assert.equal(CAPACITES_PAR_API["/api/transcribe"], undefined);
  /**
   * ⚠ `/api/gmail` reste absente alors qu'elle est de la MÊME FAMILLE que
   * l'envoi : elle écrit un brouillon via NOTRE IMAP, et la capacité `email`
   * n'apporte qu'un SMTP. L'inscrire affirmerait qu'une clé d'envoi la
   * couvre — c'est faux. Aujourd'hui ça ne changerait rien de visible
   * (`/outbox` reste fermé par `/api/compose`), et c'est ce qui rend le piège
   * dangereux : il ne se déclencherait que plus tard, pour quelqu'un d'autre.
   */
  assert.equal(CAPACITES_PAR_API["/api/gmail"], undefined);
  /**
   * ⚠⚠ `/api/send` EST couverte par `email` — mais elle sert DEUX canaux.
   * Ce que cette liste dit, c'est « une clé SMTP paie ce que cette route
   * dépense en EMAIL ». Le SMS, lui, est refusé au runtime : la porte est
   * grossière par nécessité (le canal vit dans le corps de la requête), la
   * route est l'autorité.
   */
  assert.deepEqual(CAPACITES_PAR_API["/api/send"], ["email"]);
  // Et celles qui y sont le sont pour de bon.
  assert.deepEqual(CAPACITES_PAR_API["/api/ai"], ["ia"]);
  assert.deepEqual(CAPACITES_PAR_API["/api/sparring"], ["ia"]);
});

test("⚠ le type Capacite et la contrainte SQL déclarent les MÊMES valeurs", () => {
  /**
   * Une valeur ajoutée d'un seul côté donne soit une capacité que la base
   * refuse d'écrire, soit une valeur en base que le code ne sait pas servir.
   * Les deux listes grandissent dans le même diff, ou pas du tout.
   */
  /**
   * ⚠ On lit le SCHÉMA, pas une migration : les migrations s'empilent (010
   * crée la contrainte, 011 l'élargit), et viser la première ferait échouer
   * le test à chaque lot suivant — donc le ferait assouplir. `schema.sql`
   * porte toujours l'état courant.
   */
  const sql = lire("supabase/schema.sql");
  const m = sql.match(/capacite\s+text\s+not null check \(capacite in \(([^)]*)\)\)/);
  assert.ok(m, "la contrainte de capacité a disparu du schéma");
  const duSql = m[1].split(",").map((v) => v.trim().replace(/'/g, "")).sort();
  assert.deepEqual(duSql, [...CAPACITES].sort());
});

// ══════════ LE CÂBLAGE — c'est là que ce dépôt échoue ══════════

test("⚠⚠ ai-engine NE LIT PLUS L'ENVIRONNEMENT — il reçoit le moteur", () => {
  /**
   * Il lisait `process.env.ANTHROPIC_API_KEY` lui-même. Laissé en place, ce
   * chemin facturerait à NOUS l'appel d'un locataire qui a pourtant collé sa
   * clé — et ça ne se verrait que sur la facture, un mois plus tard.
   */
  const src = sansCommentaires(lire("lib/ai-engine.ts"));
  assert.ok(!/process\.env/.test(src), "ai-engine ne doit plus lire aucune variable d'environnement");
  assert.match(src, /moteur: MoteurIA/, "le moteur est un paramètre, pas une déduction");
});

test("⚠⚠ AUCUNE ROUTE IA NE LIT PLUS LA CLÉ ELLE-MÊME", () => {
  /**
   * `/api/agent` et `/api/sparring` CONTOURNAIENT `runAI` et lisaient
   * `process.env.ANTHROPIC_API_KEY` de leur côté. Ça faisait TROIS
   * définitions de « comment on joint le modèle », dont deux invisibles
   * depuis `lib/ai-engine`.
   */
  for (const f of [
    "app/api/agent/route.ts",
    "app/api/sparring/route.ts",
    "app/api/ai/route.ts",
    "app/api/brain/route.ts",
    "app/api/icp/route.ts",
    "app/api/debrief/route.ts",
    "app/api/social/draft/route.ts",
  ]) {
    const src = sansCommentaires(lire(f));
    assert.ok(
      !/process\.env\.(ANTHROPIC_API_KEY|NVIDIA_API_KEY|AI_MODEL|OLLAMA_MODEL)/.test(src),
      `${f} lit encore une clé de moteur dans l'environnement`
    );
    assert.match(src, /moteurIADeLaRequete/, `${f} doit résoudre son moteur`);
  }
});

test("⚠⚠ LE SDK NE DOIT PAS RETOMBER SUR NOTRE ENVIRONNEMENT", () => {
  /**
   * LE PIÈGE LE PLUS COÛTEUX DU LOT, et il ne produit AUCUNE erreur :
   * `anthropic(model)` lit `ANTHROPIC_API_KEY` dans l'environnement du
   * serveur. Écrit comme ça, un appel de locataire — clé collée, vérifiée,
   * affichée comme active — serait facturé sur NOTRE compte. Tout aurait
   * l'air de marcher.
   *
   * `createAnthropic({ apiKey })` est la seule forme qui prend la clé qu'on
   * lui donne.
   */
  for (const f of ["lib/ai-engine.ts", "app/api/agent/route.ts"]) {
    const src = sansCommentaires(lire(f));
    assert.match(src, /createAnthropic\(\{\s*apiKey:/, `${f} doit passer la clé explicitement`);
    assert.ok(
      !/\banthropic\(/.test(src),
      `${f} utilise la fabrique implicite, qui retombe sur NOTRE clé`
    );
  }
});

test("⚠⚠ LE MIDDLEWARE A DEUX PORTES QUI ACCORDENT, ET LE REFUS EXIGE LES DEUX", () => {
  /**
   * ⚠ Ce `||` est de la bonne forme, et il faut se méfier de sa jumelle :
   * l'écran de connexion a déjà payé un `&&` là où il fallait un `||`, ce qui
   * avait rendu la serrure dépendante du trousseau de celui qui entre.
   */
  const src = sansCommentaires(lire("middleware.ts"));
  assert.match(
    src,
    /const ouvert = autorise\(droits, chemin\) \|\| \(await cleOuvreLeChemin\(droits, chemin\)\)/,
    "les deux portes doivent accorder, et être combinées par un OU"
  );
  assert.match(src, /if \(!ouvert\)/, "le refus porte sur la combinaison, pas sur une seule porte");
  // Et la garde maître reste AVANT : l'identité se vérifie avant les droits.
  const iMaitre = src.indexOf("MAITRE_SEULEMENT) && !droits.maitre");
  const iOuvert = src.indexOf("const ouvert = autorise");
  assert.ok(iMaitre > 0 && iMaitre < iOuvert, "la garde maître passe avant la porte des droits");
});

// ══════════ LA ROUTE D'ENREGISTREMENT ══════════

test("⚠⚠ LA ROUTE NE PREND JAMAIS LE LOCATAIRE DANS LE CORPS", () => {
  /**
   * Accepter un `tenantId` transmis laisserait n'importe qui écrire — ou
   * effacer — la clé de n'importe qui d'autre, sans que ça se voie nulle
   * part. Le locataire vient du jeton, et de rien d'autre.
   */
  const src = sansCommentaires(lire("app/api/credentials/route.ts"));
  assert.ok(!/body\.tenantId|body\?\.tenantId/.test(src), "aucun tenantId ne vient du corps");
  const occurrences = [...src.matchAll(/droits\.tenantId/g)].length;
  assert.ok(occurrences >= 4, `le tenant doit venir des droits partout (${occurrences} usages)`);
});

test("⚠⚠ RIEN N'EST ENREGISTRÉ SANS UN VRAI APPEL RÉUSSI", () => {
  /**
   * `verifie_le` est ce qui ouvre la capacité. Le poser sans avoir appelé le
   * fournisseur ferait ouvrir la brique sur une faute de frappe, et l'échec
   * se découvrirait devant un prospect.
   */
  const src = sansCommentaires(lire("app/api/credentials/route.ts"));
  const iAppel = src.indexOf("await runAI(");
  const iEchec = src.indexOf("if (echec)");
  const iUpsert = src.indexOf(".upsert(");
  assert.ok(iAppel > 0 && iEchec > iAppel && iUpsert > iEchec, "l'appel, puis le refus, puis l'écriture");
  assert.match(src, /verifie_le: new Date\(\)\.toISOString\(\)/);
  // Et sans chiffrement possible, on refuse — on ne stocke pas en clair.
  assert.match(src, /if \(!chiffre\)/);
  assert.match(src, /status: 503/);
});

test("⚠ la route ne stocke QUE les champs attendus", () => {
  /**
   * Un corps qui porterait `SUPABASE_SERVICE_ROLE_KEY` ne doit pas finir
   * chiffré dans notre base : on ne stocke pas ce qu'on n'a pas demandé.
   */
  const src = sansCommentaires(lire("app/api/credentials/route.ts"));
  assert.match(src, /for \(const champ of CHAMPS_ATTENDUS\[capacite\]\)/);
  assert.ok(!/\.\.\.brut|Object\.assign\(valeurs, brut\)/.test(src), "aucune recopie en bloc du corps");
});

test("⚠ l'écran est SERVI, et il ne réaffiche jamais la clé", () => {
  /**
   * Le défaut récurrent du dépôt : un module juste, testé, et appelé par
   * aucun écran. Il serait ironique ici — le BYOK n'existe que pour être
   * atteint par quelqu'un qui n'a rien acheté.
   */
  const page = lire("app/(app)/settings/page.tsx");
  assert.match(page, /from "@\/components\/settings\/cle-ia"/, "les Réglages doivent importer le panneau");
  assert.match(page, /<CleIA \/>/, "et le rendre");

  const comp = sansCommentaires(lire("components/settings/cle-ia.tsx"));
  assert.match(comp, /type="password"/, "la saisie est masquée");
  assert.ok(
    !/setAnthropic\(d\.|setNvidia\(d\./.test(comp),
    "aucune valeur venue du serveur ne remplit les champs : la clé ne redescend jamais"
  );
  assert.match(comp, /empreinte/, "on affiche l'empreinte, pas le secret");
});

test("⚠⚠ LES DEUX REPLIS QUI N'ONT PAS MORDU — gardés sur la SOURCE, faute de base", () => {
  /**
   * ⚠ HONNÊTETÉ SUR CE QUE CE TEST VAUT. Deux mutations sont passées au vert
   * le 16/09/2026 : faire rendre `["ia"]` à `capacitesDu` sur une erreur de
   * base, et retirer le filtre `verifie_le`. Les deux ouvrent un accès sur
   * une panne ou sur une clé jamais testée — exactement ce que le module
   * existe pour empêcher.
   *
   * Elles n'ont pas mordu pour une raison qui n'est pas rassurante : sans
   * Supabase configuré, `serviceClient()` rend `null` et la fonction sort
   * AVANT ces branches. Le comportement est donc **inatteignable ici**, et
   * un test de comportement ne peut pas le mesurer.
   *
   * Ce garde est plus faible qu'un test de comportement : il vérifie la
   * FORME du code, pas ce qu'il fait. Il tient jusqu'au jour où quelqu'un
   * écrira la même faute autrement. La vraie couverture demande une base de
   * test, et elle reste à faire.
   */
  const edge = sansCommentaires(lire("lib/credentials.ts"));
  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));

  const iCap = edge.indexOf("export async function capacitesDu");
  const corpsCap = edge.slice(iCap, iCap + 900);
  assert.match(corpsCap, /if \(error\) return \[\];/, "une erreur de base ne doit accorder AUCUNE capacité");
  assert.ok(
    !/if \(error\) return \[\s*"/.test(corpsCap),
    "rendre une capacité sur une panne ouvrirait l'accès au moment où l'on ne sait plus rien"
  );
  assert.match(
    corpsCap,
    /\.not\("verifie_le", "is", null\)/,
    "seule une clé VÉRIFIÉE compte : sinon une faute de frappe ouvre la brique"
  );

  // Et la lecture des identifiants exige aussi `verifie_le`, côté résolution.
  const iId = secret.indexOf("export async function identifiantsDu");
  const corpsId = secret.slice(iId, iId + 900);
  assert.match(corpsId, /!ligne\.verifie_le/, "une clé non vérifiée ne doit pas se déchiffrer non plus");
  assert.match(corpsId, /if \(error\) return null;/);
});

test("⚠⚠ LE MODULE LU PAR LE MIDDLEWARE NE TOUCHE PAS À node: — l'Edge n'en a pas", () => {
  /**
   * ⚠ TROUVÉ PAR `next build`, PAS PAR UN TEST. `tsc` compilait, les 1930
   * tests passaient, et le build de production échouait : le middleware
   * tourne en **Edge**, où `node:crypto` n'existe pas, et il importait le
   * module entier.
   *
   * C'est le troisième canal d'alerte du dépôt — celui que rien n'oblige à
   * lire — et c'est la deuxième fois cette semaine qu'il attrape ce que les
   * deux autres ne voient pas.
   *
   * La séparation qui en résulte n'est pas qu'un contournement de
   * plateforme : **la porte d'entrée n'a aucune raison de savoir déchiffrer
   * une clé.** Elle a seulement besoin de savoir qu'il en existe une,
   * vérifiée. Ce garde protège les deux à la fois.
   */
  const edge = sansCommentaires(lire("lib/credentials.ts"));
  assert.ok(!/from "node:/.test(edge), "le module Edge ne doit importer aucun module Node");
  assert.ok(!/createCipheriv|createDecipheriv|randomBytes/.test(edge), "ni aucune primitive de chiffrement");

  // Et le middleware ne doit pas non plus atteindre la moitié secrète.
  const mw = sansCommentaires(lire("middleware.ts"));
  assert.ok(
    !/credentials-secret/.test(mw),
    "le middleware importerait alors node:crypto par transitivité, et le build retomberait"
  );
  assert.match(mw, /from "@\/lib\/credentials"/, "il lit bien la moitié Edge");

  // Non-vacuité : la moitié secrète, elle, contient bien le chiffrement.
  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));
  assert.match(secret, /from "node:crypto"/);
});

// ══════════ L2 — L'EMAIL ══════════

test("⚠⚠ UNE CLÉ SMTP OUVRE /campaigns, ET RIEN D'AUTRE", () => {
  assert.equal(cheminOuvertParCle("/campaigns", ["email"]), true);
  assert.equal(cheminOuvertParCle("/agent", ["email"]), false, "l'email ne paie pas les jetons");
  assert.equal(cheminOuvertParCle("/voice", ["email"]), false, "ni les minutes");
  assert.equal(cheminOuvertParCle("/audits", ["email"]), false);
  assert.equal(cheminOuvertParCle("/outbox", ["email"]), false, "notre IMAP n'est pas un SMTP apporté");
  // Et réciproquement : une clé IA n'ouvre pas les envois.
  assert.equal(cheminOuvertParCle("/campaigns", ["ia"]), false);
});

test("⚠ la liste des API SANS COÛT reste minuscule et justifiée", () => {
  /**
   * ⚠⚠ CETTE LISTE EST UN TROU PAR CONSTRUCTION : tout ce qu'on y met échappe
   * au contrôle de coût. Elle existe pour UNE raison mesurée —
   * `/api/deliverability` n'interroge que des enregistrements DNS publics —
   * et chaque entrée ajoutée devrait l'être avec la même preuve.
   */
  assert.ok(API_SANS_COUT.length <= 2, `${API_SANS_COUT.length} entrées : la liste enfle`);
  for (const chere of ["/api/send", "/api/ai", "/api/voice", "/api/transcribe", "/api/video", "/api/audit"]) {
    assert.ok(!API_SANS_COUT.includes(chere), `${chere} dépense chez nous : elle ne peut pas être « sans coût »`);
  }
});

test("⚠⚠ /api/send NE LIT PLUS SMTP_* — il reçoit la boîte résolue", () => {
  /**
   * La route lisait `SMTP_*` dans NOTRE environnement. C'était la phrase
   * exacte de la doctrine : ouvrir l'envoi au gratuit faisait partir de vrais
   * emails depuis notre domaine pour des inconnus — visible seulement sur la
   * réputation, des semaines plus tard.
   */
  const src = sansCommentaires(lire("app/api/send/route.ts"));
  const iPost = src.indexOf("export async function POST");
  const corps = src.slice(iPost);
  assert.ok(
    !/process\.env\.SMTP_/.test(corps),
    "l'envoi ne doit plus lire notre SMTP dans l'environnement"
  );
  assert.match(corps, /const smtp = await resoudreSmtp\(tenantId, droits\)/);
  assert.match(corps, /if \(!smtpUtilisable\(smtp\)\)/, "sans boîte résolue, on refuse");
  assert.match(corps, /host: smtp\.host/);
  assert.match(corps, /from: smtp\.from/);
});

test("⚠⚠ LE LIEN STOP POINTE VERS LA BOÎTE QUI ENVOIE", () => {
  /**
   * Sur un envoi de locataire, un STOP qui arriverait chez NOUS ne serait
   * jamais traité par celui qui doit le traiter — et le prospect continuerait
   * de recevoir ses messages après avoir refusé. C'est une faute de fond, pas
   * un détail d'implémentation.
   */
  const src = sansCommentaires(lire("app/api/send/route.ts"));
  assert.match(src, /const stopMailto = smtp\.from\.match/);
  assert.ok(!/stopMailto = \(SMTP_FROM/.test(src));
});

test("⚠⚠ LA BRANCHE SMS QUE LE BYOK EMAIL REND ATTEIGNABLE EST FERMÉE", () => {
  /**
   * LE DÉFAUT QUE CE LOT A CRÉÉ, ET QU'IL DOIT REFERMER LUI-MÊME.
   *
   * `/api/send` sert deux canaux, et le chemin `/campaigns` s'ouvre désormais
   * à qui apporte son SMTP. Sans ce contrôle, un locataire qui a collé sa
   * boîte enverrait des SMS sur NOS crédits Textbelt — et la facture le
   * dirait un mois plus tard.
   */
  const src = sansCommentaires(lire("app/api/send/route.ts"));
  assert.match(src, /const sms = resoudreSms\(droits\)/, "le SMS se résout, il ne se lit pas");
  assert.ok(
    !/process\.env\.TEXTBELT_KEY/.test(src.slice(src.indexOf("export async function POST"))),
    "la clé SMS ne se lit plus directement dans la branche d'envoi"
  );

  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));
  const i = secret.indexOf("export function resoudreSms");
  const corps = secret.slice(i, i + 400);
  assert.match(corps, /if \(!autorise\(droits, "\/campaigns"\)\) return null;/, "sans droit, pas de SMS");
});

test("⚠⚠ L'ORDRE SMTP EST LE MÊME QUE CELUI DE L'IA — et pour la même raison", () => {
  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));
  const i = secret.indexOf("export async function resoudreSmtp");
  const corps = secret.slice(i, i + 600);
  const iSiens = corps.indexOf('identifiantsDu(tenantId, "email")');
  const iDroit = corps.indexOf('autorise(droits, "/campaigns")');
  const iMaison = corps.indexOf('smtpDepuis(process.env, "maison")');
  assert.ok(iSiens > 0 && iDroit > iSiens, "la clé du locataire se lit AVANT le droit");
  assert.ok(iMaison > iDroit, "notre boîte n'est atteinte qu'APRÈS la vérification du droit");
  assert.match(corps, /if \(!autorise\(droits, "\/campaigns"\)\) return AUCUN_SMTP;/);
});

test("⚠ un SMTP à moitié saisi n'envoie pas, et ne retombe pas sur le nôtre", () => {
  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));
  const i = secret.indexOf("function smtpDepuis");
  const corps = secret.slice(i, i + 500);
  assert.match(corps, /if \(!host \|\| !user \|\| !pass\) return AUCUN_SMTP;/, "les trois ensemble, ou rien");

  /**
   * Et la résolution ne doit PAS enchaîner sur la maison quand la ligne
   * existe mais est incomplète.
   *
   * ⚠⚠ CE GARDE A ÉTÉ ÉCRIT DEUX FOIS. Le premier cherchait la position de
   * `return s;` avant celle d'`autorise` — et la mutation qui l'a fait
   * tomber, `if (smtpUtilisable(s)) return s;`, CONTIENT cette sous-chaîne.
   * Le garde était donc satisfait par un fragment de la faute qu'il devait
   * refuser. C'est le même défaut que le motif qui matche sa propre prose,
   * commis une ligne plus bas.
   *
   * On exige maintenant le retour INCONDITIONNEL, et on refuse explicitement
   * la forme conditionnelle.
   */
  const j = secret.indexOf("export async function resoudreSmtp");
  const res = secret.slice(j, j + 600);
  assert.match(res, /\n    return s;\n/, "le retour doit être inconditionnel");
  assert.ok(
    !/if \([^)]*\)\s*return s;/.test(res),
    "un retour conditionnel ferait retomber un SMTP incomplet sur NOTRE boîte"
  );
});

test("⚠ le contrôle DNS analyse le domaine DE L'EXPÉDITEUR", () => {
  /**
   * Il dérivait le domaine de NOTRE `SMTP_FROM`. Sur un compte qui apporte sa
   * boîte, il auditait donc un domaine qui n'est pas le sien — un rapport
   * parfaitement vert et parfaitement inutile. Le pire des deux, puisqu'il
   * rassure.
   */
  const src = sansCommentaires(lire("app/api/deliverability/dns/route.ts"));
  assert.match(src, /resoudreSmtp\(tenant\?\.id \?\? null, droits\)/);
  assert.match(src, /smtpUtilisable\(smtp\) \? domaineDepuis\(smtp\.from\) : null/);
  const iSmtp = src.indexOf("domaineDepuis(smtp.from)");
  const iEnv = src.indexOf("domainFromEnv()", iSmtp);
  assert.ok(iSmtp > 0 && iEnv > iSmtp, "notre domaine n'est que le DERNIER repli");
});

// ══════════ LA FAMILLE « DESTINATION DANS NOTRE ENVIRONNEMENT » ══════════

test("⚠⚠ AUCUNE ROUTE À DESTINATION GLOBALE N'EST OUVERTE À UN LOCATAIRE", () => {
  /**
   * ⚠⚠ UNE FAMILLE DE DÉFAUTS, PAS UN CAS ISOLÉ — balayée le 16/09.
   *
   * `/api/digest` l'a révélée : son en-tête vantait une propriété de sécurité
   * — « le destinataire n'est JAMAIS pris dans la requête, toujours dans
   * l'environnement » — qui la rendait sûre pour UN opérateur et la retourne
   * dès qu'il y en a deux. La question suivante était donc obligatoire :
   * **quelles AUTRES routes ont une destination qui vient de chez nous ?**
   *
   * Le balayage a rendu trois réponses, et elles ne se valent pas :
   *  · `/api/notion` — ÉCRIT dans `NOTION_DATABASE_ID`, notre base, et elle
   *    était servie par `/pipeline`, chemin GRATUIT. Vrai défaut, fermé.
   *  · `/api/calendar` — porte sa PROPRE serrure (`?k=CALENDAR_TOKEN`) et se
   *    ferme sans elle. Une autre porte, pas un trou : même schéma que les
   *    routes de cron.
   *  · `/api/push` — scopée par `user_id` (`getTenantId`). Correcte.
   *
   * Ce test tient la conclusion : ce qui écrit ou envoie vers une destination
   * tirée de NOTRE environnement ne s'ouvre pas à un locataire.
   */
  const g = droitGratuit("locataire-lambda");
  for (const api of ["/api/notion", "/api/digest", "/api/pipeline", "/api/voice-costs"]) {
    assert.ok(
      MAITRE_SEULEMENT.includes(api),
      `${api} dirige vers NOTRE environnement : elle doit être réservée au maître`
    );
    const chemin = CHEMIN_PAR_API[api];
    if (chemin) {
      /**
       * ⚠ Le chemin métier peut rester GRATUIT — `/api/notion` est servie par
       * `/pipeline`, qu'on n'a aucune raison de fermer. C'est la garde MAÎTRE
       * qui protège, et elle passe AVANT celle des droits dans le middleware.
       * Confondre les deux ferait fermer un écran entier pour une seule route.
       */
      assert.ok(chemin.length > 0);
    }
    assert.equal(autorise(g, api), false, `${api} ne doit jamais s'ouvrir sur son propre chemin`);
  }
});

test("⚠ le panneau Notion est MASQUÉ, et le serveur refuse quand même", () => {
  /**
   * Masquer ne sécurise rien — le composant le dit lui-même. Les deux vont
   * ensemble : le middleware refuse (la barrière), l'écran cache (pour ne pas
   * proposer une porte murée). Le test exige les DEUX, parce que retirer l'un
   * des deux se voit moins qu'on ne croit.
   */
  const page = lire("app/(app)/settings/page.tsx");
  const i = page.indexOf("<NotionPush />");
  assert.ok(i > 0, "le panneau doit rester monté");
  const avant = page.slice(Math.max(0, i - 400), i);
  assert.match(avant, /<PanneauOperateur/, "il doit être dans un panneau opérateur");
  assert.ok(MAITRE_SEULEMENT.includes("/api/notion"), "et la route refusée côté serveur");
});
