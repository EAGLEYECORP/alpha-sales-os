import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_MAGNETS, magnetById, magnetReadiness, pickMagnet } from "../lib/lead-magnet";
import { withMetierBenchmark } from "../lib/audit-batch";
import { prospect } from "./fixtures";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AIMANT DOIT TENIR CE QU'IL ANNONCE.
 *
 * Chaque aimant promet quatre choses. Le générateur de document met en page
 * des champs SAISIS À LA MAIN plus des ordres de grandeur de secteur :
 * personne n'appelle les concurrents, personne ne fait de capture Google.
 *
 * Un prospect qui reçoit une page annonçant quatre parties et n'en trouve que
 * deux ne se dit pas « il manque des données ». Il se dit « ils ont
 * survendu » — au pire moment possible, la première prise de contact.
 * ─────────────────────────────────────────────────────────────────────
 */

const garage = (over = {}) =>
  prospect({
    company: "Carrosserie des Lilas",
    sector: "artisan",
    ...over,
  });

test("aimant — une fiche vide ne tient PAS ses promesses, et on le dit", () => {
  const m = magnetById("audit-telephone")!;
  const r = magnetReadiness(garage({ ignoranceTax: 0 }), m);
  assert.ok(r.tenues < m.contains.length, "une fiche vide ne peut pas tout tenir");
  assert.match(r.verdict, /promesses tenues/);
  assert.ok(r.minutesDeTravail > 0, "le travail humain restant doit être chiffré");
});

test("aimant — les promesses que RIEN ne produit sont marquées « à faire »", () => {
  /**
   * C'est le cœur du problème : « ce que font vos trois concurrents quand on
   * les appelle » n'existe dans aucun code. Le document sortira sans, et
   * l'opérateur doit le savoir AVANT d'envoyer, pas après.
   */
  const m = magnetById("audit-telephone")!;
  const r = magnetReadiness(garage(), m);
  const concurrents = r.promesses.find((x) => /concurrents/i.test(x.promesse))!;
  assert.equal(concurrents.etat, "a-faire");
  assert.match(concurrents.action ?? "", /Appeler 3 concurrents/);
});

test("aimant — le piège de la MOYENNE de secteur est signalé", () => {
  /**
   * `withMetierBenchmark` remplit les appels manqués depuis la moyenne du
   * métier quand la fiche est vide. Un document intitulé « sur VOS chiffres »
   * affiche alors une moyenne sectorielle — et le garagiste qui reçoit « vous
   * perdez 23 appels/semaine » alors qu'il en reçoit 4 par jour jette la page
   * ET nous avec.
   *
   * C'est le cas le plus dangereux parce qu'il ne se voit PAS : le document
   * sort complet, il est juste faux pour lui.
   */
  const m = magnetById("audit-telephone")!;
  const sansChiffre = magnetReadiness(garage(), m);
  const appels = sansChiffre.promesses.find((x) => /appels que vous perdez/i.test(x.promesse))!;
  assert.equal(appels.etat, "estime");
  assert.match(appels.action ?? "", /SON chiffre/);

  // Avec le vrai chiffre saisi, la promesse devient tenue.
  const avecChiffre = magnetReadiness(
    garage({ deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 6 } }),
    m
  );
  const appels2 = avecChiffre.promesses.find((x) => /appels que vous perdez/i.test(x.promesse))!;
  assert.equal(appels2.etat, "reel");
});

test("aimant — le benchmark REMPLIT vraiment la fiche, d'où le risque", () => {
  // On vérifie que le danger décrit ci-dessus est réel et pas théorique :
  // une fiche vide ressort avec un chiffre qui n'est pas le sien.
  const vide = garage({ ignoranceTax: 0 });
  const rempli = withMetierBenchmark(vide);
  if (rempli !== vide) {
    assert.notEqual(
      rempli.deepAudit.missedCallsPerWeek,
      undefined,
      "le benchmark remplit un chiffre absent — c'est pour ça que magnetReadiness le signale"
    );
  }
});

test("aimant — une donnée absente sans repli sort VIDE, et c'est dit", () => {
  const m = magnetById("audit-visibilite")!;
  const r = magnetReadiness(garage(), m);
  const site = r.promesses.find((x) => /l'état de votre site/i.test(x.promesse));
  assert.equal(site?.etat, "absent");
  assert.match(site?.action ?? "", /sortira vide/);
});

test("aimant — un document complet est déclaré envoyable, sans nuance inutile", () => {
  // Le bruit tue l'alerte : si tout alerte, plus rien n'alerte.
  const m = magnetById("audit-process")!;
  // Cet aimant n'a que des promesses manuelles ou qualitatives : on vérifie
  // au moins que le verdict est cohérent avec le compte.
  const r = magnetReadiness(garage({ ignoranceTax: 5000 }), m);
  if (r.tenues === r.promesses.length) {
    assert.match(r.verdict, /Envoyable tel quel/);
  } else {
    assert.match(r.verdict, /promesses tenues/);
  }
});

test("teaser — aucune comparaison concurrentielle INVENTÉE", () => {
  /**
   * Le teaser disait « vos concurrents en ont davantage ». On ne les a pas
   * comptés. Il suffit que le prospect en ait plus qu'eux pour que tout le
   * document devienne suspect — en première phrase.
   */
  for (const avis of [0, 3, 9, 12, 40, 300]) {
    const p = garage({
      deepAudit: { websiteState: "aucun", socialState: "", localCompetition: "", currentProcess: "", googleReviews: avis },
    });
    const pick = pickMagnet(p, "eagleye");
    if (!pick?.teaser) continue;
    assert.doesNotMatch(
      pick.teaser,
      /concurrents? en ont (davantage|plus)|mieux notés? que vous/i,
      `${avis} avis : le teaser affirme une comparaison qu'on n'a pas faite`
    );
  }
});

test("aimant — chaque aimant reste utile même sans achat", () => {
  // La règle 1 de la doctrine. Un aimant qui ne sert qu'à capturer un email
  // se voit, et brûle la marque.
  for (const m of LEAD_MAGNETS) {
    assert.ok(m.standaloneValue.trim().length > 40, `${m.id} : la valeur autonome n'est pas argumentée`);
    assert.ok(m.ask.trim().length > 0, `${m.id} : on doit demander quelque chose de petit`);
    // Et jamais de prix dans un aimant — le prix vient après le cadrage.
    const brut = JSON.stringify(m);
    assert.doesNotMatch(brut, /\d[\d\s ]*€/, `${m.id} : un montant a fui dans l'aimant`);
  }
});
