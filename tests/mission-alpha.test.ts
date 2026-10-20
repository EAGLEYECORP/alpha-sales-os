import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useAlpha } from "../lib/store";
import { prospectDefaults, seedCampaigns } from "../lib/seed";
import { computeRoutines } from "../lib/routines";
import { presenceAlpha } from "../lib/presence-alpha";
import {
  executerMission, type ActionsMission, type ContexteMission, type EtapeMission, type IdEtape,
} from "../lib/mission-alpha";
import type { Campaign, Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION « LANCER ALPHA » — le bouton qui enchaîne le travail.
 *
 * Ce qu'on protège :
 *  · un bouton qui pourrait envoyer ou appeler (il n'en a pas le moyen) ;
 *  · une mission relancée qui ÉCRASE les brouillons déjà relus ou approuvés ;
 *  · des étapes qui défilent à vide sur un pipe vide, ou une progression
 *    inventée ;
 *  · un nombre de « choses qui t'attendent » différent de celui de la bande de
 *    présence (une seule définition : `computeRoutines`).
 *
 * Joué de bout en bout contre le VRAI store : c'est la chaîne qui doit tenir.
 * ─────────────────────────────────────────────────────────────────────
 */

const snapshot = useAlpha.getState();

const fiche = (id: string, over: Partial<Prospect> = {}): Prospect =>
  ({
    ...prospectDefaults,
    id,
    company: `Société ${id}`,
    name: `Contact ${id}`,
    sector: "autre",
    city: "Lyon",
    phone: "0465713456",
    email: `${id}@exemple.test`,
    stage: "prospect",
    nextStep: { date: new Date(Date.now() + 3 * 86_400_000).toISOString(), action: "Premier appel" },
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...over,
  }) as unknown as Prospect;

const campagne = (over: Partial<Campaign> = {}): Campaign => ({ ...seedCampaigns[0], id: "camp-test", name: "Test", sector: "tous", status: "active", ...over });

beforeEach(() => {
  useAlpha.setState({ ...snapshot, prospects: [], meetings: [], campaigns: [], drafts: [], activities: [] });
});

const etatReel = (email: boolean | null = null): ContexteMission => {
  const s = useAlpha.getState();
  return { prospects: s.prospects, meetings: s.meetings, campaigns: s.campaigns, drafts: s.drafts, accountId: s.settings.accountId, email };
};
const actionsReelles = (): ActionsMission & { appels: string[] } => {
  const appels: string[] = [];
  return {
    appels,
    preparerBrouillons: (id) => {
      appels.push(id);
      useAlpha.getState().prepareCampaignDrafts(id);
      const d = useAlpha.getState().drafts.filter((x) => x.campaignId === id);
      return { aRelire: d.filter((x) => x.status === "pending").length, ecartes: d.filter((x) => x.status === "skipped").length };
    },
  };
};
const instantane = async () => {};
const par = (etapes: readonly EtapeMission[], id: IdEtape) => etapes.find((e) => e.id === id)!;

// ── LE PARCOURS ─────────────────────────────────────────────────────────

test("les étapes s'enchaînent dans l'ordre, et chacune a de quoi se lire", async () => {
  useAlpha.setState({ prospects: [fiche("a"), fiche("b")], campaigns: [campagne()] });
  const b = await executerMission(() => etatReel(), actionsReelles(), () => {}, instantane);
  assert.deepEqual(b.etapes.map((e) => e.id), ["lire", "trier", "decider", "brouillons", "appels", "bilan"]);
  for (const e of b.etapes) {
    assert.ok(e.titre.length > 5, e.id);
    assert.ok(e.resume.length > 10, `${e.id} : une étape sans phrase est un silence`);
    for (const c of e.chiffres) assert.ok(Number.isInteger(c.valeur) && c.valeur >= 0, `${e.id}/${c.label}`);
  }
});

test("⚠ `rendre` reçoit la liste COMPLÈTE après chaque étape, dans l'ordre où elles FINISSENT", async () => {
  useAlpha.setState({ prospects: [fiche("a")], campaigns: [campagne()] });
  const vus: string[][] = [];
  await executerMission(() => etatReel(), actionsReelles(), (e) => vus.push(e.map((x) => x.id)), instantane);
  assert.equal(vus.length, 6);
  assert.deepEqual(vus[0], ["lire"]);
  assert.deepEqual(vus[2], ["lire", "trier", "decider"]);
});

test("⚠⚠ de bout en bout : les brouillons sont créés dans le VRAI store, à relire, et rien n'est parti", async () => {
  useAlpha.setState({ prospects: [fiche("a"), fiche("b"), fiche("c", { email: undefined })], campaigns: [campagne()] });
  const actions = actionsReelles();
  const b = await executerMission(() => etatReel(), actions, () => {}, instantane);

  const brouillons = useAlpha.getState().drafts;
  assert.equal(brouillons.length, 3);
  assert.equal(brouillons.filter((d) => d.status === "pending").length, 2, "deux ont une adresse");
  assert.equal(brouillons.filter((d) => d.status === "skipped").length, 1, "la fiche sans email est écartée, avec sa raison");
  assert.ok(!brouillons.some((d) => d.status === "sent" || d.status === "approved"), "aucun brouillon n'a avancé tout seul");

  const e = par(b.etapes, "brouillons");
  assert.equal(e.statut, "a-toi");
  assert.equal(e.chiffres.find((c) => c.label === "à relire")?.valeur, 2);
  assert.equal(b.brouillonsPrepares, 2);
  assert.deepEqual(actions.appels, ["camp-test"]);
  assert.match(par(b.etapes, "bilan").resume, /Rien n'est parti/);
  assert.equal(b.envoyes, 0);
});

test("⚠⚠ une mission RELANCÉE n'écrase JAMAIS les brouillons déjà relus ou approuvés", async () => {
  // `prepareCampaignDrafts` REMPLACE les brouillons d'une campagne : sans cette
  // garde, relancer le bouton perdrait la relecture de la veille.
  useAlpha.setState({ prospects: [fiche("a"), fiche("b")], campaigns: [campagne()] });
  await executerMission(() => etatReel(), actionsReelles(), () => {}, instantane);
  const premier = useAlpha.getState().drafts.find((d) => d.prospectId === "a")!;
  useAlpha.getState().updateDraft(premier.id, { body: "Texte RELU et corrigé par l'opérateur" });
  useAlpha.getState().setDraftStatus(premier.id, "approved");

  const actions = actionsReelles();
  const b = await executerMission(() => etatReel(), actions, () => {}, instantane);
  assert.deepEqual(actions.appels, [], "la campagne a déjà des brouillons : on n'y retouche pas");
  const apres = useAlpha.getState().drafts.find((d) => d.id === premier.id);
  assert.equal(apres?.status, "approved");
  assert.equal(apres?.body, "Texte RELU et corrigé par l'opérateur");
  assert.equal(par(b.etapes, "brouillons").chiffres.find((c) => c.label === "à relire")?.valeur, 1, "il en reste un à relire");
  assert.equal(b.brouillonsPrepares, 0, "rien de neuf n'a été préparé");
});

test("une campagne non active n'est pas touchée — pas de brouillon sur un brouillon de campagne", async () => {
  useAlpha.setState({ prospects: [fiche("a")], campaigns: [campagne({ status: "brouillon" })] });
  const actions = actionsReelles();
  const b = await executerMission(() => etatReel(), actions, () => {}, instantane);
  assert.deepEqual(actions.appels, []);
  const e = par(b.etapes, "brouillons");
  assert.equal(e.statut, "saute");
  assert.match(e.resume, /Aucune campagne active/);
  assert.equal(e.lien?.href, "/campaigns");
});

// ── LE PIPE VIDE ET LA DÉMO ─────────────────────────────────────────────

test("⚠ un pipe VIDE le dit et ne fait pas défiler quatre étapes à vide", async () => {
  const actions = actionsReelles();
  const b = await executerMission(() => etatReel(), actions, () => {}, instantane);
  assert.equal(par(b.etapes, "lire").statut, "vide");
  assert.match(par(b.etapes, "lire").resume, /pipe est vide/);
  for (const id of ["trier", "decider", "brouillons", "appels"] as const) {
    assert.equal(par(b.etapes, id).statut, "saute", id);
  }
  assert.deepEqual(actions.appels, [], "rien n'est préparé sur du vide");
  assert.equal(b.aToi, 0);
});

test("⚠ sur des fiches de DÉMONSTRATION, la mission le dit et n'écrit rien d'envoyable", async () => {
  const demo = fiche("demo-1", { id: "demo-1" });
  useAlpha.setState({ prospects: [demo], campaigns: [campagne()] });
  const b = await executerMission(() => etatReel(), actionsReelles(), () => {}, instantane);
  assert.equal(b.demo, true);
  assert.match(par(b.etapes, "lire").resume, /DÉMONSTRATION/);
  assert.equal(useAlpha.getState().drafts.filter((d) => d.status === "pending").length, 0, "une adresse inventée ne devient jamais un brouillon envoyable");
  assert.match(par(b.etapes, "brouillons").resume, /démonstration/i);
});

// ── LA BOÎTE D'ENVOI ────────────────────────────────────────────────────

test("⚠ la boîte d'envoi n'est réclamée QUE si elle manque ET qu'il y a quelque chose à envoyer", async () => {
  useAlpha.setState({ prospects: [fiche("a")], campaigns: [campagne()] });
  const manque = await executerMission(() => etatReel(false), actionsReelles(), () => {}, instantane);
  assert.equal(par(manque.etapes, "brouillons").besoin, "email");
  assert.ok(par(manque.etapes, "brouillons").details.some((d) => /boîte d'envoi/.test(d.texte)));

  useAlpha.setState({ drafts: [] });
  const branchee = await executerMission(() => etatReel(true), actionsReelles(), () => {}, instantane);
  assert.equal(par(branchee.etapes, "brouillons").besoin, undefined);

  useAlpha.setState({ drafts: [] });
  const sansObjet = await executerMission(() => etatReel(null), actionsReelles(), () => {}, instantane);
  assert.equal(par(sansObjet.etapes, "brouillons").besoin, undefined, "null = la question ne se pose pas (maître, installation client)");
});

test("pas de brouillon à relire → pas de réclamation de boîte, même si elle manque", async () => {
  useAlpha.setState({ prospects: [fiche("a", { email: undefined })], campaigns: [campagne()] });
  const b = await executerMission(() => etatReel(false), actionsReelles(), () => {}, instantane);
  assert.equal(par(b.etapes, "brouillons").besoin, undefined);
});

// ── UNE SEULE DÉFINITION DE « CE QUI T'ATTEND » ─────────────────────────

test("⚠⚠ le bilan compte comme la bande de présence : `computeRoutines`, calculé APRÈS la préparation", async () => {
  useAlpha.setState({ prospects: [fiche("a"), fiche("b", { nextStep: null })], campaigns: [campagne()] });
  const b = await executerMission(() => etatReel(), actionsReelles(), () => {}, instantane);
  const s = useAlpha.getState();
  const attendu = presenceAlpha(computeRoutines({ prospects: s.prospects, meetings: s.meetings, campaigns: s.campaigns, drafts: s.drafts })).aToi;
  assert.equal(b.aToi, attendu);
  assert.ok(b.aToi >= 2, "une fiche sans prochaine étape + des messages à relire");
  assert.equal(par(b.etapes, "bilan").chiffres.find((c) => c.label === "à toi")?.valeur, attendu);
});

// ── CE QUE LA MISSION N'A PAS LE DROIT DE FAIRE ─────────────────────────

const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lire = (f: string) => sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));

test("⚠⚠ la mission n'a AUCUN moyen d'envoyer, d'appeler ou de supprimer : un seul geste, et il prépare", () => {
  const lib = lire("lib/mission-alpha.ts");
  const bloc = lib.match(/export interface ActionsMission\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const gestes = [...bloc.matchAll(/^\s*(\w+)\s*\(/gm)].map((m) => m[1]);
  assert.deepEqual(gestes, ["preparerBrouillons"], "ajouter un geste ici est donner la gâchette à l'agent : ça se décide dans un commit");
  assert.doesNotMatch(lib, /\/api\/send|\/api\/voice|sendMail|fetch\s*\(/, "la lib ne parle à aucun serveur");
  assert.doesNotMatch(lib, /deleteProspect|clearAllData|moveStage|setDraftStatus/, "ni suppression, ni avancement de fiche, ni approbation de brouillon");
});

test("⚠ le composant ne donne à la mission que ce seul geste", () => {
  const c = lire("components/mission/lancer-alpha.tsx");
  const actions = c.match(/const actions: ActionsMission = \{([\s\S]*?)\n    \};/)?.[1] ?? "";
  const cles = [...actions.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(cles, ["preparerBrouillons"]);
  assert.match(c, /Rien n'a été envoyé/, "la trace dans l'activité le dit");
});

test("⚠ aucun délai d'ambiance, aucune progression inventée", () => {
  const lib = lire("lib/mission-alpha.ts");
  const comp = lire("components/mission/lancer-alpha.tsx");
  assert.doesNotMatch(lib, /setTimeout\s*\([^)]*,\s*[1-9]/, "une étape instantanée est instantanée");
  assert.doesNotMatch(comp, /setTimeout|setInterval|progress|%\s*\)/i);
  assert.doesNotMatch(comp, /role=["']progressbar/);
});

// ── LE BRANCHEMENT ──────────────────────────────────────────────────────

test("⚠⚠ le bouton est MONTÉ sur l'écran où l'on commence la journée, et appelle la vraie mission", () => {
  const page = lire("app/(app)/aujourdhui/page.tsx");
  assert.match(page, /from "@\/components\/mission\/lancer-alpha"/);
  assert.match(page, /<LancerAlpha\s*\/>/, "une mission que nul écran ne monte est un module mort");
  const comp = lire("components/mission/lancer-alpha.tsx");
  assert.match(comp, /executerMission\s*\(/);
  assert.match(comp, /BoiteEnvoi/, "la boîte se branche sur place, sans changer d'écran");
  assert.match(comp, /logActivity\s*\(/, "ce que la mission a fait laisse une trace");
});

test("le composant ne réclame la boîte d'envoi qu'à un compte locataire", () => {
  const comp = lire("components/mission/lancer-alpha.tsx");
  assert.match(comp, /droits\.session && !droits\.maitre && !droits\.solo && !droits\.exploitant/);
});
