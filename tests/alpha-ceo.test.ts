import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  anglesMorts,
  diagnostiquer,
  PANNES,
  parNature,
  POINTS,
  type EtatSysteme,
} from "../lib/alpha-ceo";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA CEO — et le piège que porte son propre nom.
 *
 * La référence donnée était « une version meilleure et plus légère de
 * paperclip AI ». Le maximiseur de trombones est l'histoire canonique d'un
 * optimiseur qui détruit tout en poursuivant un objectif unique sans regarder
 * ses contraintes. Ces tests sont ce qui empêche Alpha CEO d'en devenir un.
 * ─────────────────────────────────────────────────────────────────────
 */

const VIDE: EtatSysteme = {
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
    enveloppe: null,
};

// ═══════════ LA CARTE ═══════════

test("⚠ tout point HUMAIN porte la RAISON de l'être", () => {
  /**
   * ⚠ SANS CE CHAMP, LA CARTE S'AUTO-DÉTRUIT EN SIX MOIS.
   *
   * Un point marqué « humain » sans raison écrite se lit comme un retard
   * d'automatisation. La session suivante l'optimisera en croyant finir le
   * travail — et cassera précisément ce qui distingue cet outil d'un
   * envoyeur de masse. La raison n'est pas de la documentation : c'est ce
   * qui rend la décision reproductible.
   */
  for (const p of POINTS) {
    if (p.nature === "automatisable") continue;
    assert.ok(
      p.pourquoi.length > 60,
      `« ${p.id} » est humain sans raison écrite — il sera automatisé par erreur`
    );
  }
});

test("⚠ les points HUMAINS sont MAJORITAIRES, et ce n'est pas un échec", () => {
  /**
   * La demande était « automatiser au max ». Ce test dit le contraire de ce
   * qu'on attendrait, et c'est le résultat honnête : la plupart des points
   * humains restants ne sont pas un retard à rattraper, ils sont le produit.
   *
   * Si un jour ce test tombe parce que la majorité est devenue automatisable,
   * il faudra le relire ligne par ligne — pas le supprimer. Chaque bascule
   * doit être défendue individuellement.
   */
  const auto = parNature("automatisable").length;
  const decision = parNature("humain-par-decision").length;
  const contrainte = parNature("humain-par-contrainte").length;
  assert.equal(auto + decision + contrainte, POINTS.length, "toute nature doit être couverte");
  assert.ok(
    decision + contrainte > auto,
    `${auto} automatisables contre ${decision + contrainte} humains : si l'automatisable passe devant, chaque bascule doit être justifiée`
  );
});

test("⚠ AUCUN point de la doctrine dure n'est marqué automatisable", () => {
  /**
   * ⚠ LA GARDE CENTRALE DU MODULE. Trois points sont écrits noir sur blanc
   * dans la doctrine comme non automatisables :
   *
   *  · la validation de palier — « Automatique = le REFUS » ;
   *  · les points déclaratifs — les cocher sans leur condition FABRIQUE la
   *    preuve ;
   *  · les poids de calibration — sur quarante appels, un ajustement
   *    automatique apprend le bruit et le grave dans le tri.
   *
   * Mutation vérifiée : passer l'un des trois en `automatisable` fait tomber
   * ce test.
   */
  for (const id of ["validation-palier", "points-declaratifs", "poids-calibration"]) {
    const p = POINTS.find((x) => x.id === id)!;
    assert.ok(p, `${id} doit figurer dans la carte`);
    assert.notEqual(p.nature, "automatisable", `${id} : la doctrine l'interdit explicitement`);
  }
});

test("⚠ ce que la LOI impose reste `humain-par-contrainte`", () => {
  /**
   * Distinct du précédent : ceux-là ne sont même pas notre choix. Les
   * reclasser en « décision » laisserait croire qu'on pourrait en discuter.
   */
  for (const id of ["tampon-partenaire", "article-50", "statut-apporteur"]) {
    const p = POINTS.find((x) => x.id === id)!;
    assert.equal(p.nature, "humain-par-contrainte", `${id} : c'est la loi ou un tiers, pas nous`);
    assert.equal(p.gravite, "urgent", `${id} : une contrainte légale ignorée ne se rattrape pas`);
  }
});

test("chaque point et chaque panne nomme un module ou un doc QUI EXISTE", () => {
  /**
   * ⚠ Le pendant du défaut récurrent, côté carte : une référence morte rend
   * le « micro » impossible. Quelqu'un clique pour aller voir, et il n'y a
   * rien — donc il conclut que la carte est périmée, donc il cesse de la
   * lire.
   */
  for (const ref of [...POINTS.map((p) => p.module), ...PANNES.map((p) => p.module)]) {
    assert.ok(existsSync(join(process.cwd(), ref)), `« ${ref} » n'existe pas : le micro mène nulle part`);
  }
});

// ═══════════ LES PANNES SILENCIEUSES ═══════════

test("⚠ chaque panne dit POURQUOI elle est invisible", () => {
  /**
   * C'est le champ qui porte toute la valeur du relevé. « L'email n'arrive
   * pas » ne sert à rien ; « l'inscription RÉUSSIT côté Supabase, l'écran dit
   * vérifie tes emails, et c'est vrai — sauf que le SMTP par défaut ne
   * délivre qu'au propriétaire » dit où chercher.
   */
  for (const p of PANNES) {
    assert.ok(p.pourquoiInvisible.length > 80, `« ${p.id} » : sans explication, la panne reste invisible`);
    assert.ok(p.detection.length > 20, `« ${p.id} » : une panne sans moyen de détection n'est qu'une inquiétude`);
  }
});

test("les pannes qui coûtent quelque chose d'IRRÉCUPÉRABLE sont urgentes", () => {
  /**
   * Réputation d'expéditeur, conformité, données perdues : trois choses
   * qu'aucun correctif ne rend. Les classer « à traiter » les mettrait en
   * dessous de tâches rattrapables.
   */
  for (const id of ["smtp-absent", "spf-casse", "stockage-sature", "pipe-non-charge", "plafond-decret"]) {
    const p = PANNES.find((x) => x.id === id)!;
    assert.equal(p.gravite, "urgent", `${id} : ce qui se perd ici ne se récupère pas`);
  }
});

// ═══════════ LE DIAGNOSTIC ═══════════

test("⚠ « PAS MESURÉ » NE PRODUIT AUCUNE ALERTE", () => {
  /**
   * ⚠ LA RÈGLE LA PLUS IMPORTANTE DU DIAGNOSTIC, et celle qu'on enfreint
   * sans y penser. « Je n'ai pas regardé » n'est pas « tout va bien » — mais
   * ce n'est pas non plus une panne. Alarmer sur une absence de mesure
   * remplirait l'écran de rouge le premier jour, et on apprendrait à ne plus
   * le lire. C'est comme ça qu'un tableau de bord meurt.
   *
   * L'angle mort se DIT, ailleurs et autrement.
   */
  assert.deepEqual(diagnostiquer(VIDE), [], "un état non mesuré ne doit rien alarmer");
  assert.ok(anglesMorts(VIDE).length >= 5, "…mais il doit se DIRE, explicitement");
});

test("mesuré et FAUX alerte ; mesuré et VRAI se tait", () => {
  // La moitié qui prouve que le test précédent ne cache pas un module inerte.
  const casse = { ...VIDE, smtpConfigure: false };
  assert.equal(diagnostiquer(casse).length, 1);
  assert.equal(diagnostiquer(casse)[0].id, "smtp-absent");

  assert.deepEqual(diagnostiquer({ ...VIDE, smtpConfigure: true }), [], "configuré = rien à dire");
});

test("⚠ L'URGENT PASSE EN PREMIER — l'ordre est la moitié du produit", () => {
  /**
   * Une liste non triée se lit dans l'ordre d'écriture du code, donc au
   * hasard. Celui qui la parcourt traite ce qui est en haut : si le haut
   * n'est pas le plus coûteux, l'écran fait PERDRE du temps.
   *
   * Mutation vérifiée : retirer le `sort` fait tomber ce test.
   */
  const tout: EtatSysteme = {
    smtpConfigure: false,
    prixStripeConfigures: false,
    stockage: "sature",
    pipeSynchronisable: false,
    brouillonsEnAttente: 3,
    fichesSansProchaineAction: 12,
    palierEnAttente: true,
    autopilote: "non-configure",
    agentVocal: null,
    ciblesAuPlafond: null,
    enveloppe: null,
  };
  const a = diagnostiquer(tout);
  const rang = { urgent: 0, "a-traiter": 1, info: 2 } as const;
  for (let i = 1; i < a.length; i++) {
    assert.ok(rang[a[i].gravite] >= rang[a[i - 1].gravite], "les alertes doivent être triées par gravité");
  }
  assert.equal(a[0].gravite, "urgent");
});

test("⚠ une alerte qui attend une DÉCISION le dit — sinon on attend qu'Alpha agisse", () => {
  /**
   * La différence entre « Alpha va s'en occuper » et « Alpha attend que tu
   * tranches » n'est pas cosmétique : c'est la différence entre une tâche
   * faite et une tâche qui dort. Sans ce drapeau, la validation de palier
   * reste en attente jusqu'à ce que quelqu'un se demande pourquoi rien ne
   * bouge.
   */
  const a = diagnostiquer({ ...VIDE, palierEnAttente: true, brouillonsEnAttente: 2 });
  const palier = a.find((x) => x.id === "validation-palier")!;
  assert.equal(palier.humain, true, "un palier ne se valide jamais tout seul");
  const relecture = a.find((x) => x.id === "relecture-avant-envoi")!;
  assert.equal(relecture.humain, true, "le bouton d'envoi reste une main");

  // Et l'inverse : ce qu'Alpha peut faire n'est pas marqué « humain ».
  const auto = diagnostiquer({ ...VIDE, fichesSansProchaineAction: 5 }).find((x) => x.id === "prochaine-action")!;
  assert.equal(auto.humain, false);
});

test("chaque alerte porte une ACTION à l'impératif", () => {
  // Une alerte sans verbe ne se traite pas : elle informe et elle reste.
  const a = diagnostiquer({
    smtpConfigure: false,
    prixStripeConfigures: false,
    stockage: "critique",
    pipeSynchronisable: false,
    brouillonsEnAttente: 1,
    fichesSansProchaineAction: 1,
    palierEnAttente: true,
    autopilote: "non-configure",
    agentVocal: null,
    ciblesAuPlafond: null,
    enveloppe: null,
  });
  assert.ok(a.length >= 6);
  for (const x of a) {
    assert.ok(x.action.length > 20, `« ${x.id} » : action trop courte pour être suivie`);
    assert.ok(x.ecran.startsWith("/"), `« ${x.id} » : il faut un écran où aller`);
  }
});

// ═══════════ LE PIÈGE DU NOM ═══════════

test("⚠ ALPHA CEO NE RETIRE AUCUNE GARDE — le piège du maximiseur", () => {
  /**
   * ⚠ CE TEST GARDE UNE INTENTION, ET C'EST ASSUMÉ.
   *
   * « Une version meilleure et plus légère de paperclip AI » — le maximiseur
   * de trombones est l'histoire d'un optimiseur qui détruit tout en
   * poursuivant un objectif unique sans regarder ses contraintes. Un Alpha
   * CEO qui optimiserait « plus de rendez-vous » ferait trois choses que la
   * doctrine interdit déjà, chacune pour une raison payée : appeler hors
   * fenêtre, dépasser le plafond du décret, envoyer plus vite que ce que la
   * réputation encaisse.
   *
   * Ce module est donc un LECTEUR : il diagnostique, il ordonne, il prépare.
   * Il ne doit contenir aucun verbe d'exécution. Le jour où il enverra,
   * appellera ou validera, il faudra une garde par action — pas une
   * fonction de plus dans ce fichier.
   */
  const src = readFileSync(join(process.cwd(), "lib/alpha-ceo.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const verbe of ["fetch(", "sendMail", "envoyer(", "appeler(", "valider(", "process.env"]) {
    assert.ok(
      !src.includes(verbe),
      `« ${verbe} » dans alpha-ceo : ce module diagnostique, il n'agit pas. Une action demande sa propre garde.`
    );
  }
});

test("⚠ la carte est CITÉE quelque part — sinon c'est un module mort de plus", () => {
  /**
   * Le défaut récurrent du dépôt, appliqué au module qui existe pour le
   * détecter. Ce serait la plus belle ironie du fichier.
   */
  const doc = readFileSync(join(process.cwd(), "docs/ALPHA-CEO.md"), "utf8");
  assert.match(doc, /lib\/alpha-ceo\.ts/, "la doctrine doit nommer le module");
  // Et le doc doit couvrir les trois natures, sinon il décrit autre chose.
  for (const n of ["automatisable", "humain-par-decision", "humain-par-contrainte"]) {
    assert.match(doc, new RegExp(n), `le doc doit expliquer la nature « ${n} »`);
  }
});
