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
const dossier = join(ici, "frames");
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

const nav = await chromium.launch({
  // ⚠ Surchargeable : un chemin de conteneur en dur rend le script inexécutable
  // ailleurs, et ça ne se découvre qu'en essayant.
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--font-render-hinting=none"],
});
const page = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + join(ici, "scene.html"));

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

// Six images de contrôle : on REGARDE ce qui est rendu, on ne le suppose pas.
for (const [n, t] of [[1, 1.9], [2, 5.4], [3, 10.4], [4, 16.2], [5, 20.6], [6, 23.8]]) {
  await page.evaluate((x) => window.__draw(x), t);
  await page.locator("#c").screenshot({ path: join(ici, `plan${n}.png`) });
}

await nav.close();
console.log("images écrites");
