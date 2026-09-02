import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAlpha, normaliserCompte } from "../lib/store";
import { auditCompleteness } from "../lib/deep-dive";
import type { Prospect } from "../lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le store est le cœur des données de l'app : tout ce qui s'y perd est perdu
 * partout. Ces tests couvrent ce qui peut RÉELLEMENT casser en silence —
 * les fusions à l'import, les portes de signature, le cloisonnement des notes.
 */

const snapshot = useAlpha.getState();

beforeEach(() => {
  // Chaque test repart d'un état propre : sans ça, l'ordre d'exécution
  // devient un paramètre caché et les échecs sont irreproductibles.
  useAlpha.setState({
    ...snapshot,
    prospects: [],
    notes: [],
    settledPayouts: [],
    activities: [],
    auditLog: [],
  });
});

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 0,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("store — l'import dédoublonne par email, sans créer de doublon", () => {
  const { importProspects } = useAlpha.getState();
  const a = importProspects([fixture({ id: "a", company: "Carrosserie Test", email: "gerant@test.fr" })]);
  assert.deepEqual([a.added, a.updated], [1, 0]);

  // Même email, société écrite différemment → c'est le MÊME prospect.
  const b = importProspects([fixture({ id: "b", company: "CARROSSERIE TEST SARL", email: "GERANT@test.fr" })]);
  assert.deepEqual([b.added, b.updated], [0, 1]);
  assert.equal(useAlpha.getState().prospects.length, 1);
});

test("store — l'import dédoublonne aussi par société quand l'email manque", () => {
  const { importProspects } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Garage Vitton", email: undefined })]);
  const b = importProspects([fixture({ id: "b", company: "  garage vitton  ", email: undefined })]);
  assert.equal(b.updated, 1);
  assert.equal(useAlpha.getState().prospects.length, 1);
});

test("store — l'import ne DÉTRUIT pas le travail déjà fait sur la fiche", () => {
  const { importProspects, patchProspect } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Test SARL", email: "m@t.fr" })]);
  const id = useAlpha.getState().prospects[0].id;

  // Travail terrain : on avance la fiche et on note une valeur.
  patchProspect(id, { stage: "demo", trust: 90, monthlyValue: 115, notes: "vu sur place le 12" });

  // Un ré-import (fichier source pauvre) ne doit rien écraser de tout ça.
  importProspects([fixture({ id: "b", company: "Test SARL", email: "m@t.fr", trust: 10, monthlyValue: 0, notes: "" })]);
  const p = useAlpha.getState().prospects[0];
  assert.equal(p.stage, "demo", "le stade du pipeline ne se réinitialise jamais à l'import");
  assert.equal(p.trust, 90);
  assert.equal(p.monthlyValue, 115);
  assert.match(p.notes, /vu sur place/);
});

test("store — l'import fusionne la timeline sans dupliquer les événements", () => {
  const { importProspects } = useAlpha.getState();
  const ev = { id: "e1", date: "2026-07-09T09:00:00.000Z", kind: "appel" as const, summary: "Premier contact" };
  importProspects([fixture({ id: "a", email: "m@t.fr", events: [ev] })]);
  importProspects([fixture({ id: "b", email: "m@t.fr", events: [ev, { ...ev, id: "e2", summary: "Relance" }] })]);

  const p = useAlpha.getState().prospects[0];
  const summaries = p.events.map((e) => e.summary);
  assert.equal(summaries.filter((s) => s === "Premier contact").length, 1, "l'événement identique ne doit pas doubler");
  assert.ok(summaries.includes("Relance"), "le nouvel événement est bien ajouté");
});

test("store — le score d'audit à l'import reflète ce qu'on sait vraiment", () => {
  const { importProspects } = useAlpha.getState();
  const riche = fixture({
    id: "r", email: "r@t.fr", company: "Riche",
    deepAudit: {
      websiteState: "aucun", socialState: "inactif", localCompetition: "3 garages",
      currentProcess: "le gérant décroche", missedCallsPerWeek: 9, avgTicket: 400, googleRating: 3.2,
    },
  });
  importProspects([riche]);
  const p = useAlpha.getState().prospects.find((x) => x.company === "Riche")!;
  assert.equal(p.auditScore, auditCompleteness(riche));
  assert.ok(p.auditScore > 50, "une fiche riche doit sortir exploitable");
});

test("store — un audit fait à la main n'est JAMAIS revu à la baisse", () => {
  const { importProspects, patchProspect } = useAlpha.getState();
  importProspects([fixture({ id: "a", email: "m@t.fr" })]);
  const id = useAlpha.getState().prospects[0].id;
  patchProspect(id, { auditScore: 95 });

  // Ré-import d'une fiche vide : le score acquis reste.
  importProspects([fixture({ id: "b", email: "m@t.fr" })]);
  assert.equal(useAlpha.getState().prospects[0].auditScore, 95);
});

test("store — on ne peut pas signer sans remplir les conditions", () => {
  const { upsertProspect, moveStage } = useAlpha.getState();
  upsertProspect(fixture({ id: "s1", stage: "offre", conviction: 4, demoShownBeforePrice: false }));

  const refus = moveStage("s1", "signe");
  assert.equal(refus.ok, false, "une signature sans conviction doit être refusée");
  assert.ok(refus.blockers.length > 0, "et le refus doit dire POURQUOI");
  assert.equal(useAlpha.getState().prospects.find((p) => p.id === "s1")!.stage, "offre");
});

test("store — la signature passe quand tout est au vert", () => {
  const { upsertProspect, moveStage } = useAlpha.getState();
  upsertProspect(
    fixture({
      id: "s2", stage: "offre", conviction: 10, trust: 95, demoShownBeforePrice: true,
      croyances: { produit: 10, soutien: 10, pourLui: 10 }, objections: [],
    })
  );
  const ok = moveStage("s2", "signe");
  assert.equal(ok.ok, true, ok.blockers.join(" · "));
  assert.equal(useAlpha.getState().prospects.find((p) => p.id === "s2")!.stage, "signe");
});

test("store — basculer de compte change l'identité, PAS les données", () => {
  const { upsertProspect, switchAccount, patchSettings } = useAlpha.getState();
  upsertProspect(fixture({ id: "keep", company: "Ne doit pas bouger" }));

  switchAccount("nuwacom");
  let s = useAlpha.getState();
  assert.equal(s.settings.accountId, "nuwacom");
  assert.equal(s.settings.agencyName, "Nuwacom");
  assert.equal(s.prospects.length, 1, "les prospects ne bougent pas en changeant de compte");

  switchAccount("eagleye");
  s = useAlpha.getState();
  assert.equal(s.settings.agencyName, "EAGLEYE CORP");
  assert.equal(s.prospects[0].company, "Ne doit pas bouger", "et le retour au maître non plus");

  switchAccount("eagleye");
});

test("⚠ store — la bascule n'écrit PLUS le taux : c'est l'écran qui le pose", () => {
  /**
   * ⚠ CE TEST VÉRIFIAIT `settings.commissionPct === 30` APRÈS LA BASCULE.
   *
   * Le taux ne descend plus dans le navigateur : il publiait notre part chez
   * le revendeur et Nuwacom dans un chunk servi sans mot de passe. `switchAccount`
   * ne change donc plus que l'identité, et le sélecteur écrit le taux une
   * fois qu'il l'a reçu du serveur (bouton désactivé tant qu'il ne l'a pas).
   *
   * Le danger de ce découpage, et ce que ce test surveille : si personne ne
   * pose le taux ensuite, les Réglages gardent celui du compte PRÉCÉDENT et
   * `/payouts` calcule notre part d'un deal revendeur à 100 % sans rien dire.
   * On vérifie donc les deux moitiés — que la bascule ne touche pas au taux,
   * ET que le patch qui suit le fait réellement bouger.
   */
  const { switchAccount, patchSettings } = useAlpha.getState();

  patchSettings({ commissionPct: 100 });
  switchAccount("nuwacom");
  assert.equal(
    useAlpha.getState().settings.commissionPct,
    100,
    "la bascule seule ne doit pas inventer un taux"
  );

  // Ce que fait le sélecteur une fois la réponse serveur arrivée.
  patchSettings({ commissionPct: 30 });
  assert.equal(useAlpha.getState().settings.commissionPct, 30);

  switchAccount("eagleye");
  patchSettings({ commissionPct: 100 });
});

test("store — une note créée depuis un compte lui reste attachée", () => {
  const { switchAccount, upsertNote } = useAlpha.getState();
  switchAccount("nuwacom");
  const id = useAlpha.getState().upsertNote({ title: "Note partenaire", body: "contenu" });
  assert.equal(useAlpha.getState().notes.find((n) => n.id === id)!.accountId, "nuwacom");

  // Rééditée depuis un AUTRE compte, elle ne change pas de propriétaire.
  useAlpha.getState().switchAccount("eagleye");
  useAlpha.getState().upsertNote({ id, title: "Note partenaire", body: "contenu modifié" });
  const n = useAlpha.getState().notes.find((x) => x.id === id)!;
  assert.equal(n.accountId, "nuwacom", "l'édition ne doit pas voler la note à son compte");
  assert.match(n.body, /modifié/);
});

test("store — supprimer une note ne touche qu'elle", () => {
  const { upsertNote, deleteNote } = useAlpha.getState();
  const a = useAlpha.getState().upsertNote({ title: "A", body: "a" });
  const b = useAlpha.getState().upsertNote({ title: "B", body: "b" });
  useAlpha.getState().deleteNote(a);
  const ids = useAlpha.getState().notes.map((n) => n.id);
  assert.equal(ids.includes(a), false);
  assert.ok(ids.includes(b));
});

test("store — le payout versé se bascule et ne concerne que ce paiement", () => {
  const { togglePayoutSettled } = useAlpha.getState();
  togglePayoutSettled("pay-1");
  assert.deepEqual(useAlpha.getState().settledPayouts, ["pay-1"]);
  togglePayoutSettled("pay-2");
  assert.equal(useAlpha.getState().settledPayouts.length, 2);
  togglePayoutSettled("pay-1");
  assert.deepEqual(useAlpha.getState().settledPayouts, ["pay-2"]);
});

test("store — l'export/import JSON conserve les données", () => {
  const { upsertProspect, exportData, clearAllData, importData } = useAlpha.getState();
  upsertProspect(fixture({ id: "x", company: "À restaurer", monthlyValue: 315 }));
  const json = useAlpha.getState().exportData();

  useAlpha.getState().clearAllData();
  assert.equal(useAlpha.getState().prospects.length, 0);

  const r = useAlpha.getState().importData(json);
  assert.equal(r.ok, true, r.error);
  const p = useAlpha.getState().prospects.find((x) => x.company === "À restaurer");
  assert.ok(p, "le prospect doit être restauré");
  assert.equal(p!.monthlyValue, 315);
});

test("store — un JSON invalide est refusé proprement, sans vider les données", () => {
  const { upsertProspect } = useAlpha.getState();
  upsertProspect(fixture({ id: "safe", company: "Ne pas perdre" }));

  const r = useAlpha.getState().importData("{ ceci n'est pas du json");
  assert.equal(r.ok, false);
  assert.ok(r.error, "l'échec doit être expliqué");
  assert.equal(useAlpha.getState().prospects.length, 1, "un import raté ne doit RIEN détruire");
});

test("store — l'import dédoublonne par TÉLÉPHONE : jamais deux appels au même numéro", () => {
  /**
   * ⚠ La fusion se faisait sur l'email ou le NOM D'ENTREPRISE. Sur un relevé
   * terrain, « Carrosserie des Lilas » et « Carrosserie des Lilas SARL » sont
   * deux noms — donc deux fiches, donc DEUX APPELS au même numéro.
   *
   * Le module de sourcing calcule pourtant un identifiant stable sur le
   * numéro. Il ne servait à rien ici : cette fusion-ci ne regarde pas
   * l'identifiant. Le test le prouvait au niveau du module, pas du chemin.
   */
  useAlpha.setState({ prospects: [] });
  const { importProspects } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Carrosserie des Lilas", email: undefined, phone: "+33478123456" })]);

  // Autre nom, autre écriture du numéro, même ligne téléphonique.
  const b = importProspects([
    fixture({ id: "b", company: "Carrosserie des Lilas SARL", email: undefined, phone: "04 78 12 34 56" }),
  ]);
  assert.deepEqual([b.added, b.updated], [0, 1], "deux écritures du même numéro doivent fusionner");
  assert.equal(useAlpha.getState().prospects.length, 1);
});

test("store — deux numéros DIFFÉRENTS restent deux fiches", () => {
  // Le garde-fou ne doit pas fusionner à tort : deux établissements d'une même
  // enseigne locale ont deux numéros et se travaillent séparément.
  useAlpha.setState({ prospects: [] });
  const { importProspects } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Garage Nord", email: undefined, phone: "0478000001" })]);
  const b = importProspects([fixture({ id: "b", company: "Garage Sud", email: undefined, phone: "0478000002" })]);
  assert.equal(b.added, 1);
  assert.equal(useAlpha.getState().prospects.length, 2);
});

test("store — les tags s'AJOUTENT à la réimportation", () => {
  /**
   * Une fiche déjà connue, réimportée avec un extrait d'avis nouvellement
   * relevé, doit gagner son tag « injoignable ». Sinon le relevé ne sert à
   * rien dès que la fiche existe — c'est-à-dire dans la plupart des cas.
   */
  useAlpha.setState({ prospects: [] });
  const { importProspects } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Toiture Roux", email: undefined, phone: "0478000009", tags: ["terrain"] })]);
  importProspects([
    fixture({ id: "a2", company: "Toiture Roux", email: undefined, phone: "0478000009", tags: ["injoignable"] }),
  ]);
  const p = useAlpha.getState().prospects[0];
  assert.ok(p.tags.includes("terrain"), "l'ancien tag survit");
  assert.ok(p.tags.includes("injoignable"), "le nouveau tag entre");
  assert.equal(new Set(p.tags).size, p.tags.length, "aucun doublon de tag");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ UN COMPTE RETIRÉ DU PORTEFEUILLE NE DOIT PAS SURVIVRE DANS UN NAVIGATEUR.
 *
 * Trouvé en retirant le compte du revendeur téléphonique (02/09/2026), et le
 * trou était silencieux : le stockage local garde `accountId` et
 * `agencyName`. `getAccount()` d'un identifiant inconnu retombe sur le maître
 * — donc `estPartenaire()` répond **false** — pendant qu'`agencyName`
 * continue de SIGNER au nom de la marque disparue.
 *
 * Résultat : des emails partant sous une marque qui n'est plus la nôtre, sans
 * la moindre validation partenaire, et rien pour le signaler.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ store — un compte disparu du portefeuille retombe sur le maître", () => {
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");

  // La CONDITION : la normalisation interroge le REGISTRE, pas une liste de
  // slugs morts — sinon le prochain compte retiré repassera au travers.
  assert.match(src, /ACCOUNTS\.some\(\(a\) => a\.id === settings\.accountId\)/);
  // Et elle répare l'identité, pas seulement l'identifiant : c'est
  // `agencyName` qui signe les emails.
  assert.match(src, /accountId: maitre\.id, agencyName: maitre\.name/);
  // Elle doit être branchée sur la réhydratation, pas seulement définie.
  assert.match(src, /settings: normaliserCompte\(\{/);

  /**
   * ⚠ Et le COMPORTEMENT, sur des réglages qui portent une marque morte.
   *
   * Une première version de ce test appelait `switchAccount("compte-mort")` —
   * et passait au vert sans jamais toucher `normaliserCompte` : `applyAccount`
   * retombait déjà sur le maître de son côté. Le cas réel n'est pas une
   * bascule, c'est un stockage local écrit AVANT le retrait du compte. On
   * l'exerce donc directement.
   */
  const mort = normaliserCompte({
    ...useAlpha.getState().settings,
    accountId: "un-compte-mort",
    agencyName: "Marque Disparue",
  });
  assert.equal(mort.accountId, "eagleye");
  assert.equal(mort.agencyName, "EAGLEYE CORP", "la signature ne doit plus porter la marque morte");

  // Et un compte VIVANT n'est pas touché — sinon la normalisation ramènerait
  // tout le monde au maître, ce qui casserait le white-label au lieu de le
  // protéger.
  const vivant = normaliserCompte({ ...useAlpha.getState().settings, accountId: "nuwacom", agencyName: "Nuwacom" });
  assert.equal(vivant.accountId, "nuwacom");
  assert.equal(vivant.agencyName, "Nuwacom");
});
