/**
 * ─────────────────────────────────────────────────────────────────────
 * Rendu d'emails HTML « beaux » — EAGLEYE CORP.
 *
 * Objectif : n'envoyer QUE des emails HTML soignés, responsive, lisibles
 * en clair sombre comme clair, robustes sur Outlook / Gmail / Apple Mail.
 * Table-based, styles inline, largeur 600, bouton « bulletproof » (VML
 * Outlook), pré-header caché, pied avec désinscription.
 *
 * `renderEmail` prend un corps en TEXTE (celui des templates de scripts) et
 * le met en forme. `plainText` fabrique l'alternative texte (indispensable
 * pour la délivrabilité : un email multipart html+texte spamme bien moins).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface EmailOptions {
  subject: string;
  /** Corps en texte brut (paragraphes séparés par des sauts de ligne). */
  body: string;
  /** Nom affiché en signature (closer). */
  closerName?: string;
  /** Bouton d'appel à l'action (optionnel). */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Texte d'aperçu (inbox preview). Défaut : début du corps. */
  preheader?: string;
  /** Ligne d'adresse légale en pied (obligatoire anti-spam). */
  addressLine?: string;
}

// ── DA « or » — alignée sur le light mode d'ALPHA SALES OS ────────────
// Parchemin crème, encre, or plein #E8C98A + encre-or #1B1408 (duo signature).
const GOLD = "#e8c98a"; // or plein (bandeau, bouton, filets décoratifs)
const GOLD_SOFT = "#ddb36a"; // dégradé du bandeau
const GOLD_DEEP = "#8a6a38"; // or foncé — emphase & liens (contraste sur crème)
const GOLDINK = "#1b1408"; // encre sombre posée sur l'or
const INK = "#221c14"; // texte principal (encre)
const INK_DIM = "#4a4133"; // texte secondaire
const FAINT = "#8c8069"; // texte atténué / pied
const PARCHMENT = "#ede7da"; // fond de page
const CREAM = "#fbf7f0"; // fond des cartes
const BORDER = "#e0d8c9"; // bordures / séparateurs

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Transforme le corps texte en paragraphes/listes HTML échappés. */
function bodyToHtml(body: string): string {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];
  for (const raw of blocks) {
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const isList = lines.every((l) => /^\s*(\d+[.)]|[-·•*])\s+/.test(l));
    if (isList) {
      const items = lines
        .map((l) => l.replace(/^\s*(\d+[.)]|[-·•*])\s+/, "").trim())
        .map(
          (t) =>
            `<tr><td style="padding:2px 0;vertical-align:top;color:${GOLD_DEEP};font-weight:700;width:18px;">›</td><td style="padding:2px 0;color:${INK_DIM};font-size:15px;line-height:1.6;">${esc(
              t
            )}</td></tr>`
        )
        .join("");
      out.push(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;"><tbody>${items}</tbody></table>`
      );
    } else {
      const html = lines.map(esc).join("<br />");
      out.push(
        `<p style="margin:0 0 16px;color:${INK_DIM};font-size:15px;line-height:1.65;">${html}</p>`
      );
    }
  }
  return out.join("\n");
}

/** Bouton « bulletproof » (rendu correct jusque dans Outlook via VML).
 *  DA or : pastille or pleine, texte encre-or — le duo signature. */
function button(label: string, url: string): string {
  const safeUrl = esc(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tbody><tr><td>
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="14%" strokecolor="${GOLD_SOFT}" fillcolor="${GOLD}"><w:anchorlock/><center style="color:${GOLDINK};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(
    label
  )}</center></v:roundrect><![endif]-->
  <!--[if !mso]><!-- --><a href="${safeUrl}" style="background:${GOLD};border:1px solid ${GOLD_SOFT};border-radius:8px;color:${GOLDINK};display:inline-block;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;line-height:46px;text-align:center;text-decoration:none;width:260px;-webkit-text-size-adjust:none;">${esc(
    label
  )}</a><!--<![endif]-->
  </td></tr></tbody></table>`;
}

export function renderEmail(opts: EmailOptions): string {
  const closer = opts.closerName || "EAGLEYE";
  const preheader = (opts.preheader || opts.body.replace(/\s+/g, " ").trim()).slice(0, 140);
  const cta = opts.ctaLabel && opts.ctaUrl ? button(opts.ctaLabel, opts.ctaUrl) : "";
  const address = opts.addressLine || "EAGLEYE CORP — Lyon, France";

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(opts.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  /* DA « or » = light mode ALPHA. On garde l'identité même en clients
     sombres : fonds explicites, l'or reste l'or (pas d'inversion agressive). */
  @media (prefers-color-scheme: dark) {
    .bg { background:#141007 !important; }
    .card { background:${CREAM} !important; border-color:${BORDER} !important; }
  }
  @media only screen and (max-width:600px) {
    .card { width:100% !important; border-radius:0 !important; }
    .pad { padding:24px !important; }
  }
  a { color:${GOLD_DEEP}; }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${PARCHMENT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background:${PARCHMENT};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${CREAM};border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
      <!-- Bandeau OR -->
      <tr><td style="background:${GOLD};background:linear-gradient(100deg,${GOLD} 0%,${GOLD_SOFT} 100%);padding:18px 32px;border-bottom:1px solid ${GOLD_SOFT};">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;letter-spacing:.14em;color:${GOLDINK};">🦅 EAGLEYE</span>
        <span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.28em;color:#6b5426;text-transform:uppercase;margin-left:8px;">Sales OS</span>
      </td></tr>
      <!-- Corps -->
      <tr><td class="pad" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:${INK_DIM};">
        <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:21px;line-height:1.3;color:${INK};font-weight:700;">${esc(
          opts.subject
        )}</h1>
        <div style="width:44px;height:3px;background:${GOLD};border-radius:2px;margin:0 0 18px;"></div>
        ${bodyToHtml(opts.body)}
        ${cta}
        <p style="margin:22px 0 0;color:${INK};font-size:15px;line-height:1.6;">— <span style="color:${GOLD_DEEP};font-weight:700;">${esc(
          closer
        )}</span></p>
      </td></tr>
      <!-- Pied -->
      <tr><td class="pad" style="padding:20px 32px;border-top:1px solid ${BORDER};">
        <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:${FAINT};">${esc(
          address
        )}</p>
        <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:${FAINT};">
          Vous recevez cet email car nous accompagnons les professionnels de votre secteur à Lyon.
          Vos coordonnées professionnelles proviennent de sources publiques (annuaires professionnels,
          site web de votre entreprise).
        </p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:${FAINT};">
          Vous ne souhaitez plus être contacté ? Répondez simplement <strong style="color:${GOLD_DEEP};">STOP</strong>.
          Conformément au RGPD, vous pouvez aussi demander l&#8217;accès, la rectification ou la suppression
          de vos données en répondant à cet email.
        </p>
      </td></tr>
    </table>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
      <tr><td style="padding:14px 8px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:${FAINT};">
        Envoyé par EAGLEYE CORP · Lyon
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Alternative texte brut (multipart) — cruciale pour la délivrabilité. */
export function plainText(opts: EmailOptions): string {
  const lines = [opts.subject, "", opts.body.trim()];
  if (opts.ctaLabel && opts.ctaUrl) lines.push("", `${opts.ctaLabel} : ${opts.ctaUrl}`);
  lines.push("", `— ${opts.closerName || "EAGLEYE"}`, "", opts.addressLine || "EAGLEYE CORP — Lyon, France");
  lines.push("Vos coordonnées professionnelles proviennent de sources publiques (annuaires professionnels, site web de votre entreprise).");
  lines.push("Vous ne souhaitez plus être contacté ? Répondez STOP. Conformément au RGPD, vous pouvez aussi demander l'accès, la rectification ou la suppression de vos données en répondant à cet email.");
  return lines.join("\n");
}
