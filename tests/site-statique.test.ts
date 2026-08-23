import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SITE PUBLIC (`site/`) — la seule surface que voit un inconnu.
 *
 * `site/` se dépose tel quel sur Netlify : aucun build, aucun garde-fou de
 * compilation, aucun type. Tout ce qui est faux y reste faux jusqu'à ce qu'un
 * prospect le lise. Les tests de la vitrine (l'app Next.js) ne couvraient pas
 * ce dossier — c'est exactement là que sont passés un lien de paiement mort et
 * un chiffre de performance inventé, sur un site sans un seul client signé.
 *
 * Ces tests ne jugent pas le design. Ils refusent quatre choses :
 * ce qui MENT, ce qui NE MÈNE NULLE PART, ce qui MANQUE légalement, et le
 * Markdown brut sorti du générateur de pages juridiques.
 * ─────────────────────────────────────────────────────────────────────
 */

const SITE = join(process.cwd(), "site");
const lire = (f: string) => readFileSync(join(SITE, f), "utf8");

/**
 * Les COMMENTAIRES HTML sont retirés avant analyse.
 *
 * Sans ça, le commentaire qui explique « les liens Stripe pointaient vers un
 * gabarit » déclenche le test qui interdit les gabarits Stripe — et la
 * correction naturelle serait d'effacer l'explication pour faire taire le
 * test, c'est-à-dire l'inverse du but. C'est arrivé plusieurs fois dans ce
 * dépôt ; la parade est systématique.
 */
const sansCommentaires = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

/** Toutes les pages HTML du dossier, pour que rien n'échappe au balayage. */
const PAGES = readdirSync(SITE).filter((f) => f.endsWith(".html"));

const LEGALES = ["mentions-legales.html", "cgv.html", "cgu.html", "confidentialite.html", "dpa.html"];

// ── CE QUI NE MÈNE NULLE PART ──────────────────────────────────────────

test("site — aucun lien de paiement de gabarit", () => {
  /**
   * Un bouton « S'abonner » vers `buy.stripe.com/REMPLACE_SOLO` envoie le
   * visiteur sur une page introuvable au moment exact où il voulait payer.
   * C'est le pire endroit possible pour un lien mort.
   */
  for (const f of PAGES) {
    const src = sansCommentaires(lire(f));
    assert.doesNotMatch(src, /buy\.stripe\.com\/[A-Z_]{4,}/, `${f} garde un lien Stripe de gabarit`);
    assert.doesNotMatch(src, /href="(#|\s*)"/, `${f} contient un lien vide`);
  }
});

test("site — la mention « paiement Stripe » exige un vrai lien Stripe", () => {
  /**
   * Annoncer « paiement sécurisé par Stripe » sous trois boutons qui ouvrent
   * un client mail est une promesse que la page ne tient pas. Les deux vont
   * ensemble ou ne vont pas.
   */
  for (const f of PAGES) {
    const src = sansCommentaires(lire(f));
    if (/paiement s[ée]curis[ée]|pay[ée] par Stripe|Paiement par Stripe/i.test(src)) {
      assert.match(src, /https:\/\/buy\.stripe\.com\/\w+/, `${f} annonce un paiement sans lien de paiement`);
    }
  }
});

// ── CE QUI MENT ────────────────────────────────────────────────────────

test("site — aucune performance chiffrée sans client pour l'appuyer", () => {
  /**
   * « ~80 % de ta vente qui tourne sans toi » ne venait d'aucune mesure. Un
   * prospect qui demande d'où sort le chiffre ne reçoit pas de réponse — et
   * le doute contamine tout le reste de la page, y compris ce qui est vrai.
   *
   * Ce qui reste autorisé : les faits qui décrivent le PRODUIT (« une seule
   * alerte par jour », « 40 s pour débriefer »), et les PRIX.
   */
  const texte = sansCommentaires(lire("index.html"))
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

  const interdits = [
    /[~≈]\s*\d{1,3}\s*%/,                       // « ~80 % » et ses variantes
    /\d{1,3}\s*%\s*(de|d')\s*(ta|votre|leur)/i, // « 80 % de ta vente »
    /\bx\s?\d\b.{0,20}(deals?|CA|ventes?)/i,    // « x3 de deals »
  ];
  for (const re of interdits) {
    assert.doesNotMatch(texte, re, `affirmation de performance non mesurée : ${re}`);
  }
});

test("site — aucun superlatif invérifiable", () => {
  // Zéro vente à ce jour. « Le meilleur » est une conviction, pas une preuve,
  // et l'app refuse déjà ce registre : la page publique ne peut pas être plus
  // permissive que le produit.
  for (const f of PAGES) {
    const texte = sansCommentaires(lire(f)).replace(/<[^>]+>/g, " ");
    for (const mot of [/\bn°\s?1\b/i, /\bleader\b/i, /les? meilleurs? du march[ée]/i, /\bnuméro un\b/i]) {
      assert.doesNotMatch(texte, mot, `${f} : superlatif invérifiable ${mot}`);
    }
  }
});

test("site — aucun texte de gabarit oublié", () => {
  for (const f of PAGES) {
    const texte = sansCommentaires(lire(f));
    for (const p of ["Lorem ipsum", "TODO", "[XX]", "REMPLACE", "À COMPLÉTER"]) {
      assert.ok(!texte.includes(p), `${f} contient « ${p} »`);
    }
    // Les crochets numérotés des modèles juridiques : « [12] mois de garantie ».
    assert.doesNotMatch(texte, /\[\d+\]/, `${f} garde un crochet de gabarit juridique`);
  }
});

// ── CE QUI MANQUE LÉGALEMENT ───────────────────────────────────────────

test("site — les pages légales existent et sont liées depuis l'accueil", () => {
  /**
   * Un site qui affiche des prix et propose de payer sans mentions légales ni
   * CGV n'est pas « perfectible » : il est hors la loi en France. Les textes
   * existaient déjà dans `legal/`, il n'y avait qu'à les publier.
   */
  const accueil = lire("index.html");
  for (const p of LEGALES) {
    assert.ok(PAGES.includes(p), `page légale manquante : ${p}`);
    assert.match(accueil, new RegExp(`href="/?${p.replace(".", "\\.")}"`), `l'accueil ne lie pas ${p}`);
  }
});

test("site — les pages légales sortent du générateur, pas du Markdown brut", () => {
  /**
   * `scripts/build-legal.mjs` convertit `legal/*.md`. Un gras ouvert sur une
   * ligne et fermé sur la suivante restait affiché `**comme ça**`, au milieu
   * d'une clause de responsabilité. Le symptôme est invisible en revue de
   * diff, visible par le premier lecteur.
   */
  for (const p of LEGALES) {
    const src = lire(p);
    const texte = src.replace(/<[^>]+>/g, "\n");
    assert.doesNotMatch(texte, /\*\*/, `${p} : gras Markdown non converti`);
    assert.doesNotMatch(texte, /^#{1,4}\s/m, `${p} : titre Markdown non converti`);
    assert.doesNotMatch(texte, /\|\s*-{3,}/, `${p} : tableau Markdown non converti`);
    assert.ok(texte.replace(/\s+/g, " ").trim().length > 800, `${p} est quasi vide`);
    assert.match(src, /<html lang="fr">/, `${p} n'est pas déclarée en français`);
  }
});

// ── L'HYGIÈNE DE BASE ──────────────────────────────────────────────────

test("site — une page, un h1, en français, avec un titre lisible en recherche", () => {
  for (const f of PAGES) {
    const src = lire(f);
    assert.match(src, /<html lang="fr">/, `${f} : lang manquant ou faux`);
    const h1 = src.match(/<h1[\s>]/g) ?? [];
    assert.equal(h1.length, 1, `${f} : ${h1.length} <h1>`);
    const titre = src.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    assert.ok(titre.length >= 15 && titre.length <= 65, `${f} : <title> de ${titre.length} caractères`);
  }
});

test("site — toute image porte un alt et un fichier qui existe", () => {
  /**
   * Une balise `<img>` dont le fichier a été supprimé ne casse rien au build —
   * il n'y a pas de build. Elle laisse un carré vide sur la page de vente.
   */
  for (const f of PAGES) {
    const src = sansCommentaires(lire(f));
    for (const balise of src.match(/<img\b[^>]*>/g) ?? []) {
      assert.match(balise, /\balt="[^"]+"/, `${f} : image sans alt — ${balise.slice(0, 80)}`);
      const chemin = balise.match(/\bsrc="([^"]+)"/)?.[1];
      if (chemin && chemin.startsWith("/")) {
        assert.doesNotThrow(() => statSync(join(SITE, chemin.slice(1))), `${f} : fichier absent — ${chemin}`);
      }
    }
    // Les sources d'un <picture> aussi : c'est celle qui est réellement servie.
    for (const s of src.match(/<source\b[^>]*>/g) ?? []) {
      const chemin = s.match(/\bsrcset="([^"\s]+)/)?.[1];
      if (chemin && chemin.startsWith("/")) {
        assert.doesNotThrow(() => statSync(join(SITE, chemin.slice(1))), `${f} : source absente — ${chemin}`);
      }
    }
  }
});

test("site — aucun secret, aucune clé, aucun jeton dans une page publique", () => {
  /**
   * Le dossier est servi tel quel : ce qui y est écrit est téléchargeable par
   * n'importe qui. Une clé collée « juste pour tester » y resterait publique.
   */
  for (const f of readdirSync(SITE).filter((x) => /\.(html|js|json|txt|xml|toml)$/.test(x))) {
    const src = lire(f);
    for (const re of [/nvapi-[\w-]{20,}/, /sk-[\w-]{20,}/, /eyJhbGciOi[\w-]{20,}/, /AKIA[0-9A-Z]{16}/]) {
      assert.doesNotMatch(src, re, `${f} : secret exposé (${re})`);
    }
  }
});

test("site — le poids reste compatible avec une visite en 4G", () => {
  /**
   * Quatre PNG de maquette pesaient 5 Mo et n'étaient référencés nulle part.
   * Un prospect sur le terrain n'attend pas ; et sur Netlify, ce qui n'est pas
   * référencé est quand même déployé.
   */
  let total = 0;
  const visiter = (rel: string) => {
    for (const e of readdirSync(join(SITE, rel), { withFileTypes: true })) {
      if (e.isDirectory()) visiter(join(rel, e.name));
      else total += statSync(join(SITE, rel, e.name)).size;
    }
  };
  visiter(".");
  assert.ok(total < 1_500_000, `le site pèse ${Math.round(total / 1024)} Ko`);
});

test("site — robots.txt et sitemap.xml pointent le bon domaine", () => {
  const robots = lire("robots.txt");
  assert.match(robots, /Sitemap:\s*https:\/\/eagleyecorp\.fr\/sitemap\.xml/);
  const sitemap = lire("sitemap.xml");
  for (const p of ["", ...LEGALES]) {
    assert.ok(sitemap.includes(`https://eagleyecorp.fr/${p}`), `sitemap : ${p || "/"} absent`);
  }
  // Une page listée mais absente du dossier est une 404 promise à Google.
  for (const url of sitemap.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
    const f = url.replace(/<\/?loc>/g, "").replace("https://eagleyecorp.fr/", "");
    if (f) assert.ok(PAGES.includes(f), `sitemap : ${f} n'existe pas dans site/`);
  }
});
