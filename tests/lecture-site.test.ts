import { test } from "node:test";
import assert from "node:assert/strict";
import { lireSite, pagesUtiles, propositionDepuisLecture, type PageLue } from "../lib/lecture-site";
import { POST } from "../app/api/onboarding/site/route";

/**
 * « Donne ton site, Alpha se configure » — `lib/lecture-site.ts`.
 *
 * Le site d'exemple est une FICTION de bout en bout : domaine en `.test`
 * (RFC 2606), téléphone dans une plage ARCEP réservée à la fiction, SIREN de
 * démonstration. Rien ici n'identifie une entreprise réelle.
 */

const BASE = "https://menuiserie-demo.test";

const ACCUEIL = `<!doctype html><html><head>
<title>Menuiseries bois et alu à Lyon | Menuiserie Démo</title>
<meta name="description" content="Fabrication et pose de menuiseries bois et aluminium pour le logement collectif neuf. Devis sous 48 h.">
<meta property="og:site_name" content="Menuiserie Démo">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"site"},{"@type":"HomeAndConstructionBusiness","name":"Menuiserie Démo","telephone":"+33 4 65 71 23 45","address":{"@type":"PostalAddress","addressLocality":"VILLEURBANNE","postalCode":"69100"}}]}</script>
</head><body>
<nav><a href="https://annuaire-demo.test/contact-menuiserie">Contact via l'annuaire</a> <a href="/contact">Contact</a> <a href="/mentions-legales">Mentions légales</a> <a href="/nos-prestations">Prestations</a>
<a href="/nos-services">Services</a> <a href="https://www.facebook.com/menuiserie-demo">Facebook</a> <a href="#haut">Haut</a></nav>
<h1>Vos menuiseries posées dans les délais du chantier</h1>
<p>Nous travaillons pour les promoteurs immobiliers et les bailleurs sociaux, ainsi que pour les promoteurs régionaux.</p>
<p>Nous intervenons dans tout le Rhône et l'Ain.</p>
<p><a href="https://calendly.com/menuiserie-demo/15min">Prendre rendez-vous</a></p>
</body></html>`;

const CONTACT = `<html><body><h1>Contact</h1>
<p>Menuiserie Démo — 12 rue de l&#39;Exemple, 69100 Villeurbanne, France</p>
<p><a href="mailto:agence@studio-web.test">Site réalisé par un studio</a> · <a href="mailto:contact@menuiserie-demo.test">Écrivez-nous</a></p>
<p><a href="tel:+33465712345">04 65 71 23 45</a></p>
</body></html>`;

const MENTIONS = `<html><body><h1>Mentions légales</h1>
<p>SAS au capital de 10 000 €. RCS Lyon SIREN 123 456 782.</p>
<p>Directeur de la publication : Camille Fictif</p>
</body></html>`;

const pages = (): PageLue[] => [
  { url: `${BASE}/`, html: ACCUEIL },
  { url: `${BASE}/contact`, html: CONTACT },
  { url: `${BASE}/mentions-legales`, html: MENTIONS },
];

test("la lecture rend le nom, l'activité, la ville et les coordonnées — chacun avec sa source", () => {
  const l = lireSite(pages());
  assert.equal(l.nom?.valeur, "Menuiserie Démo");
  assert.equal(l.nom?.source, "donnees-structurees");
  assert.match(l.activite?.valeur ?? "", /^Fabrication et pose de menuiseries/);
  assert.equal(l.promesse?.valeur, "Vos menuiseries posées dans les délais du chantier");
  // Les capitales du registre sont remises en casse lisible.
  assert.equal(l.ville?.valeur, "Villeurbanne");
  assert.equal(l.telephone?.valeur, "04 65 71 23 45");
  assert.equal(l.lienRdv?.valeur, "https://calendly.com/menuiserie-demo/15min");
  assert.equal(l.siren?.valeur, "123456782");
  // « tout le Rhône et l'Ain » : l'article en tête et le « l' » de l'Ain ne coupent plus la zone.
  assert.equal(l.zone?.valeur, "Rhône et l'Ain");
  // Chaque trouvaille porte la page où elle a été lue, et l'extrait.
  for (const t of [l.nom, l.activite, l.ville, l.telephone, l.siren, l.dirigeant]) {
    assert.ok(t && t.page.startsWith(BASE) && t.extrait.length > 0, `trouvaille sans source : ${JSON.stringify(t)}`);
  }
});

test("⚠ l'email retenu est celui du DOMAINE du site, pas celui de l'agence qui l'a fabriqué", () => {
  const l = lireSite(pages());
  assert.equal(l.email?.valeur, "contact@menuiserie-demo.test");
});

test("les clientèles sont comptées et prouvées ; la plus citée passe en premier", () => {
  const l = lireSite(pages());
  assert.equal(l.clienteles[0]?.id, "promoteurs");
  assert.equal(l.clienteles[0]?.occurrences, 2);
  assert.ok(l.clienteles.some((c) => c.id === "bailleurs"));
  assert.match(l.clienteles[0].preuve.extrait, /promoteurs/);
});

test("⚠ « entreprise de menuiserie » ne range personne en B2B", () => {
  const l = lireSite([{ url: `${BASE}/`, html: "<p>Entreprise de menuiserie depuis 1990. Une entreprise familiale.</p>" }]);
  assert.ok(!l.clienteles.some((c) => c.id === "professionnels"));
});

test("⚠⚠ ce qui n'est pas sur le site reste VIDE et se DIT — on n'invente pas une cible", () => {
  const l = lireSite([{ url: `${BASE}/`, html: "<title>Accueil</title><p>Bienvenue sur notre site.</p>" }]);
  const prop = propositionDepuisLecture(l);
  assert.equal(prop.profil.cibleSecteur, "");
  assert.equal(prop.bookingUrl, "");
  assert.ok(l.manques.some((m) => /secteur de tes clients/.test(m)));
  assert.ok(l.manques.some((m) => /rendez-vous/.test(m)));
});

test("⚠⚠ le dirigeant lu n'est JAMAIS posé d'office comme signataire", () => {
  const l = lireSite(pages());
  assert.equal(l.dirigeant?.valeur, "Camille Fictif");
  const prop = propositionDepuisLecture(l);
  assert.equal(prop.dirigeant, "Camille Fictif");
  // Il n'apparaît que dans le champ « proposé » : ni nom d'entreprise, ni profil.
  assert.ok(!JSON.stringify({ ...prop, dirigeant: "" }).includes("Camille Fictif"));
});

test("la proposition remplit le profil à partir de la lecture", () => {
  const prop = propositionDepuisLecture(lireSite(pages()));
  assert.equal(prop.agencyName, "Menuiserie Démo");
  assert.equal(prop.offer.city, "Villeurbanne");
  assert.equal(prop.profil.cibleSecteur, "promotion immobilière");
  assert.equal(prop.profil.cibleRole, "directeurs de programmes");
  // Ce qui suit « Tu vends … » : sans majuscule de phrase, sans point final.
  assert.equal(prop.profil.metier, "fabrication et pose de menuiseries bois et aluminium pour le logement collectif neuf");
});

test("le nom se lit dans le titre quand rien d'autre ne le porte — le morceau qui ressemble au domaine", () => {
  const l = lireSite([{ url: "https://www.roux-demo.test/", html: "<title>Roux Démo – Menuisier poseur depuis 1987</title>" }]);
  assert.equal(l.nom?.valeur, "Roux Démo");
  assert.equal(l.nom?.source, "titre");
});

test("un SIREN qui ne vérifie pas la clé de Luhn n'est pas lu", () => {
  const l = lireSite([{ url: `${BASE}/`, html: "<p>SIRET : 123 456 789 00012</p>" }]);
  assert.equal(l.siren, null);
});

test("pagesUtiles : même hôte, une page par famille, contact avant prestations, trois au plus", () => {
  const p = pagesUtiles(`${BASE}/`, ACCUEIL);
  assert.deepEqual(p, [`${BASE}/contact`, `${BASE}/mentions-legales`, `${BASE}/nos-prestations`]);
  assert.ok(!p.some((u) => u.includes("facebook")));
});

// ── La route, appelée pour de vrai, réseau simulé ─────────────────────

function avecReseau(routes: Record<string, string>, appels: string[]) {
  const vrai = globalThis.fetch;
  globalThis.fetch = (async (entree: string | URL | Request) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.toString() : entree.url;
    appels.push(url);
    if (url.startsWith("https://recherche-entreprises.api.gouv.fr/")) {
      return new Response(
        JSON.stringify({ results: [{ siren: "123456782", nom_complet: "MENUISERIE DEMO SAS", siege: { libelle_commune: "VILLEURBANNE" } }] }),
        { headers: { "content-type": "application/json" } }
      );
    }
    const html = routes[url];
    return html === undefined
      ? new Response("introuvable", { status: 404, headers: { "content-type": "text/html" } })
      : new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = vrai;
  };
}

const requete = (url: string) =>
  new Request("http://local/api/onboarding/site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

test("la route lit l'accueil PUIS les pages utiles, recoupe au registre, et rend une proposition", async () => {
  const appels: string[] = [];
  const restaurer = avecReseau(
    { [`${BASE}/`]: ACCUEIL, [`${BASE}/contact`]: CONTACT, [`${BASE}/mentions-legales`]: MENTIONS },
    appels
  );
  try {
    const res = await POST(requete("menuiserie-demo.test"));
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      lecture: ReturnType<typeof lireSite>;
      proposition: ReturnType<typeof propositionDepuisLecture>;
    };
    assert.equal(json.lecture.nom?.valeur, "Menuiserie Démo");
    assert.equal(json.lecture.registre?.raisonSociale, "MENUISERIE DEMO SAS");
    assert.equal(json.proposition.profil.cibleSecteur, "promotion immobilière");
    // ⚠ Jamais de sortie hors du site de l'inscrit, à part le registre public.
    assert.ok(appels.every((u) => u.startsWith(BASE) || u.startsWith("https://recherche-entreprises.api.gouv.fr/")), appels.join(" "));
    // Une page interne absente (404) n'empêche pas la lecture.
    assert.ok(appels.includes(`${BASE}/nos-prestations`));
  } finally {
    restaurer();
  }
});

test("⚠ la route refuse une adresse du réseau interne — avant toute requête", async () => {
  const appels: string[] = [];
  const restaurer = avecReseau({}, appels);
  try {
    for (const u of ["http://127.0.0.1/", "localhost:3000", "http://192.168.1.10/", ""]) {
      const res = await POST(requete(u));
      assert.equal(res.status, 400, u);
    }
    assert.deepEqual(appels, []);
  } finally {
    restaurer();
  }
});

test("un site injoignable rend une erreur lisible, pas une page blanche", async () => {
  const restaurer = avecReseau({}, []);
  try {
    const res = await POST(requete("https://absent-demo.test"));
    assert.equal(res.status, 422);
    const json = (await res.json()) as { error: string };
    assert.match(json.error, /Impossible de lire ce site/);
  } finally {
    restaurer();
  }
});
