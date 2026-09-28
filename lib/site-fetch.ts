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
  //
  // Les formes octales (« 0177.0.0.1 » = 127.0.0.1) sont déjà normalisées par
  // l'analyseur d'URL avant d'arriver ici — c'est LUI qui nous sauve, pas une
  // lecture manuelle : un Number("0177") naïf aurait vu 177 et laissé passer.
  // Le refus des zéros en tête reste par précaution si un runtime ne
  // normalisait pas.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    if (m.slice(1).some((p) => p.length > 1 && p.startsWith("0"))) return null;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (
      a === 127 || a === 10 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      // CGNAT 100.64/10 : c'est du réseau opérateur interne, pas du public.
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return null;
    }
  }
  // IPv6 loopback/privé, y compris la forme « IPv4 mappée » [::ffff:127.0.0.1].
  if (host === "[::1]" || host === "[::]" || host.startsWith("[fd") || host.startsWith("[fc") || host.startsWith("[fe80")) return null;
  if (host.startsWith("[::ffff:")) return null;
  return u.toString();
}

/** Nombre maximum de redirections suivies — au-delà, c'est une boucle ou un piège. */
const MAX_REDIRECTS = 4;

/**
 * `fetch` qui suit les redirections À LA MAIN, en revalidant CHAQUE saut.
 *
 * ⚠ C'était le trou : `safePublicUrl` ne validait que l'URL de départ, puis
 * `redirect: "follow"` laissait le runtime suivre aveuglément. Il suffisait
 * d'un domaine public répondant `302 Location: http://169.254.169.254/…`
 * (métadonnées cloud, jetons IAM) ou `http://127.0.0.1:5432` pour faire
 * atteindre le réseau interne par notre propre serveur. Le garde-fou de
 * départ ne protège rien s'il n'est pas rejoué à chaque saut.
 */
async function fetchNoRedirect(url: string, init: RequestInit): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status > 399) return res;

    const location = res.headers.get("location");
    if (!location) return res;

    // Résolution relative sur l'URL courante, puis MÊME validation qu'à l'entrée.
    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch {
      throw new Error("Redirection illisible.");
    }
    const safe = safePublicUrl(next);
    if (!safe) throw new Error("Redirection vers une adresse non autorisée (réseau interne).");
    current = safe;
  }
  throw new Error("Trop de redirections.");
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
  const res = await fetchNoRedirect(safe, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaSalesOS/1.0; audit)", Accept: "text/html" },
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
