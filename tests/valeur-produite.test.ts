import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COHORTE_MIN,
  SIGNAUX,
  etatDuDispositif,
  lireCohorte,
  peutFacturerSur,
  type PartageCohorte,
} from "../lib/valeur-produite";

const compte = (p: Partial<PartageCohorte> = {}): PartageCohorte => ({
  tenantId: "t",
  consenti: true,
  jours: 30,
  emailsEnvoyes: 100,
  minutesVoix: 0,
  fichesTravaillees: 50,
  rdvObtenus: 6,
  ...p,
});

test("⚠⚠ LE CA DÉCLARÉ NE PEUT JAMAIS SERVIR DE BASE DE FACTURE", () => {
  /**
   * Le point qui décide de tout. Indexer un prix sur un nombre que le client
   * TAPE lui donne une raison d'en taper un plus petit — une incitation qu'on
   * fabriquerait là où elle n'existe pas aujourd'hui.
   */
  assert.equal(peutFacturerSur("ca-encaisse"), false);
  assert.equal(peutFacturerSur("rdv-obtenus"), false);
  assert.equal(peutFacturerSur("fiches-travaillees"), false);
  // Ce qui passe par NOTRE infrastructure, en revanche, se compte sans rien demander.
  assert.equal(peutFacturerSur("emails-envoyes"), true);
  assert.equal(peutFacturerSur("minutes-voix"), true);
  // Un signal inconnu n'est pas facturable par défaut — on n'ouvre jamais par omission.
  assert.equal(peutFacturerSur("inconnu"), false);
});

test("⚠ chaque signal NOMME sa source — sinon un nombre se lit comme une mesure", () => {
  for (const s of SIGNAUX) {
    assert.ok(s.source.length > 20, `${s.id} : la provenance doit être écrite, pas supposée`);
    assert.ok(["mesure-infra", "declare-client"].includes(s.nature), `${s.id} : nature manquante`);
  }
  // Et il existe bien des deux natures : une liste qui n'en porterait qu'une
  // rendrait la distinction décorative.
  assert.ok(SIGNAUX.some((s) => s.nature === "mesure-infra"));
  assert.ok(SIGNAUX.some((s) => s.nature === "declare-client"));
});

test("⚠⚠ LE PARTAGE PORTE DES COMPTES, JAMAIS DU CONTENU", () => {
  /**
   * C'est cette ligne — et elle seule — qui permet de mesurer une cohorte sans
   * démentir « rien de ce qui touche la donnée métier ne passe par un tiers ».
   * Le jour où un champ de texte libre entre dans la structure, l'argument de
   * la vitrine devient faux, et ça se vérifie en ouvrant les devtools.
   *
   * On lit le TYPE, pas une instance : une instance de test ne prouverait rien
   * sur ce que le type autorise demain.
   */
  const src = readFileSync(join(process.cwd(), "lib/valeur-produite.ts"), "utf8");
  const bloc = src.slice(
    src.indexOf("export interface PartageCohorte"),
    src.indexOf("export const COHORTE_MIN"),
  );
  assert.ok(bloc.length > 0, "le type doit exister");

  /**
   * ⚠ LE DISCRIMINANT EST LE TYPE, PAS LE NOM DU CHAMP.
   *
   * Première rédaction : une liste de mots interdits (« email », « nom »,
   * « message »…). Elle a mordu sur `emailsEnvoyes` — un COMPTEUR — pendant
   * qu'elle aurait laissé passer un `notesLibres`. Une liste de mots est
   * toujours en retard sur la façon dont on nomme les choses, et ce dépôt a
   * déjà payé ça deux fois (`InterditFroid`, les noms réels).
   *
   * La FORME est la bonne règle : un compteur est un `number`, du contenu est
   * une `string`. On refuse donc TOUTE chaîne, quel que soit son nom, sauf
   * l'identifiant de locataire — qui est un opaque, pas une donnée métier.
   */
  const champs = [...bloc.matchAll(/^\s{2}(\w+)\??:\s*([^;]+);/gm)].map((m) => ({
    nom: m[1],
    type: m[2].trim(),
  }));
  assert.ok(champs.length >= 5, "les champs doivent être lisibles — sinon l'assertion ne mesure rien");
  for (const c of champs) {
    if (c.nom === "tenantId") continue;
    assert.ok(
      !/string/.test(c.type),
      `PartageCohorte.${c.nom} est de type « ${c.type} » : une chaîne peut porter du CONTENU. ` +
        `Des compteurs, jamais du contenu — c'est cette ligne qui tient la promesse de souveraineté.`,
    );
  }

  // Contre-test : le type porte bien les compteurs annoncés, sinon il est vide
  // et l'assertion ci-dessus passe pour la pire des raisons.
  for (const attendu of ["emailsEnvoyes", "minutesVoix", "fichesTravaillees", "rdvObtenus"]) {
    assert.ok(bloc.includes(attendu), `PartageCohorte doit porter ${attendu}`);
  }
});

test("⚠ SANS CONSENTEMENT, un compte n'entre pas — et l'exclusion se DIT", () => {
  const r = lireCohorte([compte(), compte({ consenti: false }), compte({ consenti: false })]);
  assert.equal(r.comptes, 1);
  assert.ok(
    r.reserves.some((x) => /n'ont pas consenti/.test(x)),
    "une cohorte amputée sans le dire se lit comme une cohorte complète",
  );
});

test("⚠⚠ SOUS LA COHORTE MINIMUM, AUCUN CHIFFRE — et le motif est nommé", () => {
  const r = lireCohorte([compte(), compte()]);
  assert.equal(r.prixJustifie, null);
  assert.ok(
    r.reserves.some((x) => new RegExp(`il en faut ${COHORTE_MIN}`).test(x)),
    "le seuil doit être dit AVEC sa valeur — « échantillon insuffisant » envoie chercher au hasard",
  );
});

test("⚠ JAMAIS UN TAUX NU : le dénominateur et l'intervalle voyagent avec", () => {
  // Sur une cohorte réelle, le taux se calcule — mais il ne sort jamais seul.
  const r = lireCohorte(Array.from({ length: 25 }, () => compte()));
  assert.equal(r.comptes, 25);
  assert.equal(r.tauxRdv.source, "mesure", "1 250 fiches suffisent largement");
  assert.ok(
    r.tauxRdv.bas !== null && r.tauxRdv.haut !== null,
    "un taux sans ses bornes de Wilson se lit comme une certitude",
  );
  assert.ok(r.tauxRdv.n > 0 && r.tauxRdv.phrase.length > 0, "le dénominateur et la phrase voyagent avec le taux");
  // Et Wilson vient de `lib/calibration.ts` — une seconde implémentation
  // divergerait, et c'est celle qu'on ne relit pas qui ferait foi.
  const src = readFileSync(join(process.cwd(), "lib/valeur-produite.ts"), "utf8");
  assert.match(src, /from "\.\/calibration"/, "Wilson ne se réimplémente pas ici");
});

test("⚠⚠ LE MODULE NE RENDRA JAMAIS UN PRIX TOUT SEUL — c'est dans le TYPE", () => {
  /**
   * `prixJustifie` est typé `null`, littéralement. Ce n'est pas un état
   * transitoire : c'est « aucun poids ne s'auto-corrige » appliqué au type.
   * Un module qui ajusterait le prix seul apprendrait le bruit de quarante
   * comptes et le graverait dans la facture de tout le monde.
   */
  const grande = lireCohorte(Array.from({ length: 500 }, () => compte()));
  assert.equal(grande.prixJustifie, null, "même sur 500 comptes, le prix reste une décision humaine");

  const src = readFileSync(join(process.cwd(), "lib/valeur-produite.ts"), "utf8");
  assert.match(src, /prixJustifie:\s*null;/, "le type doit interdire un prix automatique, pas la politesse du code");
});

test("⚠ la réserve sur le CA déclaré est TOUJOURS servie, même cohorte pleine", () => {
  // Sinon elle disparaît exactement quand les chiffres deviennent assez gros
  // pour donner envie de s'en servir.
  const r = lireCohorte(Array.from({ length: 200 }, () => compte()));
  assert.ok(r.reserves.some((x) => /raison d'en saisir un plus petit/.test(x)));
});

test("⚠ « rien ne remonte » et « personne n'utilise » ne se disent pas pareil", () => {
  /**
   * Même mode de panne que le moniteur qui affiche du calme quand la base est
   * injoignable. Un tableau vide se lirait « les gratuits ne produisent rien »,
   * alors que la vérité est « on ne collecte rien ».
   */
  const e = etatDuDispositif();
  assert.equal(e.collecteActive, false, "état mesuré au 13/09/2026 : aucune télémétrie n'existe");
  assert.match(e.motif, /localStorage|navigateur/i, "le motif doit dire POURQUOI, pas seulement que c'est vide");
  assert.match(e.motif, /opt-in|OPT-IN/, "et nommer ce qu'il faudrait : un partage consenti");
});
