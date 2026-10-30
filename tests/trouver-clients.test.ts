import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAF_SOUS_CLASSES } from "../lib/naf-sous-classes";
import { METIERS, codeNafValide, proposerActivites } from "../lib/naf";
import {
  PAR_PAGE, PLAFOND_RESULTATS, chercherEntreprises, casseCommune, croiserAnnonces, entrepriseVersProspect, lireReponse, lireZone,
  tranchesPour, urlDeRecherche, validerCriteres, type CriteresValides, type EntrepriseBrute, type EntrepriseTrouvee,
} from "../lib/trouver-clients";
import { lireSignaux, type AnnonceBodacc, type ResultatLecture } from "../lib/signaux-publics";
import { memeFiche } from "../lib/fusion-fiches";
import { DROIT_GRATUIT, autorise, pageOuverteAuVisiteur } from "../lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « TROUVE-MOI DES CLIENTS » (29/10/2026) — le registre officiel, par métier
 * et par zone, lu du navigateur.
 *
 * ⚠ AUCUNE ENTREPRISE RÉELLE ICI. Les réponses ont la FORME de l'API réelle
 * (champs relevés le 29/10/2026) et des contenus inventés. Les SIREN sont
 * ceux de `tests/signaux-publics.test.ts`, cherchés au BODACC et au registre
 * national : zéro résultat. Les noms portent « (démo) ».
 * ─────────────────────────────────────────────────────────────────────
 */

const A = "000000018";
const B = "000000034";
const C = "000000042";
const NOW = new Date("2026-10-29T10:00:00Z");
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

// ══════════ 1 · LA NOMENCLATURE ══════════

test("⚠⚠ la table NAF est celle de l'INSEE, à l'octet près (empreinte du relevé du 29/10/2026)", () => {
  const texte = NAF_SOUS_CLASSES.map(([c, l]) => `${c}|${l}`).join("\n");
  assert.equal(NAF_SOUS_CLASSES.length, 732);
  assert.equal(createHash("sha256").update(texte, "utf8").digest("hex"), "b85d0362427b0fca8881e73ecc3e9fcddc211b6214ceb9e7bcffe54736782409");
});

test("⚠ chaque métier proposé pointe des codes qui EXISTENT — sinon le registre répond 400", () => {
  for (const m of METIERS) {
    assert.ok(m.codes.length > 0 && m.mots.length > 0, m.libelle);
    for (const c of m.codes) assert.ok(codeNafValide(c), `${m.libelle} → ${c} absent de la nomenclature`);
  }
});

test("le mot de tous les jours mène au code, pluriel et accents compris", () => {
  assert.deepEqual(proposerActivites("plombiers")[0].codes, ["43.22A", "43.22B"]);
  // Vu au rendu : un radical commun n'est pas un métier.
  assert.ok(!proposerActivites("plombiers").some((p) => p.codes.includes("24.43Z")), "« plombiers » ne mène pas à la métallurgie du plomb");
  assert.deepEqual(proposerActivites("Électricien")[0].codes, ["43.21A"]);
  assert.deepEqual(proposerActivites("coiffeuse")[0].codes, ["96.02A"]);
  assert.deepEqual(proposerActivites("auto-école")[0].codes, ["85.53Z"]);
  assert.equal(proposerActivites("agences immobilières")[0].origine, "metier");
  assert.deepEqual(proposerActivites("   "), []);
});

test("⚠ HORIZONTAL : un métier que personne n'a écrit se trouve dans la nomenclature", () => {
  // Personne n'a prévu les luthiers ni les horlogers dans METIERS : la nomenclature répond.
  const p = proposerActivites("instruments de musique");
  assert.ok(p.some((x) => x.codes.includes("32.20Z") && x.origine === "nomenclature"), JSON.stringify(p));
  assert.ok(proposerActivites("horlogerie").some((x) => x.codes.includes("26.52Z")));
  // Et un code tapé tel quel.
  assert.deepEqual(proposerActivites("43.22").map((x) => x.codes[0]), ["43.22A", "43.22B"]);
});

// ══════════ 2 · LA ZONE : UN CODE, JAMAIS UN NOM ══════════

test("⚠⚠ un nom de commune est refusé, et la raison dit d'en donner le CODE", () => {
  const r = lireZone("Saint-Priest");
  assert.equal(r.ok, false);
  assert.match((r as { raison: string }).raison, /CODE/);
});

test("départements et codes postaux, jamais mélangés", () => {
  assert.deepEqual(lireZone("69"), { ok: true, zone: { champ: "departement", codes: ["69"] } });
  assert.deepEqual(lireZone("69003, 69006 69003"), { ok: true, zone: { champ: "code_postal", codes: ["69003", "69006"] } });
  assert.deepEqual(lireZone("2a"), { ok: true, zone: { champ: "departement", codes: ["2A"] } });
  assert.deepEqual(lireZone("974"), { ok: true, zone: { champ: "departement", codes: ["974"] } });
  assert.equal(lireZone("69 69003").ok, false, "le registre ferait un ET : la recherche ne dirait pas ce qu'elle semble dire");
  assert.equal(lireZone("20").ok, false, "20 n'est pas un département");
  assert.equal(lireZone("00123").ok, false);
  assert.equal(lireZone("").ok, false);
});

// ══════════ 3 · CE QUI PART ══════════

const CRIT: CriteresValides = { activites: ["43.22A"], zone: { champ: "departement", codes: ["69"] }, taille: "toutes" };

test("⚠ ce qui part : le registre de l'État, l'activité, la zone, les entreprises ACTIVES, 25 par page", () => {
  const u = new URL(urlDeRecherche(CRIT, 2));
  assert.equal(u.origin + u.pathname, "https://recherche-entreprises.api.gouv.fr/search");
  assert.equal(u.searchParams.get("activite_principale"), "43.22A");
  assert.equal(u.searchParams.get("departement"), "69");
  assert.equal(u.searchParams.get("etat_administratif"), "A");
  assert.equal(u.searchParams.get("per_page"), String(PAR_PAGE));
  assert.equal(u.searchParams.get("page"), "2");
  assert.equal(u.searchParams.get("tranche_effectif_salarie"), null, "« toutes tailles » ne filtre rien");
  const dix = new URL(urlDeRecherche({ ...CRIT, taille: "10-plus" }, 1));
  assert.equal(dix.searchParams.get("tranche_effectif_salarie"), tranchesPour("10-plus").join(","));
  assert.ok(!tranchesPour("employeur").includes("NN"), "NN n'est pas « employeur »");
});

test("une activité hors nomenclature ne part pas", () => {
  assert.equal(validerCriteres({ activites: ["99.99Z"], zone: "69", taille: "toutes" }).ok, false);
  assert.equal(validerCriteres({ activites: [], zone: "69", taille: "toutes" }).ok, false);
});

// ══════════ 4 · CE QU'ON LIT ══════════

function brute(siren: string, extra: Partial<EntrepriseBrute> = {}): EntrepriseBrute {
  return {
    siren,
    nom_complet: "PLOMBERIE FICTIVE (DÉMO) (PFD)",
    nom_raison_sociale: "PLOMBERIE FICTIVE (DÉMO)",
    activite_principale: "43.22A",
    etat_administratif: "A",
    statut_diffusion: "O",
    tranche_effectif_salarie: "02",
    date_creation: "2015-03-01",
    siege: { siret: `${siren}00011`, adresse: "1 RUE DE LA DEMO 69007 LYON", code_postal: "69007", departement: "69", libelle_commune: "LYON", activite_principale: "43.22A", etat_administratif: "A", statut_diffusion_etablissement: "O" },
    matching_etablissements: [
      { siret: `${siren}00011`, adresse: "1 RUE DE LA DEMO 69007 LYON", code_postal: "69007", libelle_commune: "LYON", activite_principale: "43.22A", etat_administratif: "A", statut_diffusion_etablissement: "O" },
    ],
    dirigeants: [{ type_dirigeant: "personne physique", nom: "DEMO", prenoms: "Camille", qualite: "Gérant" }],
    complements: { est_entrepreneur_individuel: false },
    ...extra,
  };
}
const page = (results: EntrepriseBrute[], total = results.length) => ({ results, total_results: total, page: 1, per_page: 25, total_pages: Math.max(1, Math.ceil(total / 25)) });

test("⚠⚠ L'ÉTABLISSEMENT MONTRÉ EST CELUI DE LA ZONE QUI EXERCE L'ACTIVITÉ — pas le siège (relevé réel)", () => {
  // Mesuré : un siège à Lyon 7e en 70.10Z (holding), l'établissement qui
  // correspond à Lyon 3e en 43.22A.
  const b = brute(A, {
    siege: { siret: `${A}00011`, adresse: "SIEGE 69007 LYON", code_postal: "69007", libelle_commune: "LYON", activite_principale: "70.10Z", etat_administratif: "A" },
    matching_etablissements: [{ siret: `${A}00029`, adresse: "ATELIER 69003 LYON", code_postal: "69003", libelle_commune: "LYON", activite_principale: "43.22A", etat_administratif: "A" }],
  });
  const l = lireReponse(page([b]), { ...CRIT, zone: { champ: "code_postal", codes: ["69003"] } }, new Set())!;
  assert.equal(l.entreprises[0].adresse, "ATELIER 69003 LYON");
  assert.equal(l.entreprises[0].activite.code, "43.22A");
  assert.equal(l.entreprises[0].activite.libelle, "Travaux d'installation d'eau et de gaz en tous locaux");

  // ⚠ La mutation l'a dit : ci-dessus, la zone écartait déjà le siège, et
  // l'ORDRE (établissement trouvé avant siège) ne se voyait pas. Ici les deux
  // sont dans la zone et exercent le métier : c'est celui que le registre a
  // trouvé qu'on montre, deux établissements comptés.
  const deux = brute(A, {
    siege: { siret: `${A}00011`, adresse: "SIEGE 69007 LYON", code_postal: "69007", libelle_commune: "LYON", activite_principale: "43.22A", etat_administratif: "A" },
    matching_etablissements: [{ siret: `${A}00029`, adresse: "ATELIER 69003 LYON", code_postal: "69003", libelle_commune: "LYON", activite_principale: "43.22A", etat_administratif: "A" }],
  });
  const d = lireReponse(page([deux]), CRIT, new Set())!;
  assert.equal(d.entreprises[0].adresse, "ATELIER 69003 LYON");
  assert.equal(d.entreprises[0].etablissementsDansLaZone, 2);
});

test("⚠⚠ UN FILTRE IGNORÉ PAR L'API NE FAIT PAS ENTRER N'IMPORTE QUI — activité et taille revérifiées", () => {
  /**
   * Mesuré le 29/10/2026 : un paramètre inconnu est oublié sans erreur, et la
   * recherche rend les 10 000 premières entreprises du département. Si le
   * filtre d'activité disparaissait, ce garde est le seul à le voir.
   */
  const autreMetier = brute(A, { matching_etablissements: [{ siret: "x", code_postal: "69003", libelle_commune: "LYON", activite_principale: "56.10A", etat_administratif: "A" }], siege: null });
  const l = lireReponse(page([autreMetier]), CRIT, new Set())!;
  assert.deepEqual(l.entreprises, []);
  assert.deepEqual(l.ecartees.map((e) => e.motif), ["autre-activite"]);

  const petite = brute(B, { tranche_effectif_salarie: "NN" });
  const t = lireReponse(page([petite]), { ...CRIT, taille: "10-plus" }, new Set())!;
  assert.deepEqual(t.ecartees.map((e) => e.motif), ["hors-taille"]);
});

test("⚠ ce qu'on écarte est COMPTÉ et NOMMÉ — sauf l'entreprise non diffusible, qui ne se nomme pas", () => {
  const l = lireReponse(
    page([
      brute(A),
      brute(B, { statut_diffusion: "P", nom_complet: "NOM PRIVÉ (DÉMO)", nom_raison_sociale: "NOM PRIVÉ (DÉMO)" }),
      brute(C, { siege: { code_postal: "75001", libelle_commune: "PARIS", activite_principale: "43.22A", etat_administratif: "A" }, matching_etablissements: [{ code_postal: "75001", libelle_commune: "PARIS", activite_principale: "43.22A", etat_administratif: "A" }] }),
      brute("000000059", { etat_administratif: "C" }),
      brute("123456789"),
    ]),
    CRIT,
    new Set([A])
  )!;
  assert.deepEqual(l.entreprises, []);
  const motifs = Object.fromEntries(l.ecartees.map((e) => [e.motif, e.nom]));
  assert.equal(motifs["deja-dans-le-crm"], "PLOMBERIE FICTIVE (DÉMO)");
  assert.equal(motifs["non-diffusible"], null, "une entreprise qui a refusé la diffusion ne s'affiche pas, même écartée");
  assert.ok("hors-zone" in motifs && "fermee" in motifs && "siren-invalide" in motifs, JSON.stringify(l.ecartees));
  assert.doesNotMatch(JSON.stringify(l), /NOM PRIVÉ/);
});

test("⚠ des dirigeants, le nom et la qualité — JAMAIS la date de naissance ni la nationalité", () => {
  const b = brute(A, {
    dirigeants: [{ type_dirigeant: "personne physique", nom: "DEMO", prenoms: "Camille", qualite: "Gérant", date_de_naissance: "1980-05", annee_de_naissance: "1980", nationalite: "Française" } as never],
  });
  const l = lireReponse(page([b]), CRIT, new Set())!;
  assert.deepEqual(l.entreprises[0].dirigeants, ["Camille DEMO — Gérant"]);
  const fiche = entrepriseVersProspect(l.entreprises[0], NOW);
  assert.doesNotMatch(JSON.stringify([l, fiche]), /1980|Française|naissance/);
});

test("⚠ « 10 000 » veut dire « au moins 10 000 », et on ne propose pas une page que l'API refuserait", () => {
  const l = lireReponse({ ...page([brute(A)], PLAFOND_RESULTATS), total_pages: 4000 }, CRIT, new Set())!;
  assert.equal(l.totalPlafonne, true);
  assert.equal(l.pages, PLAFOND_RESULTATS / PAR_PAGE);
  assert.equal(lireReponse(page([brute(A)], 9_999), CRIT, new Set())!.totalPlafonne, false);
});

test("la commune se lit, sans qu'on invente ses accents", () => {
  assert.equal(casseCommune("VAULX-EN-VELIN"), "Vaulx-en-Velin");
  assert.equal(casseCommune("SAINT-GENIS-LES-OLLIERES"), "Saint-Genis-les-Ollieres");
  assert.equal(casseCommune("L'ARBRESLE"), "L'Arbresle");
});

// ══════════ 5 · LE TRANSPORT : UNE PANNE SE DIT ══════════

function faux(reponse: { ok: boolean; status: number; json?: unknown } | Error) {
  const appels: string[] = [];
  const f = async (url: string) => {
    appels.push(url);
    if (reponse instanceof Error) throw reponse;
    return { ok: reponse.ok, status: reponse.status, json: async () => reponse.json };
  };
  return { f, appels };
}

test("⚠⚠ une panne est `non-lu`, JAMAIS une liste vide qui se lirait « personne ici »", async () => {
  for (const [rep, motif] of [
    [{ ok: false, status: 500 }, /500/],
    [{ ok: false, status: 429 }, /par seconde/],
    [{ ok: false, status: 400, json: { erreur: "Au moins un paramètre `activite_principale` est non valide." } }, /non valide/],
    [new Error("réseau"), /pas répondu/],
    [{ ok: true, status: 200, json: { results: "rien" } }, /illisible/],
  ] as const) {
    const { f } = faux(rep as never);
    const r = await chercherEntreprises({ activites: ["43.22A"], zone: "69", taille: "toutes" }, 1, f);
    assert.equal(r.etat, "non-lu");
    assert.match((r as { raison: string }).raison, motif);
  }
});

test("⚠ une saisie invalide ne part PAS — aucune requête", async () => {
  const { f, appels } = faux({ ok: true, status: 200, json: page([]) });
  assert.equal((await chercherEntreprises({ activites: ["43.22A"], zone: "Lyon", taille: "toutes" }, 1, f)).etat, "invalide");
  assert.equal((await chercherEntreprises({ activites: ["43.22A"], zone: "69", taille: "toutes" }, 401, f)).etat, "invalide", "au-delà de 10 000 résultats");
  assert.deepEqual(appels, []);
});

test("une recherche lue rend les entreprises, et écarte celles déjà au CRM", async () => {
  const { f, appels } = faux({ ok: true, status: 200, json: page([brute(A), brute(B)], 2) });
  const r = await chercherEntreprises({ activites: ["43.22A"], zone: "69", taille: "toutes" }, 1, f, new Set([B]));
  assert.equal(r.etat, "lu");
  if (r.etat !== "lu") return;
  assert.deepEqual(r.lecture.entreprises.map((e) => e.siren), [A]);
  assert.equal(appels.length, 1);
});

// ══════════ 6 · VERS LE CRM ══════════

const trouvee = (siren: string): EntrepriseTrouvee => lireReponse(page([brute(siren)]), CRIT, new Set())!.entreprises[0];

test("⚠⚠ une entreprise trouvée devient une fiche À JOINDRE — ni téléphone, ni canal, ni nom deviné", () => {
  const p = entrepriseVersProspect(trouvee(A), NOW);
  assert.equal(p.id, `reg-${A}`);
  assert.equal(p.siren, A);
  assert.equal(p.stage, "prospect");
  assert.equal(p.phone, undefined);
  assert.equal(p.preferredChannel, undefined, "on ne sait pas encore par où la joindre");
  assert.equal(p.name, "", "le dirigeant déclaré est dans les notes ; choisir la personne à joindre n'est pas à nous");
  assert.ok(p.tags.includes("a-joindre") && p.tags.includes("registre"));
  assert.match(p.nextStep!.action, /interlocuteur/);
  assert.match(p.notes, new RegExp(`SIREN : ${A}`));
  assert.match(p.notes, /Dirigeant déclaré : Camille DEMO — Gérant/);
  assert.match(p.notes, /Source : registre officiel des entreprises, lu le 2026-10-29/);
  assert.equal(p.monthlyValue, 0, "aucun montant : c'est SON prix, pas le nôtre");
  assert.equal(p.city, "Lyon");
});

// Les annonces : même fabrique que les tests BODACC.
const ilYa = (jours: number) => new Date(NOW.getTime() - jours * 86_400_000).toISOString().slice(0, 10);
function annonce(siren: string, famille: string, jours: number, extra: Partial<AnnonceBodacc>): AnnonceBodacc {
  return {
    dateparution: ilYa(jours),
    familleavis: famille,
    typeavis: "annonce",
    modificationsgenerales: null,
    jugement: null,
    acte: null,
    url_complete: `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:FICTION${siren}${jours}`,
    registre: [siren],
    ...extra,
  };
}

test("⚠⚠ une société en liquidation N'EST PAS IMPORTÉE ; non lu n'est pas « sain » ; le moment passe devant", () => {
  const liquidation: ResultatLecture = {
    siren: A,
    etat: "lu",
    lecture: lireSignaux(A, [annonce(A, "collective", 20, { jugement: JSON.stringify({ nature: "Jugement d'ouverture de liquidation judiciaire", complementJugement: "liquidation judiciaire" }) })], NOW),
  };
  const nouvelleDirection: ResultatLecture = {
    siren: C,
    etat: "lu",
    lecture: lireSignaux(C, [annonce(C, "modification", 10, { modificationsgenerales: JSON.stringify({ descriptif: "Modification survenue sur l'administration." }) })], NOW),
  };
  const panne: ResultatLecture = { siren: B, etat: "non-lu", raison: "panne" };
  const x = croiserAnnonces([trouvee(A), trouvee(B), trouvee(C)], [liquidation, panne, nouvelleDirection], NOW);
  assert.deepEqual(x.exclues.map((e) => [e.entreprise.siren, e.exclusion.motif]), [[A, "procedure-collective"]]);
  assert.deepEqual(x.retenues.map((r) => r.entreprise.siren), [C, B], "le moment frais d'abord, puis l'ordre du registre");
  assert.equal(x.nonLues, 1);
  assert.ok(x.retenues[0].moment, "le moment est nommé");
  // La lecture voyage avec la fiche : la file ne la refera qu'à péremption.
  assert.equal(entrepriseVersProspect(x.retenues[0].entreprise, NOW, x.retenues[0].annonces).signauxPublics?.siren, C);
  assert.equal(entrepriseVersProspect(x.retenues[1].entreprise, NOW, x.retenues[1].annonces).signauxPublics, undefined);
});

test("⚠⚠ LA FUSION : deux SIREN différents sont deux entreprises, quel que soit leur nom", () => {
  const homonyme = { company: "GARAGE DU CENTRE", siren: A };
  assert.equal(memeFiche(homonyme, { company: "GARAGE DU CENTRE", siren: B }), false, "deux homonymes ne s'écrasent plus");
  assert.equal(memeFiche({ company: "Garage du Centre SARL", siren: A }, { company: "GARAGE DU CENTRE", siren: A }), true);
  assert.equal(memeFiche({ company: "Garage du centre" }, { company: "GARAGE DU CENTRE", siren: A }), true, "une fiche sans SIREN rejoint celle du registre");
  assert.equal(memeFiche({ company: "X", phone: "04 65 71 34 56" }, { company: "Y", phone: "+33465713456" }), true);
  assert.equal(memeFiche({ company: "X", notes: `SIREN : ${A}` }, { company: "X", siren: B }), false, "le SIREN des notes compte aussi");
  // Le magasin pose la question par cette fonction, et par elle seule.
  assert.match(lire("lib/store.ts"), /const idx = next\.findIndex\(\(x\) => memeFiche\(x, p\)\);/);
  assert.doesNotMatch(lire("lib/store.ts"), /function normTel/, "une seule définition du « même numéro »");
});

// ══════════ 7 · LA DOCTRINE ══════════

const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("⚠⚠ LA RECHERCHE NE PASSE PAS PAR NOTRE SERVEUR : aucune route ne cherche des entreprises par activité", () => {
  /**
   * Une route à nous recevrait le métier et la zone que vise chaque inscrit.
   * ⚠ Le garde vise la RECHERCHE (le module, le filtre d'activité), pas le
   * nom du registre : `/api/onboarding/site` y lit le SIREN de l'inscrit
   * LUI-MÊME, trouvé sur son propre site — sa raison sociale, pas sa cible.
   * La première rédaction cherchait le nom de l'hôte et a mordu sur elle.
   */
  const fautifs: string[] = [];
  const parcourir = (dossier: string) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(nom) && /trouver-clients|activite_principale|code_postal=|departement=/i.test(sansCommentaires(readFileSync(chemin, "utf8")))) fautifs.push(chemin);
    }
  };
  parcourir(join(process.cwd(), "app/api"));
  assert.deepEqual(fautifs, []);
});

test("⚠⚠ LA SEULE EXCEPTION : le pilote serveur du MAÎTRE cherche au registre — sur SA cible, jamais sur une cible reçue", () => {
  /**
   * Depuis le 30/10/2026 (« tout dans le cloud, sans n8n »), le pilote du maître
   * tourne aussi sur le serveur, et ses étapes (`lib/pilote-executeur.ts`)
   * comprennent la recherche. La règle protège la cible d'un INSCRIT ; celle du
   * maître est la nôtre. Ce qui la garde : le tick ne lit AUCUN corps de requête
   * (aucune cible ne peut lui être envoyée) et ses portes ne connaissent que
   * `CONFIGURATION_ALPHA_VEND_ALPHA` et le pipe opérateur.
   */
  const tick = sansCommentaires(lire("app/api/campaign/pilote-tick/route.ts"));
  assert.doesNotMatch(tick, /req\.json\(|req\.nextUrl\.searchParams/, "une cible reçue ferait de notre serveur le collecteur d'un inscrit");
  assert.match(tick, /lireProspectsOperateur\(db\)/);
});

test("⚠ « Trouver des clients » est GRATUIT et s'ouvre au visiteur sans compte", () => {
  assert.equal(autorise(DROIT_GRATUIT, "/trouver"), true);
  assert.equal(pageOuverteAuVisiteur("/trouver"), true);
});

test("⚠ l'écran dit ce que le registre NE donne PAS, avant le premier résultat", () => {
  const src = sansCommentaires(lire("app/(app)/trouver/page.tsx"));
  const iAvertit = src.indexOf("Il ne donne ni téléphone ni email");
  const iResultats = src.indexOf("croisement.retenues.map");
  assert.ok(iAvertit > 0 && iAvertit < iResultats, "l'avertissement précède la liste");
  // Le navigateur appelle l'API publique ; jamais une route à nous.
  assert.match(src, /chercherEntreprises\(\{ activites, zone, taille \}, page, \(url, init\) => fetch\(url, init\), dejaConnus\)/);
  assert.match(src, /croiserAnnonces\(/, "les annonces légales sont lues avant l'import");
});
