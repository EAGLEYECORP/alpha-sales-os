import { test } from "node:test";
import assert from "node:assert/strict";
import { vitalSigns, triageByReadiness } from "../lib/vital-signs";
import { masterRappel } from "../lib/master-rappel";
import { humainDejaEnLigne } from "../lib/call-cadence";
import type { Prospect, TimelineEvent } from "../lib/types";

const NOW = new Date("2026-08-21T09:00:00.000Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function ev(over: Partial<TimelineEvent>): TimelineEvent {
  return { id: `e${Math.random()}`, date: ago(1), kind: "appel", summary: "", ...over } as TimelineEvent;
}

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc Dubois",
    company: "Test SARL",
    sector: "artisan",
    city: "Lyon",
    phone: "0478000000",
    email: "marc@test.fr",
    stage: "contact",
    trust: 50,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    createdAt: ago(60),
    updatedAt: ago(1),
    ...over,
  } as Prospect;
}

/** Une fiche prête à signer : tous les signaux vitaux au vert. */
const readyProspect = (over: Partial<Prospect> = {}) =>
  fixture({
    stage: "offre",
    trust: 85,
    conviction: 9,
    auditScore: 80,
    setupValue: 990,
    monthlyValue: 115,
    demoShownBeforePrice: true,
    croyances: { produit: 9, soutien: 9, pourLui: 9 },
    // Un prospect réellement prêt a une date de déblocage CONFIRMÉE :
    // sans elle, un « oui » n'est qu'une intention.
    funding: { availableAt: ago(-1), channel: "virement", approver: "le gérant", confirmed: true },
    nextStep: { date: ago(-2), action: "RDV closing" },
    events: [ev({ date: ago(2), kind: "visite", summary: "Démo faite, devis construit ensemble" })],
    ...over,
  });

test("signaux vitaux — une fiche complète est prête à signer", () => {
  const s = vitalSigns(readyProspect(), NOW);
  assert.ok(s.readiness >= 70, `readiness attendu >= 70, obtenu ${s.readiness}`);
  assert.equal(s.blockers.length, 0);
  assert.match(s.summary, /Prêt à signer/);
});

test("signaux vitaux — chaque blocage est nommé avec sa raison", () => {
  const s = vitalSigns(fixture(), NOW);
  assert.ok(s.readiness < 70);
  assert.ok(s.blockers.length >= 3);
  assert.ok(s.blockers.some((b) => /Démo montrée AVANT le prix/.test(b)));
  assert.ok(s.blockers.some((b) => /Prochaine étape DATÉE/.test(b)));
});

test("signaux vitaux — 4 relances sèches = saturation, et un vrai silence imposé", () => {
  const p = fixture({
    events: [
      ev({ date: ago(1), kind: "email", summary: "relance 4" }),
      ev({ date: ago(3), kind: "email", summary: "relance 3" }),
      ev({ date: ago(5), kind: "appel", summary: "relance 2" }),
      ev({ date: ago(7), kind: "appel", summary: "relance 1" }),
    ],
  });
  const s = vitalSigns(p, NOW);
  assert.equal(s.unansweredTouches, 4);
  assert.equal(s.fatigueLevel, "sature");
  // La fenêtre est repoussée dans le futur, avec une raison neuve exigée.
  assert.ok(new Date(s.bestWindow.at).getTime() > NOW.getTime());
  assert.match(s.bestWindow.why, /raison NEUVE/i);
});

test("signaux vitaux — un signe de vie DE LUI casse la saturation", () => {
  const p = fixture({
    events: [
      ev({ date: ago(2), kind: "appel", summary: "Il a rappelé — intéressé" }),
      ev({ date: ago(5), kind: "email", summary: "relance 2" }),
      ev({ date: ago(7), kind: "email", summary: "relance 1" }),
    ],
  });
  const s = vitalSigns(p, NOW);
  assert.equal(s.unansweredTouches, 0, "le compteur repart à zéro dès qu'il répond");
  assert.equal(s.daysSinceInbound, 2);
  assert.notEqual(s.fatigueLevel, "sature");
});

test("master rappel — un prospect prêt déclenche le rituel de closing du compte", () => {
  const eagleye = masterRappel(readyProspect(), { now: NOW, accountId: "eagleye" });
  assert.equal(eagleye.closing?.accountId, "eagleye");
  assert.match(eagleye.closing!.action, /DEVIS/i);
  assert.match(eagleye.headline, /PRÊT À SIGNER/);

  // Un troisième rituel existait (proposition commerciale via le panel d'un
  // revendeur). Le compte est parti ; le rituel avec lui.
  const nuwacom = masterRappel(readyProspect(), { now: NOW, accountId: "nuwacom" });
  assert.equal(nuwacom.closing?.accountId, "nuwacom");
  assert.match(nuwacom.closing!.action, /CADRAGE/i);
  assert.doesNotMatch(nuwacom.closing!.action, /DEVIS EAGLEYE/i);
});

test("master rappel — l'acte de closing ne transporte AUCUNE coordonnée partenaire", () => {
  // Ce module est calculé côté client : tout ce qu'il produit part dans un
  // fichier JavaScript téléchargeable. L'email d'expédition, le panel de vente
  // et le nom du CEO à impliquer arrivent par /api/catalogue, pas par ici.
  for (const id of ["eagleye", "nuwacom", "nuwacom"]) {
    const plan = masterRappel(readyProspect(), { now: NOW, accountId: id });
    assert.deepEqual(
      Object.keys(plan.closing!).sort(),
      ["accountId", "accountName", "action"],
      `${id} : le rituel ne porte que l'acte`
    );
    assert.doesNotMatch(plan.closing!.action, /@|https?:\/\/|Christophe/i, `${id} : ni adresse, ni URL, ni nom`);
  }
});

test("master rappel — pas prêt = pas de closing proposé", () => {
  const plan = masterRappel(fixture(), { now: NOW });
  assert.equal(plan.closing, null, "on ne propose pas un devis à un prospect non qualifié");
});

test("master rappel — les actions sont réparties entre l'humain et Alpha", () => {
  const plan = masterRappel(fixture({ stage: "audit" }), { now: NOW });
  assert.ok(plan.human.length > 0);
  assert.ok(plan.alpha.length > 0);
  assert.ok(plan.human.every((a) => a.owner === "humain"));
  assert.ok(plan.alpha.every((a) => a.owner === "alpha"));
  // L'étape audit exige de récolter ce qu'il faut pour la suite.
  assert.ok(plan.human[0].mustCapture?.length, "chaque action porte ce qu'il faut récolter");
});

test("master rappel — la checklist dit si ça tourne et si Alpha reçoit la donnée", () => {
  const muet = masterRappel(fixture({ email: "", phone: "", events: [] }), { now: NOW });
  const joignable = muet.checks.find((c) => c.id === "joignable");
  assert.equal(joignable?.state, "absent");
  const retour = muet.checks.find((c) => c.id === "retour-donnee");
  assert.equal(retour?.state, "absent");
  assert.match(retour!.detail, /rien à analyser/i);

  const vivant = masterRappel(fixture({ events: [ev({ date: ago(2), summary: "appel" })] }), { now: NOW });
  assert.equal(vivant.checks.find((c) => c.id === "retour-donnee")?.state, "actif");
});

/**
 * NOUVELLE DOCTRINE (28/08/2026) — Alpha Voice mène l'appel à froid entier.
 * Un décroché sans suite ne réveille personne ; seul l'INTÉRÊT QUALIFIÉ le
 * fait. Ce qui reste vrai dans les deux cas : on ne rappelle jamais quelqu'un
 * qui a décroché.
 */
test("master rappel — décroché sans suite : Alpha s'arrête, l'humain n'est PAS mobilisé", () => {
  const plan = masterRappel(fixture(), {
    now: NOW,
    attempts: [
      { at: ago(2), outcome: "sans-reponse" },
      { at: ago(1), outcome: "repondu" },
    ],
  });
  assert.equal(
    plan.human.some((a) => a.id === "reprise-humaine"),
    false,
    "un « pas intéressé » ne doit pas coûter le temps d'un closer"
  );
  // Et aucune action Alpha ne rappelle ce prospect.
  assert.equal(plan.alpha.some((a) => a.channel === "appel" && a.id === "cadence-appel"), false);
});

test("master rappel — INTÉRÊT QUALIFIÉ : l'humain reprend la main", () => {
  const plan = masterRappel(fixture(), {
    now: NOW,
    attempts: [
      { at: ago(2), outcome: "sans-reponse" },
      { at: ago(1), outcome: "interesse" },
    ],
  });
  const reprise = plan.human.find((a) => a.id === "reprise-humaine");
  assert.ok(reprise, "l'humain doit reprendre la main");
  assert.match(reprise!.do, /REPRENDRE LA MAIN/);
  assert.equal(plan.alpha.some((a) => a.channel === "appel" && a.id === "cadence-appel"), false);
});

test("comms — la fréquence suit le comportement, pas le calendrier", () => {
  // Prêt à signer → tous les jours, en visio, ton direct.
  const chaud = masterRappel(readyProspect(), { now: NOW }).comms;
  assert.equal(chaud.everyDays, 1);
  assert.equal(chaud.channel, "visio");
  assert.match(chaud.say, /on démarre quand/i);

  // Saturé → espacement long + interdiction de relancer.
  const sature = masterRappel(
    fixture({
      events: [1, 3, 5, 7].map((d) => ev({ date: ago(d), kind: "email", summary: `relance ${d}` })),
    }),
    { now: NOW }
  ).comms;
  assert.ok(sature.everyDays >= 7, `espacement attendu long, obtenu ${sature.everyDays}`);
  assert.ok(sature.avoid.some((a) => /saturé/i.test(a)));
  assert.match(sature.say, /raison NEUVE/i);
  // 4 touches ignorées → on change de canal.
  assert.equal(sature.channel, "terrain");
});

test("comms — on n'annonce jamais un prix avant la démo", () => {
  const c = masterRappel(fixture({ stage: "demo", demoShownBeforePrice: false }), { now: NOW }).comms;
  assert.ok(c.avoid.some((a) => /prix avant/i.test(a)));
});

test("triage — les saturés sortent de la file du jour, les prêts passent devant", () => {
  const chaud = readyProspect({ id: "chaud" });
  const sature = fixture({
    id: "sature",
    events: [1, 2, 3, 4].map((d) => ev({ date: ago(d), kind: "email", summary: `relance ${d}` })),
  });
  const tiede = fixture({ id: "tiede", trust: 60, auditScore: 60 });
  const file = triageByReadiness([sature, tiede, chaud], NOW);
  assert.equal(file[0].prospect.id, "chaud");
  assert.equal(file.some((x) => x.prospect.id === "sature"), false, "un saturé ne doit pas être rappelé aujourd'hui");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA VOICE NE RAPPELLE PAS QUELQU'UN QU'UN HUMAIN A DÉJÀ VU.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. Sur `/controle`, « Alpha exécute »
 * proposait « Passer le rappel 1/3 (cadence Callflow) » sur les huit fiches,
 * dont celle affichée deux blocs plus haut comme « PRÊT À SIGNER — Envoyer le
 * DEVIS ».
 *
 * `attemptsFromEvents` ne lit que `kind === "appel"` : une fiche avancée par
 * visites, rendez-vous et démo n'a aucune tentative enregistrée, donc la
 * cadence la croit froide. La règle ScintIA — « dès qu'il répond, Alpha Voice
 * arrête et passe la main » — parle de la CONVERSATION, pas d'un canal.
 * ─────────────────────────────────────────────────────────────────────
 */
test("humainDejaEnLigne — l'échange à deux sens compte, la touche sortante non", () => {
  assert.equal(humainDejaEnLigne({ events: [] }), false, "aucun événement : personne n'a parlé");
  assert.equal(humainDejaEnLigne({ events: [{ kind: "email" }] }), false, "un email envoyé ne prouve aucune réponse");
  assert.equal(humainDejaEnLigne({ events: [{ kind: "linkedin" }] }), false);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "whatsapp" }] }), false);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "note" }] }), false, "une note interne n'est pas un échange");

  assert.equal(humainDejaEnLigne({ events: [{ kind: "visite" }] }), true);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "meeting" }] }), true);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "demo" }] }), true);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "offre" }] }), true);

  // Un appel ne compte que s'il a RÉPONDU — même prudence qu'attemptsFromEvents.
  assert.equal(humainDejaEnLigne({ events: [{ kind: "appel", summary: "messagerie" }] }), false);
  assert.equal(humainDejaEnLigne({ events: [{ kind: "appel", summary: "a décroché, échange court" }] }), true);
});

test("une fiche vue en rendez-vous ne reçoit plus de cadence Callflow", () => {
  const vu = fixture({
    stage: "offre",
    events: [
      ev({ kind: "visite", date: ago(20), summary: "Passage 15h, heure creuse." }),
      ev({ kind: "meeting", date: ago(14), summary: "Audit sur place." }),
      ev({ kind: "demo", date: ago(7), summary: "Démo mobile." }),
      ev({ kind: "offre", date: ago(2), summary: "Offre présentée." }),
    ],
  });
  const plan = masterRappel(vu, { now: NOW });
  const cadences = plan.alpha.filter((a) => a.id.startsWith("cadence"));
  assert.deepEqual(
    cadences.map((a) => a.do),
    [],
    "Alpha Voice ne doit plus proposer d'appel de cadence sur une fiche que l'humain a déjà rencontrée"
  );

  // Et l'humain, lui, garde bien son action : on ne supprime pas le travail,
  // on retire seulement la main d'Alpha.
  assert.ok(plan.human.length > 0, "le plan humain doit rester rempli");
});

test("un PREMIER appel ne s'annonce pas comme un rappel", () => {
  const froid = fixture({ stage: "prospect", events: [] });
  const plan = masterRappel(froid, { now: NOW });
  const appel = plan.alpha.find((a) => a.id === "cadence-appel");
  assert.ok(appel, "une fiche froide doit bien recevoir un premier appel");
  assert.match(appel!.do, /PREMIER appel/, "à zéro tentative, ce n'est pas un « rappel 1/N »");
  assert.doesNotMatch(appel!.do, /rappel 1\//, "le libellé « rappel 1/N » comptait un rappel qui n'existe pas");
});
