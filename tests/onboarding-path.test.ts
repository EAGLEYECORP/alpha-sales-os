import test from "node:test";
import assert from "node:assert/strict";
import { prospect, meeting, daysAgo } from "./fixtures";
import type { TimelineEvent } from "../lib/types";
import {
  buildPath,
  rhythmDays,
  FUEL_TARGET,
  RHYTHM_DAYS,
  RHYTHM_MIN_TOUCHES,
  STEPS,
  type PathContext,
} from "../lib/onboarding-path";

/**
 * Le chemin de prise en main décide de ce que l'opérateur fait de sa
 * journée. S'il se trompe, il envoie quelqu'un installer une brique
 * déjà posée, ou pire : il déclare une étape faite alors qu'elle ne
 * l'est pas, et l'opérateur avance sur du vide.
 */

const ctx = (over: Partial<PathContext> = {}): PathContext => ({
  prospects: [],
  meetings: [],
  bookingUrl: undefined,
  health: null,
  dns: null,
  n8n: false,
  manual: [],
  ...over,
});

const evt = (kind: TimelineEvent["kind"], date = daysAgo(1)): TimelineEvent => ({
  id: `e-${kind}-${date}`,
  date,
  kind,
  summary: "test",
});

const ALL_ON = {
  health: { email: { configured: true }, ai: { configured: true }, inboundWebhook: { configured: true } },
  dns: { etat: "mesure" as const, domain: "eagleyecorp.fr", verdict: "bon", manquants: 0, inconnus: 0 },
  n8n: true,
  bookingUrl: "https://cal.com/x",
  // Une raison sociale À SOI : sur un compte non maître, laisser celle de
  // l'éditeur n'est pas « installé », c'est « pas encore commencé ».
  agencyName: "Agence Test",
};

test("chemin — sans aucune donnée, rien n'est déclaré fait", () => {
  const p = buildPath(ctx());
  assert.equal(p.done, 0);
  assert.equal(p.total, STEPS.length);
  /**
   * ⚠ La première étape n'est plus « brancher le SMTP » mais « mettre TON nom
   * sur l'outil ». `DEFAULT_SETTINGS` pose « EAGLEYE CORP » pour tout le
   * monde : un opérateur qui n'ouvre jamais les Réglages signe ses messages
   * sous la raison sociale de l'éditeur, et rien ne le lui disait. Aucune
   * plomberie ne passe avant ça — c'est la première chose qu'un prospect lit.
   */
  assert.equal(p.next?.id, "identite");
});

test("⚠ l'identité de l'ÉDITEUR ne vaut pas une identité — sauf pour le maître", () => {
  const etape = (over: Record<string, unknown>) =>
    buildPath(ctx(over)).phases[0].steps.find((s) => s.id === "identite")!;

  assert.equal(etape({}).done, false, "aucune raison sociale : rien n'est fait");
  assert.equal(
    etape({ agencyName: "EAGLEYE CORP" }).done,
    false,
    "la valeur d'usine laissée en place n'est pas un réglage : c'est l'absence de réglage"
  );
  assert.equal(etape({ agencyName: "Carrosserie Roux" }).done, true);
  /**
   * Le pendant, et il compte autant : le maître EST EAGLEYE. Lui afficher une
   * étape éternellement rouge sur sa propre installation serait absurde — et
   * c'est le genre de faux positif qui fait ignorer tout le parcours.
   */
  assert.equal(
    etape({ agencyName: "EAGLEYE CORP", maitre: true }).done,
    true,
    "sur le compte maître, la valeur d'usine EST la bonne réponse"
  );
});

test("chemin — l'état serveur non chargé ne vaut PAS une étape faite", () => {
  // Le piège : `health` null pourrait passer pour « rien à signaler ».
  const p = buildPath(ctx({ health: null }));
  const smtp = p.phases[0].steps.find((s) => s.id === "smtp")!;
  assert.equal(smtp.done, false);
  assert.match(smtp.detail, /non chargé/);
});

test("chemin — un DNS non concluant n'est pas un DNS conforme", () => {
  // Une résolution qui échoue ne prouve rien : ne jamais la compter comme un succès.
  const p = buildPath(ctx({ dns: { etat: "mesure" as const, domain: "eagleyecorp.fr", verdict: "non concluant", manquants: 0, inconnus: 1 } }));
  const dns = p.phases[0].steps.find((s) => s.id === "dns")!;
  assert.equal(dns.done, false);
  assert.match(dns.detail, /non concluante/);
});

test("chemin — DNS complet coche l'étape", () => {
  const p = buildPath(ctx({ dns: { etat: "mesure" as const, domain: "eagleyecorp.fr", verdict: "bon", manquants: 0, inconnus: 0 } }));
  assert.equal(p.phases[0].steps.find((s) => s.id === "dns")!.done, true);
});

test("chemin — le carburant se compte, il ne se déclare pas", () => {
  const almost = Array.from({ length: FUEL_TARGET - 1 }, (_, i) => prospect({ id: `p${i}` }));
  const fuel = buildPath(ctx({ prospects: almost })).phases[1].steps.find((s) => s.id === "fuel")!;
  assert.equal(fuel.done, false);
  assert.ok(fuel.progress! > 0.99 && fuel.progress! < 1);

  const enough = [...almost, prospect({ id: "p-last" })];
  assert.equal(buildPath(ctx({ prospects: enough })).phases[1].steps.find((s) => s.id === "fuel")!.done, true);
});

test("chemin — les premières touches se lisent dans le CRM, canal par canal", () => {
  const p = buildPath(ctx({ prospects: [prospect({ events: [evt("email")] })] }));
  const lancer = p.phases[2].steps;
  assert.equal(lancer.find((s) => s.id === "first-email")!.done, true);
  assert.equal(lancer.find((s) => s.id === "first-call")!.done, false);
  assert.equal(lancer.find((s) => s.id === "first-linkedin")!.done, false);
});

test("chemin — une note n'est pas une touche", () => {
  const p = buildPath(ctx({ prospects: [prospect({ events: [evt("note")] })] }));
  assert.equal(p.phases[2].steps.find((s) => s.id === "first-email")!.done, false);
});

test("rythme — une journée sous le seuil ne compte pas", () => {
  // Toutes les touches tombent le même jour, une sous le seuil.
  const yesterday = daysAgo(1);
  const light = prospect({
    events: Array.from({ length: RHYTHM_MIN_TOUCHES - 1 }, (_, i) => ({
      id: `e${i}`,
      date: yesterday,
      kind: "appel" as const,
      summary: "x",
    })),
  });
  assert.equal(rhythmDays([light]), 0);
});

test("rythme — cinq journées tenues valident l'étape", () => {
  const events: TimelineEvent[] = [];
  for (let day = 1; day <= RHYTHM_DAYS; day++) {
    for (let i = 0; i < RHYTHM_MIN_TOUCHES; i++) {
      events.push({ id: `e${day}-${i}`, date: daysAgo(day), kind: "appel", summary: "x" });
    }
  }
  const prospects = [prospect({ events })];
  assert.equal(rhythmDays(prospects), RHYTHM_DAYS);
  assert.equal(buildPath(ctx({ prospects })).phases[3].steps.find((s) => s.id === "rythme")!.done, true);
});

test("rythme — les journées hors fenêtre de 14 jours ne comptent plus", () => {
  const events: TimelineEvent[] = [];
  for (let day = 20; day < 20 + RHYTHM_DAYS; day++) {
    for (let i = 0; i < RHYTHM_MIN_TOUCHES; i++) {
      events.push({ id: `e${day}-${i}`, date: daysAgo(day), kind: "appel", summary: "x" });
    }
  }
  assert.equal(rhythmDays([prospect({ events })]), 0);
});

test("chemin — signé ne se coche que sur une fiche réellement signée", () => {
  const step = (stage: "offre" | "signe") =>
    buildPath(ctx({ prospects: [prospect({ stage })] })).phases[3].steps.find((s) => s.id === "premier-signe")!;
  assert.equal(step("offre").done, false);
  assert.equal(step("signe").done, true);
});

test("chemin — les cases manuelles ne se cochent que si on les coche", () => {
  const manualIds = STEPS.filter((s) => !s.auto).map((s) => s.id);
  assert.ok(manualIds.length > 0, "au moins une étape doit rester manuelle");

  const before = buildPath(ctx());
  assert.equal(before.phases.flatMap((p) => p.steps).find((s) => s.id === manualIds[0])!.done, false);

  const after = buildPath(ctx({ manual: [manualIds[0]] }));
  assert.equal(after.phases.flatMap((p) => p.steps).find((s) => s.id === manualIds[0])!.done, true);
});

test("chemin — « suivant » respecte l'ordre des phases", () => {
  // Tout branché sauf le carburant : la prochaine action est de charger,
  // pas d'aller envoyer des mails dans le vide.
  const p = buildPath(ctx({ ...ALL_ON, manual: STEPS.filter((s) => !s.auto).map((s) => s.id) }));
  assert.equal(p.next?.id, "fuel");
});

test("chemin — parcours complet : plus rien à faire, zéro minute restante", () => {
  const events: TimelineEvent[] = [evt("email"), evt("appel"), evt("linkedin")];
  for (let day = 1; day <= RHYTHM_DAYS; day++) {
    for (let i = 0; i < RHYTHM_MIN_TOUCHES; i++) {
      events.push({ id: `r${day}-${i}`, date: daysAgo(day), kind: "appel", summary: "x" });
    }
  }
  const prospects = [
    // Le tag « linkedin » marque une fiche entrée par le sourcing trié : sans
    // au moins une, l'étape « sourcer et trier » reste ouverte, et le parcours
    // n'est pas complet.
    ...Array.from({ length: FUEL_TARGET - 1 }, (_, i) => prospect({ id: `p${i}`, tags: ["linkedin"] })),
    prospect({ id: "p-signe", stage: "signe", events }),
  ];

  const p = buildPath(
    ctx({ ...ALL_ON, prospects, meetings: [meeting()], manual: STEPS.filter((s) => !s.auto).map((s) => s.id) })
  );
  assert.equal(p.next, null);
  assert.equal(p.done, p.total);
  assert.equal(p.minutesLeft, 0);
});

test("chemin — la position annoncée est celle de l'étape, pas le nombre de faites", () => {
  // Un appel consigné coche une étape TARDIVE : on reste bloqué à la
  // première. Annoncer « étape 2 » serait un mensonge d'affichage.
  const p = buildPath(ctx({ prospects: [prospect({ events: [evt("appel")] })] }));
  // « identite » est passée en tête du parcours : c'est elle, la première.
  assert.equal(p.next?.id, "identite");
  assert.equal(p.nextIndex, 1);
  assert.ok(p.done > 0, "une étape tardive est bien cochée");
});

test("chemin — les minutes restantes ne comptent que ce qui reste", () => {
  const all = buildPath(ctx()).minutesLeft;
  const withSmtp = buildPath(ctx({ health: { email: { configured: true } } })).minutesLeft;
  assert.equal(all - withSmtp, STEPS.find((s) => s.id === "smtp")!.minutes);
});
