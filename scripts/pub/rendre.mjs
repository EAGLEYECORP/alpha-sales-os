/**
 * Rendu VRAIMENT déterministe : une image = un fichier, ffmpeg cadence.
 *
 * ⚠⚠ LA PREMIÈRE VERSION UTILISAIT `MediaRecorder` + `captureStream(0)` +
 * `requestFrame()`, et son commentaire affirmait « 30 fps exacts quelle que
 * soit la charge ». C'ÉTAIT FAUX, et la mesure l'a dit : le fichier sortait à
 * **13,9 s pour un montage de 25,6 s** — tout jouait à environ deux fois la
 * vitesse.
 *
 * La raison : `MediaRecorder` horodate chaque image à l'HORLOGE MURALE, pas au
 * rythme auquel on la lui pousse. `requestFrame()` dit « voilà une image », pas
 * « place-la à t = n/30 ». Boucler plus vite que le temps réel comprime donc la
 * vidéo — et rien ne le signale : le fichier est parfaitement valide, il est
 * simplement au mauvais tempo. C'est le même mode de panne que partout dans ce
 * dépôt : ça ne casse pas, ça ment.
 *
 * Ici chaque image est écrite sur disque et numérotée ; `ffmpeg -framerate 30`
 * décide seul du temps. La durée ne dépend plus de la vitesse de la machine.
 */
import { createRequire } from "node:module";
// playwright-core est en CommonJS : un import nommé depuis un module ESM échoue
// au lien. `createRequire` est le pont, sans ajouter de dépendance au dépôt.
const require_ = createRequire(process.env.ALPHA_RACINE ?? new URL("../../package.json", import.meta.url).pathname);
const { chromium } = require_("playwright-core");
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));

/**
 * ⚠ UNE SEULE MÉCANIQUE DE RENDU POUR TOUTES LES SCÈNES.
 *
 *   node scripts/pub/rendre.mjs             → scene.html      (pub typographique)
 *   node scripts/pub/rendre.mjs scene-app   → scene-app.html  (captures de l'app)
 *
 * Dupliquer ce fichier par scène dupliquerait ses DEUX gardes — la police et
 * le débordement. C'est le défaut signature de ce dépôt : la copie qu'on ne
 * relit pas est celle qui cesse de mordre.
 */
const SCENE = (process.argv[2] ?? "scene").replace(/\.html$/, "");
const dossier = join(ici, "frames-" + SCENE);
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const nav = await chromium.launch({
  // ⚠ Surchargeable : un chemin de conteneur en dur rend le script inexécutable
  // ailleurs, et ça ne se découvre qu'en essayant.
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  /**
   * ⚠ `--allow-file-access-from-files` N'EST PAS DU CONFORT.
   *
   * Dessiner une image chargée en `file://` sur un canevas le SOUILLE au sens
   * de la spécification, et `toDataURL` lève alors `SecurityError`. Sans ce
   * drapeau, toute scène qui affiche une capture (`scene-app.html`) s'arrête
   * à la première image — mesuré, pas supposé.
   *
   * Le risque du drapeau est qu'une page lise d'autres fichiers du disque. Ici
   * la page est la nôtre, elle est dans le dépôt, et le navigateur est lancé
   * pour elle seule puis fermé. Le laisser tomber pour « faire propre »
   * casserait la moitié des pubs.
   */
  args: ["--font-render-hinting=none", "--allow-file-access-from-files"],
});
const page = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + join(ici, SCENE + ".html"));

// ⚠ ATTENDRE LA POLICE. `goto` rend la main dès que le DOM est prêt, pas quand
// la woff2 est décodée : sans cette attente, les premières images sortent dans
// la police de repli — et la toute première est l'image de couverture.
await page.evaluate(() => window.__prete ?? document.fonts.ready);

/**
 * ⚠⚠ LA POLICE SE VÉRIFIE, ELLE NE SE SUPPOSE PAS — et l'échec est BRUYANT.
 *
 * `scene.html` charge `archivo-black-400.woff2` par un chemin relatif. Le
 * fichier n'est PAS dans le dépôt (binaire, et il vit déjà dans le kit de
 * polices de higgsedit). S'il manque, le navigateur ne proteste pas : il
 * retombe sur la police suivante de la pile et dessine quand même.
 *
 * C'est le pire mode de panne possible ici — la vidéo sort, elle est valide,
 * elle n'est simplement pas à la bonne typo, et ça ne se voit que si on
 * compare. On refuse donc de rendre plutôt que de livrer une pub en repli.
 *
 * Où le trouver : `/opt/fable/fonts-kit/archivo-black-400.woff2` (sandbox
 * Higgsfield), ou n'importe quelle distribution OFL d'Archivo Black.
 */
const policeOk = await page.evaluate(() => document.fonts.check('bold 100px "Archivo Black"'));
if (!policeOk && !process.env.PUB_ACCEPTE_REPLI) {
  await nav.close();
  throw new Error(
    "Archivo Black n'est pas chargée : place `archivo-black-400.woff2` à côté de scene.html.\n" +
      "Rendre sans elle produit une vidéo valide dans la MAUVAISE typo, et rien ne le signale.\n" +
      "Pour passer outre en connaissance de cause : PUB_ACCEPTE_REPLI=1."
  );
}
console.log("police d'affichage : " + (policeOk ? "Archivo Black" : "⚠ REPLI ASSUMÉ"));

/**
 * ⚠⚠ CHANGER DE POLICE CHANGE LA MISE EN PAGE, et ça ne se voit pas d'ici.
 *
 * Payé le 11/09/2026 : les tailles avaient été calées sur la police de repli.
 * Archivo Black est ~17 % plus large à taille égale (735 px contre 628 px sur
 * « Votre permis » en 104 px). Quatre lignes ont débordé la marge, et
 * « depuis 4 mois. » — le PLAN D'OUVERTURE, donc l'image de couverture — est
 * sortie du canevas : 1094 px de bord droit pour une toile de 1080.
 *
 * Le fichier produit était parfaitement valide. Il était simplement coupé.
 * C'est le même mode de panne que le repli de police et que MediaRecorder :
 * ça ne casse pas, ça ment — et ici ça part chez des gens.
 *
 * On ne mesure pas une liste tenue à la main : on instrumente `fillText` et on
 * balaie TOUTES les images. Ce qui est vérifié est ce qui est réellement
 * dessiné, y compris ce qu'une session future ajoutera.
 */
const debords = await page.evaluate(() => {
  const c = document.getElementById("c").getContext("2d");
  const M = window.__MARGE, W = window.__W;
  const vus = new Map();
  const brut = c.fillText.bind(c);
  c.fillText = function (txt, x, y) {
    const w = c.measureText(txt).width;
    const g = c.textAlign === "center" ? x - w / 2 : x;
    const d = g + w;
    // Bord DROIT : la marge utile. Aucune animation ne pousse vers la droite,
    // donc la dépasser est toujours un défaut de mise en page.
    // Bord GAUCHE : le canevas, pas la marge — les plaques du plan 4 entrent
    // en glissant depuis `dx = -44` et passent volontairement sous la marge.
    // Contrôler la marge à gauche condamnerait le mouvement lui-même.
    if (d > W - M || g < 0) {
      const cle = txt + "|" + c.font;
      if (!vus.has(cle)) vus.set(cle, `« ${txt} » (${c.font}) : ${Math.round(g)} → ${Math.round(d)}`);
    }
    return brut(txt, x, y);
  };
  for (let i = 0; i < Math.round(window.__FPS * window.__DUR); i++) window.__draw(i / window.__FPS);
  c.fillText = brut;
  return [...vus.values()];
});
if (debords.length) {
  await nav.close();
  throw new Error(
    `${debords.length} texte(s) sortent de la boîte utile — la vidéo serait coupée :\n  ` +
      debords.join("\n  ") +
      "\nBaisse la taille dans scene.html. Ne rends pas : le fichier serait valide et faux."
  );
}
console.log("mise en page : aucun débordement");

const FPS = await page.evaluate(() => window.__FPS);
const DUR = await page.evaluate(() => window.__DUR);
const total = Math.round(FPS * DUR);
console.log(`${total} images à ${FPS} fps (${DUR}s attendues)`);

for (let i = 0; i < total; i++) {
  const b64 = await page.evaluate((t) => {
    window.__draw(t);
    return document.getElementById("c").toDataURL("image/jpeg", 0.96).slice(23);
  }, i / FPS);
  writeFileSync(join(dossier, String(i).padStart(4, "0") + ".jpg"), Buffer.from(b64, "base64"));
  if (i % 150 === 0) console.log(`  ${i}/${total}`);
}

/**
 * Images de contrôle : on REGARDE ce qui est rendu, on ne le suppose pas.
 *
 * ⚠ Les instants viennent de la SCÈNE (`window.__PLANS`), pas d'une liste
 * tenue ici. Une liste locale se périme au premier remontage : on déplacerait
 * une coupe et les vignettes montreraient des transitions au lieu des plans,
 * sans que rien ne le signale.
 */
const instants = await page.evaluate(() => window.__PLANS ?? []);
for (const [i, t] of instants.entries()) {
  await page.evaluate((x) => window.__draw(x), t);
  await page.locator("#c").screenshot({ path: join(ici, `${SCENE}-plan${i + 1}.png`) });
}

await nav.close();
console.log("images écrites");
