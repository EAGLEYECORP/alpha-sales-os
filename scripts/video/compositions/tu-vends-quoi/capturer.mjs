/**
 * Capture les écrans RÉELS du film « Tu vends quoi ? » (22/10/2026).
 *
 * ⚠ CE FICHIER EXISTE POUR QUE « ÉCRANS RÉELS » SOIT VÉRIFIABLE — même raison
 * que `scripts/pub/capturer.mjs`. Rien n'est dessiné : on sert l'app construite
 * en mode INSCRIT (installation client, donc `maitre: false` prouvé par le
 * serveur), on tape le métier dans le vrai champ « Ce que tu vends » et on
 * photographie le champ à CHAQUE lettre, puis on ouvre `/appels` et on
 * photographie les vraies lignes du script que l'app a écrites.
 *
 *   npm run build
 *   ALPHA_INSTALLATION=client SITE_PASSWORD=film npx next start -p 3112 &
 *   node scripts/video/compositions/tu-vends-quoi/capturer.mjs
 *
 * Les PNG ne sont PAS commités (binaires, régénérables) : ils vont dans
 * `caps/`, ignoré par git. La composition refuse de se rendre sans eux.
 *
 * ⚠ Les trois profils sont des EXEMPLES de métiers, pas des clients : aucun
 * nom de société, aucune personne. La société affichée est vide — l'app
 * écrit alors sans signature, ce qu'un inscrit qui n'a rien renseigné voit.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(join(ici, "../../../../package.json"));
const { chromium } = require_("playwright-core");
const BASE = process.env.ALPHA_URL ?? "http://127.0.0.1:3112";
const MOT_DE_PASSE = process.env.SITE_PASSWORD ?? "film";

/**
 * Les trois métiers du film — choisis LOIN les uns des autres. Ils vivent dans
 * `profils.json` parce que le test (`tests/film-tu-vends-quoi.test.ts`) les relit
 * pour prouver que chaque citation du film sort mot pour mot du vrai script.
 */
export const PROFILS = JSON.parse(readFileSync(join(ici, "profils.json"), "utf8"));

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const sortie = join(ici, "caps");

/**
 * ⚠ LES POLICES DE L'APP VIENNENT DE GOOGLE FONTS (`app/layout.tsx`), que ce
 * conteneur ne joint pas : sans ceci, les captures montrent la police de
 * secours du système — une image que l'app n'affiche chez personne. Les
 * fichiers versionnés à côté du film sont des polices VARIABLES (même fichier
 * pour 500, 600, 700) : on les déclare sur toute la plage de graisses.
 * ⚠ Elles se servent depuis l'adresse de `fonts.gstatic.com`, pas en `data:` :
 * la politique de sécurité de l'app (`next.config.ts`, `font-src 'self'
 * https://fonts.gstatic.com`) refuse le reste — vu en capture, police en
 * « error » et repli silencieux sur la police système.
 */
const POLICES = {
  "Bricolage Grotesque": "BricolageGrotesque-700-latin.woff2",
  "Inter Tight": "InterTight-500-latin.woff2",
  "JetBrains Mono": "JetBrainsMono-500-latin.woff2",
};
const FEUILLE_POLICES = Object.entries(POLICES)
  .map(([famille, f]) => `@font-face{font-family:"${famille}";font-style:normal;font-weight:100 900;font-display:block;src:url(https://fonts.gstatic.com/alpha-film/${f}) format("woff2")}`)
  .join("\n");
mkdirSync(sortie, { recursive: true });
const inventaire = {};

for (const profil of PROFILS) {
  // Fenêtre TÉLÉPHONE (l'app est mobile-first) ; 2,5× pour que le texte tienne à 1080 px.
  const ctx = await nav.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5, reducedMotion: "reduce" });
  const { id, ligne: _l, citation: _c, ...p } = profil;
  await ctx.addInitScript((etat) => {
    if (!sessionStorage.getItem("seme")) {
      localStorage.setItem("alpha-sales-os-v2", JSON.stringify({ state: { settings: etat }, version: 5 }));
      sessionStorage.setItem("seme", "1");
    }
  }, { accountId: "eagleye", agencyName: "", closerName: "", offer: { city: "", whatYouSell: "", valueProp: "" }, profil: { ...p, metier: "" }, onboarded: true });
  await ctx.route(/fonts\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: FEUILLE_POLICES }));
  await ctx.route(/fonts\.gstatic\.com/, (route) => {
    const f = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (!Object.values(POLICES).includes(f)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: readFileSync(join(ici, f)) });
  });
  const r = await ctx.request.post(BASE + "/api/gate", { data: { password: MOT_DE_PASSE } });
  if (!r.ok()) throw new Error(`/api/gate rend ${r.status()} — le serveur n'est pas en mode film (SITE_PASSWORD) sur ${BASE}`);
  const page = await ctx.newPage();

  // 1 · La frappe, dans le VRAI champ.
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const champ = page.locator('input[placeholder^="logiciel de paie"]').first();
  await champ.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const bloc = champ.locator("xpath=..");
  await champ.fill("");
  await champ.click();
  const frappe = [];
  for (let i = 0; i <= p.metier.length; i++) {
    if (i > 0) await champ.type(p.metier[i - 1]);
    const f = `${id}-frappe-${String(i).padStart(2, "0")}.png`;
    await bloc.screenshot({ path: join(sortie, f) });
    frappe.push(f);
  }
  // Le formulaire n'écrit qu'au bouton, comme pour l'inscrit : on le clique.
  await page.getByRole("button", { name: /Refaire la démo sur ma cible/ }).click();
  await page.waitForTimeout(400);

  // 2 · Le script que l'app a écrit pour CE métier.
  await page.goto(BASE + "/appels", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const titre = page.getByRole("button", { name: /Le script — Ton offre/ });
  const libelle = (await titre.textContent())?.trim();
  if (!libelle?.includes(p.metier)) throw new Error(`${id} : le script ne porte pas le métier tapé (« ${libelle} »)`);
  const ouvert = await page.locator("text=Diagnostic — poser, puis se taire").count();
  if (!ouvert) await titre.click();
  await page.waitForTimeout(500);
  const carte = titre.locator("xpath=ancestor::section[1]");
  await carte.evaluate((el) => el.scrollIntoView({ block: "center" }));
  /**
   * ⚠ L'EN-TÊTE ET LA BARRE DU BAS SONT FIXES : sur une capture d'élément, ils
   * recouvrent ce qu'ils survolent (vu sur la première passe : le logo posé sur
   * le titre du script). On les retire par leur POSITION calculée, pas par une
   * classe qui se périmerait — comme `scripts/pub/capturer.mjs`.
   */
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") el.style.visibility = "hidden";
    }
  });
  await page.evaluate(() => document.fonts.ready);
  await titre.screenshot({ path: join(sortie, `${id}-titre.png`) });
  const lignes = carte.locator("ol > li");
  const textes = [];
  for (let i = 0; i < Math.min(5, await lignes.count()); i++) {
    await lignes.nth(i).screenshot({ path: join(sortie, `${id}-ligne-${i + 1}.png`) });
    textes.push((await lignes.nth(i).innerText()).replace(/\s+/g, " ").trim());
  }
  inventaire[id] = { metier: p.metier, frappe, libelle, lignes: textes };
  await ctx.close();
}

writeFileSync(join(sortie, "inventaire.json"), JSON.stringify(inventaire, null, 2));
await nav.close();
console.log("Captures :", sortie);
