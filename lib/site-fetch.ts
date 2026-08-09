/**
 * ─────────────────────────────────────────────────────────────────────
 * Récupération du contenu d'un site — pour l'audit automatique.
 *
 * Deux voies :
 *  1. `fetch()` serveur direct (défaut) : marche sans navigateur ni API pour
 *     la grande majorité des sites de TPE (statiques/légers). Tourne sur Vercel.
 *  2. Endpoint scraper (SCRAPE_ENDPOINT) : pour les sites JS/anti-bot. Contrat
 *     minimal : POST { url } → { text | markdown | html }. Y brancher un
 *     Firecrawl / Crawl4AI / Camoufox auto-hébergé (ils ont besoin d'un
 *     navigateur → un hôte GPU/serveur, PAS Vercel).
 *
 * ⚠ On ne récupère QUE le site public d'un prospect connu (légitime, pas du
 * scraping de masse). Garde-fou SSRF : on refuse les hôtes privés/loopback.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Réduit un HTML en texte lisible : vire script/style, balises, entités, blancs. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:lt|gt|quot|#39|apos);/gi, (m) => ({ "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" }[m.toLowerCase()] ?? m))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalise + valide une URL publique. Renvoie l'URL http(s) sûre, ou null.
 * Garde-fou SSRF : rejette loopback, IP privées, hôtes sans point (intranet).
 */
export function safePublicUrl(input: string): string | null {
  let raw = (input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (!host.includes(".")) return null; // pas de FQDN → intranet
  // IPv4 privées / loopback / link-local.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) {
      return null;
    }
  }
  if (host === "[::1]" || host.startsWith("[fd") || host.startsWith("[fe80")) return null; // IPv6 loopback/privé
  return u.toString();
}

export interface SiteText {
  text: string;
  source: "endpoint" | "fetch";
}

/** Récupère le texte lisible d'un site (endpoint scraper si configuré, sinon fetch direct). */
export async function fetchSiteText(url: string, maxChars = 16_000): Promise<SiteText> {
  const safe = safePublicUrl(url);
  if (!safe) throw new Error("URL non valide ou non autorisée.");

  const endpoint = process.env.SCRAPE_ENDPOINT?.trim();
  if (endpoint) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SCRAPE_KEY ? { Authorization: `Bearer ${process.env.SCRAPE_KEY}` } : {}),
      },
      body: JSON.stringify({ url: safe }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`Scraper: HTTP ${res.status}`);
    const json = (await res.json()) as { text?: string; markdown?: string; html?: string };
    const raw = json.markdown ?? json.text ?? (json.html ? stripHtml(json.html) : "");
    return { text: raw.slice(0, maxChars), source: "endpoint" };
  }

  // Fetch direct — borné en temps et en taille.
  const res = await fetch(safe, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaSalesOS/1.0; audit)", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Site injoignable (HTTP ${res.status}).`);
  const ct = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/i.test(ct)) {
    throw new Error("Le lien ne renvoie pas une page web lisible.");
  }
  const html = (await res.text()).slice(0, 600_000); // borne mémoire avant nettoyage
  return { text: stripHtml(html).slice(0, maxChars), source: "fetch" };
}
