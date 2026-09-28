import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  abonnementMensuel,
  PACK_MONTHLY_HT,
  PACK_SETUP_HT,
  PRIX_SIEGE_HT,
  SIEGES_REFERENCE,
  SOCLE_PLATEFORME_HT,
  ALPHA_VOICE_PALIERS,
} from "../lib/offres-publiques";
import { chiffrer } from "../lib/calculateur-offres";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA GRILLE AU SIÈGE — ce que ce fichier tient.
 *
 * Le forfait `PACK_MONTHLY_HT = 1 000` faisait payer le même prix à une équipe
 * de trois et à une équipe de trente. Le relevé de marché avait nommé le
 * défaut le 12/09 sans pouvoir le réparer ; c'est réparé ici.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠⚠ LE PRIX DE RÉFÉRENCE EST DÉRIVÉ DE LA FORMULE, JAMAIS RECOPIÉ", () => {
  /**
   * C'est le point qui compte le plus. `PACK_MONTHLY_HT` est ce que les écrans
   * et la vitrine AFFICHENT ; la formule est ce que le client PAIE. Deux
   * nombres écrits à la main auraient divergé au premier ajustement, et c'est
   * la vitrine — celle qu'on ne recalcule pas — qui aurait menti.
   */
  assert.equal(PACK_MONTHLY_HT, abonnementMensuel(SIEGES_REFERENCE).totalEur);

  const src = readFileSync(join(process.cwd(), "lib/offres-publiques.ts"), "utf8");
  assert.match(
    src,
    /export const PACK_MONTHLY_HT = abonnementMensuel\(SIEGES_REFERENCE\)\.totalEur;/,
    "PACK_MONTHLY_HT doit se DÉRIVER — un littéral rétablirait les deux sources que ce dépôt paie à chaque fois",
  );
});

test("⚠ LE PASSAGE AU SIÈGE EST NEUTRE À LA RÉFÉRENCE — ce n'est pas une hausse déguisée", () => {
  // L'ancien forfait valait 1 000 €/mois. Si la nouvelle grille ne rendait pas
  // exactement ça au centre, on aurait changé le PRIX en prétendant changer
  // l'UNITÉ — la manœuvre qu'un client repère, et qui coûte la confiance.
  assert.equal(abonnementMensuel(SIEGES_REFERENCE).totalEur, 1000);
  assert.equal(SOCLE_PLATEFORME_HT + PRIX_SIEGE_HT * SIEGES_REFERENCE, 1000);
});

test("la courbe monte avec l'équipe, et elle ne s'effondre pas en bas", () => {
  /**
   * Les deux extrémités sont le sujet : c'est là que le forfait mentait.
   * On vérifie les VALEURS, pas seulement le sens de la pente — une formule
   * juste en tendance peut rendre un prix absurde à 1 ou à 100.
   */
  const attendu: Array<[number, number]> = [
    [1, 680],
    [5, 1000],
    [10, 1400],
    [20, 2200],
    [40, 3800],
  ];
  for (const [sieges, total] of attendu) {
    assert.equal(abonnementMensuel(sieges).totalEur, total, `${sieges} sièges`);
  }

  // Strictement croissant : un siège de plus ne doit jamais faire baisser la
  // facture (pas de palier dégressif caché qui ferait déclarer plus d'users).
  for (let n = 1; n < 60; n++) {
    assert.ok(
      abonnementMensuel(n + 1).totalEur > abonnementMensuel(n).totalEur,
      `la facture doit croître entre ${n} et ${n + 1} sièges`,
    );
  }
});

test("⚠ le prix RAMENÉ AU SIÈGE décroît — c'est ce qui rend la grille défendable", () => {
  /**
   * Le socle étant fixe, plus l'équipe est grande, moins le siège coûte. C'est
   * l'argument face à un concurrent par siège pur : à 20 personnes on est à
   * 110 €/siège tout compris (CRM + séquences + conformité + copilote), là où
   * l'addition des outils équivalents dépasse largement.
   */
  assert.ok(abonnementMensuel(1).parSiegeEur > abonnementMensuel(10).parSiegeEur);
  assert.ok(abonnementMensuel(10).parSiegeEur > abonnementMensuel(40).parSiegeEur);
  // Et il ne descend JAMAIS sous le prix du siège nu : le socle ne se dilue
  // pas jusqu'à disparaître, sinon un très gros compte paierait le moteur zéro.
  for (const n of [1, 5, 50, 500, 5000]) {
    assert.ok(
      abonnementMensuel(n).parSiegeEur >= PRIX_SIEGE_HT,
      `à ${n} sièges, le prix par siège passerait sous le siège nu`,
    );
  }
});

test("⚠⚠ ALPHA VOICE N'ENTRE PAS DANS LA FORMULE — on ne facture pas au siège ce qui REMPLACE un siège", () => {
  /**
   * La règle de fond de cette grille. Alpha Voice se compare à un SALAIRE de
   * téléprospecteur, pas à un abonnement par utilisateur. L'entrer dans le
   * prix par siège ferait deux choses fausses à la fois : il augmenterait avec
   * le nombre d'humains alors qu'il sert à en avoir moins, et il perdrait le
   * seul ancrage où il gagne.
   */
  const src = readFileSync(join(process.cwd(), "lib/offres-publiques.ts"), "utf8");
  const formule = src.slice(
    src.indexOf("export function abonnementMensuel"),
    src.indexOf("export const PACK_MONTHLY_HT"),
  );
  assert.ok(formule.length > 0, "la formule doit exister");
  for (const interdit of ["ALPHA_VOICE", "OUTBOUND_UNIT_HT", "MINUTE"]) {
    assert.ok(
      !formule.includes(interdit),
      `la formule au siège ne doit pas dépendre de ${interdit} : la voix se facture à l'usage`,
    );
  }
  // Contre-test : la grille voix existe toujours et reste à l'usage.
  assert.ok(ALPHA_VOICE_PALIERS.length >= 2, "les paliers d'usage de la voix doivent rester");
});

test("⚠ zéro siège, siège fractionnaire, siège négatif : REFUSÉS, pas arrondis", () => {
  /**
   * Un `0` rendrait le socle seul — un abonnement actif sans aucun
   * utilisateur, état qui ne veut rien dire et qu'un formulaire vide produit
   * en une frappe. Un arrondi silencieux ferait diverger la facture de ce que
   * le client a coché, et c'est le genre d'écart qu'on découvre au prélèvement.
   */
  for (const mauvais of [0, -1, 2.5, NaN, Infinity]) {
    assert.throws(() => abonnementMensuel(mauvais), RangeError, `${mauvais} doit être refusé`);
  }
});

test("le détail voyage avec le total — jamais un nombre nu", () => {
  // Un client qui voit « 2 200 € » sans la décomposition ne peut pas vérifier
  // sa facture, et un commercial ne peut pas défendre la ligne.
  const a = abonnementMensuel(20);
  assert.equal(a.socleEur, SOCLE_PLATEFORME_HT);
  assert.equal(a.siegesEur, PRIX_SIEGE_HT * 20);
  assert.equal(a.socleEur + a.siegesEur, a.totalEur);
  assert.equal(a.sieges, 20);
});

test("le setup ne bouge pas, et il reste distinct du récurrent", () => {
  // Le setup est du TRAVAIL HUMAIN fait à la main — la doctrine le dit. Il n'a
  // aucune raison de suivre le nombre de sièges, et le fondre dans l'abonnement
  // masquerait ce que l'installation coûte réellement.
  assert.equal(PACK_SETUP_HT, 10_000);
  const src = readFileSync(join(process.cwd(), "lib/offres-publiques.ts"), "utf8");
  const formule = src.slice(
    src.indexOf("export function abonnementMensuel"),
    src.indexOf("export const PACK_MONTHLY_HT"),
  );
  assert.ok(!formule.includes("PACK_SETUP_HT"), "l'installation n'entre pas dans le mensuel");
});

test("⚠ UNE SEULE DÉFINITION DE SIEGES_REFERENCE", () => {
  // Elle a vécu dans `lib/marche.ts`. Deux définitions feraient comparer la
  // grille à une taille d'équipe que la grille elle-même n'utilise pas.
  const marche = readFileSync(join(process.cwd(), "lib/marche.ts"), "utf8");
  assert.ok(
    !/export const SIEGES_REFERENCE\s*=/.test(marche),
    "lib/marche.ts ne doit plus DÉCLARER SIEGES_REFERENCE — il l'importe de lib/offres-publiques",
  );
  assert.match(
    marche,
    /from "\.\/offres-publiques"/,
    "lib/marche.ts doit importer la constante depuis le module qui décide des prix",
  );
});

test("⚠⚠ LA GRILLE EST ATTEIGNABLE DEPUIS UN ÉCRAN — pas seulement exportée", () => {
  /**
   * Le défaut le plus fréquent de ce dépôt : un mécanisme juste, testé, que
   * RIEN n'appelle. Il aurait été commis par cette correction même — une
   * formule au siège que personne ne peut atteindre laisse le forfait en
   * place dans les faits, tout en donnant l'impression qu'il a disparu.
   *
   * On vérifie la CHAÎNE : la formule → le chiffrage → l'écran, et que
   * l'écran offre bien de quoi CHANGER le nombre.
   */
  const chiffrage = readFileSync(join(process.cwd(), "lib/calculateur-offres.ts"), "utf8");
  assert.match(chiffrage, /abonnementMensuel\(/, "le chiffrage doit appeler la formule");
  assert.match(chiffrage, /sieges\?:\s*number/, "la sélection doit porter le nombre d'utilisateurs");

  const ecran = readFileSync(join(process.cwd(), "components/offre/calculateur-complet.tsx"), "utf8");
  assert.match(ecran, /abonnementMensuel\(/, "l'écran doit dériver le prix de la formule, jamais le recopier");
  assert.match(ecran, /set\(\{\s*sieges:\s*v\s*\}\)/, "l'écran doit offrir de CHANGER le nombre d'utilisateurs");
  // ⚠ Contre-test du précédent : un curseur qui existe mais dont le prix
  // affiché reste figé serait pire que pas de curseur — il affirmerait que le
  // nombre est pris en compte alors qu'il ne l'est pas.
  assert.match(
    ecran,
    /packMensuel\.totalEur/,
    "le prix affiché doit SUIVRE le curseur — un montant figé à côté d'un curseur ment",
  );
});

test("⚠ une saisie invalide ne fait pas TOMBER un chiffrage, elle s'annonce", () => {
  // `abonnementMensuel` jette — c'est juste pour une facture. Mais le
  // chiffrage sert un écran où quelqu'un tape : un champ vidé une seconde ne
  // doit pas vider la page. Il borne, et il le DIT.
  const r = chiffrer({ vip: true, sieges: 0 });
  assert.ok(
    r.alertes.some((a) => /utilisateurs invalide/i.test(a)),
    "un nombre de sièges invalide doit produire une alerte visible, pas une correction silencieuse",
  );
  const ligne = r.lignes.find((l) => l.famille === "alpha-vip");
  assert.equal(ligne?.clientMensuelHT, PACK_MONTHLY_HT, "on retombe sur la référence, pas sur zéro");
});

test("le chiffrage du pack SUIT le nombre d'utilisateurs", () => {
  const cinq = chiffrer({ vip: true, sieges: 5 }).lignes.find((l) => l.famille === "alpha-vip");
  const vingt = chiffrer({ vip: true, sieges: 20 }).lignes.find((l) => l.famille === "alpha-vip");
  assert.equal(cinq?.clientMensuelHT, 1000);
  assert.equal(vingt?.clientMensuelHT, 2200);
  // Le détail DIT la décomposition — un devis qui n'affiche qu'un total ne se
  // défend pas en rendez-vous.
  assert.match(String(vingt?.detail), /socle/);
  assert.match(String(vingt?.detail), /20 × 80/);
});
