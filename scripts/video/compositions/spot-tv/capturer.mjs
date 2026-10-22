/**
 * Capture les écrans RÉELS du spot TV « façon Apple » (22/10/2026).
 *
 * ⚠ CE FICHIER EXISTE POUR QUE « ÉCRANS RÉELS » SOIT VÉRIFIABLE — même raison
 * que `../tu-vends-quoi/capturer.mjs`. Rien n'est dessiné : on sert l'app
 * construite en mode INSCRIT (installation client, `maitre: false` prouvé par
 * le serveur), thème clair, et on y fait les VRAIS gestes :
 *   1. la file d'appels de quatre restaurants, telle qu'elle s'ouvre ;
 *   2. un clic sur « Lire … au BODACC » — le vrai bouton, le vrai code
 *      (`lireLot` → `lireSignaux`) — puis la file telle qu'elle en sort ;
 *   3. le script que l'app écrit pour « un logiciel de caisse » ;
 *   4. la relecture d'une campagne : les brouillons que l'app prépare, un clic
 *      sur « Approuver », et la fiche que l'annonce légale a mise de côté.
 *
 * ⚠ LA SEULE CHOSE REMPLACÉE EST LA RÉPONSE DU RÉSEAU : l'API du BODACC reçoit
 * les annonces FICTIVES de `donnees.json` (format de l'API réelle). Le tri,
 * l'exclusion, la remontée en tête et la mise de côté du brouillon sont faits
 * par le code de l'app. Le test (`tests/film-spot-tv.test.ts`) rejoue ces
 * annonces dans le vrai `lireSignaux` et refuse un film qui ne dirait plus vrai.
 *
 *   npm run build
 *   ALPHA_INSTALLATION=client SITE_PASSWORD=spot npx next start -p 3114 &
 *   node scripts/video/compositions/spot-tv/capturer.mjs
 *
 * Les PNG ne sont PAS commités (binaires, régénérables) : ils vont dans `caps/`,
 * ignoré par git. La composition refuse de se rendre sans eux.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(join(ici, "../../../../package.json"));
const { chromium } = require_("playwright-core");
const BASE = process.env.ALPHA_URL ?? "http://127.0.0.1:3114";
const MOT_DE_PASSE = process.env.SITE_PASSWORD ?? "spot";
const D = JSON.parse(readFileSync(join(ici, "donnees.json"), "utf8"));
const sortie = join(ici, "caps");
mkdirSync(sortie, { recursive: true });

/**
 * ⚠ L'HORLOGE EST CELLE DU TOURNAGE : les annonces sont datées par rapport à
 * `tourneLe` (un moment « frais » a moins de soixante jours). On fige l'heure
 * du navigateur sur cette date — sinon le même film tourné un mois plus tard
 * montrerait une file différente, et le test ne pourrait plus le rejouer.
 */
const TOURNAGE = new Date(D.tourneLe);

/** Polices de l'app servies depuis l'adresse de `fonts.gstatic.com` (voir `../tu-vends-quoi/capturer.mjs`). */
const POLICES = {
  "Bricolage Grotesque": "BricolageGrotesque-700-latin.woff2",
  "Inter Tight": "InterTight-500-latin.woff2",
  "JetBrains Mono": "JetBrainsMono-500-latin.woff2",
};
const FEUILLE_POLICES = Object.entries(POLICES)
  .map(([famille, f]) => `@font-face{font-family:"${famille}";font-style:normal;font-weight:100 900;font-display:block;src:url(https://fonts.gstatic.com/alpha-film/${f}) format("woff2")}`)
  .join("\n");

/** Les fiches, au format du store. `normalizeProspect` complète le reste au chargement. */
const prospects = D.fiches.map((f, i) => ({
  id: f.id,
  name: f.name,
  company: f.company,
  sector: "restaurant",
  city: D.profil.cibleZone,
  phone: f.phone,
  email: f.email,
  siren: f.siren,
  stage: "prospect",
  tags: ["demo-spot"],
  createdAt: new Date(TOURNAGE.getTime() - (10 + i) * 86_400_000).toISOString(),
}));
const campagne = {
  id: D.campagne.id,
  name: D.campagne.name,
  sector: "restaurant",
  status: "brouillon",
  offerInfo: D.profil.metier,
  cible: `${D.profil.cibleRole} de ${D.profil.cibleSecteur}`,
  industries: [D.profil.cibleSecteur],
  marketInfo: "",
  leadMagnet: "",
  steps: [{ id: "spot-etape-1", kind: "email", role: "premiere-impression", delayDays: 0, subject: D.campagne.objet, body: D.campagne.corps }],
  stats: { sent: 0, opened: 0, replied: 0, booked: 0 },
  createdAt: TOURNAGE.toISOString(),
};
const { cibleZone: _z, ...profil } = D.profil;
const reglages = {
  accountId: "eagleye",
  agencyName: "",
  closerName: D.closerName,
  offer: { city: "", whatYouSell: "", valueProp: "" },
  profil: { ...profil, cibleZone: D.profil.cibleZone },
  onboarded: true,
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
// Fenêtre de BUREAU : une télévision est un écran large. 2× pour recadrer sans flou.
const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, reducedMotion: "reduce", locale: "fr-FR", timezoneId: "Europe/Paris" });
await ctx.addInitScript(
  ({ etat, horloge }) => {
    // L'heure du tournage, figée, pour les dates de la file et des annonces.
    const Vrai = Date;
    const decalage = horloge - Vrai.now();
    // eslint-disable-next-line no-global-assign
    Date = class extends Vrai {
      constructor(...a) {
        super(...(a.length ? a : [Vrai.now() + decalage]));
      }
      static now() {
        return Vrai.now() + decalage;
      }
    };
    if (!sessionStorage.getItem("seme")) {
      localStorage.setItem("alpha-sales-os-v2", JSON.stringify({ state: etat, version: 5 }));
      localStorage.setItem("alpha_theme", "light");
      sessionStorage.setItem("seme", "1");
    }
  },
  { etat: { settings: reglages, prospects, campaigns: [campagne], drafts: [] }, horloge: TOURNAGE.getTime() }
);
await ctx.route(/fonts\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: FEUILLE_POLICES }));
await ctx.route(/fonts\.gstatic\.com/, (route) => {
  const f = new URL(route.request().url()).pathname.split("/").pop() ?? "";
  if (!Object.values(POLICES).includes(f)) return route.fulfill({ status: 404, body: "" });
  return route.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: readFileSync(join(ici, f)) });
});
// ⚠ La SEULE réponse remplacée : l'API du BODACC rend les annonces fictives du SIREN demandé.
const lectures = [];
await ctx.route(/bodacc-datadila\.opendatasoft\.com/, (route) => {
  const ou = new URL(route.request().url()).searchParams.get("where") ?? "";
  const siren = /registre="(\d{9})"/.exec(ou)?.[1] ?? "";
  lectures.push(siren);
  const results = D.annonces[siren] ?? [];
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ total_count: results.length, results }),
  });
});
const r = await ctx.request.post(BASE + "/api/gate", { data: { password: MOT_DE_PASSE } });
if (!r.ok()) throw new Error(`/api/gate rend ${r.status()} — le serveur n'est pas en mode film (SITE_PASSWORD) sur ${BASE}`);
const page = await ctx.newPage();

/** Les en-têtes et barres fixes recouvrent ce qu'on photographie : retirés par leur POSITION calculée. */
const sansFixes = () =>
  page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") el.style.visibility = "hidden";
    }
  });
const pret = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
};
const inventaire = { lectures, file: {}, script: {}, revue: {} };
const lignesDeLaFile = () => page.locator("section.space-y-2 > div.card");
async function photographierFile(etiquette) {
  await sansFixes();
  const lignes = lignesDeLaFile();
  const n = await lignes.count();
  const noms = [];
  for (let i = 0; i < n; i++) {
    const l = lignes.nth(i);
    await l.scrollIntoViewIfNeeded();
    const nom = (await l.locator("p").first().innerText()).replace(/\s+/g, " ").trim();
    const id = D.fiches.find((f) => nom.startsWith(f.company))?.id ?? `inconnue-${i}`;
    await l.screenshot({ path: join(sortie, `file-${etiquette}-${id}.png`) });
    noms.push({ id, nom, angle: (await l.locator("p.mt-2\\.5").innerText()).replace(/\s+/g, " ").trim() });
  }
  inventaire.file[etiquette] = noms;
}

// 1 · La file, telle qu'elle s'ouvre.
await page.goto(BASE + "/appels", { waitUntil: "networkidle" });
await pret();
await photographierFile("avant");

// 2 · Un clic : la file lue au BODACC — le vrai bouton.
const bouton = page.getByRole("button", { name: /au BODACC/ });
inventaire.bouton = (await bouton.innerText()).trim();
await bouton.click();
await page.getByText(/sortie de la file par une annonce légale/).waitFor({ timeout: 15_000 });
await pret();
const blocApres = page.locator("section.card", { hasText: "Annonces légales" }).first();
inventaire.annonces = (await blocApres.innerText()).replace(/\s+/g, " ").trim();
await photographierFile("apres");

// 3 · Le script que l'app a écrit pour CE métier — une seule image, du titre à la bascule.
const titre = page.getByRole("button", { name: /Le script — Ton offre/ });
inventaire.script.libelle = (await titre.textContent())?.trim();
if (!inventaire.script.libelle?.includes(D.profil.metier)) throw new Error(`le script ne porte pas le métier (« ${inventaire.script.libelle} »)`);
if (!(await page.locator("text=Diagnostic — poser, puis se taire").count())) await titre.click();
await page.waitForTimeout(400);
const carte = titre.locator("xpath=ancestor::section[1]");
await carte.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => window.scrollBy(0, -120));
await sansFixes();
await pret();
const lignesScript = carte.locator("ol > li");
inventaire.script.lignes = [];
for (let i = 0; i < 4; i++) inventaire.script.lignes.push((await lignesScript.nth(i).innerText()).replace(/\s+/g, " ").trim());
const boiteCarte = await carte.boundingBox();
const boiteTitre = await titre.boundingBox();
const boiteFin = await lignesScript.nth(3).boundingBox();
const zone = { x: boiteCarte.x, y: boiteTitre.y, width: boiteCarte.width, height: boiteFin.y + boiteFin.height + 18 - boiteTitre.y };
await page.screenshot({ path: join(sortie, "script.png"), clip: zone });
/**
 * Où se trouvent, DANS cette image, le métier tapé (ligne 1) et le bas de
 * chaque ligne : la composition y pose son surligneur et ses caches au lieu de
 * les placer à l'œil. Mesuré sur le texte rendu (un Range), pas deviné.
 */
inventaire.script.zone = zone;
inventaire.script.metier = await lignesScript.nth(0).evaluate((li, cherche) => {
  const marcheur = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    const i = n.textContent.indexOf(cherche);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + cherche.length);
    const b = r.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  return null;
}, D.profil.metier);
if (!inventaire.script.metier) throw new Error("le métier n'est pas dans la première ligne du script");
inventaire.script.basDesLignes = [];
for (let i = 0; i < 4; i++) {
  const b = await lignesScript.nth(i).boundingBox();
  inventaire.script.basDesLignes.push(b.y + b.height - boiteTitre.y);
}

// 4 · La fiche écartée : ce que l'annonce a dit, sur la fiche elle-même (l'encadré rouge seul).
const exclue = D.fiches.find((f) => f.role === "exclue");
await page.goto(`${BASE}/prospects/${exclue.id}`, { waitUntil: "networkidle" });
await pret();
const panneau = page.locator("section.card", { hasText: "Annonces légales" }).first();
await panneau.scrollIntoViewIfNeeded();
await sansFixes();
const encadre = panneau.locator("div.rounded-lg", { hasText: "À ne pas démarcher" }).first();
await encadre.screenshot({ path: join(sortie, "fiche-exclue.png") });
inventaire.ficheExclue = (await encadre.innerText()).replace(/\s+/g, " ").trim();

// 5 · La relecture d'une campagne : les brouillons que l'app prépare, un clic sur « Approuver ».
// ⚠ Pas de `sansFixes` ici : la modale EST un élément fixe, et sa barre de compteurs est collante.
await page.goto(BASE + "/campaigns", { waitUntil: "networkidle" });
await pret();
await page.getByRole("button", { name: /Réviser & envoyer/ }).first().click();
const modale = page.locator("h3", { hasText: "Relecture avant envoi" }).locator("xpath=ancestor::div[contains(@class,'card')][1]");
await modale.waitFor();
await pret();
const compteurs = modale.locator("div.sticky").first();
const verrou = modale.locator("p", { hasText: "L'envoi est bloqué" });
const carteDe = (id) => modale.locator("ul > li", { hasText: D.fiches.find((f) => f.id === id).company });
const approuvee = D.fiches.find((f) => f.role === "neutre").id;
await compteurs.screenshot({ path: join(sortie, "revue-compteurs-avant.png") });
await verrou.screenshot({ path: join(sortie, "revue-verrou.png") });
await carteDe(approuvee).screenshot({ path: join(sortie, "revue-carte-avant.png") });
inventaire.revue.verrou = (await verrou.innerText()).trim();
inventaire.revue.avant = (await carteDe(approuvee).innerText()).replace(/\s+/g, " ").trim();
// Le geste : un humain clique « Approuver ».
const approuver = carteDe(approuvee).getByRole("button", { name: /^Approuver$/ });
const boite = await approuver.boundingBox();
const cadre = await carteDe(approuvee).boundingBox();
// Où tombe le clic DANS la carte — la composition y pose le curseur, au lieu de le deviner.
// Arrondi à 4 décimales : seize chiffres d'affilée ont la FORME d'un numéro de téléphone
// pour `tests/donnees-reelles` (vu le 22/10/2026), et la précision en trop ne sert à rien.
const quatre = (v) => Math.round(v * 1e4) / 1e4;
inventaire.revue.clic = { x: quatre((boite.x + boite.width / 2 - cadre.x) / cadre.width), y: quatre((boite.y + boite.height / 2 - cadre.y) / cadre.height) };
await approuver.click();
await page.waitForTimeout(400);
await compteurs.screenshot({ path: join(sortie, "revue-compteurs-apres.png") });
await carteDe(approuvee).screenshot({ path: join(sortie, "revue-carte-apres.png") });
inventaire.revue.apres = (await carteDe(approuvee).innerText()).replace(/\s+/g, " ").trim();
inventaire.revue.compteurs = (await compteurs.innerText()).replace(/\s+/g, " ").trim();

writeFileSync(join(sortie, "inventaire.json"), JSON.stringify(inventaire, null, 2));
await nav.close();
console.log("Captures :", sortie, "· lectures BODACC :", lectures.join(", "));
