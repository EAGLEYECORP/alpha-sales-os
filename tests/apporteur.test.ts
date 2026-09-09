import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  commissionPour,
  messageVersement,
  MOIS_COMMISSIONNES,
  peutEtreVerse,
  siretBienForme,
  statutApporteur,
  TAUX_MENSUEL,
  TAUX_SETUP,
  type Apporteur,
} from "../lib/apporteur";
import { OFFRES, offreParId } from "../lib/offres-publiques";
import { REV_SHARE_PCT } from "../lib/calculateur-offres";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CELUI QUI NOUS AMÈNE UN CLIENT — et ce qu'on lui doit.
 *
 * ⚠ LE SENS DE L'ARGENT EST L'INVERSE DE L'AUTRE 30 % DU DÉPÔT. `REV_SHARE`
 * est ce qu'on FACTURE ; celui-ci est ce qu'on PAIE. Le premier test de ce
 * fichier existe pour que personne ne les confonde en les lisant vite.
 * ─────────────────────────────────────────────────────────────────────
 */

// SIRET de forme valide (clé de Luhn juste) — inventé pour le test.
const SIRET_OK = "73282932000074";

const APPORTEUR: Apporteur = { id: "u-1", siret: SIRET_OK, contratSigne: true };

test("⚠ les DEUX « 30 % » du dépôt ne désignent pas le même argent", () => {
  /**
   * `REV_SHARE_PCT` : ce qu'on FACTURE à un client sur le CA qu'on lui
   * génère. `TAUX_SETUP` : ce qu'on PAIE à qui nous amène un client. Les deux
   * valent 30, et c'est une coïncidence de chiffre, pas de nature.
   *
   * Ce test ne compare pas les valeurs — il documente qu'elles vivent dans
   * deux modules distincts et qu'aucun ne dérive de l'autre. Le jour où l'un
   * bouge, l'autre ne doit pas suivre par accident.
   */
  assert.equal(typeof REV_SHARE_PCT, "number", "le prix facturé au client vit dans calculateur-offres");
  assert.equal(typeof TAUX_SETUP, "number", "la commission versée vit ici");
  assert.ok(TAUX_SETUP > 0 && TAUX_SETUP <= 0.5, "une commission au-delà de 50 % du setup n'est plus une commission");
});

// ─────────── LE SIRET — la condition qui n'est pas technique ───────────

test("⚠ SANS SIRET, RIEN NE SE VERSE — et le risque est POUR NOUS", () => {
  /**
   * Payer un particulier sans facture est du travail dissimulé
   * (art. L.8221-1 du Code du travail). L'entreprise donneuse d'ordre — nous
   * — est la partie sanctionnée, et la charge n'est pas déductible.
   *
   * Sur une offre faite à un réseau LinkedIn, la majorité des contacts sont
   * salariés : ce cas est le cas NORMAL, pas le cas limite.
   */
  assert.equal(statutApporteur({ id: "u", siret: null, contratSigne: true }), "sans-statut");
  assert.equal(peutEtreVerse({ id: "u", siret: null, contratSigne: true }), false);
  assert.equal(peutEtreVerse({ id: "u", siret: "12345", contratSigne: true }), false, "un SIRET mal formé n'en est pas un");
});

test("un SIRET valide sans contrat ne se verse pas non plus", () => {
  assert.equal(statutApporteur({ ...APPORTEUR, contratSigne: false }), "sans-contrat");
  assert.equal(peutEtreVerse({ ...APPORTEUR, contratSigne: false }), false);
});

test("les deux réunis ouvrent le versement", () => {
  assert.equal(statutApporteur(APPORTEUR), "verse");
  assert.equal(peutEtreVerse(APPORTEUR), true);
});

test("le contrôle de SIRET attrape les fautes de frappe, et ne prétend rien de plus", () => {
  /**
   * ⚠ Un SIRET bien formé peut être inventé, radié, ou appartenir à
   * quelqu'un d'autre. La seule vérification qui vaut est l'annuaire
   * officiel — un appel réseau qu'un module pur ne fait pas. Ce test garde
   * la FORME, et le commentaire du module dit que ce n'est pas une preuve.
   */
  assert.equal(siretBienForme(SIRET_OK), true);
  assert.equal(siretBienForme("732 829 320 000 74"), true, "les espaces se tolèrent : on les retire");
  assert.equal(siretBienForme("73282932000075"), false, "un chiffre changé casse la clé de Luhn");
  assert.equal(siretBienForme("7328293200007"), false, "13 chiffres = un SIREN, pas un SIRET");
  assert.equal(siretBienForme(""), false);
  assert.equal(siretBienForme(null), false);
  assert.equal(siretBienForme("abcdefghijklmn"), false);
});

// ─────────── CE QUE ÇA RAPPORTE ───────────

test("sur un abonnement : le setup une fois, puis le mensuel douze mois", () => {
  const o = offreParId("voix-essentiel")!;
  const c = commissionPour(o);

  assert.equal(c.setupEur, Math.round(o.setupHT! * TAUX_SETUP * 100) / 100);
  assert.equal(c.mensuelEur, Math.round(o.prixHT! * TAUX_MENSUEL * 100) / 100);
  assert.equal(c.moisCommissionnes, MOIS_COMMISSIONNES);
  assert.equal(c.totalEur, c.setupEur + c.mensuelEur * MOIS_COMMISSIONNES);

  // Le chiffre qui décide quelqu'un : il doit être dans la phrase.
  assert.match(c.phrase, /installation/);
  assert.match(c.phrase, /12 mois/);
});

test("⚠ UN PAIEMENT UNIQUE N'EST PAS COMMISSIONNÉ DOUZE FOIS", () => {
  /**
   * ⚠ L'ERREUR QUI COÛTERAIT PLUS QUE LA VENTE. Le lifetime est encaissé UNE
   * fois. Lui appliquer douze mois de commission donnerait à l'apporteur
   * 10 % × 12 = 120 % du prix — plus que ce que le client a payé. Le produit
   * paierait pour vendre.
   *
   * Mutation vérifiée : forcer `mois = MOIS_COMMISSIONNES` fait tomber ce
   * test.
   */
  const life = offreParId("lifetime")!;
  assert.equal(life.cadence, "unique", "prémisse : le lifetime est un paiement unique");
  const c = commissionPour(life);
  assert.equal(c.moisCommissionnes, 1);
  assert.ok(c.totalEur < life.prixHT!, "la commission ne peut pas dépasser ce que le client a payé");
  assert.match(c.phrase, /une fois/i);
});

test("⚠ AUCUNE commission ne dépasse ce que l'offre encaisse la première année", () => {
  /**
   * La garde qui vaut pour TOUTE la grille, y compris les offres ajoutées
   * demain. Une commission supérieure à l'encaissement de l'année n'est pas
   * une commission agressive : c'est une vente à perte déguisée en
   * croissance.
   */
  for (const o of OFFRES) {
    if (o.cadence === "devis") continue;
    const c = commissionPour(o);
    /**
     * ⚠ CE DÉNOMINATEUR REPRENAIT L'ERREUR DU CODE QU'IL SURVEILLE.
     *
     * Il calculait `prixHT × 12` sur TOUTES les cadences récurrentes — donc
     * 120 000 € pour Business, dont `prixHT` est le prix total de
     * l'installation (10 000 €), pas un mensuel. La commission erronée de
     * 12 000 € passait donc les deux assertions sans difficulté.
     *
     * Un garde qui partage l'hypothèse fausse du code VALIDE l'erreur au lieu
     * de la voir. Le dénominateur se calcule maintenant depuis le plan de
     * paiement, qui est la seule description exacte de ce qui est encaissé.
     */
    const echelonne = o.cadence === "echelonne" && o.plan;
    const encaisseAn1 = echelonne
      ? o.plan!.acompteHT + o.plan!.mensualiteHT * o.plan!.mensualites + o.plan!.abonnementHT * 12
      : (o.setupHT ?? 0) + (o.prixHT ?? 0) * (o.cadence === "mensuel" ? 12 : 1);
    assert.ok(
      c.totalEur < encaisseAn1,
      `${o.nom} : commission ${c.totalEur} € pour ${encaisseAn1} € encaissés la première année`
    );
    // Et elle reste une minorité de l'encaissement, sinon la marge disparaît.
    assert.ok(c.totalEur <= encaisseAn1 * 0.4, `${o.nom} : la commission mange ${Math.round((c.totalEur / encaisseAn1) * 100)} % de l'an 1`);
  }
});

test("une offre sur DEVIS ne rend pas « 0 € » sans le dire", () => {
  /**
   * `os-complet` n'a ni prix ni setup connus. Afficher un zéro nu ferait
   * croire à un apporteur qu'un dossier à 40 000 € ne lui rapporte rien —
   * et il arrêterait d'en amener. Zéro donnée, zéro chiffre : l'angle mort
   * se DIT.
   */
  const c = commissionPour(offreParId("os-complet")!);
  assert.equal(c.totalEur, 0);
  assert.match(c.phrase, /cadrage/i);
  assert.match(c.phrase, /pas nulle/i, "il faut dire explicitement que ce n'est pas zéro");
});

// ─────────── CE QU'ON LUI DIT ───────────

test("⚠ le montant s'affiche toujours, la promesse de versement JAMAIS sans statut", () => {
  /**
   * Deux erreurs symétriques, et on refuse les deux :
   *  · cacher le montant à quelqu'un sans SIRET le priverait de la seule
   *    information qui le décidera à en créer un ;
   *  · afficher le montant en laissant croire qu'il va arriver serait la
   *    promesse la plus facile à casser du produit — et elle se casserait
   *    devant quelqu'un qui a DÉJÀ fait le travail.
   */
  const sans = messageVersement({ id: "u", siret: null, contratSigne: false });
  assert.match(sans, /SIRET/, "il faut nommer ce qui manque");
  assert.match(sans, /auto-entrepreneur/i, "…et la solution la plus simple");
  assert.match(sans, /compté|rien n'est perdu/i, "…et dire que son apport n'est pas jeté");
  assert.match(sans, /travail dissimulé/i, "la vraie raison, pas « pour des raisons administratives »");

  const contrat = messageVersement({ ...APPORTEUR, contratSigne: false });
  assert.match(contrat, /contrat/i);

  const ok = messageVersement(APPORTEUR);
  assert.match(ok, /encaissé/i, "on ne verse jamais avant d'avoir encaissé");
});

test("⚠ le socle gratuit reste SANS contrepartie — aucune créance sur un utilisateur gratuit", () => {
  /**
   * ⚠ CE TEST GARDE UNE PROMESSE COMMERCIALE, PAS UN CALCUL.
   *
   * L'idée de « prendre 30 % de ce qu'un utilisateur gratuit gagne » a été
   * écartée : pas de contrat, pas de base mesurable, aucun moyen
   * d'encaisser. Et le socle annonce « tes données, ton organisation » — y
   * accrocher une créance rendrait cette phrase fausse, devant la personne
   * même à qui on vient de la dire.
   *
   * Ce module ne doit donc jamais calculer quoi que ce soit à partir du
   * chiffre d'affaires d'un utilisateur : il ne connaît que NOS offres.
   */
  const src = readFileSync(join(process.cwd(), "lib/apporteur.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const interdit of ["caGenere", "chiffreAffaires", "revenuUtilisateur", "mrrClient"]) {
    assert.doesNotMatch(src, new RegExp(interdit), `« ${interdit} » : la commission ne se calcule pas sur l'argent d'un utilisateur`);
  }
  // La commission se calcule sur une OFFRE, et rien d'autre.
  assert.match(src, /export function commissionPour\(offre: OffrePublique\)/);
});
