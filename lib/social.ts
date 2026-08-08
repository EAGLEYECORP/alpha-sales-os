/**
 * ─────────────────────────────────────────────────────────────────────
 * Moteur de PUBLICATION sociale — LinkedIn · X (Twitter) · Meta.
 *
 * Même doctrine que la machine LinkedIn de prospection : ASSISTÉ, JAMAIS
 * automatisé. L'app rédige le post calibré par plateforme (sujet tech pour
 * EAGLEYE CORP), l'humain relit puis publie en un clic (intent de partage) ou
 * copie-colle. Pas d'auto-post : publier via API demande des apps OAuth
 * approuvées (LinkedIn/Meta) et des jetons par compte — hors périmètre, et
 * contraire au « l'humain garde la main ».
 *
 * Ce module est PUR (aucun réseau) → entièrement testable.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Platform = "linkedin" | "x" | "meta";

export interface PlatformSpec {
  id: Platform;
  label: string;
  /** Limite pratique de caractères d'un post (X = par tweet). */
  limit: number;
  /** Nombre de hashtags conseillé. */
  hashtags: number;
  /** Consigne de ton pour la génération. */
  tone: string;
}

export const PLATFORMS: Record<Platform, PlatformSpec> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    limit: 3000,
    hashtags: 3,
    tone: "Professionnel, expert, orienté valeur. Accroche forte en 1re ligne (avant le « …voir plus »), aération en courtes lignes, 1 idée = 1 paragraphe, CTA final.",
  },
  x: {
    id: "x",
    label: "X (Twitter)",
    limit: 280,
    hashtags: 2,
    tone: "Percutant, condensé. Si l'idée dépasse 280 caractères, découper en fil numéroté. Accroche qui arrête le scroll.",
  },
  meta: {
    id: "meta",
    label: "Meta (Facebook / Instagram)",
    limit: 2200,
    hashtags: 5,
    tone: "Accessible, chaleureux, storytelling. Émojis avec parcimonie. Hashtags en fin de légende.",
  },
};

/**
 * URL d'intent de partage — ouvre la plateforme avec le contenu pré-rempli
 * quand elle le permet. LinkedIn/Facebook ne pré-remplissent QUE l'URL (le
 * texte se colle à la main → l'UI propose « Copier »). X pré-remplit le texte.
 * Renvoie null si aucune intent texte n'est possible.
 */
export function shareIntentUrl(platform: Platform, opts: { text?: string; url?: string }): string | null {
  const text = opts.text ?? "";
  const url = opts.url ?? "";
  switch (platform) {
    case "x": {
      const p = new URLSearchParams();
      if (text) p.set("text", text);
      if (url) p.set("url", url);
      return `https://twitter.com/intent/tweet?${p.toString()}`;
    }
    case "linkedin":
      // LinkedIn ne pré-remplit fiablement que l'URL partagée.
      return url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` : null;
    case "meta":
      // Facebook sharer ne prend que l'URL ; Instagram n'a pas d'intent web.
      return url ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` : null;
    default:
      return null;
  }
}

/**
 * Découpe un texte en fil X : chaque tweet ≤ limite, suffixe « (n/m) ».
 * Découpe aux frontières de mots ; un mot plus long que la limite est coupé net.
 */
export function splitThread(text: string, limit = 280): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  // Réserve la place du suffixe « (n/m) » (marge fixe de 8 caractères).
  const budget = Math.max(16, limit - 8);
  const words = clean.split(" ");
  const parts: string[] = [];
  let cur = "";
  for (const w of words) {
    const chunk = w.length > budget ? w.slice(0, budget) : w;
    if (!cur) cur = chunk;
    else if ((cur + " " + chunk).length <= budget) cur += " " + chunk;
    else {
      parts.push(cur);
      cur = chunk;
    }
  }
  if (cur) parts.push(cur);

  const total = parts.length;
  return parts.map((p, i) => `${p} (${i + 1}/${total})`);
}

/** Coupe proprement un texte à la limite d'une plateforme (au dernier mot entier). */
export function fitPlatform(text: string, platform: Platform): string {
  const spec = PLATFORMS[platform];
  const clean = text.trim();
  if (clean.length <= spec.limit) return clean;
  return clean.slice(0, spec.limit).replace(/\s+\S*$/, "").trimEnd() + "…";
}
