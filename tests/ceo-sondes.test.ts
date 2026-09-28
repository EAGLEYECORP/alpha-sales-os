import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { etatDepuisSondes, sansProchaineAction, type EntreeSondes } from "../lib/ceo-sondes";
import { anglesMorts, diagnostiquer } from "../lib/alpha-ceo";
import { etatChemin } from "../lib/verrous";
import { prospectDefaults } from "../lib/seed";
import type { CampaignDraft, DraftStatus, Prospect, Stage } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BRANCHEMENT D'ALPHA CEO.
 *
 * `tests/alpha-ceo.test.ts` prouve que le DIAGNOSTIC est juste. Ce fichier
 * prouve l'autre moitié, celle que ce dépôt rate le plus souvent : que les
 * sondes réelles arrivent jusqu'à lui, et qu'elles arrivent SANS SE FAIRE
 * DÉFORMER en route.
 *
 * La déformation redoutée n'est pas théorique : elle transforme « je n'ai pas
 * pu regarder » en « c'est cassé ». Un `Boolean()` de trop suffit.
 * ─────────────────────────────────────────────────────────────────────
 */

const fiche = (over: Partial<Prospect> = {}): Prospect =>
  ({ ...prospectDefaults, id: "p1", company: "Corvane", city: "Lyon", createdAt: "", updatedAt: "", ...over }) as Prospect;

const brouillon = (status: DraftStatus): CampaignDraft => ({
  id: `d-${status}`,
  campaignId: "c1",
  prospectId: "p1",
  company: "Corvane",
  channel: "email",
  to: "x@example.com",
  subject: "s",
  body: "b",
  status,
});

const BASE: EntreeSondes = {
  sante: null,
  stockage: null,
  pipeServeur: false,
  hydratation: "locale",
  brouillons: [],
  prospects: [],
  palierPret: false,
  moniteur: null,
  presence: null,
};

// ═══════════ LE PIÈGE CENTRAL : /api/health TRONQUÉE ═══════════

test("⚠ la réponse TRONQUÉE de /api/health ne dit pas « cassé » — elle ne dit RIEN", () => {
  /**
   * ⚠ LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER, ET IL EST RÉEL.
   *
   * `GET /api/health` ne rend le détail qu'au porteur du cookie d'accès. Sans
   * lui — c'est-à-dire sur tout déploiement protégé par `SITE_PASSWORD`, donc
   * le nôtre — la réponse est `{ ok: true, checkedAt }` : un 200 valide, sans
   * `capabilities`.
   *
   * Lire `Boolean(capabilities?.email?.configured)` rendrait `false`, donc
   * « aucune inscription n'aboutit », affirmé en rouge et en permanence sur
   * une installation parfaitement saine. Deux jours de ce régime et l'écran
   * ne se lit plus.
   *
   * Mutation vérifiée : remplacer `lireBool` par `Boolean` fait tomber ce
   * test sur les deux assertions `null`.
   */
  const etat = etatDepuisSondes({ ...BASE, sante: { ok: true } });

  assert.equal(etat.smtpConfigure, null, "pas de capabilities = pas de mesure, pas un échec");
  assert.equal(etat.prixStripeConfigures, null);
  assert.deepEqual(diagnostiquer(etat), [], "une sonde muette n'alarme jamais");
  assert.ok(
    anglesMorts(etat).some((p) => /SMTP/.test(p)),
    "…mais l'angle mort doit se DIRE, sinon le vert ment"
  );
});

test("une panne réseau se lit comme un angle mort, jamais comme une panne système", () => {
  // `sante: null` = la requête n'est pas revenue. Le distinguer d'un `{}` est
  // ce qui empêche « le SMTP est cassé » d'apparaître au premier hoquet Wi-Fi.
  const etat = etatDepuisSondes({ ...BASE, sante: null });
  assert.equal(etat.smtpConfigure, null);
  assert.deepEqual(diagnostiquer(etat), []);
});

test("mesuré et FAUX alerte bien — la sonde n'est pas inerte", () => {
  /**
   * La moitié qui prouve que le test précédent ne cache pas un module qui ne
   * répond jamais rien. C'est le piège de test rencontré quatre fois dans ce
   * dépôt : asserter la PRÉSENCE d'un refus au lieu de la condition qui y
   * mène — un `if (false)` laisserait passer les deux premiers tests.
   */
  const etat = etatDepuisSondes({
    ...BASE,
    sante: { ok: true, capabilities: { email: { configured: false }, billing: { prices: false } } },
  });
  assert.equal(etat.smtpConfigure, false);
  assert.equal(etat.prixStripeConfigures, false);

  const ids = diagnostiquer(etat).map((a) => a.id);
  assert.ok(ids.includes("smtp-absent"), "un SMTP mesuré absent doit alerter");
  assert.ok(ids.includes("prix-stripe-absent"));
  /**
   * ⚠ ON ASSERTE LE CONTENU, PLUS LE COMPTE. Ce test disait `length === 3`
   * avec, en commentaire, le nom des trois. Brancher une sonde de plus l'a
   * fait tomber sur « 4 !== 3 » — un message qui ne dit ni laquelle est
   * apparue, ni si c'est voulu. Un compte figé transforme chaque ajout
   * légitime en échec illisible, et pousse à le rehausser sans regarder.
   *
   * ⚠ `ciblesAuPlafond` n'est PAS un angle mort ici : il se calcule depuis les
   * fiches, et une liste vide rend `0` — mesuré, pas ignoré. C'est justement
   * la distinction que ce module protège.
   */
  const mm = anglesMorts(etat);
  assert.ok(!mm.some((p) => /SMTP/.test(p)), "mesuré = plus un angle mort");
  assert.ok(mm.some((p) => /stockage/i.test(p)), "le stockage n'a pas été mesuré");
  assert.ok(mm.some((p) => /pipe serveur/i.test(p)), "le pipe non plus");
  assert.ok(mm.some((p) => /autopilote/i.test(p)), "l'autopilote non plus");
  assert.ok(mm.some((p) => /agent vocal/i.test(p)), "ni l'agent vocal — la sonde la plus chère du relevé");
  assert.ok(mm.some((p) => /enveloppe/i.test(p)), "ni l'enveloppe d'ouverture — on ne sait pas si les essais partent dégradés");
  /**
   * ⚠ LE COMPTE FIGÉ A SAUTÉ, ET LE COMMENTAIRE JUSTE AU-DESSUS DISAIT DÉJÀ
   * POURQUOI. Ce test portait `assert.equal(mm.length, 4)` pendant que sa
   * propre prose expliquait, à propos de `diagnostiquer`, qu'« un compte figé
   * transforme chaque ajout légitime en échec illisible, et pousse à le
   * rehausser sans regarder ». La leçon avait été appliquée à une moitié du
   * test et pas à l'autre.
   *
   * Brancher la sonde d'enveloppe l'a fait tomber sur « 5 !== 4 » — un message
   * qui ne dit ni laquelle est apparue, ni si c'est voulu. Exactement ce que
   * le commentaire annonçait.
   *
   * Ce qu'on garde : chaque angle mort attendu est nommé, un par un. Ce qu'on
   * abandonne : l'idée qu'il faille en avoir un nombre précis.
   */
  assert.ok(mm.length >= 5, `on attend au moins les cinq angles morts nommés ci-dessus (vu : ${mm.length})`);

  // Et l'inverse : configuré ne dit rien et n'aveugle rien.
  const bon = etatDepuisSondes({
    ...BASE,
    sante: { ok: true, capabilities: { email: { configured: true }, billing: { prices: true } } },
  });
  assert.deepEqual(diagnostiquer(bon), []);
});

// ═══════════ LE PIPE SERVEUR ═══════════

test("⚠ hors mode serveur, le pipe n'est ni vert ni rouge : il n'existe pas", () => {
  /**
   * ⚠ `peutSynchroniser("locale")` rend VRAI — c'est le mode historique, où le
   * navigateur EST la source. Le recopier tel quel afficherait « le pipe est
   * chargé » à quelqu'un qui n'a aucun pipe serveur : un voyant vert sur un
   * organe absent, ce qui est pire qu'un voyant éteint.
   *
   * Mutation vérifiée : retirer le `e.pipeServeur ?` fait tomber ce test.
   */
  assert.equal(etatDepuisSondes({ ...BASE, pipeServeur: false, hydratation: "locale" }).pipeSynchronisable, null);
  // Même un état d'échec ne dit rien tant que le mode n'est pas actif : cet
  // état n'a alors aucune conséquence, rien ne sera poussé.
  assert.equal(etatDepuisSondes({ ...BASE, pipeServeur: false, hydratation: "echec" }).pipeSynchronisable, null);
});

test("en mode serveur, un chargement raté alerte — c'est ce qui vide le pipe", () => {
  const casse = etatDepuisSondes({ ...BASE, pipeServeur: true, hydratation: "echec" });
  assert.equal(casse.pipeSynchronisable, false);
  assert.ok(diagnostiquer(casse).some((a) => a.id === "pipe-non-charge"));

  const ok = etatDepuisSondes({ ...BASE, pipeServeur: true, hydratation: "chargee" });
  assert.equal(ok.pipeSynchronisable, true);
  assert.ok(!diagnostiquer(ok).some((a) => a.id === "pipe-non-charge"));

  // « en-cours » n'est pas « chargé » : pousser depuis là pousse une liste
  // partielle, et la synchro sortante calcule des suppressions.
  assert.equal(etatDepuisSondes({ ...BASE, pipeServeur: true, hydratation: "en-cours" }).pipeSynchronisable, false);
});

// ═══════════ CE QUI SE COMPTE, ET CE QUI NE SE COMPTE PAS ═══════════

test("seuls les brouillons EN ATTENTE demandent une main", () => {
  // Approuvé, envoyé, ignoré, en erreur : la décision a déjà eu lieu. Les
  // compter gonflerait une alerte qu'aucun geste ne fait baisser.
  const brouillons: DraftStatus[] = ["pending", "pending", "approved", "sent", "skipped", "error"];
  const etat = etatDepuisSondes({ ...BASE, brouillons: brouillons.map(brouillon) });
  assert.equal(etat.brouillonsEnAttente, 2);
});

test("⚠ une fiche SIGNÉE ou PERDUE n'a pas de prochaine action à avoir", () => {
  /**
   * Une alerte dont le chiffre ne baisse jamais est une alerte qu'on apprend
   * à ignorer. Un dossier clos n'a aucune suite à caler : le compter mettrait
   * un plancher permanent sous le compteur.
   *
   * Mutation vérifiée : retirer le filtre `fichesActives` fait tomber ce test.
   */
  const etapes: Stage[] = ["prospect", "contact", "signe", "perdu"];
  const prospects = etapes.map((stage, i) => fiche({ id: `p${i}`, stage, nextStep: null }));
  assert.equal(sansProchaineAction(prospects), 2, "seules les deux fiches vivantes comptent");
});

test("⚠ une prochaine action SANS DATE ne compte pas comme calée", () => {
  /**
   * « Rappeler » sans date ne se déclenche jamais. C'est la même question que
   * `vital-signs` pose (`nextStepDated`), et les deux doivent répondre pareil :
   * deux définitions de « ce dossier est calé » finiraient par diverger, et
   * l'une des deux laisserait dormir la fiche.
   */
  assert.equal(sansProchaineAction([fiche({ nextStep: null })]), 1);
  assert.equal(sansProchaineAction([fiche({ nextStep: { date: "", action: "Rappeler" } })]), 1, "une date vide n'est pas une date");
  assert.equal(sansProchaineAction([fiche({ nextStep: { date: "2026-09-15T09:00:00.000Z", action: "Rappeler" } })]), 0);
});

test("le palier PRÊT remonte comme une décision humaine, jamais comme une action d'Alpha", () => {
  // « Aucun palier ne se valide seul, même tout vert. Automatique = le REFUS. »
  const alerte = diagnostiquer(etatDepuisSondes({ ...BASE, palierPret: true })).find((a) => a.id === "validation-palier");
  assert.ok(alerte, "un palier prêt doit remonter");
  assert.equal(alerte!.humain, true);
});

// ═══════════ L'AUTOPILOTE ═══════════

test("⚠ « NON CONFIGURÉ » N'EST PAS UNE PANNE — ET POURTANT ÇA S'ALERTE", () => {
  /**
   * ⚠ LA NUANCE QUE CE MODULE EXISTE POUR NOMMER, et elle est réelle depuis
   * aujourd'hui : `/api/campaign/tick` est écrit, testé, verrouillé — et si
   * personne ne pose l'ordonnanceur, il ne tourne jamais. Rien ne casse, rien
   * n'échoue, aucune erreur nulle part. Le pipe ne bouge simplement pas, et on
   * va chercher le bug dans la file d'appels.
   *
   * Mutation vérifiée : retirer la branche `non-configure` de `diagnostiquer`
   * fait tomber ce test.
   */
  const ids = (a: string) =>
    diagnostiquer(etatDepuisSondes({ ...BASE, moniteur: { autopilote: a as never } })).map((x) => x.id);

  assert.ok(ids("non-configure").includes("ordonnanceur-muet"), "un autopilote jamais branché doit se dire");
  assert.ok(ids("simulation").includes("autopilote-en-simulation"), "…et la simulation aussi : elle répond ok à tout");
  assert.deepEqual(ids("arme"), [], "armé = plus rien à signaler");
});

test("⚠ la simulation attend une DÉCISION, elle n'attend pas Alpha", () => {
  /**
   * Armer l'autopilote fait partir de vrais appels vers de vraies personnes.
   * C'est le geste le plus lourd de tout le produit : il ne se prend pas tout
   * seul, et l'écran doit dire qui l'attend — sinon on croit qu'Alpha va s'en
   * charger, et on reste en simulation des semaines.
   */
  const a = diagnostiquer(etatDepuisSondes({ ...BASE, moniteur: { autopilote: "simulation" } }));
  assert.equal(a.find((x) => x.id === "autopilote-en-simulation")!.humain, true);
});

test("⚠ un état d'autopilote INCONNU se lit comme « pas mesuré », jamais comme un des trois", () => {
  /**
   * ⚠ Même piège que `/api/health` tronquée, sur une autre sonde. Une réponse
   * absente, un champ manquant, ou une valeur d'un futur état qu'on ne sait
   * pas lire : aucun des trois ne doit se faire passer pour « armé » (on
   * croirait que ça tourne) ni pour « non configuré » (on irait reconfigurer
   * ce qui marche).
   *
   * Mutation vérifiée : remplacer la liste blanche par `e.moniteur?.autopilote
   * ?? null` laisse passer la valeur inconnue et fait tomber ce test.
   */
  for (const cas of [null, {}, { autopilote: "en-pause" as never }]) {
    const etat = etatDepuisSondes({ ...BASE, moniteur: cas });
    assert.equal(etat.autopilote, null, `« ${JSON.stringify(cas)} » ne doit pas se faire passer pour un état connu`);
    assert.deepEqual(diagnostiquer(etat), [], "et il n'alarme pas");
    assert.ok(anglesMorts(etat).some((p) => /autopilote/.test(p)), "…mais il se DIT");
  }
});

// ═══════════ LE BRANCHEMENT LUI-MÊME ═══════════

test("⚠ L'ÉCRAN LIT RÉELLEMENT LES SONDES — le défaut récurrent du dépôt", () => {
  /**
   * ⚠ « Un mécanisme juste, testé, branché à un seul endroit ou à aucun. »
   * C'est LA panne la plus fréquente ici, et elle ne ressemble pas à un bug :
   * le module rend la bonne réponse, personne ne la lit, rien n'échoue.
   *
   * Un `/ceo` qui afficherait la carte des points humains sans jamais appeler
   * les sondes serait exactement ça : une page de documentation déguisée en
   * console. Ce test nomme les quatre sources et exige qu'elles soient
   * consommées.
   */
  const src = readFileSync(join(process.cwd(), "app/(app)/ceo/page.tsx"), "utf8");

  for (const sonde of [
    "/api/health", // SMTP et prix Stripe
    "readStorageHealth", // le stockage local
    "hydratationPipe", // l'état de chargement du pipe
    "evaluerProgression", // le palier prêt à valider
    "/api/moniteur", // l'autopilote, tel que le serveur le connaît
  ]) {
    assert.ok(src.includes(sonde), `l'écran /ceo n'interroge pas « ${sonde} » : la console ne sonde rien`);
  }

  // Et il passe par le module de branchement plutôt que de refaire le mapping
  // à la main — sinon la règle « tronqué → null » aurait deux définitions.
  assert.match(src, /etatDepuisSondes\(/, "le mapping doit passer par lib/ceo-sondes.ts");
  assert.match(src, /diagnostiquer\(/, "…et le résultat doit être diagnostiqué, pas seulement affiché");
});

test("⚠ /ceo est MASQUÉ chez un client, pas grisé", () => {
  /**
   * Griser, c'est annoncer. `/ceo` n'est pas une brique à vendre : c'est la
   * console d'exploitation de NOTRE déploiement — SMTP, prix Stripe,
   * migrations. Montrer la porte inviterait à demander ce qu'on y voit de son
   * compte, alors que la réponse est « rien de personnel » et qu'il faudrait
   * la donner à chaque fois.
   *
   * Mutation vérifiée : retirer `"/ceo": []` de `ACCES_PAR_CHEMIN` rend le
   * chemin NON CLASSÉ, donc `masque` lui aussi — d'où la seconde moitié du
   * test, qui vérifie que le maître, lui, l'ouvre.
   */
  assert.equal(etatChemin("/ceo", ["crm", "campagnes", "tracking"], false, false).type, "masque");
  assert.equal(etatChemin("/ceo", [], true, false).type, "ouvert", "le maître doit pouvoir entrer");
});
