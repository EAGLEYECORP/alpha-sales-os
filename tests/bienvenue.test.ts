import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { etapesDeConfiguration, patchReglages, proposerBienvenue, sourceDe } from "../lib/bienvenue";
import { lireSite, propositionDepuisLecture, type PageLue } from "../lib/lecture-site";
import { PROFIL_VIDE } from "../lib/profil-operateur";
import { autorise, droitGratuit } from "../lib/entitlements";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « DONNE TON SITE, ALPHA SE CONFIGURE DEVANT TOI » — `lib/bienvenue.ts`.
 *
 * Site de FICTION de bout en bout : domaine `.test` (RFC 2606), téléphone
 * dans une plage ARCEP réservée à la fiction, SIREN de démonstration.
 * ─────────────────────────────────────────────────────────────────────
 */

const BASE = "https://facade-demo.test";

const ACCUEIL = `<html><head>
<title>Façades et ravalement | Façade Démo</title>
<meta name="description" content="Ravalement, isolation par l'extérieur et bardage pour le logement collectif neuf.">
<meta property="og:site_name" content="Façade Démo">
</head><body>
<a href="/contact">Contact</a> <a href="/mentions-legales">Mentions</a>
<h1>Des façades livrées au planning du chantier</h1>
<p>Nous travaillons pour les promoteurs immobiliers et les bailleurs sociaux, et pour les promoteurs de la région.</p>
<p>Nous intervenons dans tout le Rhône.</p>
<p><a href="https://cal.com/facade-demo/15min">Prendre rendez-vous</a></p>
</body></html>`;

const CONTACT = `<html><body><p>Façade Démo — 4 rue de l&#39;Exemple, 69003 Lyon</p>
<p><a href="mailto:contact@facade-demo.test">Écrire</a> · <a href="tel:+33465712399">04 65 71 23 99</a></p></body></html>`;

const MENTIONS = `<html><body><p>SAS. RCS Lyon SIREN 123 456 782.</p><p>Directeur de la publication : Dominique Fictif</p></body></html>`;

const pages = (): PageLue[] => [
  { url: `${BASE}/`, html: ACCUEIL },
  { url: `${BASE}/contact`, html: CONTACT },
  { url: `${BASE}/mentions-legales`, html: MENTIONS },
];

const etapes = (p: PageLue[] = pages()) => {
  const l = lireSite(p);
  return { l, e: etapesDeConfiguration(l, propositionDepuisLecture(l)) };
};

test("les étapes se révèlent dans l'ordre : lu → qui → quoi → à qui → où → qui signe → rendez-vous", () => {
  const { e } = etapes();
  assert.deepEqual(
    e.map((x) => x.id),
    ["lecture", "entreprise", "activite", "cible", "zone", "signataire", "rdv"]
  );
});

test("chaque valeur lue porte sa source, et chaque étape dit ce qu'elle CHANGE", () => {
  const { e } = etapes();
  const par = Object.fromEntries(e.map((x) => [x.id, x]));
  assert.equal(par.entreprise.valeur, "Façade Démo — Lyon");
  assert.match(par.entreprise.source, /^(données du site|description du site|titre de page) · accueil/);
  assert.equal(par.rdv.valeur, "https://cal.com/facade-demo/15min");
  assert.match(par.zone.valeur, /Rhône/);
  assert.match(par.lecture.valeur, /3 pages lues sur facade-demo\.test/);
  for (const x of e) {
    assert.ok(x.effet.length > 20, `${x.id} ne dit pas ce qu'il change`);
    if (x.statut !== "a-completer") assert.ok(x.source.length > 0, `${x.id} : valeur sans source`);
  }
});

test("⚠⚠ une étape n'existe que si elle règle quelque chose — l'email et le téléphone lus ne s'affichent pas", () => {
  /**
   * Aucun réglage ne reçoit l'email ni le téléphone du site. Les montrer dans
   * un écran qui s'appelle « Alpha se configure » ferait croire qu'ils ont
   * été posés quelque part.
   */
  const { l, e } = etapes();
  assert.ok(l.email && l.telephone, "fixture cassée : le site doit porter un email et un téléphone");
  const tout = JSON.stringify(e);
  assert.ok(!tout.includes(l.email!.valeur), "l'email lu est montré comme un réglage");
  assert.ok(!tout.includes("65 71 23 99"), "le téléphone lu est montré comme un réglage");

  // Et chaque réglage nommé est réellement ÉCRIT par la validation.
  const patch = patchReglages(
    { agencyName: "X", offer: undefined },
    { identite: { agencyName: "Y", offer: { city: "Z", whatYouSell: "a", valueProp: "b" } }, garderIdentite: true, lien: "https://cal.com/x", dirigeant: "D", cestMoi: true }
  );
  const ecrits = new Set([...Object.keys(patch), ...Object.keys(PROFIL_VIDE).map((k) => `profil.${k}`)]);
  for (const x of e) {
    if (x.reglage === null) continue;
    assert.ok(ecrits.has(x.reglage), `${x.id} annonce « ${x.reglage} », que la validation n'écrit pas`);
  }
});

test("⚠⚠ ce qui n'est pas sur le site reste VIDE et à compléter — on n'invente ni cible, ni nom, ni lien", () => {
  const { e } = etapes([{ url: `${BASE}/`, html: "<title>Accueil</title><p>Bienvenue.</p>" }]);
  const par = Object.fromEntries(e.map((x) => [x.id, x]));
  for (const id of ["activite", "cible", "zone", "signataire", "rdv"] as const) {
    assert.equal(par[id].statut, "a-completer", id);
    assert.equal(par[id].valeur, "", `${id} a une valeur inventée`);
    assert.equal(par[id].source, "", `${id} a une source sans valeur`);
  }
});

test("⚠⚠ le dirigeant lu est À CONFIRMER, jamais réglé d'office", () => {
  const { e } = etapes();
  const sig = e.find((x) => x.id === "signataire")!;
  assert.equal(sig.valeur, "Dominique Fictif");
  assert.equal(sig.statut, "a-choisir");
  assert.match(sig.effet, /SEULEMENT si tu confirmes/);
});

test("plusieurs clientèles citées → la cible est à CHOISIR, la plus citée en premier", () => {
  const { e } = etapes();
  const cible = e.find((x) => x.id === "cible")!;
  assert.equal(cible.statut, "a-choisir");
  assert.match(cible.valeur, /^promotion immobilière/);
  assert.match(cible.source, /^2 mentions/);
});

test("patchReglages — le signataire ne change QUE sur « c'est moi », et jamais sur un nom vide", () => {
  const actuel = { agencyName: "Avant", offer: { city: "Ville", whatYouSell: "offre", valueProp: "promesse" } };
  const base = { identite: null, garderIdentite: true, lien: "", dirigeant: "Dominique Fictif" };
  assert.equal(patchReglages(actuel, { ...base, cestMoi: false }).closerName, undefined);
  assert.equal(patchReglages(actuel, { ...base, cestMoi: true }).closerName, "Dominique Fictif");
  assert.equal(patchReglages(actuel, { ...base, dirigeant: "  ", cestMoi: true }).closerName, undefined);
});

test("patchReglages — une valeur que le site n'a pas su lire n'efface jamais celle qui était posée", () => {
  const actuel = { agencyName: "Avant", offer: { city: "Ville", whatYouSell: "offre", valueProp: "promesse" } };
  const p = patchReglages(actuel, {
    identite: { agencyName: "", offer: { city: "", whatYouSell: "nouvelle offre", valueProp: "" } },
    garderIdentite: true,
    lien: "",
    dirigeant: "",
    cestMoi: false,
  });
  assert.equal(p.agencyName, "Avant");
  assert.deepEqual(p.offer, { city: "Ville", whatYouSell: "nouvelle offre", valueProp: "promesse" });
  // Décochée, l'identité ne bouge pas du tout.
  const garde = patchReglages(actuel, {
    identite: { agencyName: "Autre", offer: { city: "X", whatYouSell: "Y", valueProp: "Z" } },
    garderIdentite: false,
    lien: "",
    dirigeant: "",
    cestMoi: false,
  });
  assert.equal(garde.agencyName, undefined);
  assert.equal(garde.offer, undefined);
});

test("⚠ « qu'est-ce qu'une lecture a le droit d'écraser ? » n'a qu'UNE définition", () => {
  /**
   * Le formulaire « À qui vends-tu ? » et l'écran de bienvenue appliquent la
   * même lecture. Une recopie de la règle divergerait — et c'est le nom qui
   * signe qui partirait faux.
   */
  const lire = (f: string) =>
    readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const f of ["components/profil-icp.tsx", "app/(app)/bienvenue/page.tsx"]) {
    const src = lire(f);
    assert.match(src, /patchReglages\(/, `${f} n'utilise pas la règle partagée`);
    assert.ok(!/closerName:\s*dirigeant/.test(src), `${f} recopie la règle du signataire`);
  }
});

test("proposerBienvenue — une fois, à un client connecté, sans profil ; jamais au maître ni au solo", () => {
  const client = { session: true, maitre: false, solo: false, aUnProfil: false, dejaVu: false };
  assert.equal(proposerBienvenue(client), true);
  assert.equal(proposerBienvenue({ ...client, dejaVu: true }), false, "« plus tard » doit tenir");
  assert.equal(proposerBienvenue({ ...client, aUnProfil: true }), false);
  assert.equal(proposerBienvenue({ ...client, session: false }), false, "sans compte, la lecture est refusée : ne pas y envoyer");
  assert.equal(proposerBienvenue({ ...client, maitre: true }), false, "le maître configurerait NOTRE compte");
  assert.equal(proposerBienvenue({ ...client, solo: true }), false);
});

test("⚠ l'écran de bienvenue est ouvert à tout compte, et le premier passage y mène", () => {
  assert.equal(autorise(droitGratuit("t-neuf"), "/bienvenue"), true, "le premier écran d'un inscrit ne peut pas être payant");
  const onboarding = readFileSync(join(process.cwd(), "components/onboarding.tsx"), "utf8");
  assert.match(onboarding, /proposerBienvenue\(/, "la règle du premier passage n'est pas branchée");
  assert.match(onboarding, /router\.replace\("\/bienvenue"\)/);
  // Jamais arraché à un écran ouvert exprès : seulement depuis l'accueil ou la journée.
  assert.match(onboarding, /pathname === "\/" \|\| pathname === "\/aujourdhui"/);
});

test("⚠⚠ le compte maître est prévenu AVANT de valider — sinon une démo écrase notre identité", () => {
  const page = readFileSync(join(process.cwd(), "app/(app)/bienvenue/page.tsx"), "utf8");
  assert.match(page, /droits\.maitre &&/, "aucun avertissement pour le maître");
  assert.match(page, /remplace TON identité/);
});

test("sourceDe — la provenance et la page, sans le domaine ; l'accueil s'appelle accueil", () => {
  assert.equal(sourceDe({ valeur: "x", source: "texte", page: `${BASE}/`, extrait: "x" }), "texte du site · accueil");
  assert.equal(sourceDe({ valeur: "x", source: "balise", page: `${BASE}/contact/`, extrait: "x" }), "description du site · /contact");
  assert.equal(sourceDe(null), "");
});
