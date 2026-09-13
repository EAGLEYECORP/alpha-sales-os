import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PALIERS_PART, BASE_REFUSEE, niveauAtteint, etatPart } from "../lib/part-resultat";
import { REV_SHARE } from "../lib/pricing";
import { prospectDefaults } from "../lib/seed";
import type { EventKind, Payment, Prospect, Stage, TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PART SUR LE RÉSULTAT — ce qui se facture, et ce qui ne se facture pas.
 *
 * Le modèle : le produit est gratuit jusqu'à ce qu'il dépense chez nous, donc
 * quelqu'un sans un euro peut prospecter pour de vrai et encaisser. Ce qu'on
 * demande ensuite est une part de ce qu'on lui a fait gagner.
 *
 * ⚠⚠ CES TESTS TIENNENT SURTOUT CE QU'IL NE FAUT PAS FAIRE. Un modèle de
 * commission se dégrade toujours du même côté : on facture un peu trop tôt,
 * un peu trop large, sur une base un peu trop floue — et on perd le client au
 * lieu du montant.
 * ─────────────────────────────────────────────────────────────────────
 */

const evt = (kind: EventKind, date: string): TimelineEvent => ({
  id: `e-${kind}-${date}`, date, kind, summary: "test",
});

const fiche = (over: Partial<Prospect> = {}): Prospect =>
  ({ ...prospectDefaults, id: "p1", name: "X", company: "Y", ...over }) as Prospect;

/**
 * ⚠ Un paiement RÉELLEMENT encaissé. La base de la part n'est pas une
 * projection : c'est de l'argent reçu. Voir le motif dans `etatPart`.
 */
const paye = (amount: number, status: Payment["status"] = "paye"): Payment[] => [
  { id: "pay1", label: "acompte", amount, dueDate: "2026-01-15", status },
];

test("⚠⚠ LE HAUT DE L'ÉCHELLE EST LA PART DÉJÀ PUBLIÉE — jamais un second 30", () => {
  /**
   * `lib/pricing.ts` porte « 30 % du CA généré » et la vitrine l'affiche.
   * Réécrire 30 ici créerait une deuxième définition de notre part : le jour
   * où l'une bouge, l'écran et le devis annonceraient deux prix — et c'est le
   * client qui s'en apercevrait, au pire moment.
   */
  const haut = PALIERS_PART[PALIERS_PART.length - 1];
  assert.equal(haut.pct, REV_SHARE * 100, "le palier haut a divergé de REV_SHARE");
  // L'échelle monte, sinon « faire plus » rapporterait moins.
  for (let i = 1; i < PALIERS_PART.length; i++) {
    assert.ok(PALIERS_PART[i].pct > PALIERS_PART[i - 1].pct, "les paliers ne montent pas");
  }
});

test("⚠ chaque palier dit ce qu'Alpha a fait ET ce qui reste au client", () => {
  /**
   * Une part qui ne dit que ce qu'on a fait paraît arbitraire. Dire aussi ce
   * que le client a fait est ce qui rend le pourcentage discutable — donc
   * défendable. C'est la phrase qu'on prononce en rendez-vous.
   */
  for (const p of PALIERS_PART) {
    assert.ok(p.ceQuAlphaAFait.length > 40, `${p.niveau} : ce qu'Alpha a fait n'est pas écrit`);
    assert.ok(p.ceQuIlAFait.length > 30, `${p.niveau} : ce que le client a fait n'est pas écrit`);
  }
});

test("⚠⚠ LE NIVEAU SE LIT SUR LA CHRONOLOGIE, ET IL MONTE AVEC LE TRAVAIL", () => {
  const base = { stage: "signe" as Stage, payments: paye(10_000) };
  assert.equal(niveauAtteint(fiche({ ...base, events: [evt("note", "2026-01-02")] })), "suivi");
  assert.equal(niveauAtteint(fiche({ ...base, events: [evt("appel", "2026-01-02")] })), "approche");
  assert.equal(niveauAtteint(fiche({ ...base, events: [evt("meeting", "2026-01-02")] })), "rendez-vous");
  // La démo compte comme une rencontre : le prospect a donné de son temps.
  assert.equal(niveauAtteint(fiche({ ...base, events: [evt("demo", "2026-01-02")] })), "rendez-vous");
});

test("⚠⚠ UNE FICHE SANS AUCUNE TOUCHE N'EST PAS À NOUS", () => {
  /**
   * Quelqu'un colle une affaire déjà signée dans son CRM pour l'archiver. La
   * facturer serait indéfendable, et c'est la première chose qu'un client
   * contesterait — à juste titre.
   *
   * ⚠ `null` n'est PAS zéro : « cette affaire ne nous revient pas » doit se
   * DIRE, pas se facturer à 10 % par défaut.
   */
  assert.equal(niveauAtteint(fiche({ stage: "signe", events: [] })), null);
});

test("⚠⚠ CE QUI EST CONSIGNÉ APRÈS LA SIGNATURE NE COMPTE PAS", () => {
  /**
   * ⚠⚠ SANS CETTE BORNE, TOUTE FICHE FINIRAIT AU PALIER HAUT : il suffit
   * d'ouvrir l'app une fois le contrat signé et de poser un rendez-vous de
   * suivi. On facturerait 30 % d'une affaire qu'on n'a pas faite, sur la foi
   * d'un événement postérieur — c'est du suivi de client, pas de la conquête.
   */
  const p = fiche({
    stage: "signe",
    monthlyValue: 10_000,
    events: [
      evt("appel", "2026-01-02"),
      evt("stage", "2026-01-10"), // ← la signature
      evt("meeting", "2026-02-01"), // ← réunion de suivi, APRÈS
    ],
  });
  assert.equal(
    niveauAtteint(p),
    "approche",
    "un rendez-vous postérieur à la signature a fait monter la part de 20 à 30 %"
  );
});

test("⚠⚠ ON NE FACTURE QUE DES AFFAIRES SIGNÉES", () => {
  /**
   * Une affaire en négociation a une valeur pondérée — utile pour prévoir,
   * jamais pour facturer. Envoyer une facture sur un deal qui n'existe pas
   * encore est la façon la plus rapide de perdre le client ET l'affaire.
   */
  const enCours = fiche({ stage: "offre", payments: paye(50_000), events: [evt("meeting", "2026-01-02")] });
  const r = etatPart([enCours]);
  assert.equal(r.lignes.length, 0);
  assert.equal(r.totalEur, null, "une affaire non signée a été chiffrée");
});

test("⚠⚠ ZÉRO AFFAIRE FACTURABLE → `null`, JAMAIS « 0 € »", () => {
  /**
   * La règle du dépôt. Un « 0 € » se lit comme un RÉSULTAT (« Alpha n'a rien
   * rapporté »), alors que la vérité est « personne n'a encore signé » ou
   * « les montants ne sont pas saisis ». Trois situations, trois gestes
   * opposés.
   */
  assert.equal(etatPart([]).totalEur, null);
});

test("⚠ une affaire signée SANS montant se COMPTE, elle ne se devine pas", () => {
  /**
   * ⚠⚠ LA LIMITE STRUCTURELLE DU MODÈLE, et elle ne se corrige pas par du
   * code : tout repose sur un montant que le CLIENT saisit. S'il n'inscrit
   * rien, on ne voit rien. Estimer à sa place fabriquerait une facture sur un
   * chiffre inventé — la seule chose pire que ne pas facturer.
   */
  const r = etatPart([fiche({ stage: "signe", payments: [], events: [evt("meeting", "2026-01-02")] })]);
  assert.equal(r.sansMontant, 1);
  assert.equal(r.totalEur, null, "un montant a été deviné");
  assert.match(r.reserve, /encaissé/i, "le trou doit être DIT, pas seulement compté");
});

test("⚠ une affaire signée sans aucune touche se compte à part", () => {
  const r = etatPart([fiche({ stage: "signe", payments: paye(9_000), events: [] })]);
  assert.equal(r.nonAttribuables, 1);
  assert.equal(r.totalEur, null);
  assert.match(r.reserve, /ne nous reviennent pas/i);
});

test("le calcul, quand tout est réuni", () => {
  const r = etatPart([
    fiche({ id: "a", company: "A", stage: "signe", payments: paye(10_000), events: [evt("note", "2026-01-02")] }),
    fiche({ id: "b", company: "B", stage: "signe", payments: paye(10_000), events: [evt("appel", "2026-01-02")] }),
    fiche({ id: "c", company: "C", stage: "signe", payments: paye(10_000), events: [evt("meeting", "2026-01-02")] }),
  ]);
  assert.deepEqual(r.lignes.map((l) => l.pct), [10, 20, 30]);
  assert.deepEqual(r.lignes.map((l) => l.partEur), [1_000, 2_000, 3_000]);
  assert.equal(r.totalEur, 6_000);
  assert.equal(r.reserve, "", "rien ne manque : aucune réserve à afficher");
});

test("⚠⚠ LE MODULE REFUSE DE CHIFFRER UNE PART SUR LE BÉNÉFICE", () => {
  /**
   * ⚠⚠ LA DISTINCTION QUI DÉCIDE SI LA CLAUSE SE FAIT PAYER.
   *
   * « 30 % des bénéfices » et « 30 % du CA généré » sonnent pareil. Le CA,
   * nous le voyons : c'est un montant inscrit sur une affaire signée. Le
   * bénéfice dépend des coûts, des salaires et des amortissements du client —
   * que nous ne pouvons ni lire ni auditer. Dans une clause au bénéfice,
   * **celui qui paie contrôle le dénominateur** : chaque euro de charge
   * imputé à l'affaire réduit notre facture, légalement.
   *
   * Un pourcentage plus petit sur une base qu'on mesure vaut mieux qu'un
   * grand pourcentage sur une base qu'on subit. Le module ne rend donc aucun
   * chiffre sur une base qu'il ne sait pas mesurer, et il dit pourquoi.
   */
  assert.match(BASE_REFUSEE, /bénéfice/i);
  assert.match(BASE_REFUSEE, /dénominateur/i, "le motif doit dire POURQUOI, pas seulement refuser");
  assert.ok(BASE_REFUSEE.length > 150, "un refus sans explication se fait contourner au premier rendez-vous");

  /**
   * ⚠ Et rien dans le module ne doit calculer sur une base « bénéfice ». Le
   * garde lit la source : une fonction qui prendrait un `benefice` en entrée
   * rendrait le refus décoratif.
   */
  const src = readFileSync(join(process.cwd(), "lib/part-resultat.ts"), "utf8");
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(
    sansCommentaires,
    /benefice\w*\s*[:=]/i,
    "le module accepte une base « bénéfice » — le refus écrit plus haut devient décoratif"
  );
});

test("⚠⚠ LE MODULE EST BRANCHÉ, ET IL NE SE PRÉSENTE PAS COMME UNE FACTURE", () => {
  /**
   * ⚠ LE DÉFAUT N°1 DU DÉPÔT : un mécanisme juste, testé, correct — branché
   * nulle part. Tous les tests ci-dessus passeraient sur un module que rien
   * n'importe, pendant que le modèle économique resterait une intention.
   */
  const panneau = readFileSync(join(process.cwd(), "components/billing/part-resultat-panel.tsx"), "utf8");
  const compte = readFileSync(join(process.cwd(), "app/(app)/compte/page.tsx"), "utf8");
  assert.match(panneau, /etatPart\(/, "le panneau ne calcule pas la part");
  assert.match(compte, /<PartResultatPanel \/>/, "le panneau n'est monté sur aucun écran");

  /**
   * ⚠⚠ ET LA PHRASE QUI EMPÊCHE L'ÉCRAN DE MENTIR. Aucun contrat de part au
   * résultat n'est signé aujourd'hui. Un montant affiché dans la section
   * « Compte » se lit comme une somme DUE : le client découvrirait une dette
   * qu'il n'a jamais contractée, et c'est la façon la plus rapide de perdre
   * quelqu'un qu'on venait de convaincre.
   *
   * Le test ne cherche pas une formulation : il exige que le mot
   * « simulation » et l'absence de prélèvement soient dits.
   */
  assert.match(panneau, /[Ss]imulation/, "l'écran ne dit pas que c'est une simulation");
  assert.match(panneau, /aucun prélèvement/i, "l'écran ne dit pas qu'aucun prélèvement n'est en cours");
  assert.match(panneau, /accord\s*\n?\s*écrit|accord écrit/, "l'écran ne dit pas qu'un accord écrit est requis");
});

test("⚠⚠ ON NE PRÉLÈVE RIEN SUR DE L'ARGENT QUE LE CLIENT N'A PAS REÇU", () => {
  /**
   * ⚠⚠ « EN ATTENTE » ET « RETARD » SONT DES PROMESSES, PAS DES ENCAISSEMENTS.
   *
   * C'est l'objection la plus légitime qu'un client puisse avoir : « tu me
   * factures ta part sur une facture que je n'ai pas encaissée ». Facturer
   * là-dessus transforme notre part en avance de trésorerie qu'il nous fait —
   * sur une affaire qui peut finir en impayé, et c'est lui qui porterait les
   * deux pertes.
   *
   * ⚠ La correction qui a amené ce test vient du RENDU, pas d'une relecture :
   * la première version facturait `monthlyValue`, et l'écran affichait
   * « 30 % de 349 € » — un MENSUEL présenté comme le CA de l'affaire.
   */
  const enAttente = etatPart([
    fiche({ stage: "signe", payments: paye(50_000, "en-attente"), events: [evt("meeting", "2026-01-02")] }),
  ]);
  assert.equal(enAttente.totalEur, null, "une part a été calculée sur un paiement non encaissé");
  assert.equal(enAttente.sansMontant, 1, "l'affaire doit être COMPTÉE, pas ignorée en silence");

  const enRetard = etatPart([
    fiche({ stage: "signe", payments: paye(50_000, "retard"), events: [evt("meeting", "2026-01-02")] }),
  ]);
  assert.equal(enRetard.totalEur, null, "une part a été calculée sur un impayé");

  // Le contre-test : le jour où il encaisse, la part existe.
  const encaisse = etatPart([
    fiche({ stage: "signe", payments: paye(50_000, "paye"), events: [evt("meeting", "2026-01-02")] }),
  ]);
  assert.equal(encaisse.totalEur, 15_000, "30 % de 50 000 € encaissés");
});
