/**
 * Capture les écrans RÉELS de l'app pour la pub `scene-app.html`.
 *
 * ⚠ CE FICHIER EXISTE POUR QUE « CAPTURES RÉELLES » SOIT VÉRIFIABLE.
 * Une vidéo qui montre des écrans peut toujours montrer des maquettes, et
 * personne ne peut faire la différence en la regardant. Ici la recette est
 * écrite : on construit l'app (`npm run build`), on la sert (`npx next start`),
 * on ouvre les vraies routes et on photographie ce qu'elles rendent. Rien
 * n'est dessiné à la main.
 *
 *   npm run build && npx next start -p 3100 &
 *   node scripts/pub/capturer.mjs
 *
 * ⚠ Les JPEG ne sont PAS commités : binaires, régénérables, et ils dateraient
 * (le jeu de démonstration porte des dates relatives). `rendre.mjs` refuse de
 * rendre s'ils manquent plutôt que de produire une vidéo à trous.
 */
import { createRequire } from "node:module";
const require_ = createRequire(process.env.ALPHA_RACINE ?? new URL("../../package.json", import.meta.url).pathname);
const { chromium } = require_("playwright-core");
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.ALPHA_URL ?? "http://127.0.0.1:3100";

/**
 * ⚠ LE CHOIX DES ÉCRANS EST UNE DÉCISION, PAS UNE COMMODITÉ.
 *
 * Écartés sur pièces, après les avoir capturés et REGARDÉS :
 *  · `/moniteur` affiche « Autopilote · Éteint » (l'ordonnanceur n'est pas
 *    configuré ici) ;
 *  · `/appels` affiche « RDV 0 » ;
 *  · `/closer` et `/pipeline` mettent un MONTANT en tête d'écran.
 * Les quatre sont vrais et honnêtes dans l'app. Dans une publicité, les deux
 * premiers annoncent une machine à l'arrêt, et les deux autres font lire un
 * chiffre de démonstration comme un résultat — alors qu'aucune vente n'a eu
 * lieu (`JUILLET_REEL.gagnes` vaut 0).
 *
 * Ceux qui restent montrent le MÉCANISME : ce qu'on fait, ce qui s'est dit,
 * ce que l'agent a le droit de dire, où tout est rangé.
 */
export const ECRANS = [
  ["s1", "/aujourdhui"],
  ["s2", "/prospects/demo-sccv-canuts"],
  ["s3", "/voice"],
  ["s4", "/cerveau"],
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
// Fenêtre TÉLÉPHONE : l'app est mobile-first et la pub est en 9:16. Filmer un
// écran de bureau recadré en vertical montrerait une mise en page que personne
// n'utilise sur le support où la vidéo est vue.
const ctx = await nav.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
mkdirSync(join(ici, "caps"), { recursive: true });

for (const [nom, url] of ECRANS) {
  const r = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
  if (!r || r.status() !== 200) throw new Error(`${url} rend ${r?.status()} — l'app n'est pas servie sur ${BASE}`);
  await page.waitForTimeout(1800);

  /**
   * ⚠ LA BARRE DU BAS EST `position: fixed`. Sur une capture pleine page, le
   * navigateur la pose là où elle flottait — c'est-à-dire au tiers du
   * document, en plein milieu du contenu. Filmer ça montrerait une image que
   * l'app n'affiche JAMAIS. On la retire par sa POSITION calculée, pas par un
   * sélecteur de classe qui se périmerait au premier renommage.
   */
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      if (s.position === "fixed" && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.remove();
    }
  });

  // 1,4 hauteur d'écran : assez pour un défilement lent qui prouve que l'écran
  // continue, pas assez pour que le panoramique devienne illisible.
  await page.screenshot({
    path: join(ici, "caps", `${nom}.jpg`),
    type: "jpeg",
    quality: 88,
    fullPage: true,
    clip: { x: 0, y: 0, width: 430, height: 1300 },
  });
  console.log(`${nom} ← ${url}`);
}

await nav.close();
console.log(`${ECRANS.length} captures dans scripts/pub/caps/`);
