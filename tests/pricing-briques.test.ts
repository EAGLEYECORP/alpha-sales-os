import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXED_COSTS } from "../lib/voice-costs";
import {
  APPEL_TYPE,
  COUTS_BRIQUES,
  MULTIPLE_CONSOMMATION,
  TARIFS_MODELES,
  auditerCatalogue,
  BRIQUES_A_MODELE_VOLUME,
  consommationDe,
  coutJetons,
  devisVoix,
  verdictBrique,
  PRIX_PALIER_HT,
  VOLUME_PALIER,
} from "../lib/pricing-briques";
import {
  BRICKS,
  OUTBOUND_UNIT_CALLS,
  OUTBOUND_UNIT_HT,
  outboundPrice,
} from "../lib/bricks";
import { ALPHA_VOICE_SETUP_HT } from "../lib/offres-publiques";

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
  /**
   * ⚠ Ce test lisait `consommationMensuelleEur` — la CONSTANTE. Il tombait
   * juste tant que la constante était la consommation réelle ; il est devenu
   * faux le jour où Alpha Voice a été raccordée au modèle de volume, et c'est
   * lui qui a signalé le changement. La règle n'a pas bougé : c'est la source
   * de « la consommation » qui a changé, et le test lit maintenant la même
   * que le verdict.
   */
  const conso = COUTS_BRIQUES.find((c) => c.nature === "consommation" && consommationDe(c) > 0)!;
  const v = verdictBrique(conso, { tauxHoraireEur: TAUX })!;
  const attendu = consommationDe(conso) * MULTIPLE_CONSOMMATION + conso.heuresSupportMois * TAUX;
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

// ─────────── 4. SOUS LE MILLIER — le renvoi, pas le millier entamé ───────────

/**
 * ⚠ CINQ TESTS DU PALIER D'ESSAI VIVAIENT ICI. Le palier a été retiré le
 * 04/09/2026 (raisonnement complet dans `lib/bricks.ts`). Ce qu'ils gardaient
 * de vraiment important n'était pas le prix de 290 € : c'était l'invariant
 * « un petit volume ne se facture jamais au millier entamé ». Cet invariant
 * n'a pas disparu avec l'offre, et c'est lui qu'on garde ici.
 */

test("sous le millier, la grille mensuelle RENVOIE au lieu de facturer un millier entamé", () => {
  const q = outboundPrice(100);
  assert.equal(q.monthlyHT, OUTBOUND_UNIT_HT, "le calcul reste le millier entamé — c'est la NOTE qui protège");
  assert.match(q.note ?? "", /pas le bon produit/i, "il faut dire que ce produit-là ne convient pas");
  assert.match(q.note ?? "", /Essentiel/i, "…et nommer celui qui convient");
  assert.match(
    q.note ?? "",
    new RegExp(String(ALPHA_VOICE_SETUP_HT)),
    "avec son installation chiffrée : un renvoi sans prix ne se transforme pas en devis"
  );
});

test("⚠ la note ne renvoie plus vers une offre qui n'existe plus", () => {
  /**
   * Le piège exact qu'on vient de payer ailleurs : un texte de vente qui
   * nomme un palier retiré de la grille. Il ne plante pas — il se lit au
   * téléphone, devant un prospect, et c'est lui qui découvre que l'offre
   * n'existe pas.
   */
  const q = outboundPrice(100);
  assert.doesNotMatch(q.note ?? "", /palier d'essai/i, "l'essai est mort : plus aucun texte ne doit le proposer");
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


// ══════════ LA CONSOMMATION QUI NE COMPTAIT AUCUN APPEL ══════════

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ ALPHA VOICE ÉTAIT CHIFFRÉE SANS UN SEUL APPEL.
 *
 * `COUTS_BRIQUES` portait `consommationMensuelleEur: 2` — le prix du numéro
 * loué — avec ce commentaire : « calculé, pas posé : voir `coutVoixMensuel` ;
 * le variable s'ajoute selon les appels ».
 *
 * **`coutVoixMensuel` n'a jamais existé dans le dépôt.** Le variable ne
 * s'ajoutait donc nulle part. La brique dont le coût est presque entièrement
 * variable était jugée sur 2 €, et l'audit du catalogue rendait un verdict
 * rassurant — « au-dessus, ×2,53 » — sur un coût faux d'un facteur 25.
 *
 * Le bon calcul existait à trois cents lignes de là, dans `devisVoix`.
 * Encore deux modules corrects qui ne se parlaient pas.
 * ─────────────────────────────────────────────────────────────────────
 */

test("la consommation d'Alpha Voice vient du MODÈLE DE VOLUME, pas d'une constante", () => {
  const c = COUTS_BRIQUES.find((x) => x.brickId === "alpha-voice")!;
  assert.equal(c.volumeDependant, true, "la brique doit être marquée comme dépendante du volume");

  const resolue = consommationDe(c);
  assert.ok(
    resolue > c.consommationMensuelleEur * 10,
    `la consommation résolue (${resolue} €) doit être sans commune mesure avec le socle (${c.consommationMensuelleEur} €)`
  );

  // Et elle doit valoir EXACTEMENT la part variable du devis voix.
  const d = devisVoix(VOLUME_PALIER.calls, PRIX_PALIER_HT, VOLUME_PALIER);
  const fixe = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);
  assert.ok(Math.abs(resolue - (d.coutTotalEur - fixe)) < 0.5, "elle doit venir de devisVoix, pas d'un autre calcul");
});

test("le FIXE mutualisé n'est pas imputé à la brique", () => {
  /**
   * Hébergement et supervision sont partagés par tous les clients. Les mettre
   * dans la consommation d'une brique reviendrait à les facturer une fois par
   * brique vendue — et à multiplier le tout par 4 dans le plancher.
   */
  const c = COUTS_BRIQUES.find((x) => x.brickId === "alpha-voice")!;
  const fixe = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);
  assert.ok(consommationDe(c) < fixe, "la consommation ne doit pas inclure le fixe mutualisé");
});

test("⚠ toute brique marquée « volume » a un modèle NOMMÉ", () => {
  /**
   * Trouvé en cassant le code : un simple booléen ne dit pas QUEL modèle
   * s'applique. Marquer `campagnes` comme dépendante du volume lui donnait
   * silencieusement le coût de la VOIX — une brique d'emailing chiffrée avec
   * des minutes de téléphone, sans que rien ne proteste.
   */
  for (const c of COUTS_BRIQUES.filter((x) => x.volumeDependant)) {
    assert.ok(
      BRIQUES_A_MODELE_VOLUME.includes(c.brickId),
      `« ${c.brickId} » est marquée volumeDependant mais aucun modèle ne lui correspond — elle hériterait du coût d'une autre brique`
    );
  }
  // Et l'inverse : un modèle déclaré pour une brique qui ne le demande pas
  // ne servirait à rien, donc signale une erreur de déclaration.
  for (const id of BRIQUES_A_MODELE_VOLUME) {
    const c = COUTS_BRIQUES.find((x) => x.brickId === id);
    assert.ok(c?.volumeDependant, `un modèle existe pour « ${id} » mais la brique ne le réclame pas`);
  }
});

test("les briques SANS volume gardent leur constante, inchangée", () => {
  // Le contre-test : si le résolveur touchait à tout, il casserait neuf
  // briques pour en réparer une.
  for (const c of COUTS_BRIQUES.filter((x) => !x.volumeDependant)) {
    assert.equal(consommationDe(c), c.consommationMensuelleEur, `${c.brickId} ne doit pas être recalculée`);
  }
});

test("le verdict d'Alpha Voice reflète le VRAI coût", () => {
  const v = auditerCatalogue({ tauxHoraireEur: TAUX }).verdicts.find((x) => x.brickId === "alpha-voice")!;
  const c = COUTS_BRIQUES.find((x) => x.brickId === "alpha-voice")!;
  // Avec l'ancienne constante, le coût mensuel était consommation(2) + support.
  const ancien = c.consommationMensuelleEur + c.heuresSupportMois * TAUX;
  assert.ok(v.coutMensuelEur > ancien * 1.2, `le coût (${Math.round(v.coutMensuelEur)} €) doit dépasser l'ancien (${Math.round(ancien)} €)`);
  assert.ok(v.plancherMensuelEur !== null, "une brique de consommation doit avoir un plancher");
  // Le prix public reste au-dessus — mais de bien moins qu'on ne le croyait.
  assert.ok(v.mensuelAfficheEur >= v.plancherMensuelEur!, "le prix affiché doit rester au-dessus du plancher");
});

test("aucun renvoi vers une fonction qui n'existe pas", () => {
  /**
   * L'erreur d'origine tenait dans un commentaire : il promettait un calcul
   * qui n'était jamais arrivé. Un renvoi mort est pire qu'une absence — il
   * fait croire que le travail est fait.
   */
  const src = readFileSync(join(process.cwd(), "lib/pricing-briques.ts"), "utf8");
  const renvois = [...src.matchAll(/`([a-zA-Z][a-zA-Z0-9_]*)\(\)`/g)].map((m) => m[1]);
  for (const nom of [...new Set(renvois)]) {
    assert.ok(
      src.includes(`function ${nom}`) || src.includes(`const ${nom}`) || src.includes(`${nom},`) || src.includes(`import`),
      `le commentaire renvoie à ${nom}() — vérifier qu'elle existe`
    );
  }
  assert.doesNotMatch(src, /voir `coutVoixMensuel`/, "ce renvoi pointait vers le vide");
});
