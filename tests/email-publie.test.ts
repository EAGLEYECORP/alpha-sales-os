import test from "node:test";
import assert from "node:assert/strict";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";
import { emailPublie, patchDepuisSite, siteALire, siteDeLaFiche, SITES_PAR_PASSAGE, TAG_EMAIL_DU_SITE, TAG_SITE_LU } from "../lib/email-publie";
import { aContacter, ETAT_AUTOPILOTE_VIDE, planifier } from "../lib/autopilote-inscrit";
import { passagePilote } from "../lib/pilote-executeur";
import { mondeServeur, portesServeur, reglagesServeur, type DepsServeur } from "../lib/pilote-serveur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EMAIL PUBLIÉ SUR LE SITE (05/11/2026) — mesuré en production : 18 agences
 * passées à Dropcontact, ZÉRO email. Le pilote lit désormais la page contact
 * du site connu de l'entreprise et n'en retient qu'une adresse de SON domaine,
 * jamais une boîte de données personnelles ni une boîte technique.
 * Domaines RFC 2606 seulement.
 * ─────────────────────────────────────────────────────────────────────
 */

const MARDI_10H = new Date("2026-11-03T09:00:00Z");
const SITE = "https://www.agence-a.example/";

const fiche = (o: Partial<Prospect>): Prospect =>
  ({
    ...prospectDefaults,
    name: "",
    sector: "autre",
    city: "Lyon",
    stage: "prospect",
    tags: ["registre", "contacts-dropcontact"],
    notes: `Site : ${SITE}`,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...o,
  }) as Prospect;

const page = (url: string, corps: string) => ({ url, html: `<html><body>${corps}</body></html>` });

// ── 1 · Ce qu'on retient, ce qu'on refuse ───────────────────────────

test("⚠⚠ seule une adresse du DOMAINE DU SITE est retenue — pas celle de l'hébergeur ni de l'agence web des mentions légales", () => {
  const pages = [
    page(SITE, `<footer>Site réalisé par <a href="mailto:studio@agence-web.example">Studio</a></footer>`),
    page(`${SITE}mentions-legales`, `Hébergeur : support@hebergeur.example — Contact : <a href="mailto:contact@agence-a.example">écrire</a>`),
  ];
  assert.deepEqual(emailPublie(pages, SITE), { email: "contact@agence-a.example", page: `${SITE}mentions-legales` });
  // Sans adresse du domaine : rien, jamais l'agence web.
  assert.equal(emailPublie([pages[0]], SITE), null);
});

test("⚠⚠ jamais une boîte de données personnelles ni une boîte technique, même du bon domaine", () => {
  for (const local of ["dpo", "rgpd", "privacy", "noreply", "no-reply", "postmaster", "webmaster", "compta", "recrutement"]) {
    assert.equal(emailPublie([page(SITE, `${local}@agence-a.example`)], SITE), null, `${local}@ ne doit jamais recevoir une prospection`);
  }
  // …et elles ne masquent pas la bonne adresse quand elle existe.
  assert.equal(emailPublie([page(SITE, `dpo@agence-a.example · accueil@agence-a.example`)], SITE)?.email, "accueil@agence-a.example");
});

test("une boîte webmail n'est jamais retenue (règle du domaine, sans liste à tenir)", () => {
  assert.equal(emailPublie([page(SITE, "agence.a@gmail.example")], SITE), null);
});

test("on préfère la boîte faite pour les nouvelles demandes, sinon la première adresse du domaine", () => {
  assert.equal(emailPublie([page(SITE, "jean.martin@agence-a.example — contact@agence-a.example")], SITE)?.email, "contact@agence-a.example");
  assert.equal(emailPublie([page(SITE, "jean.martin@agence-a.example")], SITE)?.email, "jean.martin@agence-a.example");
});

test("les adresses encodées en entités HTML se lisent ; les formes masquées « [at] » ne se reconstituent pas", () => {
  assert.equal(emailPublie([page(SITE, "contact&#64;agence-a.example")], SITE)?.email, "contact@agence-a.example");
  assert.equal(emailPublie([page(SITE, "contact [at] agence-a.example")], SITE), null);
});

test("une ressource « logo@2x.png » n'est pas une adresse", () => {
  assert.equal(emailPublie([page(SITE, `<img src="/img/logo@2x.png">`)], SITE), null);
});

test("le domaine parent d'un sous-domaine compte (lyon.reseau.example → @reseau.example), et une redirection aussi", () => {
  assert.equal(emailPublie([page("https://lyon.reseau.example/", "lyon@reseau.example")], "https://lyon.reseau.example/")?.email, "lyon@reseau.example");
  assert.equal(emailPublie([page("https://www.nouveau-nom.example/", "contact@nouveau-nom.example")], SITE)?.email, "contact@nouveau-nom.example");
});

// ── 2 · Quelle fiche, et ce qu'elle reçoit ───────────────────────────

test("le site vient de la fiche (« Site : … », posé par l'enrichissement), jamais deviné", () => {
  assert.equal(siteDeLaFiche({ notes: "Dirigeant : X\nSite : agence-a.example" }), "https://agence-a.example");
  assert.equal(siteDeLaFiche({ notes: "Pas de site connu" }), null);
  assert.equal(siteALire(fiche({})), true);
  assert.equal(siteALire(fiche({ email: "deja@agence-a.example" })), false, "un email déjà posé ne se remplace pas");
  assert.equal(siteALire(fiche({ tags: [TAG_SITE_LU] })), false, "un site déjà lu ne se relit pas en boucle");
  assert.equal(siteALire(fiche({ notes: "" })), false);
});

test("trouvé : l'email et deux tags ; rien trouvé : le site est quand même marqué lu", () => {
  const t = patchDepuisSite(fiche({}), { email: "contact@agence-a.example", page: SITE }, MARDI_10H);
  assert.equal(t.email, "contact@agence-a.example");
  assert.ok(t.tags?.includes(TAG_SITE_LU) && t.tags.includes(TAG_EMAIL_DU_SITE));
  const r = patchDepuisSite(fiche({}), null, MARDI_10H);
  assert.equal(r.email, undefined);
  assert.ok(r.tags?.includes(TAG_SITE_LU) && !r.tags.includes(TAG_EMAIL_DU_SITE));
});

// ── 3 · Le planificateur ─────────────────────────────────────────────

const reglages = reglagesServeur(true, {});

test("⚠⚠ l'étape ne se planifie QUE si la porte existe (serveur) — jamais du navigateur d'un inscrit", () => {
  const fiches = [fiche({ id: "a" })];
  const sans = planifier(fiches, reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: false }, MARDI_10H);
  assert.deepEqual(sans.lireSites, []);
  const avec = planifier(fiches, reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: false, lectureSite: true }, MARDI_10H);
  assert.deepEqual(avec.lireSites, ["a"]);
});

test("borné par passage, et jamais une fiche de démo, refusée ou fermée", () => {
  const fiches = [
    ...Array.from({ length: SITES_PAR_PASSAGE + 2 }, (_, i) => fiche({ id: `f${i}` })),
    fiche({ id: "demo-x" }),
    fiche({ id: "perdue", stage: "perdu" }),
  ];
  const plan = planifier(fiches, reglages, ETAT_AUTOPILOTE_VIDE, { boite: true, cleDropcontact: false, lectureSite: true }, MARDI_10H);
  assert.equal(plan.lireSites.length, SITES_PAR_PASSAGE);
  assert.ok(!plan.lireSites.includes("demo-x") && !plan.lireSites.includes("perdue"));
});

// ── 4 · La chaîne : site lu → email posé → fiche prête pour le premier message ──

function deps(lire: DepsServeur["lirePagesSite"]): DepsServeur {
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
    ...(lire ? { lirePagesSite: lire } : {}),
  };
}

test("⚠⚠ DE BOUT EN BOUT : le passage lit le site, pose l'email publié, et la fiche entre dans la file du premier message", async () => {
  const lus: string[] = [];
  const m = mondeServeur([fiche({ id: "a", company: "AGENCE A (DÉMO)" })], [], null);
  await passagePilote(
    portesServeur(
      m,
      deps(async (url) => {
        lus.push(url);
        return [page(url, "Nous écrire : contact@agence-a.example")];
      }),
    ),
    { boite: true },
  );
  assert.deepEqual(lus, [SITE]);
  const a = m.prospects.find((p) => p.id === "a")!;
  assert.equal(a.email, "contact@agence-a.example");
  assert.ok(a.events.some((e) => e.summary.startsWith("Email publié sur son site")));
  assert.ok(m.fichesModifiees.has("a"), "la fiche doit être réécrite en base");
  assert.ok(m.etat.journal.some((j) => j.type === "enrichit" && /1 email publié trouvé/.test(j.texte)));
  assert.deepEqual(aContacter(m.prospects, MARDI_10H).map((p) => p.id), ["a"]);
});

test("une panne de lecture se DIT sur la fiche, ne pose aucun email, et le site n'est pas relu en boucle", async () => {
  const m = mondeServeur([fiche({ id: "a", company: "AGENCE A (DÉMO)" })], [], null);
  await passagePilote(
    portesServeur(
      m,
      deps(async () => {
        throw new Error("Page injoignable (HTTP 503).");
      }),
    ),
    { boite: true },
  );
  const a = m.prospects.find((p) => p.id === "a")!;
  assert.ok(!a.email?.trim(), "une panne ne pose aucun email");
  assert.ok(a.tags.includes(TAG_SITE_LU));
  assert.ok(a.events.some((e) => /Site injoignable/.test(e.summary)));
});
