import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMIS_DEMO, prospectDefaults } from "../lib/seed";
import { permisVersProspect, trierPermis } from "../lib/permis-construire";
import { deepDive } from "../lib/deep-dive";
import { pickMagnet } from "../lib/lead-magnet";
import { approcheEcrite } from "../lib/approche-ecrite";
import { matchOffer } from "../lib/offer-match";
import { offreDeLaVerticale, verticalForProspect } from "../lib/playbook";
import { estMesure } from "../lib/mesure-champ";
import { verticalForSector } from "../lib/playbook";
import type { Prospect, Sector } from "../lib/types";

/**
 * Les six secteurs de l'app, écrits ici pour que l'ajout d'un septième fasse
 * tomber le test au lieu de passer inaperçu — `Sector` est une union, il n'y a
 * rien à énumérer à l'exécution.
 */
const SECTEURS_TESTES: Sector[] = ["maitrise-ouvrage", "restaurant", "pub", "ambulance", "artisan", "autre"];

/**
 * ─────────────────────────────────────────────────────────────────────
 * TOUTES LES FICHES DE NOTRE ICP PARTAIENT SUR LA MAUVAISE OFFRE — 17/09/2026.
 *
 * ══ CE QUI A ÉTÉ MESURÉ ══
 *
 * En partant d'un arrêté de permis et en allant jusqu'à l'aimant servi :
 * **8 fiches sur 8** recevaient l'offre Visibilité / Growth, alors que leur
 * verticale (`maitrise-ouvrage`) sert l'OS de vente. Le message d'approche
 * s'ouvrait donc sur « quelqu'un qui cherche du neuf dans le quartier tombe
 * sur votre programme » — un sujet qu'aucun de ces prospects n'a soulevé, et
 * sur lequel nous n'avions RIEN relevé.
 *
 * ══ LA CAUSE, ET ELLE EST DANS UN GARDE QUI SE CROYAIT ARMÉ ══
 *
 * `matchOffer` testait `sig.websiteState !== undefined` avec, en commentaire,
 * l'intention exacte : « Donnée ABSENTE (undefined) ≠ signal : on ne score que
 * ce qui est mesuré ». Mais `DeepAudit` déclare `websiteState` en `string`
 * OBLIGATOIRE, et `prospectDefaults.deepAudit` — le socle de TOUS les imports,
 * pas un jeu de démonstration — écrit `""`. Le champ est donc toujours défini.
 * **La condition gardait un état que le type rend impossible**, et
 * `weakWebsite("")` rendait `true` : +3 « site absent ou obsolète », sur chaque
 * fiche importée du produit.
 *
 * Même famille que `AngleKey = Exclude<Sector, "autre">` : un type qui rend
 * fausse la garde écrite à côté de lui.
 *
 * ⚠ Et l'escalier, lui, répondait JUSTE sur les mêmes fiches — `filled()` avant
 * de conclure. Deux définitions de « son site est-il un problème ? », deux
 * réponses opposées, même produit, même fiche.
 *
 * ══ LA RÈGLE QUI EN SORT, ET ELLE EST DISSYMÉTRIQUE ══
 *
 * **Un signal MESURÉ peut contredire la verticale ; un vide ne le peut pas.**
 * Un maître d'ouvrage dont on a CONSTATÉ l'absence de site part sur la
 * visibilité — c'est la 1re marche de l'escalier et elle revient au même
 * compte. Sans rien de mesuré, c'est la verticale qui tranche, plus un ordre
 * de départage écrit en dur.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠⚠ DE L'ARRÊTÉ JUSQU'À L'AIMANT SERVI, AUCUNE FICHE ICP NE CHANGE D'OFFRE", () => {
  /**
   * ⚠ LA CHAÎNE, PAS LES MAILLONS. Ce dépôt a déjà payé d'avoir testé
   * `matchOffer` seul : trois tests verts pendant que la fiche réelle — celle
   * que `permisVersProspect` fabrique, avec ses `""` — partait ailleurs. On
   * repart donc de l'ARRÊTÉ, on passe par le vrai trieur, la vraie conversion,
   * le vrai deep-dive, et on va jusqu'à l'aimant que le prospect reçoit.
   */
  const lot = trierPermis([...PERMIS_DEMO]);
  assert.ok(lot.retenus.length >= 6, "le jeu d'arrêtés doit fournir de la matière");

  const fautes: string[] = [];
  for (const r of lot.retenus) {
    const p = permisVersProspect(r.permis, r.ciblage);
    const v = verticalForProspect(p);
    const attendue = offreDeLaVerticale(v);
    assert.ok(attendue, `${p.company} : aucune verticale — le tag posé à l'import doit la donner`);

    const d = deepDive(p);
    const aimant = pickMagnet(p);
    if (d.offer !== attendue) fautes.push(`${p.company} : deep-dive ${d.offer} ≠ verticale ${attendue}`);
    if (aimant && aimant.magnet.offer !== attendue)
      fautes.push(`${p.company} : aimant ${aimant.magnet.offer} ≠ verticale ${attendue}`);
  }

  assert.deepEqual(
    fautes,
    [],
    "Une fiche de notre ICP reçoit une offre que sa verticale ne sert pas.\n  " + fautes.join("\n  "),
  );
});

test("⚠⚠ LE VIDE N'EST PAS UN SIGNAL — c'est le défaut exact qui a été payé", () => {
  /**
   * La mutation la plus utile de ce fichier : remettre `!t → true` dans
   * `weakWebsite` fait tomber celui-ci, et lui seul dit POURQUOI.
   *
   * On passe la valeur que le produit écrit réellement, pas une valeur
   * choisie pour le test : `prospectDefaults.deepAudit.websiteState`.
   */
  assert.equal(prospectDefaults.deepAudit.websiteState, "", "le socle écrit bien une chaîne vide");
  assert.equal(estMesure(prospectDefaults.deepAudit.websiteState), false);

  const m = matchOffer({
    sector: "maitrise-ouvrage",
    websiteState: prospectDefaults.deepAudit.websiteState,
    socialState: prospectDefaults.deepAudit.socialState,
  });
  assert.equal(m.scores["visibilite-growth"], 0, "un champ jamais relevé ne doit rien scorer");
  assert.deepEqual(m.reasons["visibilite-growth"], [], "…et surtout ne fabriquer aucune RAISON à dire");
  assert.equal(m.sansSignal, true, "rien n'est mesuré : le routage vient d'un défaut, et il le dit");
});

test("⚠ « AUCUN » RESTE UN SIGNAL, ET C'EST MÊME LE PLUS FORT", () => {
  /**
   * Le contre-test obligatoire. Sans lui, « le vide ne score pas » serait
   * satisfait par une fonction qui ne score JAMAIS rien — et on aurait
   * désarmé la détection de visibilité en croyant la réparer.
   *
   * « aucun » veut dire que quelqu'un est allé voir. C'est une observation.
   */
  const m = matchOffer({ sector: "maitrise-ouvrage", websiteState: "aucun", socialState: "aucun" });
  assert.ok(m.scores["visibilite-growth"] > 0, "un constat d'absence est une mesure");
  assert.equal(m.sansSignal, false);
  assert.equal(m.primary, "visibilite-growth", "et il a le droit de contredire la verticale");
});

test("⚠⚠ UN SIGNAL MESURÉ PRIME SUR LA VERTICALE — la dissymétrie est la règle", () => {
  /**
   * Le défaut par verticale ne doit JAMAIS renverser une observation. S'il le
   * faisait, on aurait remplacé un routage aveugle par un routage sourd : une
   * fiche de maîtrise d'ouvrage sans site n'entendrait plus jamais parler de
   * visibilité, alors que c'est la 1re marche de l'escalier.
   */
  const mesure = matchOffer(
    { sector: "maitrise-ouvrage", websiteState: "aucun" },
    undefined,
    "alpha-sales-os",
  );
  assert.equal(mesure.primary, "visibilite-growth", "le défaut ne renverse pas ce qui est mesuré");

  /**
   * ⚠⚠ CE CAS A DÛ ÊTRE RÉÉCRIT APRÈS UNE MUTATION QUI N'A PAS MORDU, ET
   * C'EST LA LEÇON LA PLUS UTILE DE CE FICHIER.
   *
   * Première rédaction : `defautSansSignal: "alpha-sales-os"`, assertion
   * `primary === "alpha-sales-os"`. Elle passait AUSSI en débranchant
   * complètement la verticale — parce que `alpha-sales-os` est justement le
   * défaut écrit en dur. **L'assertion était satisfaite par la coïncidence que
   * le code existant produit déjà**, exactement le travers que la doctrine
   * nomme (« asserter la PRÉSENCE du refus au lieu de la CONDITION »).
   *
   * On demande donc un défaut que le code ne rendrait JAMAIS tout seul.
   */
  const rien = matchOffer({ sector: "maitrise-ouvrage" }, undefined, "alpha-voice");
  assert.equal(rien.primary, "alpha-voice", "sans mesure, c'est la verticale qui tranche — pas un ordre en dur");
  assert.notEqual(
    matchOffer({ sector: "maitrise-ouvrage" }).primary,
    "alpha-voice",
    "…et sans verticale fournie, le code rend bien autre chose : la mutation a donc de quoi mordre",
  );

  /**
   * ⚠ Et le défaut ne franchit pas le périmètre d'offre du compte : sur un
   * compte mono-offre, la marque du partenaire ne se voit jamais proposer
   * autre chose, quelle que soit la verticale de la fiche.
   */
  const contraint = matchOffer({ sector: "maitrise-ouvrage" }, ["alpha-voice"], "alpha-sales-os");
  assert.equal(contraint.primary, "alpha-voice", "le compte borne le routage avant la verticale");
});

test("⚠⚠ LE DEEP-DIVE PASSE VRAIMENT LA VERTICALE — pas seulement `matchOffer` en théorie", () => {
  /**
   * ══ LE BRANCHEMENT, TESTÉ SUR LA SEULE FAMILLE QUI PEUT LE PROUVER ══
   *
   * La chaîne ICP ne suffit PAS à garder cette ligne : la maîtrise d'ouvrage
   * sert `alpha-sales-os`, qui est aussi le défaut écrit en dur. Débrancher la
   * verticale du deep-dive laissait donc les huit fiches au bon endroit — et
   * six tests verts. Mesuré par mutation, pas déduit.
   *
   * Il faut une fiche dont la verticale sert une AUTRE offre et sur laquelle
   * rien n'est mesuré. Un garage en secteur `autre` (le secteur ne déclenche
   * alors aucun mot-clé), verticale posée par TAG — le chemin déterministe.
   */
  const garage: Prospect = {
    ...prospectDefaults,
    id: "demo-branchement",
    name: "Contact (démo)",
    company: "Atelier (démo)",
    sector: "autre",
    city: "Lyon",
    stage: "prospect",
    tags: ["garage-carrosserie"],
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
  };

  const v = verticalForProspect(garage);
  assert.equal(v?.id, "garage-carrosserie", "le tag doit poser la verticale, jamais le texte");
  assert.equal(offreDeLaVerticale(v), "alpha-voice", "et cette verticale sert une AUTRE offre que le défaut");

  const m = matchOffer({ sector: "autre" });
  assert.equal(m.sansSignal, true, "le jeu d'essai doit bien être sans aucun signal mesuré");
  assert.equal(m.primary, "alpha-sales-os", "…et le défaut nu rendrait la mauvaise offre");

  assert.equal(
    deepDive(garage).offer,
    "alpha-voice",
    "le deep-dive doit transmettre la verticale à `matchOffer` — sinon ce prospect part sur l'OS de vente",
  );
});

test("⚠⚠ UNE SEULE DÉFINITION DE « CE CHAMP EST-IL MESURÉ ? »", () => {
  /**
   * C'est la divergence entre `ladder` et `offer-match` qui a produit le bug.
   * Les trois modules qui posent la question l'importent maintenant ; une
   * quatrième copie locale la ferait revenir.
   *
   * ⚠ On cherche la DÉCLARATION d'une fonction locale, pas le mot `filled` :
   * l'alias `const filled = estMesure` est justement ce qu'on veut autoriser.
   */
  for (const f of ["lib/offer-match.ts", "lib/deep-dive.ts", "lib/ladder.ts"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.match(src, /from "\.\/mesure-champ"/, `${f} doit importer la définition commune`);
    assert.ok(
      !/function filled\s*\(|const filled\s*=\s*\(/.test(src),
      `${f} redéclare « filled » — c'est cette copie qui a divergé et routé 8 fiches sur 8 à côté`,
    );
  }

  /**
   * ⚠ DEUX COPIES SURVIVENT, NOMMÉES AVEC LEUR MOTIF. `master-rappel` et
   * `checkpoints` utilisent la version FAIBLE (`Boolean(trim())`, sans la
   * liste « n/a · - · inconnu »). Les basculer changerait le comportement de
   * leurs écrans, que je n'ai pas mesurés. Les taire ferait croire à une
   * source unique qui n'existe pas.
   */
  for (const f of ["lib/master-rappel.ts", "lib/checkpoints.ts"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.match(src, /const filled/, `${f} porte encore sa copie faible — à trancher avec une mesure`);
  }
});

test("⚠⚠ LE MESSAGE SERVI À UN PROSPECT ICP NE DÉCLENCHE AUCUN INTERDIT DE SA VERTICALE", () => {
  /**
   * ══ LE MAILLON QUI MANQUAIT ══
   *
   * Le routage n'est pas une donnée interne : il décide de la PHRASE. Tant
   * qu'une fiche partait sur Alpha Voice, `approcheEcrite` servait la question
   * « Vous aimeriez savoir qui a appelé votre bureau de vente pendant que
   * l'équipe était en visite ? » — l'angle accueil téléphonique, à un maître
   * d'ouvrage dont la verticale interdit en toutes lettres « vous ratez des
   * appels ».
   *
   * ⚠ Les motifs exécutables ne l'attrapaient PAS : c'est une reformulation,
   * et « un garde par motif n'attrape que ce qu'on a déjà vu ». On croise donc
   * quand même — ce qui tient ici, c'est surtout que l'offre est la bonne.
   */
  const lot = trierPermis([...PERMIS_DEMO]);
  for (const r of lot.retenus.slice(0, 4)) {
    const p = permisVersProspect(r.permis, r.ciblage);
    const v = verticalForProspect(p);
    assert.ok(v, "la fiche doit porter sa verticale");
    const a = approcheEcrite(p);
    const textes = [a.question, a.critere, a.critereMetier ?? ""];
    for (const i of v.forbidden ?? []) {
      if (!i.motif) continue; // interdit de JUGEMENT : aucun motif exécutable
      for (const t of textes) {
        assert.ok(!i.motif.test(t), `${p.company} — « ${i.regle} » déclenché par : « ${t} »`);
      }
    }
  }
});

test("⚠ UNE FICHE SANS VERTICALE NE SE VOIT PAS INVENTER UN DÉFAUT", () => {
  /**
   * `offreDeLaVerticale(null)` rend `undefined`, pas « alpha-voice ». Le repli
   * historique ne vaut que pour une verticale RÉELLE dont le champ n'est pas
   * déclaré ; l'appliquer à une fiche sans verticale inventerait une réponse
   * là où il n'y a pas de question.
   */
  assert.equal(offreDeLaVerticale(null), undefined);

  /**
   * ⚠ ÉTAT MESURÉ, ET IL VAUT MIEUX QUE MA PREMIÈRE RÉDACTION. J'ai d'abord
   * écrit ce test avec une fiche « orpheline » en secteur `autre` — il est
   * tombé : la verticale `generique` couvre ce secteur. **Aucune fiche réelle
   * ne peut donc être sans verticale**, `verticalForSector` ayant toujours une
   * réponse. La branche `undefined` est défensive, pas un cas de production,
   * et l'écrire ici évite qu'une session future la croie atteignable et
   * raisonne dessus.
   */
  for (const s of SECTEURS_TESTES) {
    assert.ok(
      offreDeLaVerticale(verticalForSector(s)),
      `le secteur « ${s} » doit résoudre une verticale, sinon le routage n'a rien à quoi se raccrocher`,
    );
  }
});
