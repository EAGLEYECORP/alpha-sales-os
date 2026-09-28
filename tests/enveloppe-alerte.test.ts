import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENVELOPPE_ALERTE_PART,
  ENVELOPPE_OUVERTURE_EUR,
  etatEnveloppe,
} from "../lib/essai";
import { anglesMorts, diagnostiquer, PANNES, type EtatSysteme } from "../lib/alpha-ceo";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ENVELOPPE FERMAIT POUR LE LOCATAIRE, ET PERSONNE NE NOUS PRÉVENAIT.
 *
 * Le compte qui arrive après l'épuisement lit « ce n'est pas toi » sur
 * `/compte` depuis ce matin. **Nous, non.** L'enveloppe se refermait en
 * silence, et le seul moyen de l'apprendre était une requête écrite à la main.
 *
 * ⚠⚠ ET C'EST LA PANNE LA PLUS DIFFICILE À VOIR DU LOT : le signal de succès
 * et le signal de fermeture sont **le même silence**. Une ouverture qui marche
 * très bien et une enveloppe épuisée produisent exactement les mêmes journaux,
 * exactement les mêmes écrans, et une facture qui cesse de monter — ce qu'on
 * lit spontanément comme une bonne nouvelle.
 * ─────────────────────────────────────────────────────────────────────
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Un état système neutre : rien de mesuré, donc rien qui alerte. */
const ETAT: EtatSysteme = {
  enveloppe: null,
  smtpConfigure: null,
  prixStripeConfigures: null,
  stockage: null,
  pipeSynchronisable: null,
  brouillonsEnAttente: 0,
  fichesSansProchaineAction: 0,
  palierEnAttente: false,
  autopilote: null,
  agentVocal: null,
  ciblesAuPlafond: null,
};

test("⚠⚠ L'INCONNU N'ALERTE PAS — il se dit", () => {
  /**
   * La discipline du module, appliquée ici comme partout : `false` alerte,
   * `null` est un angle mort. Une console qui crierait « enveloppe pleine »
   * parce qu'elle n'a pas su lire serait le moniteur qui affiche du calme,
   * à l'envers — et on apprendrait à ne plus lire l'écran.
   */
  const pasLu = etatEnveloppe(null);
  assert.equal(pasLu.niveau, null);
  assert.equal(pasLu.consommeEur, null, "`null` n'est PAS zéro consommé");
  assert.match(pasLu.phrase, /on ne sait pas/i, "et l'ignorance se dit en toutes lettres");

  assert.deepEqual(diagnostiquer({ ...ETAT, enveloppe: pasLu }), [], "une sonde muette n'alarme jamais");
  assert.ok(
    anglesMorts({ ...ETAT, enveloppe: pasLu }).some((p) => /enveloppe/i.test(p)),
    "…mais l'angle mort doit se DIRE",
  );
  // Et le champ absent (sonde pas revenue) mène au même endroit.
  assert.ok(anglesMorts(ETAT).some((p) => /enveloppe/i.test(p)));
});

test("⚠⚠ MESURÉ ET PLEIN ALERTE — la sonde n'est pas inerte", () => {
  /**
   * La moitié qui prouve que le test précédent ne cache pas un module qui ne
   * répond jamais rien. Le piège de test rencontré cinq fois dans ce dépôt :
   * asserter la PRÉSENCE d'un refus au lieu de la condition qui y mène.
   */
  const pleine = etatEnveloppe(ENVELOPPE_OUVERTURE_EUR);
  assert.equal(pleine.niveau, "pleine");
  assert.equal(pleine.resteEur, 0);

  const ids = diagnostiquer({ ...ETAT, enveloppe: pleine }).map((a) => a.id);
  assert.ok(ids.includes("enveloppe-ouverture-pleine"), "une enveloppe mesurée pleine doit alerter");
  assert.ok(
    !anglesMorts({ ...ETAT, enveloppe: pleine }).some((p) => /enveloppe/i.test(p)),
    "mesuré = plus un angle mort",
  );
});

test("⚠⚠ L'ALERTE ARRIVE AVANT L'ÉPUISEMENT — sinon elle ne sert à rien", () => {
  /**
   * LE POINT CENTRAL DE CE LOT. Une alerte à 100 % se déclenche quand les
   * essais suivants sont DÉJÀ dégradés et que les comptes concernés sont déjà
   * partis avec une mauvaise première impression. Le seul moment où elle sert
   * est celui où l'on peut encore décider : relever l'enveloppe, pousser le
   * BYOK, ou assumer la fermeture.
   */
  const juste = etatEnveloppe(ENVELOPPE_OUVERTURE_EUR * ENVELOPPE_ALERTE_PART);
  assert.equal(juste.niveau, "bientot-pleine", "au seuil, on prévient");
  assert.ok((juste.resteEur ?? 0) > 0, "et il reste encore de quoi décider");
  assert.ok(
    diagnostiquer({ ...ETAT, enveloppe: juste }).some((a) => a.id === "enveloppe-ouverture-pleine"),
    "« bientôt pleine » doit alerter, pas seulement « pleine »",
  );

  // Juste en dessous, rien : une alerte permanente est une alerte qu'on n'lit plus.
  const calme = etatEnveloppe(ENVELOPPE_OUVERTURE_EUR * (ENVELOPPE_ALERTE_PART - 0.2));
  assert.equal(calme.niveau, "ouverte");
  assert.deepEqual(diagnostiquer({ ...ETAT, enveloppe: calme }), []);
});

test("⚠ C'EST UNE DÉCISION HUMAINE, et l'écran doit le montrer", () => {
  /**
   * Relever l'enveloppe, pousser le BYOK ou assumer la fermeture est un
   * arbitrage commercial. Une alerte marquée « à traiter » sans `humain: true`
   * laisse croire qu'Alpha CEO va s'en charger — et on attend.
   */
  const a = diagnostiquer({ ...ETAT, enveloppe: etatEnveloppe(ENVELOPPE_OUVERTURE_EUR) });
  const e = a.find((x) => x.id === "enveloppe-ouverture-pleine");
  assert.ok(e, "l'alerte doit exister");
  assert.equal(e.humain, true, "aucune automatisation ne tranche un budget");
  assert.match(e.action, /enveloppe/i, "l'action porte le chiffre, pas un libellé générique");
});

test("⚠⚠ NOTRE BUDGET NE DESCEND QU'AU MAÎTRE", () => {
  /**
   * L'enveloppe appartient à la même famille que `/payouts`, `/offre` et
   * `voice-costs` : notre économie, jamais celle du client.
   *
   * ⚠ ET ELLE NE PASSE PAS PAR `detailAutorise`, qui garde le reste de
   * `/api/health`. Cette fonction rend `true` QUAND `SITE_PASSWORD` EST
   * ABSENT — c'est voulu en développement, et c'est exactement l'état que la
   * doctrine appelle `deploiementSansSerrure` : une production en ligne sans
   * mot de passe. Y poser notre budget l'exposerait publiquement, et ça ne se
   * verrait jamais. Il suit donc l'IDENTITÉ.
   */
  const src = sansCommentaires(lire("app/api/health/route.ts"));
  assert.match(src, /enveloppe: droits\.maitre \?/, "l'enveloppe est conditionnée au compte maître");
  assert.ok(
    !/enveloppe:\s*etatEnveloppe\(/.test(src),
    "jamais servie sans condition d'identité",
  );
  // Et la sonde côté console accepte son absence sans inventer un état.
  const sondes = sansCommentaires(lire("lib/ceo-sondes.ts"));
  assert.match(sondes, /enveloppe: e\.sante\?\.enveloppe \?\? null/, "absente ⇒ `null`, jamais « ouverte » par défaut");
});

test("⚠ LA PANNE EST DÉCLARÉE, avec ce qui la rend invisible", () => {
  /**
   * `PANNES` n'est pas une liste de bugs : c'est la carte de ce qui casse
   * SANS LE DIRE. Une entrée sans `pourquoiInvisible` n'a rien à y faire —
   * c'est ce champ qui distingue cette liste d'un journal d'erreurs.
   */
  const p = PANNES.find((x) => x.id === "enveloppe-ouverture-pleine");
  assert.ok(p, "la panne doit être déclarée");
  assert.match(p.pourquoiInvisible, /silence|normal/i, "elle doit dire pourquoi personne ne la voit");
  assert.match(p.detection, /health/, "et comment on la détecte, concrètement");
});
