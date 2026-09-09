import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFRES } from "../lib/offres-publiques";
import { TOUS_RELEVES } from "../lib/marche";
import { PEREMPTION_JOURS, REFERENCE_PAR_OFFRE, ageDuReleve, positionnerOffres } from "../lib/positionnement";
import { TAUX_HORAIRE_EUR } from "../lib/taux-horaire";
import { auditerCatalogue } from "../lib/pricing-briques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE POSITIONNEMENT — trois modules de mesure qui vivaient sans lecteur.
 *
 * `lib/marche.ts` savait déjà comparer. `lib/taux-horaire.ts` exportait
 * « le nombre que le reste du code attend ». `lib/pricing-briques.ts` exigeait
 * ce nombre sans défaut. Les trois avaient été écrits l'un pour l'autre, et
 * aucun n'était importé par autre chose que ses propres tests.
 * ─────────────────────────────────────────────────────────────────────
 */

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

// ═══════════ CE QU'ON REFUSE DE COMPARER ═══════════

test("⚠ UNE OFFRE SANS RÉFÉRENCE HONNÊTE N'EN REÇOIT PAS UNE DE FORTUNE", () => {
  /**
   * ⚠ LE PIÈGE DE CE MODULE, ET IL EST TENTANT : remplir le tableau.
   *
   * Une comparaison bancale ne reste pas à l'écran — elle se cite en
   * rendez-vous, et se fait démonter par un prospect qui connaît le concurrent
   * mieux que nous. Trois offres n'ont aucune référence défendable : un devis
   * n'a pas de prix, un déploiement échelonné n'est pas un abonnement, et un
   * paiement unique comparé à un mensuel met un capital en face d'un loyer.
   *
   * Mutation vérifiée : rattacher `lifetime` à un relevé mensuel fait tomber
   * ce test.
   */
  const sans = positionnerOffres().filter((p) => p.comparaison === null);
  assert.deepEqual(
    sans.map((p) => p.offreId).sort(),
    ["business", "lifetime", "os-complet"],
    "seules ces trois offres n'ont pas de comparaison défendable"
  );

  // Et chacune DIT pourquoi. Un trou muet se lit comme un oubli, et le
  // prochain le comblera au jugé.
  for (const p of sans) {
    assert.ok(p.pourquoiPas.length > 40, `« ${p.offreId} » : un trou sans raison écrite sera comblé au hasard`);
  }
});

test("chaque référence citée EXISTE dans le relevé", () => {
  /**
   * Une carte qui pointe vers un relevé supprimé ne plante pas : elle rend
   * simplement `comparaison: null`, et l'offre passe silencieusement dans la
   * colonne « pas comparable ». On perdrait la comparaison sans le savoir.
   */
  for (const [offreId, refId] of Object.entries(REFERENCE_PAR_OFFRE)) {
    if (refId === null) continue;
    assert.ok(
      TOUS_RELEVES.some((r) => r.id === refId),
      `« ${offreId} » pointe vers le relevé « ${refId} », absent de lib/marche.ts`
    );
  }
});

test("toute offre du catalogue est classée — comparée, ou refusée avec sa raison", () => {
  // Le pendant de `ACCES_PAR_CHEMIN` : une offre ajoutée sans entrée ici
  // tomberait dans « pas comparable » sans que personne l'ait décidé.
  const classees = new Set(Object.keys(REFERENCE_PAR_OFFRE));
  const orphelines = OFFRES.filter((o) => !classees.has(o.id)).map((o) => o.id);
  assert.deepEqual(orphelines, [], "offre(s) sans décision de comparaison");
});

test("la comparaison porte le prix MENSUEL, jamais le setup", () => {
  /**
   * Les relevés d'abonnement et ceux de mise en service sont deux familles
   * distinctes dans `lib/marche.ts`. Comparer notre setup à une fourchette
   * mensuelle produirait un ratio spectaculaire et faux.
   */
  for (const p of positionnerOffres()) {
    if (!p.comparaison) continue;
    const offre = OFFRES.find((o) => o.id === p.offreId)!;
    assert.equal(p.comparaison.notrePrix, offre.prixHT, `${p.offreId} : le prix comparé n'est pas le mensuel`);
  }
});

// ═══════════ L'ÂGE DU RELEVÉ ═══════════

test("⚠ un relevé vieux se MARQUE, il ne se cache pas", () => {
  /**
   * Un relevé de prix ne vieillit pas comme une doctrine : les concurrents
   * changent leurs tarifs sans prévenir. Le retirer laisserait un écran vide
   * qu'on lirait comme « pas de concurrence » ; le laisser nu le ferait citer
   * en rendez-vous comme une mesure du jour, devant quelqu'un qui a la page
   * de tarifs ouverte.
   */
  const base = new Date("2026-08-26T00:00:00.000Z");
  assert.equal(ageDuReleve("2026-08-26", base), 0);
  assert.equal(ageDuReleve("2026-08-26", new Date("2026-09-09T00:00:00.000Z")), 14);
  // Une date illisible ne doit pas rendre un âge négatif ni exploser.
  assert.equal(ageDuReleve("pas une date", base), 0);
  assert.equal(ageDuReleve("2027-01-01", base), 0, "un relevé du futur ne vieillit pas à l'envers");
  assert.ok(PEREMPTION_JOURS > 0);
});

// ═══════════ LE BRANCHEMENT ═══════════

test("⚠ LE TAUX HORAIRE ARRIVE JUSQU'À L'AUDIT DU CATALOGUE", () => {
  /**
   * ⚠ LE CÂBLAGE QUI MANQUAIT, ET IL TIENT EN UN ARGUMENT.
   *
   * `verdictBrique` exige `tauxHoraireEur` et n'a AUCUN défaut — c'est écrit
   * dans le module : « un taux inventé se propagerait dans tous les prix du
   * catalogue ». Et `lib/taux-horaire.ts` existe pour le poser, en décrivant
   * `TAUX_HORAIRE_EUR` comme « le nombre que le reste du code attend ».
   *
   * Les deux modules ont été écrits l'un pour l'autre et n'avaient jamais été
   * présentés. Ce test tient la présentation.
   */
  const route = sansCommentaires(lire("app/api/positionnement/route.ts"));
  assert.match(
    route,
    /auditerCatalogue\(\{\s*tauxHoraireEur:\s*TAUX_HORAIRE_EUR\s*\}\)/,
    "l'audit du catalogue doit être nourri par le taux horaire du module qui le calcule"
  );

  // Et le résultat n'est pas vide : un audit qui ne rend rien passerait le
  // test précédent sans rien prouver.
  const audit = auditerCatalogue({ tauxHoraireEur: TAUX_HORAIRE_EUR });
  assert.ok(audit.verdicts.length > 0, "l'audit ne rend aucun verdict — le taux ne le traverse pas");
});

test("⚠ AUCUN MODULE DE COÛT N'EST IMPORTÉ PAR L'ÉCRAN", () => {
  /**
   * ⚠ CE DÉPÔT A DÉJÀ PAYÉ EXACTEMENT ÇA.
   *
   * `components/voice/cost-panel.tsx` importait `lib/voice-costs` — un
   * composant client, donc compilé dans un chunk `_next/static/**`, que le
   * middleware ne couvre pas et qui se télécharge SANS COMPTE. `usdPerMin`
   * était mesurable dans le build.
   *
   * `pricing-briques` et `offres-marge` remontent tous les deux jusqu'à
   * `voice-costs`. Les importer dans l'écran rouvrirait le trou.
   *
   * Mutation vérifiée : ajouter `import { margeOffre } from "@/lib/offres-marge"`
   * dans le composant fait tomber ce test.
   */
  const vue = sansCommentaires(lire("components/offre/positionnement.tsx"));
  for (const interdit of ["voice-costs", "pricing-briques", "offres-marge", "lib/marche", "taux-horaire"]) {
    assert.ok(!vue.includes(interdit), `« ${interdit} » importé côté client : notre coût partirait dans un chunk public`);
  }
  assert.match(vue, /fetch\("\/api\/positionnement"\)/, "l'écran doit passer par la route serveur");
});

test("l'écran est monté sur /offre, et la route est réservée au maître", () => {
  // Un composant qui n'est monté nulle part est mort — c'est précisément la
  // situation dont ces trois modules sortent.
  assert.match(lire("app/(app)/offre/page.tsx"), /<Positionnement \/>/, "le composant n'est monté sur aucune page");

  // `/offre` n'est ouvert par aucune brique : maître seul (lib/bricks-access).
  const acces = lire("lib/api-access.ts");
  assert.match(acces, /"\/api\/positionnement":\s*"\/offre"/, "la route doit suivre la porte de l'écran qu'elle alimente");

  // Et elle est INTERNE : même origine exigée, pas seulement le mot de passe.
  const mw = lire("middleware.ts");
  const bloc = mw.slice(mw.indexOf("const INTERNAL"), mw.indexOf("const PUBLIC_PREFIXES"));
  assert.ok(bloc.includes('"/api/positionnement"'), "une route qui sert notre marge doit être interne");
});
