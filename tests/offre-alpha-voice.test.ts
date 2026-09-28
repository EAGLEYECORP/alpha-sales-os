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

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LA GARANTIE OFFERTE DOIT ÊTRE BORNÉE — sinon elle est infalsifiable.
 *
 * « Vous ne payez pas si ça ne marche pas » sans bord, c'est une promesse
 * qu'un client peut activer au bout de trois jours en ayant coupé la ligne.
 * Trois bords, et ils se disent à l'oral :
 *   · une DURÉE (30 jours de ligne active) — sinon on ne saura jamais si
 *     l'agent a eu sa chance ;
 *   · un PÉRIMÈTRE (le setup, pas l'abonnement consommé) ;
 *   · un CRITÈRE (un rendez-vous PRIS, pas honoré) — qui vient et qui signe
 *     ne dépend plus de nous, et le promettre serait promettre son métier.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la garantie offerte porte ses trois bords : durée, périmètre, critère", () => {
  const forte = GARANTIES[0];
  assert.match(forte.limite, /30 jours/i, "sans durée, on ne sait jamais si l'agent a eu sa chance");
  assert.match(forte.limite, /setup/i, "le périmètre : l'installation, pas l'abonnement consommé");
  assert.match(forte.limite, /pris.*honor|honor.*pris/i, "un RDV pris n'est pas un RDV honoré");

  /**
   * ⚠ ET SON VRAI COÛT EST NOMMÉ. Les minutes ne sont pas le poste qui
   * compte : c'est le temps d'installation, fait à la main. Une garantie
   * dont on ne chiffre que la partie négligeable donne l'illusion qu'elle
   * est gratuite — et on en offre alors trop à la fois.
   */
  assert.match(forte.coutSiActivee, /installation/i, "le vrai coût est le temps d'installation");
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

test("⚠ le coût de la garantie est SERVI et AFFICHÉ, pas seulement calculé", () => {
  /**
   * ⚠ TROUVÉ PAR L'AUDIT DES EXPORTS ORPHELINS, DANS MON PROPRE CODE, ET POUR
   * LA TROISIÈME FOIS DE LA SESSION.
   *
   * `lib/offre-alpha-voice-cout.ts` était importé par ZÉRO fichier de
   * production. On chiffrait ce que coûte la garantie la plus engageante
   * qu'on fasse — et personne ne pouvait le lire sans rouvrir le code. Une
   * promesse dont on ne voit pas le prix se donne trop facilement.
   *
   * Il transite par `/api/voice-costs` (réservée au compte maître : le calcul
   * dérive de nos marges) et s'affiche dans le panneau de coût.
   */
  const route = sansCommentaires(lire("app/api/voice-costs/route.ts"));
  assert.match(route, /coutGarantiePremierRdv\(\)/, "la route doit servir le coût de la garantie");
  assert.match(route, /garantie: coutGarantiePremierRdv/, "et sous une clé que le panneau lit");

  const panel = sansCommentaires(lire("components/voice/cost-panel.tsx"));
  assert.match(panel, /data\.garantie\.basEur/, "le panneau doit AFFICHER la fourchette");
  assert.match(panel, /data\.garantie\.hautEur/);
  assert.match(panel, /data\.garantie\.reserve/, "et la réserve : une fourchette nue se lit comme une mesure");

  /**
   * ⚠ ET L'AVERTISSEMENT QUI VA AVEC. Afficher « 1,91 € – 8,45 € » tout seul
   * rassure à tort : le vrai poste est la demi-journée d'installation. Le
   * chiffre sans cette phrase pousse à offrir la garantie trop largement.
   */
  const i = panel.indexOf("data.garantie.basEur");
  assert.match(
    panel.slice(i, i + 700),
    /installation/i,
    "le vrai coût (le temps d'installation) doit être dit à côté du chiffre"
  );
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

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ UN PRIX NE S'ÉCRIT QU'À UN ENDROIT — ailleurs, il se CALCULE.
 *
 * Trouvé en regardant une fiche prospect au navigateur : `lib/segments.ts`
 * affichait « 990 € HT installation + abonnement au volume » en dur, à côté
 * de `lib/offres-publiques.ts`. Deuxième source. Elle est restée vraie par
 * CHANCE quand la grille est passée de cinq paliers à deux — le setup n'avait
 * pas bougé. Elle aurait menti au premier changement de setup, sur l'écran que
 * l'opérateur montre au prospect.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ le prix affiché sur la fiche DÉRIVE de la grille, il ne la recopie pas", async () => {
  const { SEGMENTS } = await import("../lib/segments");
  const { ALPHA_VOICE_PALIERS, ALPHA_VOICE_SETUP_HT } = await import("../lib/offres-publiques");

  /**
   * ⚠ On cible le segment par son IDENTIFIANT, pas par le contenu de son
   * prix : chercher « installation » attrapait le segment « centre d'appels »,
   * qui vend le SORTANT au volume et porte donc un autre montant. Un test qui
   * choisit sa cible par le texte qu'il vérifie ne vérifie rien.
   */
  const seg = SEGMENTS.find((s) => s.id === "commerce-local")!;
  assert.ok(seg, "le segment du commerce local doit exister");
  assert.equal(seg.offer, "alpha-voice");

  // La CONDITION : les montants affichés sont ceux de la grille, pas des
  // jumeaux qui lui ressemblent aujourd'hui.
  assert.ok(seg.dealRange.includes(String(ALPHA_VOICE_SETUP_HT)), "le setup doit venir de la grille");
  assert.ok(
    seg.dealRange.includes(String(ALPHA_VOICE_PALIERS[0].prixHT)),
    "le plancher aussi — c'est lui qui vient de changer"
  );
  assert.ok(
    seg.dealRange.includes(String(ALPHA_VOICE_PALIERS[ALPHA_VOICE_PALIERS.length - 1].prixHT)),
    "et le plafond"
  );

  /**
   * ⚠ CE QUE CE TEST NE GARDE PAS, ET POURQUOI — dit ici plutôt que découvert.
   *
   * Les AUTRES `dealRange` du fichier portent encore des montants en dur
   * (10 000 € VIP, 3 500 € + 364 €/mois du sortant). Ils viennent de
   * `lib/bricks.ts`, un module SERVEUR : le faire lire par `segments`, qui
   * descend dans le navigateur, publierait tout notre catalogue — la
   * tentative a été faite et `tests/vitrine-fuite` l'a refusée, à raison.
   *
   * La correction propre est de remonter les prix PUBLICS du sortant dans
   * `lib/offres-publiques.ts`, comme pour Alpha Voice. Tant que ce n'est pas
   * fait, ce sont deux sources, et ce test le sait au lieu de l'ignorer.
   *
   * On garde donc UNIQUEMENT ce qui est dérivable aujourd'hui : la ligne du
   * commerce local ne doit pas redevenir un littéral.
   */
  const src = sansCommentaires(lire("lib/segments.ts"));
  const i = src.indexOf('id: "commerce-local"');
  assert.ok(i > 0);
  const bloc = src.slice(i, src.indexOf("},", src.indexOf("dealRange", i)));
  assert.match(bloc, /dealRange:\s*`/, "la ligne du commerce local doit être un gabarit calculé, pas une chaîne figée");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE JEU DE DÉMONSTRATION DOIT POUVOIR MONTRER LE PRODUIT.
 *
 * Trouvé en vérifiant, la veille d'une démonstration client, ce qui
 * s'afficherait vraiment : **0 des 8 fiches de démo routaient vers Alpha
 * Voice**. Une seule occurrence de `deepAudit` existait dans `lib/seed.ts` —
 * la valeur NEUTRE de `prospectDefaults`. Chaque fiche retombait dessus, donc
 * le routeur n'avait aucun signal et renvoyait « visibilité » huit fois.
 *
 * Conséquence : le diagnostic central du produit, le chiffrage de la perte,
 * la marche 2 de l'escalier et la garantie ne s'affichaient NULLE PART — sur
 * le jeu de données dont le seul rôle est de montrer le produit. Le code
 * était juste ; il n'avait simplement jamais de quoi s'exécuter.
 *
 * ⚠ Rien n'a été inventé pour corriger : la prose de ces deux fiches
 * affirmait déjà « 12 appels manqués/semaine ». Les chiffres sont passés du
 * texte libre au champ structuré, celui que le routeur lit.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ le jeu de démo route au moins une fiche vers Alpha Voice, garantie comprise", async () => {
  const { seedProspects } = await import("../lib/seed");
  const { deepDive } = await import("../lib/deep-dive");

  const voix = seedProspects.filter((p) => deepDive(p, "eagleye").offer === "alpha-voice");
  assert.ok(
    voix.length >= 2,
    `seulement ${voix.length} fiche(s) vocale(s) : une démonstration ne tient pas sur un cas unique`
  );

  for (const p of voix) {
    const a = buildArgumentaire(p, "eagleye");
    assert.ok(a.garantie, `${p.company} : routée Alpha Voice mais sans garantie affichée`);

    /**
     * ⚠ ON EXIGE LE CHAMP STRUCTURÉ, PAS SEULEMENT « une perte chiffrée ».
     *
     * Une première version se contentait de `losses.measured`. Une mutation
     * qui vidait `missedCallsPerWeek` des deux fiches passait au vert :
     * `computeLosses` retombait sur `ignoranceTax`, déjà présent sur ces
     * fiches pour d'autres raisons. Le test validait donc un chiffre qui ne
     * venait PAS de l'audit — exactement le trou qu'il devait fermer.
     *
     * Et une seconde mutation survivait aussi : une fiche restait routée
     * vocale par son seul secteur, ce qui suffisait à `voix.length >= 1`.
     * D'où les deux durcissements : au moins DEUX fiches, et le champ que le
     * routeur lit vraiment.
     */
    assert.ok(
      typeof p.deepAudit?.missedCallsPerWeek === "number" && p.deepAudit.missedCallsPerWeek > 0,
      `${p.company} : l'audit doit porter les appels manqués dans le champ STRUCTURÉ, pas seulement dans la prose`
    );
    assert.ok(
      a.losses.measured,
      `${p.company} : la perte doit être CHIFFRÉE sur ses données — c'est l'étape 2 du rendez-vous`
    );
  }
});

test("⚠ le jeu de démo garde aussi une fiche NON vocale", () => {
  /**
   * La moitié qui manque. Remplir l'audit de toutes les fiches avec des appels
   * manqués ferait passer le test précédent au vert en supprimant la variété —
   * et une démonstration où tout route vers la même offre ne montre pas le
   * routage, elle le cache.
   */
  const offres = new Set(seedProspectsSync().map((p) => deepDiveSync(p).offer));
  assert.ok(offres.size >= 2, `toutes les fiches routent vers la même offre (${[...offres].join(", ")})`);
});

// Imports synchrones pour le second test (le premier les charge à la demande).
import { seedProspects as _seed } from "../lib/seed";
import { deepDive as _dd } from "../lib/deep-dive";
const seedProspectsSync = () => _seed;
const deepDiveSync = (p: (typeof _seed)[number]) => _dd(p, "eagleye");
