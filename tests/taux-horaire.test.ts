import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECOTE_LYON,
  HEURES_PAR_JOUR,
  JOURS_FACTURABLES_BAS,
  JOURS_FACTURABLES_HAUT,
  JUSTIFICATION_TJM,
  RELEVE_TJM,
  RESERVE_TAUX,
  TAUX_HORAIRE_BAS_EUR,
  TAUX_HORAIRE_EUR,
  TAUX_HORAIRE_HAUT_EUR,
  TJM_BAS_EUR,
  TJM_HAUT_EUR,
  TJM_RETENU_EUR,
  capaciteAnnuelle,
  coutHoraireSalarie,
  tjmLyon,
} from "../lib/taux-horaire";
import { auditerCatalogue, COUTS_BRIQUES } from "../lib/pricing-briques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE TAUX HORAIRE — le nombre qui bloquait la moitié de la grille.
 *
 * Six briques sur dix se chiffrent au temps, et `verdictBrique` rendait
 * `null` faute de taux. Il est maintenant relevé sur le marché — donc il
 * arrive avec le risque de tout chiffre relevé : se faire citer comme une
 * mesure. Ces tests tiennent la traçabilité, pas la valeur.
 * ─────────────────────────────────────────────────────────────────────
 */

test("chaque relevé de marché porte sa source, sa date et une fourchette qui tient", () => {
  assert.ok(RELEVE_TJM.length >= 4, "un seul baromètre n'est pas un marché");
  for (const r of RELEVE_TJM) {
    assert.ok(r.source.length > 10, `${r.profil} : sans source, le chiffre est du folklore`);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `${r.profil} : date illisible`);
    assert.ok(r.basEur > 0 && r.hautEur > r.basEur, `${r.profil} : fourchette incohérente`);
  }
});

test("le taux se DÉDUIT du TJM — il n'est pas écrit à la main quelque part", () => {
  assert.equal(TAUX_HORAIRE_EUR, Math.round(TJM_RETENU_EUR / HEURES_PAR_JOUR));
  assert.equal(TAUX_HORAIRE_BAS_EUR, Math.round(TJM_BAS_EUR / HEURES_PAR_JOUR));
  assert.equal(TAUX_HORAIRE_HAUT_EUR, Math.round(TJM_HAUT_EUR / HEURES_PAR_JOUR));
});

test("une journée facturée vaut 7 h, pas 8 — sinon chaque forfait est sous-évalué", () => {
  /**
   * Le TJM est un prix de JOURNÉE. Diviser par 8 fabrique une heure vendable
   * de plus par jour qui n'existe pas (réunions, contexte, allers-retours),
   * et chaque devis au forfait part 12 % trop bas.
   */
  assert.equal(HEURES_PAR_JOUR, 7);
});

test("le TJM retenu est DÉLIBÉRÉMENT sous ce que le calcul donne", () => {
  /**
   * ⚠ CE TEST PROTÈGE UNE DÉCISION, PAS UN CALCUL.
   *
   * L'intersection des baromètres place le national à 600 €/j, soit 552 à
   * Lyon. On retient 500. Quelqu'un — moi dans trois semaines — verra l'écart
   * et « corrigera » à la hausse. C'est le haut de fourchette qui se paie avec
   * des références, et il y a zéro vente. Remonter le TJM exige de réécrire la
   * justification en même temps, donc de le décider pour de bon.
   */
  assert.ok(TJM_RETENU_EUR < tjmLyon(600), "le retenu doit rester sous le centre de marché lyonnais");
  assert.ok(TJM_RETENU_EUR >= TJM_BAS_EUR && TJM_RETENU_EUR <= TJM_HAUT_EUR, "le retenu sort de sa propre fourchette");
  assert.match(JUSTIFICATION_TJM, /zéro vente/i, "la prudence doit être écrite, pas seulement appliquée");
});

test("la décote lyonnaise s'APPLIQUE quelque part — une constante inutilisée ment", () => {
  // Elle a failli rester déclarée sans jamais servir : un lecteur en aurait
  // déduit que les chiffres étaient déjà régionalisés. Ils ne l'étaient pas.
  assert.ok(DECOTE_LYON > 0.8 && DECOTE_LYON < 1);
  assert.equal(tjmLyon(600), Math.round(600 * DECOTE_LYON));
  assert.match(JUSTIFICATION_TJM, new RegExp(String(tjmLyon(600))), "le contre-calcul doit apparaître dans la justification");
});

test("la réserve dit que c'est un prix de VENTE, pas un coût", () => {
  /**
   * La confusion qui coûte cher : prendre le taux facturé pour un coût, puis
   * lui appliquer la règle ×4. On facturerait l'installation quatre fois le
   * prix du marché, en croyant appliquer une règle de prudence.
   */
  assert.match(RESERVE_TAUX, /VEND/);
  assert.match(RESERVE_TAUX, /pas ce qu'elle coûte/);
  assert.match(RESERVE_TAUX, /baromètres|comptabilité/i);
});

test("la capacité annuelle dit la limite du temps vendu", () => {
  const c = capaciteAnnuelle();
  assert.equal(c.bas.caEur, JOURS_FACTURABLES_BAS * TJM_RETENU_EUR);
  assert.equal(c.haut.caEur, JOURS_FACTURABLES_HAUT * TJM_RETENU_EUR);
  assert.equal(c.haut.heuresVendables, JOURS_FACTURABLES_HAUT * HEURES_PAR_JOUR);
  // Le fait qui compte commercialement : le temps humain PLAFONNE. C'est
  // l'argument du produit récurrent, et il se chiffre.
  assert.ok(c.haut.caEur < 100_000, "si vendre son temps suffisait, l'OS n'aurait pas de raison d'être");
});

test("le coût d'un SALARIÉ est un autre calcul, et il ne sert pas encore", () => {
  // 3 000 € brut, 42 % de charges, 120 h productives → ~35,50 €/h.
  const h = coutHoraireSalarie(3000);
  assert.ok(h > 30 && h < 40, `attendu ~35 €/h, obtenu ${h}`);
  assert.ok(h < TAUX_HORAIRE_EUR, "un salarié coûte moins qu'il ne se facture — sinon rien ne tient");
  // Entrées absurdes : zéro, pas une exception ni un NaN qui se propage.
  assert.equal(coutHoraireSalarie(0), 0);
  assert.equal(coutHoraireSalarie(3000, 42, 0), 0);
});

// ─────────── Ce que le taux DÉBLOQUE réellement ───────────

test("avec ce taux, TOUTES les briques du catalogue se chiffrent", () => {
  /**
   * C'était le blocage : sans taux, `verdictBrique` rend `null` et la moitié
   * de la grille reste invérifiable. Le test vaut par son contraire, vérifié
   * juste en dessous — à taux nul, rien ne sort.
   */
  const a = auditerCatalogue({ tauxHoraireEur: TAUX_HORAIRE_EUR });
  assert.equal(a.verdicts.length, COUTS_BRIQUES.length, "chaque brique doit rendre un verdict");
  for (const v of a.verdicts) {
    assert.ok(v.coutSetupEur > 0, `${v.label} : installation à coût nul, le taux n'a pas été appliqué`);
    assert.ok(Number.isFinite(v.coutMensuelEur));
  }
});

test("…et sans taux, la grille reste muette plutôt que d'inventer", () => {
  const a = auditerCatalogue({ tauxHoraireEur: 0 });
  assert.equal(a.verdicts.length, 0, "un taux absent ne doit pas produire de prix");
});

test("le prix de setup affiché reste TRÈS au-dessus du temps passé — et ça se dit", () => {
  /**
   * ⚠ LE CHIFFRE LE PLUS ATTAQUABLE DE TOUTE LA GRILLE.
   *
   * Une fois le taux posé, les frais d'installation à la brique valent ×4 à
   * ×10 la main-d'œuvre : Agent ALPHA, c'est 2 200 € pour 3 h estimées, soit
   * 733 €/h. Ce n'est pas forcément faux — on vend l'installation d'un
   * produit qui EXISTE, pas des journées — mais ça ne survit pas à la
   * question « ça vous prend combien de jours ? ».
   *
   * Ce test ne corrige rien : il refuse que l'écart devienne invisible.
   */
  const a = auditerCatalogue({ tauxHoraireEur: TAUX_HORAIRE_EUR });
  const pires = a.verdicts
    .filter((v) => v.setupAfficheEur > 0 && v.coutSetupEur > 0)
    .map((v) => ({ label: v.label, mult: v.setupAfficheEur / v.coutSetupEur }))
    .sort((x, y) => y.mult - x.mult);

  assert.ok(pires.length > 0);
  assert.ok(
    pires[0].mult > 4,
    "si l'écart tombait sous ×4, cette réserve n'aurait plus lieu d'être — et le doc doit alors changer"
  );
});
