import test from "node:test";
import assert from "node:assert/strict";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { domainesCandidats, pageProuveSiren, TAG_SITE_CHERCHE, TAG_SITE_PROUVE } from "../lib/site-par-siren";
import { TAG_EMAIL_DU_SITE, TAG_SITE_LU } from "../lib/email-publie";
import { ETAT_AUTOPILOTE_VIDE, aContacter, planifier } from "../lib/autopilote-inscrit";
import { passagePilote } from "../lib/pilote-executeur";
import { mondeServeur, portesServeur, reglagesServeur, type DepsServeur } from "../lib/pilote-serveur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SITE PROUVÉ PAR LE SIREN (05/11/2026, « go SIREN ») — la piste gratuite
 * qui passe AVANT Dropcontact. Un site n'est retenu que s'il porte le SIREN
 * exact de l'entreprise ; un nom qui ressemble ne prouve rien.
 * SIREN de fixture hors registre ; domaines .example quand ils sont lus.
 * ─────────────────────────────────────────────────────────────────────
 */

const MARDI_10H = new Date("2026-11-03T09:00:00Z");
const SIREN = "000000018";
const reglages = reglagesServeur(true, {});

const fiche = (o: Partial<Prospect>): Prospect =>
  ({
    ...prospectDefaults,
    name: "",
    sector: "autre",
    city: "Lyon",
    stage: "prospect",
    company: "MENUISERIE QUIXOTZ (DÉMO)",
    siren: SIREN,
    tags: ["registre", "a-joindre", "naf-43.32A"],
    notes: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...o,
  }) as Prospect;

// ── 1 · Les adresses essayées ───────────────────────────────────────

test("trois adresses au plus, construites sur la raison sociale sans forme juridique ni accent", () => {
  assert.deepEqual(domainesCandidats("SARL Menuiserie Quixotz & Fils"), ["menuiserie-quixotz-et-fils.fr", "menuiseriequixotzetfils.fr", "menuiserie-quixotz-et-fils.com"]);
  assert.deepEqual(domainesCandidats("ÉTABLISSEMENTS GÉRARD (DÉMO)"), ["gerard.fr", "gerard.com"]);
  assert.deepEqual(domainesCandidats("SAS ABC"), [], "un nom de trois lettres ne désigne personne : on n'essaie rien");
});

// ── 2 · La preuve ────────────────────────────────────────────────────

test("⚠⚠ la page prouve le SIREN : séparé, collé, ou en tête d'un SIRET", () => {
  assert.equal(pageProuveSiren("<p>RCS Lyon 000 000 018</p>", SIREN), true);
  assert.equal(pageProuveSiren("<p>SIREN : 000000018</p>", SIREN), true);
  assert.equal(pageProuveSiren("<p>SIRET 000 000 018 00012</p>", SIREN), true);
  assert.equal(pageProuveSiren("<p>SIRET 00000001800012</p>", SIREN), true);
});

test("⚠⚠ …mais jamais au milieu d'un autre nombre, jamais un autre SIREN, jamais des zéros", () => {
  assert.equal(pageProuveSiren("<p>Commande 9000000018</p>", SIREN), false, "précédé d'un chiffre : un autre nombre");
  assert.equal(pageProuveSiren("<p>Réf 000000018123456</p>", SIREN), false, "suivi de six chiffres : pas un SIRET");
  assert.equal(pageProuveSiren("<p>RCS Lyon 000 000 026</p>", SIREN), false);
  assert.equal(pageProuveSiren("<p>Menuiserie Quixotz, Lyon</p>", SIREN), false, "le nom seul ne prouve rien");
  assert.equal(pageProuveSiren("<p>000000000</p>", "000000000"), false);
});

// ── 3 · L'ordre : gratuit d'abord, Dropcontact seulement si ça échoue ──

test("⚠⚠ une fiche du registre sans site attend la piste gratuite AVANT de coûter un crédit Dropcontact", () => {
  const cap = { boite: true, cleDropcontact: true, lectureSite: true };
  const avant = planifier([fiche({ id: "a" })], reglages, ETAT_AUTOPILOTE_VIDE, cap, MARDI_10H);
  assert.deepEqual(avant.chercherSites, ["a"]);
  assert.deepEqual(avant.lancerEnrichissement, [], "aucun crédit dépensé tant que la piste gratuite n'a pas été essayée");
  const apres = planifier([fiche({ id: "a", tags: ["registre", "a-joindre", "naf-43.32A", TAG_SITE_CHERCHE] })], reglages, ETAT_AUTOPILOTE_VIDE, cap, MARDI_10H);
  assert.deepEqual(apres.chercherSites, []);
  assert.deepEqual(apres.lancerEnrichissement, ["a"], "la piste gratuite a échoué : Dropcontact prend le relais");
});

test("sans la porte (navigateur d'un inscrit), rien ne change : Dropcontact comme avant", () => {
  const p = planifier([fiche({ id: "a" })], reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: true }, MARDI_10H);
  assert.deepEqual(p.chercherSites, []);
  assert.deepEqual(p.lancerEnrichissement, ["a"]);
});

test("une entreprise par passage, et pas pendant la lecture des sites connus (un passage serveur dure une minute au plus)", () => {
  const cap = { boite: true, cleDropcontact: false, lectureSite: true };
  const seules = planifier([fiche({ id: "a" }), fiche({ id: "b" })], reglages, ETAT_AUTOPILOTE_VIDE, cap, MARDI_10H);
  assert.deepEqual(seules.chercherSites, ["a"]);
  const avecConnu = planifier([fiche({ id: "a" }), fiche({ id: "k", siren: "", notes: "Site : https://www.connu.example/" })], reglages, ETAT_AUTOPILOTE_VIDE, cap, MARDI_10H);
  assert.deepEqual(avecConnu.lireSites, ["k"]);
  assert.deepEqual(avecConnu.chercherSites, []);
});

// ── 4 · De bout en bout ─────────────────────────────────────────────

function deps(lire: NonNullable<DepsServeur["lirePagesSite"]>): DepsServeur {
  let n = 0;
  return {
    maintenant: () => MARDI_10H,
    uid: () => `id-${++n}`,
    reglages,
    expediteur: { closerName: "" },
    lienSignature: "https://alpha.example.com/compte",
    cleDropcontact: "",
    envoyer: async () => ({ ok: true }),
    lireReponses: async () => ({ etat: "lu", messages: [] }),
    agenda: async () => ({ etat: "absent" }),
    fetch: async () => {
      throw new Error("réseau non simulé");
    },
    lirePagesSite: lire,
  };
}

test("⚠⚠ DE BOUT EN BOUT : la 1re adresse n'existe pas, la 2e porte un AUTRE SIREN, la 3e est la bonne → email publié posé, fiche prête à écrire", async () => {
  const essayees: string[] = [];
  const m = mondeServeur([fiche({ id: "a" })], [], null);
  await passagePilote(
    portesServeur(
      m,
      deps(async (url) => {
        essayees.push(url);
        if (url.includes("menuiserie-quixotz.fr")) throw new Error("getaddrinfo ENOTFOUND");
        if (url.includes("menuiseriequixotz.fr")) return [{ url, html: "Menuiserie Quixotz, Bordeaux — RCS 000 000 026 — contact@menuiseriequixotz.fr" }];
        return [
          { url, html: "Bienvenue" },
          { url: `${url}mentions-legales`, html: "RCS Lyon 000 000 018 — Nous écrire : contact@menuiserie-quixotz.com" },
        ];
      }),
    ),
    { boite: true },
  );
  assert.deepEqual(essayees, ["https://menuiserie-quixotz.fr/", "https://menuiseriequixotz.fr/", "https://menuiserie-quixotz.com/"]);
  const a = m.prospects.find((p) => p.id === "a")!;
  assert.equal(a.email, "contact@menuiserie-quixotz.com", "l'email de l'homonyme de Bordeaux ne doit jamais être retenu");
  assert.match(a.notes, /Site : https:\/\/menuiserie-quixotz\.com\//);
  for (const t of [TAG_SITE_CHERCHE, TAG_SITE_PROUVE, TAG_SITE_LU, TAG_EMAIL_DU_SITE]) assert.ok(a.tags.includes(t), t);
  assert.ok(m.fichesModifiees.has("a"));
  assert.deepEqual(aContacter(m.prospects, MARDI_10H).map((p) => p.id), ["a"]);
});

test("rien de prouvé : la fiche le dit, aucun email, et Dropcontact pourra prendre le relais", async () => {
  const m = mondeServeur([fiche({ id: "a" })], [], null);
  await passagePilote(portesServeur(m, deps(async () => { throw new Error("ENOTFOUND"); })), { boite: true });
  const a = m.prospects.find((p) => p.id === "a")!;
  assert.ok(!a.email?.trim());
  assert.ok(a.tags.includes(TAG_SITE_CHERCHE) && !a.tags.includes(TAG_SITE_PROUVE));
  assert.ok(a.events.some((e) => /Site non trouvé par le SIREN/.test(e.summary)));
  const ensuite = planifier(m.prospects, reglages, m.etat, { boite: true, cleDropcontact: true, lectureSite: true }, MARDI_10H);
  assert.deepEqual(ensuite.lancerEnrichissement, ["a"]);
});
