/**
 * Capture les écrans RÉELS du film « Notifications » (06/11/2026), en THÈME CLAIR.
 *
 * Rien n'est dessiné : on sert l'app construite, on ouvre le vrai `/notifications`
 * et la vraie cloche de la coquille. Seules les DONNÉES sont fictives
 * (`donnees.json`, entreprises « (DÉMO) ») : la réponse du réseau
 * `/api/track/stats` est remplacée, et le journal du pilote est posé dans le
 * stockage du navigateur — là où un inscrit l'a. On ne touche jamais à l'app
 * (même règle que le spot TV : on remplace la RÉPONSE, jamais l'écran).
 *
 *   npm run build && npx next start -p 3100 &
 *   node scripts/video/compositions/notifications/capturer.mjs
 *
 * Les PNG vont dans `caps/` (ignoré par git) : binaires, régénérables.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(join(ici, "../../../../package.json"));
const { chromium } = require_("playwright-core");
const BASE = process.env.ALPHA_URL ?? "http://127.0.0.1:3100";
const D = JSON.parse(readFileSync(join(ici, "donnees.json"), "utf8"));
const sortie = join(ici, "caps");
mkdirSync(sortie, { recursive: true });

// Polices de l'app (Google Fonts, injoignable ici) servies depuis les fichiers du film.
const FACES = [
  ["Bricolage Grotesque", [600, 700], "BricolageGrotesque-700-latin"], ["Bricolage Grotesque", [800], "BricolageGrotesque-800-latin"],
  ["Inter Tight", [400, 500], "InterTight-500-latin"], ["Inter Tight", [600], "InterTight-600-latin"], ["Inter Tight", [700], "InterTight-700-latin"],
  ["JetBrains Mono", [400, 500], "JetBrainsMono-500-latin"], ["JetBrains Mono", [600], "JetBrainsMono-600-latin"],
];
const CSS = FACES.flatMap(([f, ws, file]) => ws.map((w) => `@font-face{font-family:'${f}';font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/local/${file}.woff2) format('woff2');}`)).join("\n");

/** Le suivi tel qu'il était à l'heure `t` : ouvertures et clics postérieurs effacés. */
const suiviA = (t) =>
  D.suivi
    .filter((r) => r.createdAt <= t)
    .map((r) => ({
      ...r,
      opens: r.lastOpenAt && r.lastOpenAt <= t ? r.opens : 0,
      lastOpenAt: r.lastOpenAt && r.lastOpenAt <= t ? r.lastOpenAt : undefined,
      clicks: r.lastClickAt && r.lastClickAt <= t ? r.clicks : 0,
      lastClickAt: r.lastClickAt && r.lastClickAt <= t ? r.lastClickAt : undefined,
    }));
const journalA = (t) => D.journal.filter((e) => e.le <= t);

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });

async function ecran(etape, route, nom, vp) {
  const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: 2, timezoneId: "Europe/Paris", locale: "fr-FR" });
  await ctx.addInitScript(() => localStorage.setItem("alpha_theme", "light"));
  await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: CSS }));
  await ctx.route("https://fonts.gstatic.com/local/**", (r) =>
    r.fulfill({ contentType: "font/woff2", body: readFileSync(join(ici, r.request().url().split("/").pop())) }),
  );
  await ctx.route("**/api/track/stats**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ records: suiviA(etape.jusqua) }) }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(etape.jusqua));
  await page.goto(BASE + "/aujourdhui", { waitUntil: "networkidle" });
  // Le journal du pilote, là où un inscrit l'a : dans son navigateur.
  await page.evaluate(
    ([journal, vu]) => {
      const brut = JSON.parse(localStorage.getItem("alpha-sales-os-v2") ?? "{}");
      const s = brut.state ?? {};
      s.settings = s.settings ?? {};
      const ap = s.settings.autopilote ?? {};
      s.settings.autopilote = { reglages: ap.reglages ?? {}, etat: { ...(ap.etat ?? {}), journal } };
      brut.state = s;
      localStorage.setItem("alpha-sales-os-v2", JSON.stringify(brut));
      localStorage.setItem("alpha-notifications-vu", vu);
    },
    [journalA(etape.jusqua), etape.vu],
  );
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(sortie, `${nom}.png`) });
  console.log(nom, route);
  await ctx.close();
}

const TEL = { width: 430, height: 932 };
for (const e of D.etapes) await ecran(e, "/notifications", `fil-${e.nom}`, TEL);
await ecran(D.etapes[3], "/aujourdhui", "cloche", TEL);
await nav.close();
