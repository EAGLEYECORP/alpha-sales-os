import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRILLES_PERIMEES, PRIX_HONORE_JUSQU_AU, phrasePrixPerime, prixPerime } from "../lib/grille-perimee";
import { ALPHA_VOICE_PALIERS, ALPHA_VOICE_SETUP_HT } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PIPELINE ENTIER ÉTAIT CHIFFRÉ SUR UNE GRILLE MORTE — 17/09/2026.
 *
 * ══ CE QUI A ÉTÉ MESURÉ ══
 *
 * Sur le pipeline réel : **16 fiches sur 16** portent `setupValue = 990` et un
 * mensuel pris dans `59 / 115 / 169 / 219 / 319`. C'est EXACTEMENT la grille
 * remplacée le 02/09, puis réajustée le 12/09 (setup à 1 490 €, deux paliers à
 * 149 / 349). Les trois offres encore sur la table en font partie.
 *
 * ⚠ Le défaut de signature du dépôt, sur l'argent : une DÉCISION prise dans la
 * doctrine qui n'atteint jamais la DONNÉE. Le Cerveau l'avait déjà payé
 * (`sc-voix-tarifs` annonçait l'ancien setup dix jours après la décision).
 * Ici c'est pire — le Cerveau alimente un prompt, une fiche alimente un DEVIS.
 *
 * ⚠⚠ ET LA DOCTRINE ELLE-MÊME RÉPÉTAIT LE PRIX MORT : « 3 fiches en offre
 * (2 970 €) » revenait dans chaque compte rendu. 2 970 = 3 × 990. Le chiffre
 * qui sert à décider de la priorité était celui de la grille disparue.
 * ─────────────────────────────────────────────────────────────────────
 */

const FICHE = { monthlyValue: 115, setupValue: 990 };

/** Deux instants qui encadrent la décision du 17/09 — injectés, jamais lus. */
const AVANT_ECHEANCE = Date.parse("2026-09-20T09:00:00.000Z");
const APRES_ECHEANCE = Date.parse("2026-11-02T09:00:00.000Z");

test("⚠⚠ UNE FICHE FIGÉE AVANT LE REMPLACEMENT EST `datee`, pas une coïncidence", () => {
  /**
   * C'est la distinction qui rend l'alerte utilisable. Une fiche qui n'a pas
   * bougé depuis la décision ne peut PAS avoir choisi ce montant en
   * connaissance de cause : il vient de l'ancienne grille.
   */
  const v = prixPerime(FICHE, "2026-07-09T10:00:00.000Z");
  assert.ok(v, "990 € de setup et 115 €/mois doivent être reconnus");
  assert.equal(v.certitude, "datee");
  assert.deepEqual(v.reconnus, ["setup 990 €", "mensuel 115 €"]);
});

test("⚠⚠ UNE FICHE QUI A VÉCU DEPUIS N'EST QU'UNE COÏNCIDENCE", () => {
  /**
   * Quelqu'un peut négocier 115 €/mois aujourd'hui, en le sachant. Affirmer
   * « périmé » sur le seul montant fabriquerait des faux positifs — et un garde
   * qui crie sur une fiche juste est un garde qu'on désarme. Le dépôt l'a déjà
   * payé deux fois (le motif `prim[ée]`, le garde de la marque morte).
   */
  const v = prixPerime(FICHE, "2026-09-16T10:00:00.000Z");
  assert.equal(v?.certitude, "coincidence");
  assert.match(phrasePrixPerime(v!, AVANT_ECHEANCE), /peut-être un choix/);
  assert.ok(
    !/à re-chiffrer/i.test(phrasePrixPerime(v!, AVANT_ECHEANCE)),
    "on n'ordonne pas de corriger un choix assumé",
  );
});

test("⚠ UNE FICHE SANS AUCUNE TOUCHE PENCHE VERS L'ALERTE", () => {
  /**
   * L'inconnu ne se traite pas pareil partout, et c'est délibéré : ici alerter
   * ne coûte qu'une lecture, alors que sur le cadrage l'inconnu BLOQUE un
   * document. On choisit le côté dont l'erreur est la moins chère.
   */
  assert.equal(prixPerime(FICHE, null)?.certitude, "datee");
  assert.equal(prixPerime(FICHE, "jeudi")?.certitude, "datee", "une date illisible n'ouvre rien");
});

test("⚠ UN PRIX EN VIGUEUR NE DÉCLENCHE RIEN", () => {
  /**
   * Le contre-test obligatoire. Sans lui, un détecteur qui rendrait toujours
   * « périmé » passerait les trois tests précédents.
   */
  assert.equal(prixPerime({ monthlyValue: 149, setupValue: 1490 }, null), null);
  assert.equal(prixPerime({ monthlyValue: 349, setupValue: 1490 }, null), null);
  assert.equal(prixPerime({ monthlyValue: 0, setupValue: 0 }, null), null, "une fiche non chiffrée n'est pas périmée");
});

test("⚠⚠ LES PRIX EN VIGUEUR SONT IMPORTÉS, JAMAIS RECOPIÉS", () => {
  /**
   * Le module NOMME les anciens montants — c'est légitime, ils n'existent plus
   * nulle part ailleurs. Mais s'il recopiait aussi les montants COURANTS, il y
   * aurait deux sources pour le prix d'aujourd'hui, et c'est celle qu'on ne
   * relit pas qui mentirait. Exactement ce que ce module vient corriger.
   */
  const src = readFileSync(join(process.cwd(), "lib/grille-perimee.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.match(src, /from "\.\/offres-publiques"/, "les prix courants viennent du module de prix");
  for (const courant of [String(ALPHA_VOICE_SETUP_HT), ...ALPHA_VOICE_PALIERS.map((p) => String(p.prixHT))]) {
    assert.ok(
      !new RegExp(`\\b${courant}\\b`).test(src),
      `le montant en vigueur ${courant} ne doit pas être écrit en dur ici — il s'importe`,
    );
  }

  // Et la phrase servie porte bien les vrais montants courants.
  const phrase = phrasePrixPerime(prixPerime(FICHE, null)!, AVANT_ECHEANCE);
  assert.ok(phrase.includes(String(ALPHA_VOICE_SETUP_HT)), "la phrase annonce le setup en vigueur");
  for (const p of ALPHA_VOICE_PALIERS) assert.ok(phrase.includes(String(p.prixHT)), "…et les paliers en vigueur");
});

test("⚠⚠ CHAQUE GRILLE MORTE PORTE SON MOTIF, ET IL VOYAGE JUSQU'À L'ÉCRAN", () => {
  /**
   * « La grille a changé » sans la raison se lit comme une hausse arbitraire —
   * et c'est la première chose qu'un commercial contourne pour ne pas perdre
   * son deal. Avec le motif, il sait quoi répondre au prospect.
   */
  for (const g of GRILLES_PERIMEES) {
    assert.ok(g.motif.length >= 40, `${g.id} : un motif d'une ligne ne se défend pas devant un client`);
    assert.ok(!Number.isNaN(Date.parse(g.remplaceeLe)), `${g.id} : la date doit être lisible`);
  }

  const ecran = readFileSync(join(process.cwd(), "components/prospects/alerte-prix-perime.tsx"), "utf8");
  assert.match(ecran, /verdict\.grille\.motif/, "l'écran sert le motif, il ne le résume pas");
  assert.ok(
    !/onClick|patch\(/.test(ecran),
    "aucun bouton ne corrige : un prix annoncé au prospect ne se réécrit pas depuis un écran",
  );
});

test("⚠⚠ LA DATE VIENT DES ÉVÉNEMENTS, PAS D'UN « MODIFIÉ LE »", () => {
  /**
   * Un champ « modifié le » bougerait au moindre clic — ouvrir une fiche n'est
   * pas la travailler. Une fiche figée depuis juillet passerait pour vivante,
   * `datee` deviendrait `coincidence`, et l'alerte perdrait sa force exactement
   * là où elle compte : sur les dossiers qu'on n'a pas touchés.
   */
  const ecran = readFileSync(join(process.cwd(), "components/prospects/alerte-prix-perime.tsx"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.match(ecran, /p\.events/, "la dernière touche se lit sur la timeline");
  assert.ok(!/updatedAt|modifieLe/.test(ecran), "jamais un horodatage de modification");
});

test("⚠⚠ LA DÉCISION DU 17/09 : LE PRIX ANNONCÉ EST HONORÉ, ET L'HONNEUR A UNE DATE", () => {
  /**
   * Zakaria a délégué l'arbitrage. Décision : on honore le prix ANNONCÉ sur les
   * dossiers ouverts avant le changement, tout ce qui est neuf part au tarif en
   * vigueur. Les motifs vivent dans `lib/grille-perimee.ts` — ici on vérifie
   * que la décision est EXÉCUTABLE, pas qu'elle est écrite.
   *
   * ⚠⚠ ET LA DATE LIMITE EST LA MOITIÉ QUI COMPTE. Un prix honoré sans échéance
   * devient une SECONDE GRILLE : deux tarifs en vigueur, celui qu'on affiche et
   * celui qu'on pratique. C'est le défaut que ce dépôt traque partout ailleurs.
   * Sans ce test, la phrase « on l'honore » se servirait indéfiniment.
   */
  const v = prixPerime(FICHE, "2026-07-09T10:00:00.000Z")!;
  assert.equal(v.certitude, "datee");

  const avant = phrasePrixPerime(v, AVANT_ECHEANCE);
  assert.match(avant, /honore|honorе|on l.honore/i, "avant l'échéance : on honore");
  assert.match(avant, /raison de rappeler/, "…et la phrase sert la relance, qui est le vrai livrable");
  assert.ok(!/à re-chiffrer/i.test(avant), "on n'ordonne pas de corriger ce qu'on a décidé d'honorer");

  const apres = phrasePrixPerime(v, APRES_ECHEANCE);
  assert.match(apres, /expiré/, "après l'échéance : la faveur est finie, et la phrase le dit");
  assert.match(apres, /à re-chiffrer/i);

  // L'échéance est une DATE lisible, pas un « bientôt ».
  assert.ok(!Number.isNaN(Date.parse(PRIX_HONORE_JUSQU_AU)));
  assert.ok(
    Date.parse(PRIX_HONORE_JUSQU_AU) > Date.parse(GRILLES_PERIMEES[0].remplaceeLe),
    "honorer un prix jusqu'à une date ANTÉRIEURE au changement ne veut rien dire",
  );
});

test("⚠⚠ L'ÉCRAN NE PEINT PAS UNE FAVEUR COMME UNE ALERTE", () => {
  /**
   * La décision a créé un état qui n'existait pas ce matin : « le prix tient,
   * et c'est une bonne nouvelle ». Le laisser en ambre ferait lire une faveur
   * comme un problème — et l'opérateur corrigerait le prix par réflexe, soit
   * exactement l'inverse de ce qui a été décidé.
   */
  const ecran = readFileSync(join(process.cwd(), "components/prospects/alerte-prix-perime.tsx"), "utf8");
  assert.match(ecran, /signal-green/, "l'état honoré a son propre ton");
  assert.match(ecran, /PRIX_HONORE_JUSQU_AU/, "…et il est borné par la même date que le module");
  assert.ok(!/onClick|patch\(/.test(ecran), "toujours aucun bouton qui corrige un prix annoncé");
});
