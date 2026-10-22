import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  FENETRE_CREATION_JOURS,
  FENETRE_EXCLUSION_MOIS,
  FENETRE_SIGNAL_JOURS,
  FRAICHEUR_JOURS,
  LECTURES_SIMULTANEES,
  exclusionPublique,
  lectureAFaire,
  lireAnnonces,
  lireLot,
  lireSignaux,
  momentFrais,
  phraseDuMoment,
  urlDeLecture,
  type AnnonceBodacc,
  type LectureSignaux,
} from "../lib/signaux-publics";
import { normaliserSiren, sirenDeLaFiche, sirenValide } from "../lib/siren";
import { buildCallSession, callAngle, verticalsWithTargets } from "../lib/call-session";
import { buildCampaignRun } from "../lib/campaign-runner";
import { csvToProspects } from "../lib/csv";
import { prospectDefaults, seedCampaigns } from "../lib/seed";
import { computeRoutines } from "../lib/routines";
import { useAlpha } from "../lib/store";
import { DO_NOT_CALL_TAG } from "../lib/voice-script";
import type { Prospect } from "../lib/types";
import { sansCommentaires } from "./citations-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SIGNAUX PUBLICS (BODACC) — 22/10/2026.
 *
 * ⚠ AUCUNE ANNONCE RÉELLE ICI. Les fixtures ont la FORME de l'API réelle
 * (champs JSON en chaîne, registre en liste avec et sans espaces — relevé le
 * jour même), et des contenus inventés. Les SIREN sont choisis HORS de tout
 * registre : un numéro à neuf chiffres qui passe la clé de Luhn appartient
 * presque toujours à une vraie société (cinq essais sur cinq, vérifiés). Ceux
 * d'ici ont été cherchés au BODACC et au registre national : zéro résultat.
 * ─────────────────────────────────────────────────────────────────────
 */

const A = "000000018";
const B = "000000034";
const C = "000000042";
const NOW = new Date("2026-10-22T10:00:00Z");
const ilYa = (jours: number) => new Date(NOW.getTime() - jours * 86_400_000).toISOString().slice(0, 10);
const URL_FICTIVE = (n: string) => `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:FICTION${n}`;

let n = 0;
function annonce(famille: string, jours: number, extra: Partial<AnnonceBodacc> = {}, siren = A): AnnonceBodacc {
  n++;
  return {
    dateparution: ilYa(jours),
    familleavis: famille,
    typeavis: "annonce",
    modificationsgenerales: null,
    jugement: null,
    acte: null,
    url_complete: URL_FICTIVE(String(n)),
    registre: [siren, `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6)}`],
    ...extra,
  };
}
const modif = (descriptif: string, jours: number) => annonce("modification", jours, { modificationsgenerales: JSON.stringify({ descriptif }) });
const jugement = (nature: string, complementJugement: string, jours: number, famille = "collective") =>
  annonce(famille, jours, { jugement: JSON.stringify({ type: "initial", famille: "Extrait de jugement", nature, complementJugement }) });

// ── 1 · LES EXCLUSIONS ──────────────────────────────────────────────────

test("⚠⚠ une liquidation récente EXCLUT, se nomme, garde son lien — et efface tout moment", () => {
  const l = lireSignaux(A, [modif("Modification survenue sur l'administration.", 10), jugement("Jugement d'ouverture de liquidation judiciaire", "Jugement prononçant la liquidation judiciaire", 30)], NOW);
  assert.equal(l.exclusion?.motif, "procedure-collective");
  assert.match(l.exclusion!.libelle, /^Liquidation judiciaire \(BODACC du \d{2}\/\d{2}\/\d{4}\)$/);
  assert.match(l.exclusion!.source, /^https:\/\/www\.bodacc\.fr\//);
  assert.deepEqual(l.signaux, [], "une société exclue n'a pas de moment : on ne la remonte pas");
});

test("la clôture se dit clôture, la conciliation se dit conciliation — jamais « problème financier »", () => {
  const cloture = lireSignaux(A, [jugement("Autre jugement et ordonnance", "Clôture pour insuffisance d'actif de la liquidation judiciaire", 5)], NOW);
  assert.match(cloture.exclusion!.libelle, /^Clôture de procédure collective/);
  const concil = lireSignaux(A, [jugement("Jugement d'homologation de l'accord", "accord intervenu dans la procédure de conciliation", 5, "conciliation")], NOW);
  assert.match(concil.exclusion!.libelle, /^Accord de conciliation homologué/);
});

test(`une procédure de plus de ${FENETRE_EXCLUSION_MOIS} mois n'exclut plus — la société a pu se relever`, () => {
  const vieille = jugement("Jugement d'ouverture", "redressement judiciaire", FENETRE_EXCLUSION_MOIS * 31);
  assert.equal(lireSignaux(A, [vieille], NOW).exclusion, null);
  const recente = jugement("Jugement d'ouverture", "redressement judiciaire", FENETRE_EXCLUSION_MOIS * 29);
  assert.equal(lireSignaux(A, [recente], NOW).exclusion?.motif, "procedure-collective");
});

test("⚠ une radiation exclut sans limite d'âge — SAUF si le SIREN a repris vie après (relevé réel)", () => {
  assert.equal(lireSignaux(A, [annonce("creation", 2000), annonce("radiation", 1500)], NOW).exclusion?.motif, "radiation");
  // Créée, radiée, recréée sous le même numéro : la forme exacte relevée sur l'API.
  const revenue = lireSignaux(A, [annonce("creation", 500), annonce("radiation", 180), annonce("creation", 80)], NOW);
  assert.equal(revenue.exclusion, null);
  assert.equal(revenue.signaux[0]?.type, "creation");
});

test("une dissolution exclut même quand l'annonce parle AUSSI d'administration", () => {
  const l = lireSignaux(A, [modif("Modification survenue sur l'administration, cessation d'activité, dissolution de la société.", 20)], NOW);
  assert.equal(l.exclusion?.motif, "dissolution");
  assert.deepEqual(l.signaux, []);
  assert.equal(lireSignaux(A, [modif("transmission universelle du patrimoine.", 20)], NOW).exclusion?.motif, "dissolution");
});

test("une annonce d'ANNULATION ne compte pas", () => {
  const annulee = { ...jugement("Jugement d'ouverture", "liquidation judiciaire", 10), typeavis: "annulation" };
  const l = lireSignaux(A, [annulee], NOW);
  assert.equal(l.exclusion, null);
  assert.equal(l.annonces, 0);
});

// ── 2 · LES MOMENTS — tournures relevées sur cent descriptifs réels ──────

test("⚠ « Modification du capital » est un moment ; une DIMINUTION n'en est pas un", () => {
  assert.equal(lireSignaux(A, [modif("Modification du capital.", 10)], NOW).signaux[0]?.type, "capital");
  assert.equal(lireSignaux(A, [modif("modification survenue sur le capital (augmentation) et l'administration", 10)], NOW).signaux.length, 2);
  assert.deepEqual(lireSignaux(A, [modif("modification survenue sur le capital (diminution)", 10)], NOW).signaux, []);
});

test("⚠ « Nouveau siège » et l'adresse du siège sont des déménagements", () => {
  for (const d of ["Nouveau siège.", "transfert du siège social.", "modification survenue sur l'adresse du siège", "transfert de l'établissement principal."]) {
    assert.equal(lireSignaux(A, [modif(d, 10)], NOW).signaux[0]?.type, "demenagement", d);
  }
});

test("⚠⚠ une IMMATRICULATION « suite à transfert » est un DÉMÉNAGEMENT, pas une création (relevé réel)", () => {
  const im = annonce("immatriculation", 15, { acte: JSON.stringify({ descriptif: "Immatriculation d'une personne morale suite au transfert du siège hors ressort." }) });
  const l = lireSignaux(A, [annonce("creation", 4000), im], NOW);
  assert.deepEqual(l.signaux.map((s) => s.type), ["demenagement"], "une société de 2015 ne devient pas une jeune société");
  const autre = annonce("immatriculation", 15, { acte: JSON.stringify({ descriptif: "Apport partiel d'actif." }) });
  assert.deepEqual(lireSignaux(A, [autre], NOW).signaux, []);
});

const precedent = (siren: string) =>
  JSON.stringify({ personne: { typePersonne: "pm", numeroImmatriculation: { numeroIdentification: `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6)}`, codeRCS: "RCS" }, denomination: "FICTION (démo)" } });

test("⚠⚠ une VENTE où la fiche est l'ANCIEN propriétaire n'est pas un rachat — elle a cédé", () => {
  const vente = annonce("vente", 20, { registre: [B, "000 000 034", A, "000 000 018"], listeprecedentproprietaire: precedent(A) });
  assert.deepEqual(lireSignaux(A, [vente], NOW).signaux, [], "A est le cédant");
  assert.equal(lireSignaux(A, [vente], NOW).exclusion, null, "céder un fonds n'est pas disparaître");
  assert.equal(lireSignaux(B, [vente], NOW).signaux[0]?.libelle, "Rachat d'un fonds de commerce", "B est l'acheteur");
});

test("⚠⚠ une FUSION range l'absorbée EN TÊTE du registre — c'est la liste des anciens propriétaires qui tranche (relevé réel)", () => {
  // Forme relevée le 22/10/2026 : 3 « cédants » sur 10 sortaient en rachat.
  const fusion = annonce("vente", 9, {
    registre: [A, "000 000 018"],
    listeprecedentproprietaire: precedent(A),
    acte: JSON.stringify({ descriptif: "Avis relatif au projet commun de fusion. Société absorbée : FICTION (démo)." }),
  });
  assert.deepEqual(lireSignaux(A, [fusion], NOW).signaux, [], "l'absorbée n'achète rien");
  const absorbante = { ...fusion, registre: [B, "000 000 034", A, "000 000 018"] };
  assert.equal(lireSignaux(B, [absorbante], NOW).signaux[0]?.libelle, "Fusion ou apport d'actifs");
  // Sans liste d'anciens propriétaires, l'ordre du registre sert à défaut.
  const sansListe = annonce("vente", 9, { registre: [B, "000 000 034", A, "000 000 018"] });
  assert.deepEqual(lireSignaux(A, [sansListe], NOW).signaux, []);
  assert.equal(lireSignaux(B, [sansListe], NOW).signaux[0]?.type, "rachat");
});

test("nouvelle direction, activité, nouveau nom — chacun nommé par sa tournure réelle", () => {
  const l = lireSignaux(A, [modif("Modification de la dénomination. Modification de l'administration.", 12), modif("Mise en activité de la société.", 40)], NOW);
  assert.deepEqual(new Set(l.signaux.map((s) => s.type)), new Set(["nouveau-nom", "nouvelle-direction", "activite"]));
});

test(`les fenêtres : ${FENETRE_SIGNAL_JOURS} j pour un changement, ${FENETRE_CREATION_JOURS} j pour une création`, () => {
  assert.deepEqual(lireSignaux(A, [modif("Modification de l'administration.", FENETRE_SIGNAL_JOURS + 5)], NOW).signaux, []);
  assert.equal(lireSignaux(A, [modif("Modification de l'administration.", FENETRE_SIGNAL_JOURS - 5)], NOW).signaux.length, 1);
  assert.equal(lireSignaux(A, [annonce("creation", FENETRE_CREATION_JOURS - 5)], NOW).signaux[0]?.type, "creation");
  assert.deepEqual(lireSignaux(A, [annonce("creation", FENETRE_CREATION_JOURS + 5)], NOW).signaux, []);
});

test("un moment par famille, le plus récent, et la liste va du plus récent au plus ancien", () => {
  const l = lireSignaux(A, [modif("Modification de l'administration.", 90), modif("transfert du siège social.", 50), modif("Modification de l'administration.", 8)], NOW);
  assert.deepEqual(l.signaux.map((s) => [s.type, s.date]), [["nouvelle-direction", ilYa(8)], ["demenagement", ilYa(50)]]);
});

test("zéro annonce est un FAIT (`annonces: 0`), pas une absence de lecture", () => {
  const l = lireSignaux(A, [], NOW);
  assert.equal(l.annonces, 0);
  assert.equal(l.exclusion, null);
  assert.equal(l.luLe, NOW.toISOString());
});

// ── 3 · CE QUE L'APPELANT LIT ───────────────────────────────────────────

test(`⚠⚠ le moment n'est FRAIS que ${FRAICHEUR_JOURS} jours, et sa phrase interdit de le citer`, () => {
  const fiche = (jours: number) => ({ signauxPublics: lireSignaux(A, [modif("Modification de l'administration.", jours)], NOW) });
  assert.ok(momentFrais(fiche(FRAICHEUR_JOURS - 2), NOW));
  assert.equal(momentFrais(fiche(FRAICHEUR_JOURS + 2), NOW), null);
  assert.equal(momentFrais({}, NOW), null, "jamais lue ≠ moment");
  const phrase = phraseDuMoment(momentFrais(fiche(10), NOW)!);
  assert.match(phrase, /ne le cite pas/);
  assert.doesNotMatch(phrase, /€|\d+\s?%/, "aucun montant dans ce qui se lit avant d'appeler");
});

test("une lecture vieillit : absente, illisible ou de plus de trente jours, elle se refait", () => {
  assert.equal(lectureAFaire({}, NOW), true);
  const l = (jours: number): { signauxPublics: LectureSignaux } => ({ signauxPublics: { ...lireSignaux(A, [], NOW), luLe: new Date(NOW.getTime() - jours * 86_400_000).toISOString() } });
  assert.equal(lectureAFaire(l(5), NOW), false);
  assert.equal(lectureAFaire(l(45), NOW), true);
  assert.equal(lectureAFaire({ signauxPublics: { ...lireSignaux(A, [], NOW), luLe: "pas une date" } }, NOW), true);
});

// ── 4 · LE TRANSPORT : rien de deviné, rien de conclu sur une panne ──────

type Reponse = { ok: boolean; status: number; json(): Promise<unknown> };
const repondre = (corps: unknown, status = 200): Reponse => ({ ok: status < 400, status, json: async () => corps });

test("⚠ ce qui part : le SIREN exact, sans les dépôts de comptes, du plus récent au plus ancien", () => {
  const u = new URL(urlDeLecture(A));
  assert.equal(u.hostname, "bodacc-datadila.opendatasoft.com");
  assert.equal(u.searchParams.get("where"), `registre="${A}" AND familleavis!="dpc"`);
  assert.equal(u.searchParams.get("order_by"), "dateparution desc");
});

test("⚠⚠ un SIREN invalide ne part PAS — l'API aurait dit « zéro annonce », qui se lit comme « saine »", async () => {
  let appels = 0;
  const f = async () => (appels++, repondre({ results: [] }));
  for (const brut of ["000000000", "123", "000000019", ""]) {
    assert.equal((await lireAnnonces(brut, f, NOW)).etat, "invalide", brut);
  }
  assert.equal(appels, 0);
  // Un SIRET se ramène à son SIREN, les espaces tombent.
  assert.equal((await lireAnnonces("000 000 018 00012", f, NOW)).siren, A);
});

test("⚠⚠ une panne n'est JAMAIS une lecture vide : délai, refus, quota, réponse illisible → `non-lu`", async () => {
  const cas: [string, () => Promise<Reponse>][] = [
    ["délai", async () => { throw new Error("timeout"); }],
    ["500", async () => repondre({}, 500)],
    ["quota", async () => repondre({}, 429)],
    ["illisible", async () => repondre({ erreur: "x" })],
  ];
  for (const [nom, f] of cas) {
    const r = await lireAnnonces(A, f, NOW);
    assert.equal(r.etat, "non-lu", nom);
  }
  assert.match(((await lireAnnonces(A, cas[2][1], NOW)) as { raison: string }).raison, /quota/);
  const ok = await lireAnnonces(A, async () => repondre({ results: [jugement("Jugement d'ouverture", "liquidation judiciaire", 3)] }), NOW);
  assert.equal(ok.etat === "lu" && ok.lecture.exclusion?.motif, "procedure-collective");
});

test(`un lot se lit ${LECTURES_SIMULTANEES} à la fois, et rend les résultats dans l'ordre reçu`, async () => {
  let enVol = 0;
  let pic = 0;
  const f = async () => {
    enVol++;
    pic = Math.max(pic, enVol);
    await new Promise((r) => setTimeout(r, 2));
    enVol--;
    return repondre({ results: [] });
  };
  const sirens = [A, B, C, A, B, C, A, B, C, A, B, C];
  const r = await lireLot(sirens, f, NOW);
  assert.deepEqual(r.map((x) => x.siren), sirens);
  assert.ok(pic <= LECTURES_SIMULTANEES && pic > 1, `pic ${pic}`);
});

test("⚠⚠ LA LISTE DES SIREN NE PASSE PAS PAR NOTRE SERVEUR : aucune route n'interroge le BODACC", () => {
  // La première version le faisait — une route à nous recevait le pipe d'un
  // inscrit à chaque lecture. L'API répond `access-control-allow-origin: *` :
  // la requête part du navigateur. Ce test refuse le retour de la route.
  const fautifs: string[] = [];
  const parcourir = (dossier: string) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(nom) && /bodacc|signaux-publics/i.test(sansCommentaires(readFileSync(chemin, "utf8")))) fautifs.push(chemin);
    }
  };
  parcourir(join(process.cwd(), "app/api"));
  assert.deepEqual(fautifs, []);
  const csp = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(csp, /connect-src 'self' https:/, "la CSP doit laisser le navigateur joindre l'API publique — sinon l'écran tombe en « non lu » partout");
});

// ── 5 · LE SIREN : une seule définition ─────────────────────────────────

test("⚠ « 000000000 » n'est pas un SIREN — il porte 1 563 annonces d'inconnus au BODACC", () => {
  assert.equal(sirenValide("000000000"), false);
  assert.equal(sirenDeLaFiche({ siren: "000000000" }), undefined);
  assert.equal(sirenDeLaFiche({ notes: "SIREN : 000000000." }), undefined, "ni pour la cadence légale");
  assert.equal(sirenValide(A), true);
  assert.equal(normaliserSiren("000 000 018 00012"), A);
  assert.equal(sirenDeLaFiche({ siren: B, notes: `SIREN : ${A}.` }), B, "le champ structuré passe devant les notes");
  assert.equal(sirenDeLaFiche({ notes: `Métier : x. SIREN : ${A}.` }), A, "les anciens imports restent lus");
});

test("l'import CSV lit une colonne SIREN ou SIRET", () => {
  const { prospects } = csvToProspects(`entreprise;siret\nFiction A (démo);000 000 018 00012\nFiction B (démo);\n`);
  assert.equal(prospects[0].siren, A);
  assert.equal(prospects[1].siren, undefined);
});

// ── 6 · LA FILE : branchée, des deux côtés ──────────────────────────────

function fiche(id: string, over: Partial<Prospect> = {}): Prospect {
  return {
    ...prospectDefaults,
    id,
    company: `Fiction ${id} (démo)`,
    name: "",
    sector: "restaurant",
    city: "",
    phone: "0465710000",
    stage: "contact",
    tags: ["restauration"],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...over,
  } as Prospect;
}
const liquidee = lireSignaux(A, [jugement("Jugement d'ouverture de liquidation judiciaire", "liquidation judiciaire", 20)], NOW);
const enMouvement = lireSignaux(B, [modif("Modification survenue sur l'administration.", 6)], NOW);

test("⚠⚠ la file humaine ÉCARTE la société liquidée, la COMPTE, et le dit — et l'onglet dit le même nombre", () => {
  const autreMetier = fiche("g", { sector: "artisan", tags: ["garage-carrosserie"], signauxPublics: liquidee });
  const prospects = [fiche("a", { siren: A, signauxPublics: liquidee }), fiche("b"), fiche("c"), autreMetier];
  const { targets, ecartees } = buildCallSession(prospects, "restauration", NOW);
  assert.deepEqual(targets.map((t) => t.prospect.id).sort(), ["b", "c"]);
  assert.deepEqual(ecartees.map((e) => [e.prospect.id, e.exclusion.motif]), [["a", "procedure-collective"]], "le garage liquidé ne s'annonce pas dans l'onglet restauration");
  assert.equal(verticalsWithTargets(prospects).find((v) => v.vertical.id === "restauration")?.count, 2);
});

test("⚠⚠ le moment frais REMONTE la fiche en tête — et une objection bloquante passe encore devant lui", () => {
  const prospects = [fiche("calme"), fiche("bouge", { siren: B, signauxPublics: enMouvement })];
  const { targets } = buildCallSession(prospects, "restauration", NOW);
  assert.equal(targets[0].prospect.id, "bouge");
  assert.equal(targets[0].hot, true);
  assert.match(targets[0].angle, /ne le cite pas/);
  const bloque = fiche("x", {
    signauxPublics: enMouvement,
    objections: [{ id: "o", label: "trop cher", status: "bloquante" }] as Prospect["objections"],
  });
  assert.match(callAngle(bloque, null, null, NOW).angle, /^Objection bloquante/);
});

test("⚠⚠ le ROBOT d'appels refuse la même société, avec le même motif", () => {
  const run = buildCampaignRun([fiche("a", { siren: A, signauxPublics: liquidee })], { now: new Date("2026-10-20T09:30:00") });
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0]?.reason, "annonce-legale");
  assert.match(run.skipped[0].detail, /Liquidation judiciaire/);
  assert.equal(exclusionPublique({}), null, "jamais lue n'exclut pas : on ne sait pas, on ne conclut pas");
});

// ── 7 · LES AUTRES ENDROITS QUI POSENT LA QUESTION — trouvés au RENDU ────
//
// Vu le 22/10/2026 en rendant `/appels` : la file écartait la société
// liquidée pendant que la bande « ALPHA a besoin de toi » demandait de « poser
// un next step » sur elle. Les brouillons de campagne l'auraient aussi écrite.

test("⚠⚠ la routine du matin ne demande plus d'agir sur une société liquidée — elle demande de TRANCHER", () => {
  const exclue = fiche("a", { siren: A, signauxPublics: liquidee, nextStep: null, stage: "redzone" });
  const r = computeRoutines({ prospects: [exclue], meetings: [], campaigns: [], drafts: [] });
  assert.deepEqual(r.map((x) => x.category), ["annonce-legale"], "ni relance, ni next step, ni « closer »");
  assert.equal(r[0].priority, "moyenne", "un tri à faire, pas une urgence qui interrompt");
  assert.match(r[0].detail, /Liquidation judiciaire/);
  // Contre-test : la même fiche sans annonce reçoit bien ses routines.
  const saine = computeRoutines({ prospects: [{ ...exclue, signauxPublics: undefined }], meetings: [], campaigns: [], drafts: [] });
  assert.ok(saine.some((x) => x.category === "next-step") && saine.some((x) => x.category === "close"));
});

test("⚠⚠ un brouillon de campagne n'est pas écrit pour une société liquidée, ni pour qui a refusé tout contact", () => {
  const avant = useAlpha.getState();
  try {
    useAlpha.setState({
      prospects: [
        fiche("reel-a", { email: "a@exemple.test", siren: A, signauxPublics: liquidee }),
        fiche("reel-b", { email: "b@exemple.test", tags: ["restauration", DO_NOT_CALL_TAG] }),
        fiche("reel-c", { email: "c@exemple.test" }),
      ],
      campaigns: [{ ...seedCampaigns[0], id: "camp-sig", sector: "tous", status: "active" }],
      drafts: [],
    });
    useAlpha.getState().prepareCampaignDrafts("camp-sig");
    const d = Object.fromEntries(useAlpha.getState().drafts.map((x) => [x.prospectId, x]));
    assert.equal(d["reel-a"].status, "skipped");
    assert.match(d["reel-a"].error ?? "", /annonce légale — Liquidation judiciaire/);
    assert.equal(d["reel-b"].status, "skipped");
    assert.match(d["reel-b"].error ?? "", /ne plus être contacté/);
    assert.equal(d["reel-c"].status, "pending", "contre-test : une fiche saine part en relecture");
  } finally {
    useAlpha.setState(avant, true);
  }
});
