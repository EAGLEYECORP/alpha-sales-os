import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUREE_ESSAI_JOURS,
  PLAFOND_ESSAI_COUT_EUR,
  etatEssai,
  finDEssai,
} from "../lib/essai";
import { USD_TO_EUR, usdPerConversationMinute } from "../lib/voice-costs";
import { ALPHA_VOICE_PALIERS } from "../lib/offres-publiques";

const dans = (jours: number) => new Date(Date.now() + jours * 86400_000).toISOString();

test("⚠⚠ DEUX LIMITES INDÉPENDANTES — la durée seule serait notre carte bancaire dans la nature", () => {
  /**
   * Le point qui décide de tout. Les briques d'essai DÉPENSENT chez nous :
   * SMTP, minutes LiveKit, jetons IA, et il n'existe aucun chemin
   * d'identifiants par locataire. Un compte motivé consomme en deux jours ce
   * qu'on comptait donner en trente.
   */
  // Jour 1, mais le plafond est déjà consommé → l'essai ferme.
  const creve = etatEssai({ jusquA: dans(29), coutConsommeEur: PLAFOND_ESSAI_COUT_EUR, coutGlobalEur: 0 }, new Date());
  assert.equal(creve.actif, false);
  assert.equal(creve.fin, "plafond-atteint");
  assert.match(creve.phrase, /il restait 29 jour/, "le motif doit dire que c'est le COÛT et pas la durée");

  // Inversement : plafond intact, mais les 30 jours sont passés.
  const perime = etatEssai({ jusquA: dans(-1), coutConsommeEur: 0, coutGlobalEur: 0 }, new Date());
  assert.equal(perime.actif, false);
  assert.equal(perime.fin, "duree-atteinte");
});

test("⚠⚠ COÛT INCONNU = ESSAI FERMÉ — l'inverse du réflexe des écrans de mesure", () => {
  /**
   * Même arbitrage que la présence de l'agent vocal : `null` ne se contente
   * pas de se dire, il BLOQUE. Ne pas ouvrir coûte une démonstration ; ouvrir
   * en aveugle coûte une facture qu'on découvre trente jours plus tard.
   */
  const r = etatEssai({ jusquA: dans(20), coutConsommeEur: null, coutGlobalEur: 0 }, new Date());
  assert.equal(r.actif, false);
  assert.equal(r.fin, "cout-inconnu");
  assert.match(r.phrase, /pas pu être lue/, "la panne se DIT, elle ne se déguise pas en fin d'essai normale");
  // ⚠ Et elle ne se confond pas avec un plafond atteint : les deux ferment,
  // mais l'un est un prospect chaud et l'autre est une panne chez nous.
  assert.notEqual(r.fin, "plafond-atteint");
});

test("un essai qui tourne dit ses DEUX restes, jamais un booléen nu", () => {
  const r = etatEssai({ jusquA: dans(12), coutConsommeEur: 10, coutGlobalEur: 0 }, new Date());
  assert.equal(r.actif, true);
  assert.equal(r.joursRestants, 12);
  assert.equal(r.coutRestantEur, PLAFOND_ESSAI_COUT_EUR - 10);
  assert.match(r.phrase, /12 jour/);
  assert.match(r.phrase, new RegExp(`${PLAFOND_ESSAI_COUT_EUR - 10} €`));
});

test("⚠ LES DEUX LIMITES SE CALCULENT TOUJOURS, même quand l'une a déjà mordu", () => {
  // Savoir qu'un compte a été coupé au plafond le jour 3 change la
  // conversation de vente : c'est un prospect qui a consommé, pas un compte
  // qui n'a rien fait.
  const r = etatEssai({ jusquA: dans(27), coutConsommeEur: 40, coutGlobalEur: 0 }, new Date());
  assert.equal(r.fin, "plafond-atteint");
  assert.equal(r.joursRestants, 27, "les jours restants restent lisibles après la coupure au coût");
});

test("⚠⚠ LE PLAFOND EST DÉRIVÉ DU COÛT MESURÉ, pas choisi au doigt", () => {
  /**
   * Ancrage : ce que le palier d'entrée nous COÛTE pour un mois. L'essai donne
   * autant de matière que le premier abonnement en consomme — défendable des
   * deux côtés.
   *
   * ⚠ Le nombre est DÉCLARÉ dans `lib/essai.ts` et croisé ici contre
   * `voice-costs`, qui est SERVEUR (il porte nos marges) et ne doit pas
   * descendre dans un bundle. Même arbitrage que `offres-publiques` face à
   * `bricks` : le test refuse la divergence, il ne crée pas une dépendance.
   */
  const essentiel = ALPHA_VOICE_PALIERS[0];
  const coutMesure = essentiel.minutes * usdPerConversationMinute() * USD_TO_EUR;
  assert.ok(coutMesure > 27 && coutMesure < 29, `coût mesuré du palier d'entrée : ${coutMesure.toFixed(2)} €`);
  assert.ok(
    PLAFOND_ESSAI_COUT_EUR >= coutMesure,
    "le plafond doit au moins couvrir un mois du palier d'entrée — sinon l'essai ne démontre rien",
  );
  assert.ok(
    PLAFOND_ESSAI_COUT_EUR <= coutMesure * 1.5,
    "et il ne doit pas dériver : au-delà, on offre plus que ce qu'on facture ensuite",
  );
});

test("⚠ LE PLAFOND EST UNE DÉCISION, et le fichier le dit", () => {
  // Aucune vente ne l'a validé. Une constante muette se lit comme une mesure.
  const src = readFileSync(join(process.cwd(), "lib/essai.ts"), "utf8");
  const ou = src.indexOf("export const PLAFOND_ESSAI_COUT_EUR");
  const bloc = src.slice(Math.max(0, ou - 900), ou).replace(/\s*\n\s*\*\s*/g, " ");
  assert.match(bloc, /DÉCISION, pas une mesure/i, "le plafond doit porter, à côté de lui, qu'il n'est pas mesuré");
});

test("finDEssai pose exactement la durée annoncée", () => {
  const debut = new Date("2026-09-13T08:00:00.000Z");
  const fin = new Date(finDEssai(debut));
  assert.equal((fin.getTime() - debut.getTime()) / 86400_000, DUREE_ESSAI_JOURS);
  // ⚠ Une seule source du calcul : « aujourd'hui + 30 » recopié ailleurs se
  // réécrit à un jour près sans que personne s'en aperçoive.
  assert.equal(DUREE_ESSAI_JOURS, 30);
});

test("⚠ SANS DATE DE FIN, l'essai ne devient pas ÉTERNEL — le plafond tient encore", () => {
  // Cas réel : une ligne créée à la main, `essai_jusqu_a` laissé NULL.
  const ouvert = etatEssai({ jusquA: null, coutConsommeEur: 5, coutGlobalEur: 0 }, new Date());
  assert.equal(ouvert.actif, true);
  assert.equal(ouvert.joursRestants, null, "on ne fabrique pas une échéance qu'on n'a pas");
  const ferme = etatEssai({ jusquA: null, coutConsommeEur: PLAFOND_ESSAI_COUT_EUR + 1, coutGlobalEur: 0 }, new Date());
  assert.equal(ferme.actif, false, "le plafond ferme même sans date : deux limites INDÉPENDANTES");
  assert.equal(ferme.fin, "plafond-atteint");
});

test("⚠ L'ESSAI N'OUVRE JAMAIS NOTRE ÉCONOMIE", () => {
  // « Pleine capacité » désigne le produit, pas nos comptes. Le module ne doit
  // même pas connaître ces chemins — c'est `MAITRE_SEULEMENT` qui les tient.
  const src = readFileSync(join(process.cwd(), "lib/essai.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const interdit of ["/payouts", "/offre", "MAITRE_SEULEMENT"]) {
    assert.ok(!src.includes(interdit), `lib/essai.ts ne doit pas manipuler ${interdit} : ce n'est pas son rôle`);
  }
});

test("⚠⚠ LE PLAFOND EST BRANCHÉ DANS resoudreDroits — pas seulement exporté", () => {
  /**
   * Le défaut récurrent du dépôt, sur la porte qui coûte de l'argent. Un
   * plafond juste, testé, que la résolution des droits n'appelle pas, laisse
   * l'essai tourner jusqu'à J+30 quoi qu'il consomme — et il a l'air fait.
   */
  const src = readFileSync(join(process.cwd(), "lib/entitlements.ts"), "utf8");
  assert.match(src, /import \{ etatEssai[^}]*\} from "\.\/essai"/, "la résolution doit consulter le module");
  assert.match(src, /etatEssai\(/, "et l'appeler, pas seulement l'importer");
  /**
   * ⚠ ON VISE LE `select=`, PAS LE FICHIER. Première rédaction : je cherchais
   * `cout_consomme_eur` n'importe où — et le nom apparaît aussi dans le type
   * de la ligne et dans `l.cout_consomme_eur`. Retirer la colonne de la
   * REQUÊTE laissait donc le test vert, avec un plafond calculé sur une valeur
   * que la base ne renvoie jamais : `undefined` → `null` → essai fermé en
   * permanence, ou pire selon le repli. Un garde qui cherche un symbole au
   * lieu de son point d'usage ne garde rien.
   */
  const select = /select=([^&`]+)/.exec(src)?.[1] ?? "";
  assert.ok(
    select.split(",").includes("cout_consomme_eur"),
    `la colonne doit être dans le select (vu : « ${select} ») — un plafond calculé sur une valeur jamais lue ne mord jamais`,
  );
  /**
   * ⚠ La condition s'écrivait sur une ligne (`statut === "essai" && !actif`)
   * ; elle est devenue un bloc le 16/09, quand l'essai s'est mis à SUBSTITUER
   * ses briques au lieu de lire la colonne. Les deux moitiés sont vérifiées
   * séparément, et c'est plus solide que l'ancienne ligne unique : la seconde
   * ne doit pas pouvoir se perdre en réécrivant la première.
   */
  assert.match(src, /if \(statut === "essai"\)/, "la branche essai doit exister");
  assert.match(
    src,
    /if \(!essai\.actif\) return droitGratuit\(/,
    "un essai fermé retombe au socle GRATUIT, jamais au néant — ses fiches lui appartiennent",
  );
});

test("⚠ PostgREST rend un `numeric` en CHAÎNE — la conversion est obligatoire", () => {
  /**
   * `"12.50" >= 30` vaut `false` en JavaScript, comme `"40" >= 30` vaut `true`
   * par coercition : une comparaison de chaînes qui a l'air d'une comparaison
   * de nombres. Elle ne fait rien tomber, elle laisse la porte ouverte par
   * moments et pas par d'autres — le pire mode de panne.
   */
  const src = readFileSync(join(process.cwd(), "lib/entitlements.ts"), "utf8");
  assert.match(src, /Number\(brut\)/, "la valeur lue doit être convertie en nombre");
  assert.match(src, /Number\.isFinite\(coutConsommeEur\)/, "et une conversion ratée retombe sur null, donc sur le refus");
});

test("⚠ LE SQL NE RECOPIE PAS LE PLAFOND — une seule définition", () => {
  /**
   * Même règle que la fenêtre d'appel, qu'un test interdit déjà au SQL de
   * redéfinir : deux définitions du même seuil finissent par diverger, et
   * c'est celle qu'on ne relit pas — le SQL — qui ferait foi, parce qu'elle
   * s'exécute en premier.
   */
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/008-essai-plafond-cout.sql"), "utf8");
  const sansCommentaires = sql.replace(/--.*$/gm, "");
  assert.ok(
    !new RegExp(`\\b${PLAFOND_ESSAI_COUT_EUR}\\b`).test(sansCommentaires),
    "le plafond ne doit pas apparaître dans le SQL exécuté : il vit dans lib/essai.ts",
  );
  assert.match(sansCommentaires, /cout_consomme_eur/, "la colonne, elle, doit bien être créée");
  assert.ok(
    !/default\s+0\b/i.test(sansCommentaires),
    "défaut null et non 0 : `0` affirmerait « rien consommé » sur une colonne jamais alimentée",
  );
});
