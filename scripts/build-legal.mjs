#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * GÉNÈRE LES PAGES LÉGALES du site statique depuis `legal/*.md`.
 *
 * ── POURQUOI CE SCRIPT ──
 *
 * Le site VEND (boutons Stripe) et n'avait ni mentions légales, ni CGV, ni
 * politique de confidentialité. En France, sur un site marchand, ce n'est pas
 * une bonne pratique : c'est une obligation.
 *
 * Les textes existaient déjà dans `legal/`, en Markdown. Il n'y avait qu'à
 * les publier — d'où un convertisseur, pas une réécriture. Le juridique se
 * relit et se modifie dans `legal/`, source unique ; le HTML se régénère.
 *
 * ── POURQUOI ÉCRIT À LA MAIN ──
 *
 * La maison n'ajoute pas de dépendance. Le sous-ensemble de Markdown utilisé
 * par ces sept fichiers est petit — titres, listes, gras, liens, tableaux,
 * citations — et un convertisseur de 120 lignes le couvre entièrement. Un
 * paquet de 400 Ko pour ça serait un mauvais échange.
 *
 * ⚠ Ce convertisseur n'est PAS générique : il traite ce que nos fichiers
 * contiennent, et rien d'autre. Il échappe le HTML en entrée, donc un fichier
 * malveillant ne peut pas injecter de balise — mais ces fichiers sont écrits
 * par nous, la vraie garantie est là.
 *
 * Usage : node scripts/build-legal.mjs
 * ─────────────────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les pages à publier : fichier source → nom de sortie + titre affiché. */
const PAGES = [
  { src: "MENTIONS-LEGALES.md", out: "mentions-legales.html", titre: "Mentions légales" },
  { src: "CGV.md", out: "cgv.html", titre: "Conditions générales de vente" },
  { src: "CGU.md", out: "cgu.html", titre: "Conditions générales d'utilisation" },
  { src: "POLITIQUE-CONFIDENTIALITE.md", out: "confidentialite.html", titre: "Politique de confidentialité" },
  { src: "DPA.md", out: "dpa.html", titre: "Traitement des données (DPA)" },
];

/** Échappement HTML — appliqué AVANT toute mise en forme. */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Mise en forme en ligne : gras, italique, code, liens. */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Markdown → HTML, sur le sous-ensemble réellement utilisé.
 *
 * Volontairement linéaire et lisible plutôt que court : c'est du juridique,
 * une balise mal fermée rend un paragraphe invisible et personne ne le voit.
 */
function markdown(md) {
  const out = [];
  let dansListe = null; // "ul" | "ol" | null
  let dansTableau = false;
  let enteteFaite = false;
  /**
   * Lignes de prose en attente.
   *
   * ⚠ Le convertisseur traitait chaque ligne comme un paragraphe. En Markdown,
   * des lignes consécutives forment UN paragraphe — et surtout, un `**gras**`
   * ouvert en fin de ligne et fermé sur la suivante n'était jamais converti :
   * les deux astérisques restaient à l'écran, au milieu d'une clause de
   * responsabilité. On accumule donc avant de mettre en forme.
   */
  let para = [];
  const viderPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  /**
   * Même mécanique pour les PUCES : une liste peut porter une puce dont le
   * texte continue sur la ligne suivante, indentée. Le `**gras**` ouvert sur
   * la première et fermé sur la seconde restait brut, exactement comme dans
   * les paragraphes — et ça s'est produit dans le DPA, sur la clause « ne
   * traite les données que sur instruction documentée ».
   */
  let li = [];
  const viderLi = () => {
    if (li.length) {
      out.push(`<li>${inline(li.join(" "))}</li>`);
      li = [];
    }
  };

  const fermerListe = () => {
    viderLi();
    if (dansListe) {
      out.push(`</${dansListe}>`);
      dansListe = null;
    }
  };
  const fermerTableau = () => {
    if (dansTableau) {
      out.push("</tbody></table>");
      dansTableau = false;
      enteteFaite = false;
    }
  };

  for (const ligne of md.split("\n")) {
    const l = ligne.trimEnd();

    if (!l.trim()) {
      viderPara();
      fermerListe();
      fermerTableau();
      continue;
    }

    // Séparateur — mais PAS la ligne de séparation d'un tableau.
    if (/^---+$/.test(l.trim())) {
      viderPara();
      fermerListe();
      fermerTableau();
      out.push("<hr/>");
      continue;
    }

    const titre = l.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      viderPara();
      fermerListe();
      fermerTableau();
      const n = titre[1].length;
      out.push(`<h${n}>${inline(titre[2])}</h${n}>`);
      continue;
    }

    if (l.startsWith("> ")) {
      viderPara();
      fermerListe();
      fermerTableau();
      out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
      continue;
    }

    // Tableau : ligne encadrée de « | ». La 2e ligne (---|---) est ignorée.
    if (/^\s*\|.*\|\s*$/.test(l)) {
      viderPara();
      fermerListe();
      const cellules = l.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (/^[-: ]+$/.test(cellules.join(""))) continue; // ligne de séparation
      if (!dansTableau) {
        out.push("<table>");
        dansTableau = true;
        enteteFaite = false;
      }
      if (!enteteFaite) {
        out.push("<thead><tr>" + cellules.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
        enteteFaite = true;
      } else {
        out.push("<tr>" + cellules.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      }
      continue;
    }
    fermerTableau();

    const puce = l.match(/^\s*[-*]\s+(.*)$/);
    if (puce) {
      viderPara();
      if (dansListe !== "ul") {
        fermerListe();
        out.push("<ul>");
        dansListe = "ul";
      }
      viderLi();
      li.push(puce[1].trim());
      continue;
    }

    const num = l.match(/^\s*\d+\.\s+(.*)$/);
    if (num) {
      viderPara();
      if (dansListe !== "ol") {
        fermerListe();
        out.push("<ol>");
        dansListe = "ol";
      }
      viderLi();
      li.push(num[1].trim());
      continue;
    }

    // Une ligne indentée DANS une liste continue la puce en cours ; sinon,
    // c'est de la prose et on ferme la liste.
    if (dansListe && li.length && /^\s{1,}/.test(ligne)) {
      li.push(l.trim());
      continue;
    }
    fermerListe();
    para.push(l.trim());
  }
  viderPara();
  fermerListe();
  fermerTableau();
  return out.join("\n");
}

/**
 * Le gabarit de page.
 *
 * Styles en ligne plutôt qu'une feuille partagée : ces pages sont lues une
 * fois, rarement, et souvent imprimées. Une page juridique qui dépend d'un
 * CSS externe s'imprime mal le jour où quelqu'un en a besoin.
 */
const page = (titre, corps, fichier) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${titre} — EAGLEYE CORP.</title>
<meta name="description" content="${titre} — EAGLEYE CORP., Lyon. ALPHA SALES OS®." />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://eagleyecorp.fr/${fichier}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 24px 96px;
    font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1A1A18; background: #F4F2ED;
  }
  @media (prefers-color-scheme: dark) { body { color: #EDEAE3; background: #0E0E0D; } }
  main { max-width: 74ch; margin: 0 auto; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 20px; margin: 40px 0 8px; letter-spacing: -0.01em; }
  h3 { font-size: 16px; margin: 28px 0 6px; }
  h4 { font-size: 15px; margin: 20px 0 4px; }
  p, li { margin: 8px 0; }
  ul, ol { padding-left: 22px; }
  hr { border: 0; border-top: 1px solid currentColor; opacity: .15; margin: 32px 0; }
  blockquote { margin: 16px 0; padding-left: 14px; border-left: 2px solid currentColor; opacity: .8; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; display: block; overflow-x: auto; }
  th, td { border: 1px solid currentColor; border-color: color-mix(in srgb, currentColor 18%, transparent); padding: 7px 10px; text-align: left; }
  th { font-weight: 600; }
  .retour { display: inline-block; margin-bottom: 28px; font-size: 13px; opacity: .7; }
  .pied { margin-top: 56px; padding-top: 20px; border-top: 1px solid currentColor; border-color: color-mix(in srgb, currentColor 15%, transparent); font-size: 12.5px; opacity: .75; }
  .pied a { margin-right: 14px; display: inline-block; }
  @media print { body { background: #fff; color: #000; padding: 0; } .retour, .pied a { display: none; } }
</style>
</head>
<body>
<main>
  <a class="retour" href="/">← EAGLEYE CORP.</a>
${corps}
  <div class="pied">
    <a href="/mentions-legales.html">Mentions légales</a>
    <a href="/cgv.html">CGV</a>
    <a href="/cgu.html">CGU</a>
    <a href="/confidentialite.html">Confidentialité</a>
    <a href="/dpa.html">DPA</a>
    <p>EAGLEYE CORP. — 8 Cours Lafayette, 69003 Lyon · SIREN 831&nbsp;729&nbsp;934 · contact@eagleyecorp.fr</p>
  </div>
</main>
</body>
</html>
`;

mkdirSync(join(RACINE, "site"), { recursive: true });

for (const { src, out, titre } of PAGES) {
  const md = readFileSync(join(RACINE, "legal", src), "utf8");
  writeFileSync(join(RACINE, "site", out), page(titre, markdown(md), out), "utf8");
  console.log(`✓ site/${out}  ←  legal/${src}`);
}
console.log(`\n${PAGES.length} pages générées. Le juridique se modifie dans legal/, jamais dans site/.`);
