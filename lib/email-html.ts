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
  /** URL publique du logo aigle (PNG hébergé — l'inline SVG est bloqué par
   *  Gmail). Repli : monogramme typographique si absent. */
  logoUrl?: string;
}

// ── DA « calme » — plateforme de marque : on chuchote, on ne crie jamais.
// Fond végétal doux, encre profonde, sauge + blush en accents, cartes
// blanc cassé, filets « cheveu ». Titres en serif italique (Fraunces →
// repli email : Georgia italique), corps en Inter → Helvetica/Arial.
const BG = "#f4f7ec"; // fond de page (vert d'eau très pâle)
const BG_DEEP = "#e7eeda"; // bandeaux doux (pied, blocs secondaires)
const CARD = "#fffdf9"; // fond des cartes (blanc cassé chaud)
const INK = "#1e1e19"; // encre — titres, emphase
const INK_SOFT = "#55564c"; // encre douce — corps de texte
const BLUSH = "#e3c9bc"; // accent blush — filets décoratifs
const SAGE = "#8b9678"; // sauge — eyebrows, puces, bouton
const SAGE_DEEP = "#5f6a4c"; // sauge profonde — liens (contraste sur crème)
const LINE = "#e4e3da"; // filet « cheveu » (rgba → aplati pour Outlook)

const SERIF = "Georgia,'Times New Roman',serif"; // repli Fraunces
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"; // repli Inter

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
            `<tr><td style="padding:3px 0;vertical-align:top;color:${SAGE};font-weight:700;width:18px;font-family:${SANS};">·</td><td style="padding:3px 0;color:${INK_SOFT};font-family:${SANS};font-size:15px;line-height:1.65;">${esc(
              t
            )}</td></tr>`
        )
        .join("");
      out.push(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;"><tbody>${items}</tbody></table>`
      );
    } else {
      const html = lines.map(esc).join("<br />");
      out.push(
        `<p style="margin:0 0 16px;color:${INK_SOFT};font-family:${SANS};font-size:15px;line-height:1.7;">${html}</p>`
      );
    }
  }
  return out.join("\n");
}

/** Bouton « bulletproof » (rendu correct jusque dans Outlook via VML).
 *  DA calme : pastille sauge arrondie, texte blanc cassé — doux, jamais criard. */
function button(label: string, url: string): string {
  const safeUrl = esc(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tbody><tr><td>
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="50%" strokecolor="${SAGE}" fillcolor="${SAGE}"><w:anchorlock/><center style="color:${CARD};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(
    label
  )}</center></v:roundrect><![endif]-->
  <!--[if !mso]><!-- --><a href="${safeUrl}" style="background:${SAGE};border:1px solid ${SAGE};border-radius:100px;color:${CARD};display:inline-block;font-family:${SANS};font-size:15px;font-weight:600;line-height:46px;text-align:center;text-decoration:none;width:260px;-webkit-text-size-adjust:none;">${esc(
    label
  )}</a><!--<![endif]-->
  </td></tr></tbody></table>`;
}

export function renderEmail(opts: EmailOptions): string {
  const closer = opts.closerName || "EAGLEYE";
  const preheader = (opts.preheader || opts.body.replace(/\s+/g, " ").trim()).slice(0, 140);
  const cta = opts.ctaLabel && opts.ctaUrl ? button(opts.ctaLabel, opts.ctaUrl) : "";
  const address = opts.addressLine || "EAGLEYE CORP — Lyon, France";
  // Logo aigle : PNG hébergé (encre sur transparent). Repli sans image :
  // monogramme serif italique — même voix, zéro dépendance.
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" width="52" height="42" alt="EAGLEYE" style="display:block;border:0;width:52px;height:42px;" />`
    : `<span style="font-family:${SERIF};font-style:italic;font-size:30px;line-height:42px;color:${INK};">E.</span>`;

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
  /* DA « calme » : l'identité tient même en clients sombres — fonds
     explicites, on ne laisse pas l'inversion agressive écraser la douceur. */
  @media (prefers-color-scheme: dark) {
    .bg { background:${BG} !important; }
    .card { background:${CARD} !important; border-color:${LINE} !important; }
  }
  @media only screen and (max-width:600px) {
    .card { width:100% !important; border-radius:0 !important; }
    .pad { padding:24px !important; }
  }
  a { color:${SAGE_DEEP}; }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${CARD};border:1px solid ${LINE};border-radius:18px;overflow:hidden;">
      <!-- En-tête — aigle + marque, sur carte claire, filet cheveu dessous -->
      <tr><td class="pad" style="padding:28px 36px 20px;border-bottom:1px solid ${LINE};">
        <table role="presentation" cellpadding="0" cellspacing="0"><tbody><tr>
          <td style="vertical-align:middle;padding-right:14px;">${logo}</td>
          <td style="vertical-align:middle;">
            <span style="display:block;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.1;color:${INK};">Eagleye</span>
            <span style="display:block;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${SAGE};margin-top:3px;">Sales OS — Lyon</span>
          </td>
        </tr></tbody></table>
      </td></tr>
      <!-- Corps -->
      <tr><td class="pad" style="padding:30px 36px;font-family:${SANS};color:${INK_SOFT};">
        <h1 style="margin:0 0 8px;font-family:${SERIF};font-style:italic;font-weight:400;font-size:23px;line-height:1.3;color:${INK};">${esc(
          opts.subject
        )}</h1>
        <div style="width:38px;height:2px;background:${BLUSH};margin:0 0 20px;"></div>
        ${bodyToHtml(opts.body)}
        ${cta}
        <p style="margin:24px 0 0;color:${INK_SOFT};font-family:${SANS};font-size:15px;line-height:1.6;">— <span style="font-family:${SERIF};font-style:italic;font-size:16px;color:${INK};">${esc(
          closer
        )}</span></p>
      </td></tr>
      <!-- Pied — bandeau doux, mentions RGPD -->
      <tr><td class="pad" style="padding:22px 36px;background:${BG_DEEP};">
        <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.55;color:${INK_SOFT};">${esc(
          address
        )}</p>
        <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.55;color:${INK_SOFT};">
          Vous recevez cet email car nous accompagnons les professionnels de votre secteur à Lyon.
          Vos coordonnées professionnelles proviennent de sources publiques (annuaires professionnels,
          site web de votre entreprise).
        </p>
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.55;color:${INK_SOFT};">
          Vous ne souhaitez plus être contacté ? Répondez simplement <strong style="color:${INK};">STOP</strong>.
          Conformément au RGPD, vous pouvez aussi demander l&#8217;accès, la rectification ou la suppression
          de vos données en répondant à cet email.
        </p>
      </td></tr>
    </table>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
      <tr><td style="padding:16px 8px 4px;text-align:center;font-family:${SANS};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};">
        Eagleye Corp · Lyon
      </td></tr>
      <tr><td style="padding:0 8px 14px;text-align:center;font-family:${SANS};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};">
        Envoyé avec <span style="font-family:${SERIF};font-style:italic;font-size:12px;letter-spacing:.04em;text-transform:none;color:${INK};">Alpha Sales OS</span><span style="color:${INK};">&#174;</span>
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
  lines.push("", "Envoyé avec ALPHA SALES OS® — Eagleye Corp, Lyon");
  return lines.join("\n");
}
