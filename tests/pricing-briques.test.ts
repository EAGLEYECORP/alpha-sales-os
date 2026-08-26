import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPEL_TYPE,
  COUTS_BRIQUES,
  MULTIPLE_CONSOMMATION,
  TARIFS_MODELES,
  auditerCatalogue,
  coutJetons,
  devisVoix,
  verdictBrique,
  PRIX_PALIER_HT,
  VOLUME_PALIER,
} from "../lib/pricing-briques";
import {
  BRICKS,
  ESSAI_CALLS,
  ESSAI_HT,
  OUTBOUND_UNIT_CALLS,
  OUTBOUND_UNIT_HT,
  outboundPrice,
  prixEssai,
} from "../lib/bricks";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PRIX EST LA SEULE CHOSE QU'ON NE PEUT PAS CORRIGER APRÈS COUP.
 *
 * Un bug se répare ; un prix annoncé à un client se renégocie, et on perd
 * la face. Ce fichier protège donc trois choses :
 *
 *  1. la règle ×4 ne s'applique QU'À la consommation — sur du logiciel au
 *     coût marginal nul, elle dirait de tout donner ;
 *  2. aucun prix ne sort d'un chiffre inventé : sans taux horaire, le module
 *     refuse de calculer au lieu de deviner ;
 *  3. la grille reste MONOTONE : jamais un petit volume moins cher au total
 *     qu'un gros, sinon on fabrique un arbitrage contre soi.
 * ─────────────────────────────────────────────────────────────────────
 */

const TAUX = 70;

// ─────────── 1. LA RÈGLE ×4 ET SES LIMITES ───────────

test("la règle ×4 ne s'applique PAS à une brique au coût marginal nul", () => {
  const logiciel = COUTS_BRIQUES.find((c) => c.nature === "logiciel" && c.consommationMensuelleEur === 0);
  assert.ok(logiciel, "le catalogue doit contenir au moins une brique purement logicielle");

  const v = verdictBrique(logiciel!, { tauxHoraireEur: TAUX })!;
  assert.equal(v.plancherMensuelEur, null, "×4 de zéro vaut zéro — rendre un plancher serait trompeur");
  assert.equal(v.verdict, "hors-regle");
  assert.match(v.phrase, /ne s'applique pas/);
  assert.match(v.phrase, /valeur et du marché/, "il faut dire d'où vient le prix à la place");
});

test("sur une brique de consommation, le plancher est bien la consommation ×4 plus le support", () => {
  const conso = COUTS_BRIQUES.find((c) => c.nature === "consommation" && c.consommationMensuelleEur > 0)!;
  const v = verdictBrique(conso, { tauxHoraireEur: TAUX })!;
  const attendu = conso.consommationMensuelleEur * MULTIPLE_CONSOMMATION + conso.heuresSupportMois * TAUX;
  assert.equal(v.plancherMensuelEur, Math.round(attendu * 100) / 100);
});

test("le temps de support ne se multiplie pas — il se facture", () => {
  // Une heure de support coûte une heure, qu'on la vende ×1 ou ×10. La
  // multiplier gonflerait un plancher qui n'a rien à voir avec un fournisseur.
  const conso = COUTS_BRIQUES.find((c) => c.nature === "consommation" && c.heuresSupportMois > 0)!;
  const bas = verdictBrique(conso, { tauxHoraireEur: 50 })!;
  const haut = verdictBrique(conso, { tauxHoraireEur: 100 })!;
  const ecart = (haut.plancherMensuelEur ?? 0) - (bas.plancherMensuelEur ?? 0);
  assert.equal(
    Math.round(ecart),
    Math.round(conso.heuresSupportMois * 50),
    "l'écart doit être exactement le surcoût horaire, sans multiple"
  );
});

// ─────────── 2. AUCUN CHIFFRE INVENTÉ ───────────

test("sans taux horaire, le module REFUSE de chiffrer et dit ce qui manque", () => {
  const a = auditerCatalogue({ tauxHoraireEur: 0 });
  assert.equal(a.verdicts.length, 0, "aucun verdict ne doit sortir d'un taux absent");
  assert.ok(a.manque.some((m) => /taux horaire/i.test(m)));
  assert.match(a.lecture[0], /Aucun calcul possible/);
});

test("les tarifs de modèles portent tous leur réserve de vérification", () => {
  assert.ok(TARIFS_MODELES.length > 0);
  for (const t of TARIFS_MODELES) {
    assert.equal(t.aVerifier, true, `${t.id} doit être marqué à vérifier`);
    assert.ok(t.usdEntreeParMillion > 0 && t.usdSortieParMillion > 0);
  }
  // Et la réserve doit VOYAGER jusqu'à la phrase affichée, pas rester dans le type.
  const c = coutJetons(APPEL_TYPE, TARIFS_MODELES[0], 100);
  assert.match(c.phrase, /non vérifié/i);
});

test("l'audit dit qu'il ne connaît pas le marché — la règle « un peu moins » l'exige", () => {
  const a = auditerCatalogue({ tauxHoraireEur: TAUX });
  assert.ok(
    a.manque.some((m) => /concurrent/i.test(m)),
    "sans relevé concurrent, « un peu moins que le marché » n'est pas calculable"
  );
  assert.ok(a.manque.some((m) => /estimations de conception/i.test(m)));
});

// ─────────── 3. LES JETONS ───────────

test("les jetons se comptent sur les appels DÉCROCHÉS, et ne sont pas comptés deux fois", () => {
  const d = devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER);
  // La ligne LLM forfaitaire de voice-costs doit avoir été retirée au profit
  // du calcul par jetons, sinon le coût est gonflé.
  assert.ok(d.coutTotalEur > 0);
  const sansJetons = devisVoix(1000, PRIX_PALIER_HT, { ...VOLUME_PALIER, answerRatePct: 0 });
  assert.ok(
    sansJetons.coutTotalEur < d.coutTotalEur,
    "zéro décroché = zéro jeton : le coût doit baisser"
  );
});

test("un modèle cher coûte plus cher — le rapport entre modèles reste lisible", () => {
  const mini = coutJetons(APPEL_TYPE, TARIFS_MODELES[0], 300);
  const gros = coutJetons(APPEL_TYPE, TARIFS_MODELES[1], 300);
  assert.ok(gros.eurPourLot > mini.eurPourLot * 5, "l'écart doit être franc, pas cosmétique");
  // Et surtout : même le modèle cher reste marginal face à la téléphonie.
  const d = devisVoix(1000, PRIX_PALIER_HT, VOLUME_PALIER);
  assert.ok(
    gros.eurPourLot < d.coutTotalEur,
    "les jetons ne doivent pas dominer le coût d'un appel — c'est la téléphonie et la voix qui pèsent"
  );
});

// ─────────── 4. LE PALIER D'ESSAI ───────────

test("l'essai existe — 100 appels ne se facturent plus au prix d'un mois entier", () => {
  const e = prixEssai();
  assert.equal(e.calls, ESSAI_CALLS);
  assert.equal(e.totalHT, ESSAI_HT);
  assert.ok(e.totalHT < OUTBOUND_UNIT_HT, "un essai doit coûter moins qu'un mois complet, sinon personne ne l'achète");
  assert.ok(e.conditions.length >= 3, "un essai sans conditions écrites devient un abonnement déguisé");
});

test("l'essai est LOIN de la proportionnelle — sinon dix lots de 100 battent un lot de 1 000", () => {
  const e = prixEssai();
  const proportionnel = (OUTBOUND_UNIT_HT / OUTBOUND_UNIT_CALLS) * ESSAI_CALLS;
  assert.ok(
    e.totalHT > proportionnel * 3,
    `${e.totalHT} € contre ${proportionnel} € au prorata — l'écart doit rendre le palier 1 000 évident`
  );
  // Le test qui compte vraiment : la monotonie de la grille.
  const dixEssais = e.totalHT * 10;
  assert.ok(
    dixEssais > outboundPrice(OUTBOUND_UNIT_CALLS).monthlyHT,
    "dix essais doivent coûter PLUS qu'un palier 1 000, sinon on fabrique un arbitrage contre soi"
  );
});

test("l'essai se déduit du premier mois — c'est ce qui en fait une porte, pas un péage", () => {
  const e = prixEssai();
  assert.equal(e.deductibleHT, e.totalHT);
  assert.ok(e.conditions.some((c) => /déduit/i.test(c)));
  assert.ok(e.conditions.some((c) => /un seul essai/i.test(c)), "sinon il devient un abonnement à 100 appels");
});

test("sous le millier, la grille mensuelle renvoie vers l'essai au lieu de facturer un millier", () => {
  const q = outboundPrice(100);
  assert.match(q.note ?? "", /palier d'essai/i);
  assert.match(q.note ?? "", new RegExp(String(ESSAI_HT)));
});

test("l'essai reste rentable — la mise en route est du temps, pas de la consommation", () => {
  const d = devisVoix(ESSAI_CALLS, ESSAI_HT, { ...VOLUME_PALIER, calls: ESSAI_CALLS });
  assert.ok(d.margeEur > 0, `marge ${d.margeEur} € : un essai à perte n'est pas une porte, c'est un trou`);
  assert.ok(d.multipleReel >= MULTIPLE_CONSOMMATION - 1, `×${d.multipleReel} du coût`);
});

// ─────────── 5. LA GRILLE RESTE COHÉRENTE ───────────

test("la grille des volumes reste monotone : plus d'appels ne coûte jamais moins cher", () => {
  let precedent = 0;
  for (const n of [1000, 2000, 3000, 4000, 5000, 8000, 12000]) {
    const p = outboundPrice(n).monthlyHT;
    assert.ok(p >= precedent, `${n} appels à ${p} € après ${precedent} € — la courbe redescend`);
    precedent = p;
  }
});

test("le pack complet est comparé à la somme des briques, et l'écart est DIT", () => {
  const a = auditerCatalogue({ tauxHoraireEur: TAUX });
  assert.equal(a.sommeSetupEur, BRICKS.reduce((s, b) => s + b.setupHT, 0));
  assert.equal(a.sommeMensuelEur, BRICKS.reduce((s, b) => s + b.monthlyHT, 0));
  // Une remise de moitié sur le pack est une information commerciale majeure :
  // elle doit apparaître à l'écran, pas rester dans un calcul.
  if (a.remiseSetupPct >= 40 || a.remiseMensuelPct >= 40) {
    assert.ok(
      a.lecture.some((l) => /remise de \d+ %/.test(l)),
      "une remise de cet ordre doit être nommée : le client la calcule en dix secondes"
    );
  }
});

test("chaque brique du catalogue a son coût déclaré — aucune ne se vend à l'aveugle", () => {
  const avecCout = new Set(COUTS_BRIQUES.map((c) => c.brickId));
  for (const b of BRICKS) {
    assert.ok(avecCout.has(b.id), `${b.id} est vendue sans qu'on sache ce qu'elle coûte`);
  }
});

test("toute brique dont le coût est estimé porte sa réserve écrite", () => {
  for (const c of COUTS_BRIQUES) {
    if (c.consommationMensuelleEur > 0) {
      assert.ok(c.reserve.trim().length > 0, `${c.brickId} facture une consommation sans dire ce qui pourrait la faire varier`);
    }
  }
});
