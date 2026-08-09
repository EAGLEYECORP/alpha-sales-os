import type { Prospect } from "./types";
import { recovery, type RecoveryInput } from "./recovery";
import { EAGLE_SVG } from "@/components/eagle";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Audit cadeau — le lead magnet. Un document HTML autonome, brandé
 * EAGLEYE, généré depuis le deep-dive de la fiche : position marché,
 * présence en ligne, ce que l'inaction coûte (Taxe d'Ignorance),
 * constats, recommandations, prochaine étape.
 *
 * Destiné au PROSPECT : zéro jargon doctrine interne, zéro tracking,
 * que de la valeur. S'ouvre dans le navigateur, s'imprime en PDF
 * (bouton natif), se joint à l'email d'awareness.
 * ─────────────────────────────────────────────────────────────────────
 */

// DA « calme » — plateforme de marque : fond végétal pâle, encre douce,
// sauge + blush en accents, cartes blanc cassé, serif italique (Fraunces,
// repli Georgia). Même voix que les emails : on chuchote, jamais on ne crie.
const BG = "#f4f7ec";
const BG_DEEP = "#e7eeda";
const CARD = "#fffdf9";
const INK = "#1e1e19";
const INK_SOFT = "#55564c";
const BLUSH = "#e3c9bc";
const SAGE = "#8b9678";
const TERRA = "#b98872"; // terracotta doux — le chiffre qui pique, sans crier
const LINE = "rgba(30,30,25,0.12)";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Feuille de style commune — partagée par l'audit unique et le lot (bundle). */
const AUDIT_STYLE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: ${BG}; color: ${INK}; line-height: 1.65; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 28px 60px; }
  .sheet { background: ${CARD}; border: 1px solid ${LINE}; border-radius: 18px; padding: 38px 40px 44px; }
  header.doc { display: flex; align-items: center; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid ${LINE}; margin-bottom: 28px; }
  header.doc .mark { width: 52px; height: 42px; color: ${INK}; flex-shrink: 0; }
  header.doc .mark svg { width: 100%; height: 100%; }
  header.doc .brand { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 24px; line-height: 1.1; }
  header.doc .sub { font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: ${SAGE}; font-weight: 600; margin-top: 4px; }
  h1 { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 30px; color: ${INK}; line-height: 1.2; }
  .meta { font-size: 12.5px; color: ${INK_SOFT}; margin-top: 8px; }
  .rule { width: 38px; height: 2px; background: ${BLUSH}; margin-top: 14px; }
  h2 { font-family: 'Inter', Arial, sans-serif; font-weight: 600; font-size: 11.5px; color: ${SAGE}; margin: 34px 0 12px; padding-top: 18px; border-top: 1px solid ${LINE}; text-transform: uppercase; letter-spacing: .18em; }
  p, li, td { font-size: 14.5px; color: ${INK_SOFT}; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 5px 0; }
  li::marker { color: ${SAGE}; }
  table.facts { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.facts td { padding: 8px 10px; border-bottom: 1px solid ${LINE}; vertical-align: top; }
  table.facts td.lbl { width: 200px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: ${SAGE}; font-weight: 600; }
  .tax { background: #f7ece5; border: 1px solid ${BLUSH}; border-radius: 16px; padding: 20px 24px; margin-top: 10px; }
  .tax .big { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 34px; font-weight: 500; color: ${TERRA}; }
  .tax .per { font-size: 12px; color: ${INK_SOFT}; }
  .reco { border-left: 3px solid ${BLUSH}; padding: 4px 0 4px 18px; font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 16px; color: ${INK}; }
  .cta { background: ${SAGE}; color: ${CARD}; border-radius: 16px; padding: 22px 26px; margin-top: 36px; }
  .cta p, .cta strong { color: ${CARD}; }
  .cta strong { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 500; font-size: 16px; }
  footer { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: ${SAGE}; text-align: center; margin-top: 28px; }
  .print { position: fixed; top: 14px; right: 14px; font-family: 'Inter', Arial, sans-serif; font-size: 12px; background: ${INK}; color: ${CARD}; border: none; border-radius: 100px; padding: 9px 18px; cursor: pointer; font-weight: 500; }
  .soft-note { background: ${BG_DEEP}; border-radius: 12px; padding: 10px 16px; font-style: italic; color: ${INK_SOFT}; font-size: 13px; }
  @media print { .print { display: none; } body { background: #fff; } .page { padding: 0 0 24px; } .sheet { border: none; } .page.brk { page-break-after: always; } }`;

const AUDIT_HEAD = (title: string) => `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400;1,9..144,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>${AUDIT_STYLE}</style>`;

/**
 * Le corps de l'audit (la « feuille ») — sans <head> ni bouton d'impression.
 * Réutilisé tel quel par l'audit unique et par le lot multi-fiches.
 */
export function renderAuditSheet(p: Prospect, closerName = "EAGLEYE", bookingUrl?: string): string {
  const d = p.deepAudit;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const taxMonthly = p.ignoranceTax > 0 ? p.ignoranceTax : null;
  const taxYearly = taxMonthly ? taxMonthly * 12 : null;
  const taxDetail =
    d.missedCallsPerWeek !== undefined && d.avgTicket !== undefined
      ? `${d.missedCallsPerWeek} demande(s) manquée(s)/semaine × ${eur(d.avgTicket)} de valeur moyenne${d.conversionRate ? ` × ${d.conversionRate} % de conversion` : ""}`
      : null;
  const problems = p.problems.length ? p.problems : [];

  return `<div class="sheet">
      <header class="doc">
        <span class="mark">${EAGLE_SVG}</span>
        <div>
          <div class="brand">Eagleye</div>
          <div class="sub">Audit de présence — offert</div>
        </div>
      </header>
      <h1>${esc(p.company)}</h1>
      <p class="meta">${esc(p.city)} · ${date} · préparé par ${esc(closerName)} — EAGLEYE CORP, Lyon</p>
      <div class="rule"></div>

      <h2>Votre position sur votre marché</h2>
      <table class="facts">
        ${row("Note Google", d.googleRating !== undefined ? `${d.googleRating}/5 (${d.googleReviews ?? "?"} avis)` : undefined)}
        ${row("Site web", d.websiteState)}
        ${row("Réseaux sociaux", d.socialState)}
        ${row("Concurrence locale", d.localCompetition)}
        ${row("Votre process actuel", d.currentProcess)}
      </table>
      ${!d.websiteState && d.googleRating === undefined ? `<p class="soft-note" style="margin-top:10px;">(Sections complétées lors de l'audit terrain.)</p>` : ""}

      ${taxMonthly ? `
      <h2>Ce que l'inaction vous coûte</h2>
      <div class="tax">
        <span class="big">≈ ${eur(taxMonthly)}</span> <span class="per">/ mois — soit ${eur(taxYearly as number)} / an</span>
        ${taxDetail ? `<p style="margin-top:8px;font-size:12.5px;">Base de calcul : ${esc(taxDetail)}. Estimation prudente, à affiner ensemble avec vos vrais chiffres.</p>` : ""}
      </div>` : ""}

      ${problems.length ? `
      <h2>Ce que nous avons constaté</h2>
      <ul>${li(problems)}</ul>` : ""}

      ${p.solution.trim() ? `
      <h2>Ce que font les mieux placés — et ce que nous recommandons</h2>
      <p class="reco">${esc(p.solution)}</p>` : ""}

      <div class="cta">
        <p><strong>La suite, si vous le souhaitez :</strong> 20 minutes, nous venons vous montrer — sur un téléphone,
        en conditions réelles — à quoi ressemblerait ${esc(p.company)} avec ces points corrigés. Sans engagement,
        et vous gardez cet audit quoi qu'il arrive.</p>
        ${bookingUrl?.trim() ? `<p style="margin-top:14px;"><a href="${esc(bookingUrl.trim())}" style="display:inline-block;background:${CARD};color:${INK};text-decoration:none;border-radius:100px;padding:12px 24px;font-weight:600;font-size:14.5px;">Choisir un créneau →</a></p>` : ""}
      </div>

      <footer>
        Eagleye Corp — Lyon · Cet audit vous est offert · Données publiques, chiffres à valider ensemble<br />
        <span style="text-transform:none;letter-spacing:.02em;">Généré avec <em style="font-family:'Fraunces',Georgia,serif;font-size:12px;color:${INK};">Alpha Sales OS</em><span style="color:${INK};">®</span></span>
      </footer>
    </div>`;
}

const eur = (n: number) => n.toLocaleString("fr-FR") + " €";

function li(items: string[]): string {
  return items.map((t) => `<li>${esc(t)}</li>`).join("");
}

function row(label: string, value?: string): string {
  if (!value?.trim()) return "";
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

export function renderAuditDoc(p: Prospect, closerName = "EAGLEYE", bookingUrl?: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
${AUDIT_HEAD(`Audit de présence — ${p.company}`)}
</head>
<body>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
<div class="page">
  ${renderAuditSheet(p, closerName, bookingUrl)}
</div>
</body>
</html>`;
}

/**
 * « Projette-toi » IMPRIMABLE — le document à laisser au prospect.
 *
 * Personnalisé à CHAQUE prospect (ses chiffres) et aux valeurs ajustées en RDV
 * (les curseurs). Même DA calme qu'un audit cadeau : on montre ce qui se perd,
 * sobrement, puis ce qu'on récupère. C'est une ESTIMATION, dit noir sur blanc.
 */
export function renderRecoveryDoc(
  p: Prospect,
  input: RecoveryInput,
  closerName = "EAGLEYE",
  bookingUrl?: string
): string {
  const r = recovery(input);
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const sheet = `<div class="sheet">
      <header class="doc">
        <span class="mark">${EAGLE_SVG}</span>
        <div>
          <div class="brand">Eagleye</div>
          <div class="sub">Projection — ce que vous récupérez</div>
        </div>
      </header>
      <h1>${esc(p.company || "Votre entreprise")}</h1>
      <p class="meta">${esc(p.city)} · ${date} · préparé par ${esc(closerName)} — EAGLEYE CORP, Lyon</p>
      <div class="rule"></div>

      <h2>Sur vos chiffres</h2>
      <table class="facts">
        <tr><td class="lbl">Contacts manqués / semaine</td><td>${input.missedPerWeek}</td></tr>
        <tr><td class="lbl">Panier moyen d'une vente</td><td>${eur(input.avgTicket)}</td></tr>
        <tr><td class="lbl">Part qui aurait converti</td><td>${input.conversionPct} %</td></tr>
      </table>

      <h2>Ce que vous laissez sur la table</h2>
      <div class="tax">
        <span class="big">≈ ${eur(r.perMonth)}</span> <span class="per">/ mois — soit ${eur(r.perYear)} / an</span>
        <p style="margin-top:8px;font-size:12.5px;">Base : ${input.missedPerWeek} contact(s) manqué(s)/semaine × ${input.conversionPct} % de conversion × ${eur(input.avgTicket)} — ${r.salesPerMonth.toFixed(1)} vente(s)/mois perdue(s).</p>
      </div>

      <h2>Ce qu'on change</h2>
      <p class="reco">Un système qui rappelle chaque contact manqué et relance sans oubli, 24 h/24, 7 j/7 — c'est ce montant que vous visez à récupérer, sans embaucher.</p>
      <p class="soft-note" style="margin-top:14px;">Ce chiffre est une <strong>estimation</strong> basée sur vos données ci-dessus, <strong>pas une garantie</strong>. Ce qu'on garantit : le procédé — plus aucun contact perdu, la machine tourne 24/7. Le montant réel dépend de vos vrais chiffres, qu'on affine ensemble.</p>

      <div class="cta">
        <p><strong>La suite, si vous le souhaitez :</strong> 20 minutes, on vous montre en conditions réelles à quoi ressemble ${esc(p.company || "votre accueil")} avec ce manque comblé. Sans engagement — et vous gardez cette projection.</p>
        ${bookingUrl?.trim() ? `<p style="margin-top:14px;"><a href="${esc(bookingUrl.trim())}" style="display:inline-block;background:${CARD};color:${INK};text-decoration:none;border-radius:100px;padding:12px 24px;font-weight:600;font-size:14.5px;">Choisir un créneau →</a></p>` : ""}
      </div>

      <footer>
        Eagleye Corp — Lyon · Projection offerte · Estimation sur vos chiffres, à valider ensemble<br />
        <span style="text-transform:none;letter-spacing:.02em;">Généré avec <em style="font-family:'Fraunces',Georgia,serif;font-size:12px;color:${INK};">Alpha Sales OS</em><span style="color:${INK};">®</span></span>
      </footer>
    </div>`;
  return `<!doctype html>
<html lang="fr">
<head>
${AUDIT_HEAD(`Projection — ${p.company || "votre entreprise"}`)}
</head>
<body>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
<div class="page">
  ${sheet}
</div>
</body>
</html>`;
}

/**
 * Le LOT — un seul document imprimable qui enchaîne les audits de plusieurs
 * fiches, une par page (saut de page à l'impression). « Imprimer / PDF »
 * produit un PDF multi-pages : un audit par prospect, prêts à joindre.
 */
export function renderAuditBundle(prospects: Prospect[], closerName = "EAGLEYE", bookingUrl?: string): string {
  const sheets = prospects
    .map((p, i) => `<div class="page${i < prospects.length - 1 ? " brk" : ""}">
  ${renderAuditSheet(p, closerName, bookingUrl)}
</div>`)
    .join("\n");
  const title = prospects.length === 1
    ? `Audit de présence — ${prospects[0].company}`
    : `Audits de présence — ${prospects.length} fiches`;
  return `<!doctype html>
<html lang="fr">
<head>
${AUDIT_HEAD(title)}
</head>
<body>
<button class="print" onclick="window.print()">Imprimer / PDF (${prospects.length})</button>
${sheets}
</body>
</html>`;
}
