import type { Prospect } from "./types";

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

// DA « or » — alignée sur le light mode d'ALPHA SALES OS.
const GOLD = "#e8c98a";
const GOLD_SOFT = "#ddb36a";
const GOLD_DEEP = "#8a6a38";
const GOLDINK = "#1b1408";
const INK = "#221c14";
const PARCHMENT = "#ede7da";
const CREAM = "#fbf7f0";
const BORDER = "#e0d8c9";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const eur = (n: number) => n.toLocaleString("fr-FR") + " €";

function li(items: string[]): string {
  return items.map((t) => `<li>${esc(t)}</li>`).join("");
}

function row(label: string, value?: string): string {
  if (!value?.trim()) return "";
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

export function renderAuditDoc(p: Prospect, closerName = "EAGLEYE"): string {
  const d = p.deepAudit;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const taxMonthly = p.ignoranceTax > 0 ? p.ignoranceTax : null;
  const taxYearly = taxMonthly ? taxMonthly * 12 : null;
  const taxDetail =
    d.missedCallsPerWeek !== undefined && d.avgTicket !== undefined
      ? `${d.missedCallsPerWeek} demande(s) manquée(s)/semaine × ${eur(d.avgTicket)} de valeur moyenne${d.conversionRate ? ` × ${d.conversionRate} % de conversion` : ""}`
      : null;
  const problems = p.problems.length ? p.problems : [];

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Audit de présence — ${esc(p.company)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: ${PARCHMENT}; color: #33291b; line-height: 1.6; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 28px 60px; }
  header.doc { background: ${GOLD}; background: linear-gradient(100deg, ${GOLD} 0%, ${GOLD_SOFT} 100%); color: ${GOLDINK}; padding: 26px 28px; border-radius: 14px 14px 0 0; }
  header.doc .brand { letter-spacing: .18em; font-weight: 700; font-size: 18px; }
  header.doc .sub { font-family: Arial, sans-serif; font-size: 10.5px; letter-spacing: .3em; text-transform: uppercase; color: #6b5426; margin-top: 2px; }
  .sheet { background: ${CREAM}; border: 1px solid ${BORDER}; border-top: none; border-radius: 0 0 14px 14px; padding: 34px 36px 40px; }
  h1 { font-size: 26px; color: ${INK}; line-height: 1.25; }
  .meta { font-family: Arial, sans-serif; font-size: 12px; color: #8c8069; margin-top: 6px; }
  h2 { font-size: 15px; color: ${INK}; margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${GOLD}; text-transform: uppercase; letter-spacing: .08em; font-family: Arial, sans-serif; }
  p, li, td { font-size: 14.5px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; }
  li::marker { color: ${GOLD_DEEP}; }
  table.facts { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.facts td { padding: 7px 10px; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
  table.facts td.lbl { width: 200px; font-family: Arial, sans-serif; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: #8c8069; }
  .tax { background: #fdf6ec; border: 1px solid ${GOLD_SOFT}; border-radius: 12px; padding: 18px 22px; margin-top: 10px; }
  .tax .big { font-size: 34px; font-weight: 700; color: #b23a2f; }
  .tax .per { font-family: Arial, sans-serif; font-size: 12px; color: #8c8069; }
  .cta { background: ${GOLD}; background: linear-gradient(100deg, ${GOLD} 0%, ${GOLD_SOFT} 100%); color: ${GOLDINK}; border-radius: 12px; padding: 20px 24px; margin-top: 34px; }
  .cta strong { color: ${GOLDINK}; }
  footer { font-family: Arial, sans-serif; font-size: 11px; color: #8c8069; text-align: center; margin-top: 26px; }
  .print { position: fixed; top: 14px; right: 14px; font-family: Arial, sans-serif; font-size: 12px; background: ${GOLD}; color: ${GOLDINK}; border: 1px solid ${GOLD_SOFT}; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: bold; }
  @media print { .print { display: none; } body { background: #fff; } .page { padding: 0; } }
</style>
</head>
<body>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
<div class="page">
  <header class="doc">
    <div class="brand">🦅 EAGLEYE</div>
    <div class="sub">Audit de présence — offert</div>
  </header>
  <div class="sheet">
    <h1>${esc(p.company)}</h1>
    <p class="meta">${esc(p.city)} · ${date} · préparé par ${esc(closerName)} — EAGLEYE CORP, Lyon</p>

    <h2>Votre position sur votre marché</h2>
    <table class="facts">
      ${row("Note Google", d.googleRating !== undefined ? `${d.googleRating}/5 (${d.googleReviews ?? "?"} avis)` : undefined)}
      ${row("Site web", d.websiteState)}
      ${row("Réseaux sociaux", d.socialState)}
      ${row("Concurrence locale", d.localCompetition)}
      ${row("Votre process actuel", d.currentProcess)}
    </table>
    ${!d.websiteState && d.googleRating === undefined ? `<p style="color:#9a8f80;font-style:italic;">(Sections complétées lors de l'audit terrain.)</p>` : ""}

    ${taxMonthly ? `
    <h2>Ce que l'inaction vous coûte</h2>
    <div class="tax">
      <span class="big">≈ ${eur(taxMonthly)}</span> <span class="per">/ mois — soit ${eur(taxYearly as number)} / an</span>
      ${taxDetail ? `<p style="margin-top:8px;font-family:Arial,sans-serif;font-size:12.5px;color:#6b6355;">Base de calcul : ${esc(taxDetail)}. Estimation prudente, à affiner ensemble avec vos vrais chiffres.</p>` : ""}
    </div>` : ""}

    ${problems.length ? `
    <h2>Ce que nous avons constaté</h2>
    <ul>${li(problems)}</ul>` : ""}

    ${p.solution.trim() ? `
    <h2>Ce que font les mieux placés — et ce que nous recommandons</h2>
    <p>${esc(p.solution)}</p>` : ""}

    <div class="cta">
      <p><strong>La suite, si vous le souhaitez :</strong> 20 minutes, nous venons vous montrer — sur un téléphone,
      en conditions réelles — à quoi ressemblerait ${esc(p.company)} avec ces points corrigés. Sans engagement,
      et vous gardez cet audit quoi qu'il arrive.</p>
    </div>

    <footer>
      EAGLEYE CORP — Lyon · Cet audit vous est offert. Données issues de sources publiques et de nos observations ;
      chiffres à valider ensemble.
    </footer>
  </div>
</div>
</body>
</html>`;
}
