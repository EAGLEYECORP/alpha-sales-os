import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EQUATION, PILE, GARANTIES, RARETE, ANCRAGES, DEROULE } from "../lib/offre-alpha-voice";
import { coutGarantiePremierRdv } from "../lib/offre-alpha-voice-cout";
import { buildArgumentaire } from "../lib/argumentaire";
import { prospect } from "./fixtures";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'OFFRE NE DOIT RIEN INVENTER — c'est sa seule contrainte dure.
 *
 * La méthode appliquée ici (pile d'offre, garantie, rareté, ancrage) repose
 * normalement sur des témoignages et des résultats passés. Il n'y en a aucun :
 * zéro vente à ce jour. Toute la valeur du module tient donc à ce qu'il
 * n'ajoute AUCUNE preuve fabriquée — sinon on remplace un pitch faible par un
 * pitch faux, et un artisan lyonnais qui le découvre en parle à ses confrères.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ l'offre ne contient aucune preuve sociale ni superlatif invérifiable", () => {
  const tout = JSON.stringify({ EQUATION, PILE, GARANTIES, RARETE, ANCRAGES, DEROULE });

  const interdits = [
    /nos clients/i,
    /t[ée]moignage/i,
    /\d+\s*(clients?|entreprises?)\s+(nous|satisfait)/i,
    /leader/i,
    /le meilleur|les meilleurs/i,
    /n°\s*1/i,
    /r[ée]volutionnaire/i,
    /garanti[e]?\s+\d+\s*%/i,
  ];
  for (const rx of interdits) {
    assert.ok(!rx.test(tout), `l'offre contient une affirmation invérifiable : ${rx}`);
  }
});

test("⚠ aucun MONTANT en dur dans l'offre — ils viennent du prospect ou du catalogue", () => {
  /**
   * Un prix écrit ici serait une troisième source, à côté de
   * `lib/offres-publiques.ts` et du calcul de perte fait sur les chiffres du
   * prospect. Trois sources pour un prix, c'est un devis qui ne correspond à
   * aucun des deux autres écrans.
   *
   * On tolère les durées (« 30 jours ») et les horaires, pas les euros.
   */
  const tout = JSON.stringify({ EQUATION, PILE, GARANTIES, RARETE, ANCRAGES, DEROULE });
  assert.ok(!/\d[\d\s ]*€/.test(tout), "un montant en euros est écrit en dur dans l'offre");
});

test("l'équation de valeur travaille ses QUATRE leviers, pas seulement le résultat", () => {
  /**
   * Le piège de tout pitch : ne parler que du gain. Chez un artisan, ce qui
   * bloque est au dénominateur — le délai et l'effort. Une offre qui ne les
   * traite pas se fait répondre « rappelez-moi en septembre ».
   */
  assert.deepEqual(
    EQUATION.map((e) => e.levier).sort(),
    ["delai", "effort", "probabilite", "resultat"],
    "les quatre leviers doivent être couverts"
  );
  for (const e of EQUATION) {
    assert.ok(e.phrase.length > 20, `${e.levier} : une phrase à dire, pas un concept`);
  }
});

test("chaque ligne de la pile répond à une objection RÉELLE, et se dit", () => {
  assert.ok(PILE.length >= 8, "une pile courte laisse des objections non traitées");
  for (const l of PILE) {
    assert.ok(l.probleme.length > 15 && l.solution.length > 15);
    assert.ok(["nul", "faible", "reel"].includes(l.coutPourNous));
  }
  /**
   * ⚠ Un bonus qui coûte cher n'est pas un bonus, c'est une remise déguisée.
   * On l'écrit dans le type ET on le vérifie : un bonus « reel » signalerait
   * qu'on offre quelque chose qui ronge la marge sans que personne le voie.
   */
  for (const b of PILE.filter((l) => l.role === "bonus")) {
    assert.notEqual(b.coutPourNous, "reel", `« ${b.probleme} » : un bonus coûteux est une remise qui ne dit pas son nom`);
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA GARANTIE — chiffrée, donc décidable.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la garantie forte est CHIFFRÉE, et rendue en fourchette avec sa réserve", () => {
  const c = coutGarantiePremierRdv();
  assert.ok(c.basEur > 0 && c.hautEur > c.basEur, "une fourchette, pas un point");
  assert.ok(c.hautEur < 50, "si elle coûtait des dizaines d'euros, elle ne serait pas offrable telle quelle");

  /**
   * ⚠ LA RÉSERVE EST OBLIGATOIRE, et c'est la règle du dépôt : jamais un taux
   * nu. Les bornes reposent sur des taux HYPOTHÉTIQUES (30 % de décroché,
   * 20 % d'intérêt) que le palier 10 doit mesurer. Seul le coût à la minute
   * est relevé. Sans cette phrase, la fourchette se lirait comme une mesure.
   */
  assert.match(c.reserve, /hypoth[ée]tiques|Fourchette, pas mesure/i);
});

test("chaque garantie dit sa LIMITE — jamais découverte sur la facture", () => {
  assert.ok(GARANTIES.length >= 2);
  for (const g of GARANTIES) {
    assert.ok(g.limite.length > 20, `« ${g.nom} » : une garantie sans bord écrit se retourne au premier litige`);
    assert.ok(g.coutSiActivee.length > 10, `« ${g.nom} » : on doit savoir ce qu'elle nous coûte avant de la promettre`);
  }
});

test("⚠ la rareté est un FAIT, pas un compteur inventé", () => {
  assert.match(RARETE.interdit, /jamais|inventé/i);
  // Aucun nombre de places : c'est précisément ce qui se vérifie au coup de
  // fil suivant et grille le vendeur pour de bon.
  assert.ok(!/\d+\s*places?/i.test(RARETE.phrase + RARETE.fait));
});

test("le prix arrive APRÈS la démonstration dans le déroulé", () => {
  /**
   * Règle dure du dépôt (`vital-signs`, `master-rappel`) : jamais de prix
   * avant la démo. Ce test l'impose à l'ordre du rendez-vous, pas seulement
   * au code qui l'applique — sinon la doctrine et le script divergent.
   */
  const demo = DEROULE.find((e) => /écoute|sonner|démonstration/i.test(e.titre + e.but))!;
  const prix = DEROULE.find((e) => /prix/i.test(e.titre))!;
  assert.ok(demo && prix, "le déroulé doit contenir la démonstration et le prix");
  assert.ok(demo.etape < prix.etape, "le prix ne se dit jamais avant que la valeur soit vue");
  assert.match(prix.but, /garantie/i, "et jamais sans la garantie qui l'accompagne");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CÂBLAGE — un export que rien ne consomme est mort, pas « prêt ».
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la garantie APPARAÎT dans l'argumentaire d'une fiche routée Alpha Voice", () => {
  const p = prospect({
    id: "voix",
    sector: "artisan",
    deepAudit: {
      websiteState: "",
      socialState: "",
      localCompetition: "",
      currentProcess: "",
      missedCallsPerWeek: 9,
      avgTicket: 350,
    },
  });
  const a = buildArgumentaire(p, "eagleye");
  assert.ok(a.garantie, "une fiche qui crie « appels manqués » doit porter la garantie");
  assert.equal(a.garantie!.nom, GARANTIES[0].nom);
  assert.ok(a.garantie!.limite.length > 20, "et sa limite, à côté");
});

test("⚠ une fiche SANS signal téléphonique ne se voit PAS inventer de garantie", () => {
  /**
   * La moitié qui manque au test précédent. Sans elle, `garantie: GARANTIES[0]`
   * en dur passerait au vert — la garde serait décorative.
   */
  const p = prospect({
    id: "visi",
    deepAudit: {
      websiteState: "aucun",
      socialState: "aucun",
      localCompetition: "",
      currentProcess: "",
      googleReviews: 2,
    },
  });
  const a = buildArgumentaire(p, "eagleye");
  assert.equal(a.garantie, null, "on n'attache pas une garantie vocale à une offre de visibilité");
});

test("⚠ la garantie est AFFICHÉE, collée au prix, pas seulement calculée", () => {
  const panel = sansCommentaires(lire("components/prospects/master-panel.tsx"));
  const i = panel.indexOf("argu.offer.price");
  assert.ok(i > 0, "le panneau doit afficher le prix");
  const bloc = panel.slice(i, i + 900);

  /**
   * ⚠ ON ASSERTE LA CONDITION, PAS LA PRÉSENCE.
   *
   * Une première version cherchait `argu.garantie` dans le bloc. La mutation
   * `{false && argu.garantie && (` passait au vert : le nom était là, le rendu
   * ne se produisait jamais. C'est le piège que ce dépôt collectionne, et il
   * s'est refermé ici pour la troisième fois de la session.
   */
  assert.match(
    bloc,
    /\{argu\.garantie && \(/,
    "le rendu doit être gardé par la garantie elle-même, sans condition parasite"
  );
  assert.ok(
    !/\bfalse\b/.test(bloc),
    "une condition constamment fausse rendrait l'affichage décoratif"
  );
  assert.match(bloc, /garantie\.promesse/, "la promesse doit être rendue, pas seulement son nom");
  assert.match(bloc, /garantie\.limite/, "et sa limite avec — une garantie sans bord se retourne au litige");
});

test("⚠ le coût de la garantie ne descend PAS dans le navigateur", () => {
  /**
   * `lib/voice-costs` porte nos marges. Le module de l'offre est atteint par
   * `master-panel`, donc par un chunk téléchargeable. La première version
   * important le coût dans le module d'offre a été attrapée par
   * `tests/vitrine-fuite.test.ts` — ce test-ci la fige au bon endroit.
   */
  const offre = lire("lib/offre-alpha-voice.ts");
  assert.ok(
    !/^import .*voice-costs/m.test(offre),
    "le module d'offre est côté client : il ne doit jamais importer notre modèle de coût"
  );
  assert.match(lire("lib/offre-alpha-voice-cout.ts"), /^import .*voice-costs/m, "le calcul vit côté serveur");
});
