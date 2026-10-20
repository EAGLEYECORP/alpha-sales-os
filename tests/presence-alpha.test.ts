import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ETAT_NOTIFICATION_INITIAL, INTERVALLE_NOTIFICATION_MS, presenceAlpha, prochaineNotification,
  type EtatNotification,
} from "../lib/presence-alpha";
import { computeRoutines, type Routine } from "../lib/routines";
import { fenetreOuverte } from "../lib/conformite";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « ALPHA A BESOIN DE TOI » — la bande de présence et sa notification.
 *
 * Ce qu'on protège :
 *  · une cinquième définition de « ce qui attend un humain » (la bande lit
 *    `computeRoutines`, elle ne recompte rien) ;
 *  · une notification qui rejoue l'arriéré à chaque ouverture ;
 *  · une rafale de notifications, ou une à deux heures du matin ;
 *  · une nouveauté tue (hors fenêtre) marquée « vue » sans avoir été dite.
 * ─────────────────────────────────────────────────────────────────────
 */

// Mardi 20 octobre 2026, 10 h à Paris : dans la fenêtre utile.
const OUVERT = new Date("2026-10-20T08:30:00.000Z");
// Mardi 20 octobre 2026, 23 h à Paris : hors fenêtre.
const NUIT = new Date("2026-10-20T21:30:00.000Z");
// Samedi 24 octobre 2026, 11 h à Paris.
const WEEKEND = new Date("2026-10-24T09:00:00.000Z");

const routine = (id: string, priority: Routine["priority"], title = `Tâche ${id}`): Routine => ({
  id, priority, category: "relance", title, detail: `détail ${id}`, href: `/prospects/${id}`,
});

test("les fenêtres de test sont celles qu'on croit", () => {
  assert.equal(fenetreOuverte(OUVERT).open, true);
  assert.equal(fenetreOuverte(NUIT).open, false);
  assert.equal(fenetreOuverte(WEEKEND).open, false);
});

// ── LA PRÉSENCE ─────────────────────────────────────────────────────────

test("rien ne t'attend : « rien », pas de préfixe d'onglet", () => {
  const p = presenceAlpha([]);
  assert.equal(p.etat, "rien");
  assert.equal(p.aToi, 0);
  assert.equal(p.premiere, null);
  assert.equal(p.prefixeOnglet, "");
  assert.match(p.phrase, /rien n'attend/i);
});

test("⚠ seules les routines HAUTE et MOYENNE comptent : une basse n'interrompt personne", () => {
  const p = presenceAlpha([routine("a", "basse"), routine("b", "basse")]);
  assert.equal(p.etat, "rien", "un point satisfaction ne fait pas dire « ALPHA a besoin de toi »");
  const q = presenceAlpha([routine("a", "basse"), routine("b", "moyenne"), routine("c", "haute")]);
  assert.equal(q.aToi, 2);
  assert.equal(q.urgentes, 1);
});

test("la première chose à faire est la plus URGENTE, pas la première de la liste", () => {
  const p = presenceAlpha([routine("m", "moyenne"), routine("h", "haute")]);
  assert.equal(p.premiere?.id, "h");
  assert.equal(p.prefixeOnglet, "(2) ");
  assert.match(p.phrase, /dont 1 urgente/);
});

test("le préfixe d'onglet se plafonne à l'affichage, jamais le compte", () => {
  const beaucoup = Array.from({ length: 250 }, (_, i) => routine(`r${i}`, "haute"));
  const p = presenceAlpha(beaucoup);
  assert.equal(p.aToi, 250, "le compte reste exact");
  assert.equal(p.prefixeOnglet, "(99+) ");
});

test("⚠⚠ elle lit `computeRoutines` : une fiche sans prochaine étape y devient « ALPHA a besoin de toi »", () => {
  // Bout en bout : de l'état du CRM à la bande, sans recompter quoi que ce soit.
  const p = {
    id: "p1", company: "Atelier Test", name: "", stage: "prospect", nextStep: null, payments: [], objections: [],
    events: [], tags: [], deepAudit: {}, contract: { status: "aucun" }, delivery: "non-demarre", satisfaction: undefined,
  } as unknown as Prospect;
  const routines = computeRoutines({ prospects: [p], meetings: [], campaigns: [], drafts: [] });
  assert.ok(routines.some((r) => r.id === "nostep-p1"));
  const presence = presenceAlpha(routines);
  assert.equal(presence.etat, "attend");
  assert.ok(presence.aToi >= 1);
});

// ── LA NOTIFICATION ─────────────────────────────────────────────────────

test("⚠⚠ le premier passage est une LIGNE DE BASE : l'arriéré ne se rejoue pas à l'ouverture", () => {
  const arriere = [routine("a", "haute"), routine("b", "haute"), routine("c", "haute")];
  const r = prochaineNotification(ETAT_NOTIFICATION_INITIAL, arriere, OUVERT);
  assert.equal(r.message, null);
  assert.deepEqual([...(r.suivant.vus ?? [])].sort(), ["a", "b", "c"]);
});

test("une NOUVEAUTÉ haute, dans la fenêtre utile, notifie — et dit où aller", () => {
  const base: EtatNotification = { vus: new Set(["a"]), dernierEnvoiMs: null };
  const r = prochaineNotification(base, [routine("a", "haute"), routine("b", "haute", "Relancer Atelier Moreau")], OUVERT);
  assert.ok(r.message);
  assert.equal(r.message.title, "ALPHA a besoin de toi");
  assert.match(r.message.body, /Relancer Atelier Moreau/);
  assert.equal(r.message.url, "/prospects/b", "l'écran où l'action se fait, pas l'accueil");
  assert.equal(r.message.tag, "alpha-besoin");
  assert.equal(r.suivant.dernierEnvoiMs, OUVERT.getTime());
  assert.ok(r.suivant.vus?.has("b"));
});

test("⚠ UNE notification par passage : trois nouveautés = un seul message", () => {
  const base: EtatNotification = { vus: new Set(), dernierEnvoiMs: null };
  const r = prochaineNotification(base, [routine("a", "haute"), routine("b", "haute"), routine("c", "haute")], OUVERT);
  assert.match(r.message!.title, /3 nouveaux/);
  assert.match(r.message!.body, /\+2 autres/);
  // Et tout est « vu » : le passage suivant ne renotifie pas les deux autres.
  const suite = prochaineNotification(r.suivant, [routine("a", "haute"), routine("b", "haute"), routine("c", "haute")], OUVERT);
  assert.equal(suite.message, null);
});

test("une routine MOYENNE n'interrompt pas", () => {
  const base: EtatNotification = { vus: new Set(), dernierEnvoiMs: null };
  assert.equal(prochaineNotification(base, [routine("m", "moyenne")], OUVERT).message, null);
});

test("⚠⚠ hors fenêtre utile on se tait — et la nouveauté RESTE nouvelle", () => {
  const base: EtatNotification = { vus: new Set(), dernierEnvoiMs: null };
  const nuit = prochaineNotification(base, [routine("tard", "haute")], NUIT);
  assert.equal(nuit.message, null, "pas de notification à 23 h");
  assert.ok(!nuit.suivant.vus?.has("tard"), "marquée « vue » sans avoir été dite, elle ne serait jamais notifiée");
  const weekend = prochaineNotification(base, [routine("tard", "haute")], WEEKEND);
  assert.equal(weekend.message, null, "ni le week-end");
  // Le matin venu, elle part.
  const matin = prochaineNotification(nuit.suivant, [routine("tard", "haute")], OUVERT);
  assert.ok(matin.message, "la nouveauté tue hier soir doit partir au premier passage utile");
});

test("⚠ un intervalle minimal entre deux notifications, et la nouveauté attend", () => {
  const apres: EtatNotification = { vus: new Set(["a"]), dernierEnvoiMs: OUVERT.getTime() };
  const tropTot = new Date(OUVERT.getTime() + INTERVALLE_NOTIFICATION_MS - 1_000);
  const r1 = prochaineNotification(apres, [routine("a", "haute"), routine("b", "haute")], tropTot);
  assert.equal(r1.message, null);
  assert.ok(!r1.suivant.vus?.has("b"), "elle reste nouvelle");
  const assezTard = new Date(OUVERT.getTime() + INTERVALLE_NOTIFICATION_MS + 1_000);
  assert.ok(prochaineNotification(r1.suivant, [routine("a", "haute"), routine("b", "haute")], assezTard).message);
});

test("une routine résolue sort des « vues » : si elle revient, c'est une nouveauté", () => {
  const base: EtatNotification = { vus: new Set(["a", "b"]), dernierEnvoiMs: null };
  const resolue = prochaineNotification(base, [routine("a", "haute")], OUVERT);
  assert.equal(resolue.message, null);
  assert.ok(!resolue.suivant.vus?.has("b"));
  const revient = prochaineNotification(resolue.suivant, [routine("a", "haute"), routine("b", "haute")], OUVERT);
  assert.ok(revient.message);
});

// ── LE BRANCHEMENT ──────────────────────────────────────────────────────

const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lire = (f: string) => sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));

test("⚠⚠ la bande est MONTÉE dans la coquille, et lit `computeRoutines` (aucune définition de plus)", () => {
  const coquille = lire("components/shell/app-shell.tsx");
  assert.match(coquille, /import\s*\{\s*AlphaPresence\s*\}\s*from\s*"@\/components\/shell\/alpha-presence"/);
  assert.match(coquille, /<AlphaPresence\s*\/>/, "une bande qu'aucun écran ne monte est un module mort");
  const composant = lire("components/shell/alpha-presence.tsx");
  assert.match(composant, /computeRoutines\s*\(/);
  assert.match(composant, /prochaineNotification\s*\(/);
  assert.match(composant, /presenceAlpha\s*\(/);
  const lib = lire("lib/presence-alpha.ts");
  assert.doesNotMatch(lib, /nextStep|\.stage\b|\.payments/, "la lib ne doit pas relire les fiches : elle lit des routines");
});

test("⚠ la notification n'ouvre JAMAIS de demande de permission toute seule", () => {
  const composant = lire("components/shell/alpha-presence.tsx");
  const appels = composant.match(/requestPermission/g) ?? [];
  assert.equal(appels.length, 1, "une seule occurrence : celle du bouton");
  assert.match(composant, /onClick=\{[^}]*requestPermission/s, "la demande part d'un GESTE, pas d'un effet");
});

test("⚠ la bande dit que les alertes ne partent que l'onglet ouvert — elle ne promet pas l'app fermée", () => {
  const composant = readFileSync(join(process.cwd(), "components/shell/alpha-presence.tsx"), "utf8");
  assert.match(composant, /onglet reste ouvert/);
});
