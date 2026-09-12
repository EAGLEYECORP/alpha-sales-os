import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prospect, meeting, daysAgo } from "./fixtures";
import type { TimelineEvent } from "../lib/types";
import {
  buildPath,
  rhythmDays,
  FUEL_TARGET,
  RHYTHM_DAYS,
  RHYTHM_MIN_TOUCHES,
  STEPS,
  repartirParSurface,
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

/* ────────────────────────────────────────────────────────────────────
   LE PARCOURS S'ARRÊTAIT AU DEUXIÈME BARREAU SUR UN TÉLÉPHONE.

   ⚠⚠ CE QUE ÇA COÛTAIT, et rien ne le disait. `/demarrage` déroule dix-huit
   étapes dans l'ordre. La deuxième est « Brancher l'envoi email », dont le
   premier geste est « colle-le dans .env.local ». Sur un téléphone, ce geste
   n'existe pas.

   Quelqu'un qui s'inscrit depuis son mobile voyait donc la marche 1 réussie,
   la marche 2 impossible, et n'apprenait NULLE PART que les treize suivantes
   se font très bien au pouce. Il reposait le téléphone en pensant que le
   produit n'était pas pour lui. Le produit était déjà mobile ; c'est son
   parcours d'installation qui ne le savait pas.
   ──────────────────────────────────────────────────────────────────── */

test("⚠⚠ CHAQUE ÉTAPE DÉCLARE SA SURFACE — le champ est obligatoire", () => {
  /**
   * ⚠ Le compilateur l'impose déjà, et ce test tient l'autre moitié : un
   * défaut implicite (« si rien n'est écrit, c'est faisable au téléphone »)
   * ferait passer une étape de plomberie pour une étape de pouce au premier
   * ajout distrait.
   *
   * Mesuré pendant l'écriture : le script qui a posé ces valeurs a SAUTÉ
   * `n8n` — son identifiant contient un chiffre — et c'est `tsc` qui l'a
   * rattrapé, pas une relecture.
   */
  for (const s of STEPS) {
    assert.ok(
      s.surface === "partout" || s.surface === "ordinateur",
      `${s.id} : surface non déclarée`
    );
  }
});

test("⚠⚠ UNE ÉTAPE « ORDINATEUR » DIT POURQUOI, JAMAIS « pas sur mobile »", () => {
  /**
   * ⚠ « Pas faisable sur mobile » sans raison se lit comme une limite du
   * PRODUIT, alors que c'est une limite du GESTE — écrire dans un fichier du
   * serveur, publier chez un registrar. La nuance décide si la personne
   * attend d'être devant son ordinateur, ou si elle abandonne.
   */
  for (const s of STEPS.filter((x) => x.surface === "ordinateur")) {
    assert.ok(
      (s.motifSurface ?? "").length > 40,
      `${s.id} exige un ordinateur sans dire pourquoi — la limite paraît venir du produit`
    );
  }
  // Et le contraire : un motif sur une étape faisable au pouce serait une
  // contradiction affichée à l'écran.
  for (const s of STEPS.filter((x) => x.surface === "partout")) {
    assert.equal(s.motifSurface, undefined, `${s.id} est faisable partout et porte un motif d'ordinateur`);
  }
});

test("⚠⚠ LA MAJORITÉ DU PARCOURS SE FAIT DEPUIS UN TÉLÉPHONE", () => {
  /**
   * C'est la mesure qui a motivé tout le reste, et elle doit rester vraie :
   * si quelqu'un reclasse la moitié des étapes en « ordinateur », l'affirmation
   * « on peut s'installer depuis son téléphone » devient un mensonge
   * commercial, et ce test tombe avant qu'elle ne soit publiée.
   */
  const pouce = STEPS.filter((s) => s.surface === "partout").length;
  const ordi = STEPS.filter((s) => s.surface === "ordinateur").length;
  assert.ok(pouce > ordi * 2, `${pouce} étapes au pouce contre ${ordi} sur ordinateur — l'installation mobile n'est plus vraie`);
});

test("⚠⚠ LES ÉTAPES D'ORDINATEUR NE SONT PAS CACHÉES SUR MOBILE", () => {
  /**
   * ⚠⚠ LE POINT ENTIER. La tentation est de filtrer : écran propre, parcours
   * qui avance, personne ne bute. Ce serait reproduire le défaut déjà payé sur
   * le rail — masquer une porte n'apprend pas qu'elle existe, ça apprend que
   * le produit est plus petit qu'il n'est.
   *
   * Pire ici : quelqu'un finirait son parcours mobile en croyant avoir tout
   * installé, alors que ses emails ne peuvent pas partir.
   */
  const path = buildPath(ctx());
  const r = repartirParSurface(path);

  assert.ok(r.surOrdinateur.length > 0, "aucune étape d'ordinateur listée — elles ont été filtrées, pas séparées");
  assert.ok(r.auPouce.length > 0, "aucune étape faisable au téléphone : la répartition ne sert à rien");

  const total = path.phases.flatMap((p) => p.steps).filter((s) => !s.done).length;
  assert.equal(
    r.auPouce.length + r.surOrdinateur.length,
    total,
    "des étapes ont disparu de la répartition — un parcours incomplet se termine en croyant avoir tout fait"
  );
});

test("⚠ la prochaine action au pouce respecte l'ORDRE du parcours", () => {
  // Brancher avant de charger, charger avant d'envoyer. Un tri qui remonterait
  // les étapes faisables casserait le raisonnement qui fait tenir la séquence.
  const path = buildPath(ctx());
  const r = repartirParSurface(path);
  const ordre = path.phases.flatMap((p) => p.steps).map((s) => s.id);
  const positions = r.auPouce.map((s) => ordre.indexOf(s.id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "les étapes au pouce ont été réordonnées");
  assert.equal(r.prochaineAuPouce?.id, r.auPouce[0]?.id, "la prochaine action n'est pas la première de la liste");
});

test("⚠⚠ « RIEN À FAIRE ICI » ET « TU AS FINI » NE SE DISENT PAS PAREIL", () => {
  /**
   * Quand il ne reste que des étapes d'ordinateur, un écran vide se lirait
   * « tu as terminé ». C'est le même mode de panne que le moniteur qui affiche
   * du calme quand la base est injoignable : zéro parce que c'est fini et zéro
   * parce qu'on est bloqué demandent deux gestes opposés.
   */
  const path = buildPath(ctx());
  const toutes = path.phases.flatMap((p) => p.steps);

  // On simule le cas : toutes les étapes de pouce faites, la plomberie non.
  const bloque = repartirParSurface({
    ...path,
    phases: path.phases.map((ph) => ({
      ...ph,
      steps: ph.steps.map((s) => (s.surface === "partout" ? { ...s, done: true } : s)),
    })),
  });
  assert.equal(bloque.auPouce.length, 0);
  assert.ok(bloque.bloqueSurMobile, "le parcours est bloqué sur mobile et ne le dit pas — l'écran se lira « terminé »");

  // Et le vrai « fini » : plus rien du tout, donc pas de blocage à annoncer.
  const fini = repartirParSurface({
    ...path,
    phases: path.phases.map((ph) => ({ ...ph, steps: ph.steps.map((s) => ({ ...s, done: true })) })),
  });
  assert.equal(fini.bloqueSurMobile, false, "un parcours terminé ne doit pas annoncer un blocage");
  assert.ok(toutes.length > 0, "le parcours est vide — le test ne mesure rien");
});

test("⚠⚠ L'ÉCRAN CONSOMME LA RÉPARTITION — sinon le module est mort", () => {
  /**
   * ⚠ LE DÉFAUT LE PLUS FRÉQUENT DE CE DÉPÔT : un mécanisme juste, testé,
   * correct — branché nulle part. Tous les tests ci-dessus passeraient sur un
   * `repartirParSurface` que `/demarrage` n'appelle pas, pendant qu'un
   * téléphone continuerait de servir « colle-le dans .env.local » comme
   * première action.
   */
  const page = readFileSync(join(process.cwd(), "app/(app)/demarrage/page.tsx"), "utf8");
  assert.match(page, /repartirParSurface\(path\)/, "l'écran ne calcule pas la répartition");
  assert.match(page, /mobile\.surOrdinateur/, "l'écran ne liste pas les étapes qui exigent une machine");
  assert.match(page, /mobile\.bloqueSurMobile/, "l'écran ne distingue pas « bloqué ici » de « terminé »");
  assert.match(page, /md:hidden/, "le bloc mobile s'afficherait aussi sur ordinateur, où il n'a rien à dire");
});
