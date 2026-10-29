/**
 * Capture les écrans RÉELS du film « ALPHA vend ALPHA » (29/10/2026).
 *
 * ⚠ CE FICHIER EXISTE POUR QUE « ÉCRANS RÉELS » SOIT VÉRIFIABLE — même raison
 * que `../tu-vends-quoi/capturer.mjs`. Rien n'est dessiné. On sert l'app
 * construite en mode MAÎTRE (mot de passe de film, aucun compte : le serveur
 * rend `maitre: true`, prouvé), on lui donne NOTRE offre dans le vrai champ
 * « Ce que tu vends », puis on lance le vrai pilote automatique
 * (`components/autopilote/moteur-autopilote.tsx`) et on photographie ce qu'il
 * écrit dans son journal, à mesure.
 *
 *   npm run build
 *   SITE_PASSWORD=film npx next start -p 3113 &
 *   node scripts/video/compositions/alpha-vend-alpha/capturer.mjs
 *
 * ⚠ ON REMPLACE LES RÉPONSES DU RÉSEAU, JAMAIS L'APP (règle du spot TV) :
 *  · le registre des entreprises et le BODACC rendent des sociétés FICTIVES ;
 *  · Dropcontact rend leurs coordonnées (domaines RFC 2606) ;
 *  · `/api/agenda` rend un agenda où le mercredi est pris ;
 *  · `/api/send` est un faux STRICT — il refuse en 409 ce que le vrai refuse
 *    (un second premier message, une « réponse » sans message de notre part) ;
 *  · `/api/reponses` rend les réponses écrites dans `donnees.json`, seulement
 *    une fois que le message auquel elles répondent est PARTI.
 * Le reste — le tri, le classement des réponses, le choix des créneaux, le
 * rendez-vous, l'escalade du prix — est le code de production, horloge accélérée.
 *
 * Les emails montrés sont rendus par le serveur lui-même (`/api/email/preview` :
 * même `habillageEnvoi`, même `renderEmail` que `/api/send`), à partir du corps
 * EXACT que le pilote a envoyé. C'est ce qui arriverait dans la boîte du prospect.
 *
 * Les PNG ne sont PAS commités (binaires, régénérables) : ils vont dans
 * `caps/`, ignoré par git. La composition refuse de se rendre sans eux.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(join(ici, "../../../../package.json"));
const { chromium } = require_("playwright-core");
const BASE = process.env.ALPHA_URL ?? "http://127.0.0.1:3113";
const MOT_DE_PASSE = process.env.SITE_PASSWORD ?? "film";
const D = JSON.parse(readFileSync(join(ici, "donnees.json"), "utf8"));
const sortie = join(ici, "caps");
mkdirSync(sortie, { recursive: true });

// Polices de l'app servies depuis l'adresse gstatic interceptée (CSP : `font-src https://fonts.gstatic.com`).
const POLICES = {
  "Bricolage Grotesque": "BricolageGrotesque-700-latin.woff2",
  "Inter Tight": "InterTight-500-latin.woff2",
  "JetBrains Mono": "JetBrainsMono-500-latin.woff2",
};
const FEUILLE_POLICES = Object.entries(POLICES)
  .map(([famille, f]) => `@font-face{font-family:"${famille}";font-style:normal;font-weight:100 900;font-display:block;src:url(https://fonts.gstatic.com/alpha-film/${f}) format("woff2")}`)
  .join("\n");

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

/**
 * ⚠ FUSEAU DE PARIS. Le conteneur est en UTC : vu à la première passe, l'écran
 * du jour annonçait « 08:00 » pour un rendez-vous fixé à 9 h — l'heure que
 * verrait un utilisateur à Londres, pas à Lyon.
 */
async function contexte({ largeur = 430, hauteur = 932, echelle = 2.5 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: echelle, reducedMotion: "reduce", timezoneId: "Europe/Paris", locale: "fr-FR" });
  await ctx.addInitScript(({ reglages, agenda }) => {
    if (!sessionStorage.getItem("seme")) {
      localStorage.setItem("alpha-sales-os-v2", JSON.stringify({ state: { settings: reglages }, version: 5 }));
      // L'adresse secrète de l'agenda vit HORS du magasin (`lib/cle-locale.ts`).
      localStorage.setItem("alpha-agenda-ics", agenda);
      sessionStorage.setItem("seme", "1");
    }
  }, { reglages: D.reglages, agenda: "https://calendar.example.com/private-demo/basic.ics" });
  await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: FEUILLE_POLICES }));
  await ctx.route(/fonts\.gstatic\.com/, (r) => {
    const f = new URL(r.request().url()).pathname.split("/").pop() ?? "";
    if (!Object.values(POLICES).includes(f)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: readFileSync(join(ici, f)) });
  });
  const g = await ctx.request.post(BASE + "/api/gate", { data: { password: MOT_DE_PASSE } });
  if (!g.ok()) throw new Error(`/api/gate rend ${g.status()} — le serveur n'est pas en mode film (SITE_PASSWORD) sur ${BASE}`);
  /**
   * Le cookie du mot de passe est `Secure` : le navigateur l'envoie à 127.0.0.1,
   * le client HTTP de Playwright non (vu : 401 sur `ctx.request`). Toute lecture
   * du serveur passe donc par une PAGE, comme dans l'app.
   */
  const sonde = await ctx.newPage();
  await sonde.goto(BASE + "/api/compte/droits");
  const droits = JSON.parse(await sonde.locator("body").innerText());
  await sonde.close();
  if (droits.maitre !== true) throw new Error("le serveur ne rend pas le verdict MAÎTRE : ce film montre ALPHA vendre NOTRE offre");
  return ctx;
}

/** L'en-tête et la barre du bas sont FIXES : sur une capture d'élément, ils recouvrent ce qu'ils survolent. */
const sansFixes = (page) =>
  page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") el.style.visibility = "hidden";
    }
  });

const inventaire = { frappe: [], journal: {}, emails: {}, reperes: {} };

/**
 * Où se trouvent, DANS une capture, les lignes que le montage surligne — en
 * pixels de l'image. Mesuré sur le rendu, jamais estimé : un surlignage posé à
 * l'œil glisse sur la ligne voisine au premier changement de texte.
 */
async function reperes(racine, motifs, echelle) {
  return racine.evaluate(
    (el, { motifs, echelle }) => {
      const base = el.getBoundingClientRect();
      const out = {};
      for (const [id, texte] of Object.entries(motifs)) {
        const candidats = Array.from(el.querySelectorAll("p, td, label, li, h1, h2, input, select, table"))
          // `value` n'est du texte que sur un champ (`<li value>` est un nombre).
          .filter((n) => String(n instanceof HTMLInputElement ? n.value : (n.textContent ?? "")).includes(texte))
          .sort((x, y) => (x.textContent ?? "").length - (y.textContent ?? "").length);
        const n = candidats[0];
        if (!n) throw new Error(`repère introuvable : « ${texte} »`);
        const r = n.getBoundingClientRect();
        out[id] = { y: Math.round((r.top - base.top) * echelle), h: Math.round(r.height * echelle) };
      }
      return out;
    },
    { motifs, echelle },
  );
}

// ── 1 · NOTRE offre, tapée dans le VRAI champ « Ce que tu vends » ─────────
{
  // Plus large que le téléphone, sous le point de rupture (640 px, deux colonnes) :
  // la phrase entière tient dans le champ (à 430 px
  // elle défilait, et l'image finale commençait à « de vente… »).
  const ctx = await contexte({ largeur: 620, hauteur: 932, echelle: 1.8 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const champ = page.locator('input[placeholder^="logiciel de paie"]').first();
  await champ.scrollIntoViewIfNeeded();
  await sansFixes(page);
  await page.waitForTimeout(400);
  const bloc = champ.locator("xpath=..");
  await champ.fill("");
  await champ.click();
  const metier = D.reglages.profil.metier;
  /**
   * Où est le curseur, en pixels de l'image, après chaque lettre. Le montage
   * suit la frappe de près (la phrase entière, à la taille du champ, se lisait
   * à peine sur un téléphone) : il lui faut la position RÉELLE du curseur, pas
   * une vitesse moyenne qui le ferait sortir du cadre sur les lettres larges.
   */
  const curseur = () =>
    champ.evaluate((el) => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
      return (r.left - p.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) + ctx.measureText(el.value).width - el.scrollLeft) * 1.8;
    });
  inventaire.curseur = [];
  for (let i = 0; i <= metier.length; i++) {
    if (i > 0) await champ.type(metier[i - 1]);
    const f = `frappe-${String(i).padStart(2, "0")}.png`;
    await bloc.screenshot({ path: join(sortie, f) });
    inventaire.frappe.push(f);
    inventaire.curseur.push(Math.round(await curseur()));
  }
  inventaire.champDefile = await champ.evaluate((el) => el.scrollLeft > 0);
  await ctx.close();
}

// ── 2 · Le cycle, par le vrai pilote ─────────────────────────────────────
const envois = [];
{
  const ctx = await contexte();
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.clock.install({ time: new Date(D.maintenant) });
  const json = (r, o, status = 200) =>
    r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-access-token" }, body: JSON.stringify(o) });
  const E = D.entreprises;
  await page.route("https://recherche-entreprises.api.gouv.fr/**", (r) =>
    json(r, {
      results: E.map((e, i) => ({
        siren: e.siren, nom_complet: e.nom, nom_raison_sociale: e.nom, activite_principale: D.cible.naf, etat_administratif: "A", statut_diffusion: "O", tranche_effectif_salarie: "03",
        siege: { siret: e.siren + "00011", adresse: `${i + 1} RUE DE LA DEMO 69006 LYON`, code_postal: "69006", departement: "69", libelle_commune: "LYON", activite_principale: D.cible.naf, etat_administratif: "A", statut_diffusion_etablissement: "O" },
        matching_etablissements: [{ siret: e.siren + "00011", adresse: `${i + 1} RUE DE LA DEMO 69006 LYON`, code_postal: "69006", libelle_commune: "LYON", activite_principale: D.cible.naf, etat_administratif: "A", statut_diffusion_etablissement: "O" }],
        dirigeants: [{ type_dirigeant: "personne physique", nom: "DEMO", prenoms: e.prenom, qualite: "Gérant" }],
        complements: { est_entrepreneur_individuel: false },
      })),
      total_results: E.length, page: 1, per_page: 25, total_pages: 1,
    }),
  );
  await page.route("https://bodacc-datadila.opendatasoft.com/**", (r) => json(r, { results: [] }));
  let lot = [];
  await page.route("https://api.dropcontact.com/**", (r) => {
    const q = r.request();
    if (q.method() === "OPTIONS") return json(r, {});
    if (q.method() === "POST") {
      lot = JSON.parse(q.postData()).data;
      return json(r, { error: false, success: true, request_id: "req-film", credits_left: 47 });
    }
    return json(r, {
      error: false, success: true, credits_left: 44,
      data: lot.map((d) => {
        const e = E.find((x) => x.siren === d.num_siren);
        return { siren: e.siren, email: [{ email: e.email, qualification: e.qualification }], full_name: e.qualification.startsWith("nominative") ? `${e.prenom} Démo` : "", phone: D.telephone };
      }),
    });
  });
  await page.route("**/api/agenda", (r) => json(r, { etat: "lu", plages: D.agenda.occupe, evenements: D.agenda.occupe.length, approximes: 0, ignores: 0 }));
  await page.route("**/api/credentials", (r) => json(r, { cles: { email: { verifieLe: "2026-10-01T00:00:00Z" } } }));
  const ecrits = new Set();
  await page.route("**/api/send", (r) => {
    const x = JSON.parse(r.request().postData());
    const to = String(x.to).toLowerCase();
    if (!x.suite && ecrits.has(to)) return json(r, { error: "Déjà contacté", alreadyContacted: true }, 409);
    if (x.suite === "reponse" && !ecrits.has(to)) return json(r, { error: "pas une réponse", suiteRefusee: true }, 409);
    ecrits.add(to);
    envois.push(x);
    return json(r, { ok: true });
  });
  await page.route("**/api/reponses", (r) => {
    const partis = (i, apres) =>
      envois.some((x) => x.to.toLowerCase() === E[i].email && (apres === "creneaux" ? /Répondez simplement/.test(x.body) : !x.suite));
    const messages = D.reponses
      .filter((m) => partis(m.de, m.apres))
      .map((m, k) => ({ de: E[m.de].email, date: m.date, sujet: `Re: ${E[m.de].nom} — une question`, messageId: `<film-${k}@example.com>`, inReplyTo: null, autoReponse: false, texte: m.texte }));
    return json(r, { etat: "lu", messages: messages.reverse() });
  });

  await page.goto(BASE + "/autopilote", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.fill("#metier-ap", D.cible.saisie);
  await page.getByRole("button", { name: new RegExp(D.cible.activite) }).click();
  await page.fill("#zone-ap", D.cible.zone);
  await page.fill('input[placeholder="Colle ta clé API Dropcontact"]', "cle-de-film");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await sansFixes(page);
  const section = (titre) => page.locator("section", { has: page.getByRole("heading", { name: titre, exact: true }) }).first();
  await section("Qui il cherche").screenshot({ path: join(sortie, "cible.png") });
  inventaire.reperes.cible = await reperes(section("Qui il cherche"), { metier: "Le métier de tes clients", taille: "Taille" }, 2.5);

  await page.getByRole("button", { name: /Lancer ALPHA/ }).click();
  const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
  await attendre(2500);
  await sansFixes(page);
  await page.locator("section", { hasText: "ALPHA travaille." }).first().screenshot({ path: join(sortie, "travaille.png") });
  for (let i = 0; i < 14; i++) {
    await page.clock.runFor(3 * 60_000 + 1000);
    await attendre(2500);
    const fini = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("alpha-sales-os-v2") || "{}").state || {};
      const j = s.settings?.autopilote?.etat?.journal || [];
      return (s.meetings || []).length > 0 && j.some((e) => e.type === "escalade") && j.filter((e) => e.type === "ecrit").length >= 3;
    });
    if (fini) break;
  }
  await sansFixes(page);
  await page.evaluate(() => document.fonts.ready);

  // Chaque ligne du journal que le film montre, photographiée là où l'app l'a écrite.
  const LIGNES = {
    cherche: /Registre, page 1/,
    coordonnees: /Coordonnées trouvées pour/,
    ecrit: new RegExp(`Premier message envoyé à ${D.entreprises[0].nom.replace(/[()]/g, "\\$&")}`),
    repond: /est intéressé/,
    rdv: /Rendez-vous avec/,
    escalade: /demande le tarif/,
  };
  const journal = section("Journal");
  for (const [id, motif] of Object.entries(LIGNES)) {
    const li = journal.locator("li", { hasText: motif }).first();
    await li.scrollIntoViewIfNeeded();
    await li.screenshot({ path: join(sortie, `j-${id}.png`) });
    inventaire.journal[id] = (await li.innerText()).replace(/\s+/g, " ").trim();
  }
  const etat = section("Où il en est");
  await etat.locator("div.grid").first().screenshot({ path: join(sortie, "compteurs.png") });
  await etat.locator("div.panel", { hasText: "À toi (" }).first().screenshot({ path: join(sortie, "a-toi.png") });
  await etat.locator("a", { hasText: "Mon agenda" }).first().screenshot({ path: join(sortie, "rdv.png") });
  inventaire.aToi = (await etat.locator("div.panel", { hasText: "À toi (" }).first().innerText()).replace(/\s+/g, " ").trim();
  inventaire.rdv = (await etat.locator("a", { hasText: "Mon agenda" }).first().innerText()).replace(/\s+/g, " ").trim();
  inventaire.erreurs = erreurs;
  await ctx.close();
}

// ── 3 · Ce qui arrive dans SA boîte : le rendu du serveur, sur le corps envoyé ──
{
  // 480 px : la largeur d'une boîte de réception sur une tablette ou un grand
  // téléphone. À 600, le texte rendu dans le film tombait à 24 px — trop petit
  // pour un fil d'actualité lu sur téléphone.
  const ctx = await contexte({ largeur: 480, hauteur: 900, echelle: 2.25 });
  const page = await ctx.newPage();
  /**
   * Le rendu se pose sur une page VIERGE : posé sur une page de l'app, il hérite
   * de sa politique de sécurité, qui refuse le logo (adresse absolue en http) —
   * vu à la première passe, une image cassée qu'aucune boîte de réception
   * n'afficherait (en production, le logo est servi en https).
   */
  const boite = await ctx.newPage();
  const premier = envois.find((x) => !x.suite && x.to === D.entreprises[0].email);
  const creneaux = envois.find((x) => x.suite === "reponse" && /Répondez simplement/.test(x.body));
  const confirmation = envois.find((x) => x.suite === "reponse" && (x.attachments ?? []).length > 0);
  for (const [id, x] of Object.entries({ premier, creneaux, confirmation })) {
    if (!x) throw new Error(`le pilote n'a pas envoyé « ${id} » : la chaîne a cassé avant le tournage`);
    await page.goto(BASE + "/api/health");
    const html = await page.evaluate(async (d) => {
      const r = await fetch("/api/email/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) throw new Error(`/api/email/preview rend ${r.status}`);
      return (await r.json()).html;
    }, { subject: x.subject, body: x.body, accountId: x.accountId, closerName: x.closerName, agencyName: x.agencyName });
    await boite.setContent(html, { waitUntil: "load" });
    const carte = boite.locator("table.card").first();
    await carte.screenshot({ path: join(sortie, `mail-${id}.png`) });
    const MOTIFS = {
      premier: { question: "Est-ce qu", aveu: "assistant IA", signature: "— " },
      creneaux: { sujet: "Re:", bonjour: "Bonjour", jeudi: "jeudi", lundi: "lundi", choix: "Répondez simplement", aveu: "assistant IA" },
      confirmation: { sujet: "Re:", note: "C'est noté", aveu: "assistant IA" },
    };
    inventaire.reperes[`mail-${id}`] = await reperes(carte, MOTIFS[id], 2.25);
    inventaire.emails[id] = { to: x.to, suite: x.suite ?? null, subject: x.subject, body: x.body, pieces: (x.attachments ?? []).map((a) => a.filename), copieExpediteur: x.copieExpediteur ?? false };
  }
  await ctx.close();
}

writeFileSync(join(sortie, "inventaire.json"), JSON.stringify(inventaire, null, 2));
await nav.close();
if (inventaire.erreurs.length) throw new Error(`erreurs JavaScript pendant le tournage :\n${inventaire.erreurs.join("\n")}`);
console.log("Captures :", sortie);
