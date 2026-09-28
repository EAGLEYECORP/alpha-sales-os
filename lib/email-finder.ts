/**
 * ─────────────────────────────────────────────────────────────────────
 * CHERCHEUR D'EMAILS — trouver l'email d'un décideur à partir de son NOM et du
 * DOMAINE de sa société, SANS payer de crédit Explorium.
 *
 * Décidé le 28/09/2026. On a les NOMS + les DOMAINES gratuitement (le nom d'un
 * dirigeant et le site de sa boîte sont publics). Ce qui coûtait, c'était le
 * mapping nom → email vérifié. Ce module le fait via un fournisseur BYOK
 * (Hunter aujourd'hui ; Dropcontact — français, RGPD — se branche pareil), avec
 * LA CLÉ DE L'OPÉRATEUR. Donc : coût pour NOUS = 0, et on ne dépend plus des
 * crédits Explorium.
 *
 * ⚠ POURQUOI PAS UN SCRAPER (la question tranchée). Un scraper lit une PAGE :
 * le site d'un promoteur affiche `contact@`, jamais l'email du directeur du
 * développement. Et deux des scrapers évoqués (ScrapeGraphAI avec
 * `undetected-playwright`, l'aspiration de Google Maps) sont des contournements
 * de détection / des violations de CGU — dans un produit dont l'argument est la
 * CONFORMITÉ. Un annuaire d'emails vérifiés (Hunter/Dropcontact) est légal,
 * ciblé sur la bonne personne, et gratuit jusqu'au palier du fournisseur.
 *
 * ⚠ BYOK, FAIL-CLOSED. Sans clé, `chercheurConfigure()` rend false et personne
 * n'appelle. Aucune dépendance npm : `fetch` natif.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface EmailTrouve {
  email: string;
  /** 0..100 — confiance du fournisseur. En dessous d'un seuil, à vérifier. */
  score: number | null;
  /** L'état de vérification quand le fournisseur le donne (deliverable/risky/…). */
  etat: string | null;
  source: "hunter";
}

/** Le chercheur est-il configuré ? (clé de l'opérateur posée) Fail-closed. */
export function chercheurConfigure(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

/** Un domaine propre à partir d'un site ou d'un email de société. */
export function domaineDe(brut: string): string {
  const s = (brut || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[1] ?? "";
  return s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .trim();
}

/**
 * Trouve l'email d'une personne (prénom + nom) sur un domaine, via Hunter.
 * Lève sur clé absente, réseau coupé, ou réponse inattendue — l'appelant
 * décide alors quoi faire (repli, marquer « à trouver »). On ne renvoie jamais
 * un email inventé : pas de résultat ⇒ `null`.
 */
export async function trouverEmail(opts: {
  firstName: string;
  lastName: string;
  domain: string;
}): Promise<EmailTrouve | null> {
  const key = (process.env.HUNTER_API_KEY ?? "").trim();
  if (!key) throw new Error("email-finder: HUNTER_API_KEY absent (BYOK).");
  const domain = domaineDe(opts.domain);
  const first = (opts.firstName || "").trim();
  const last = (opts.lastName || "").trim();
  if (!domain || (!first && !last)) return null;

  const url =
    `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}` +
    `&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}` +
    `&api_key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal });
    if (r.status === 404) return null; // Hunter n'a pas trouvé : pas de résultat, pas une erreur.
    if (!r.ok) throw new Error(`email-finder: HTTP ${r.status}`);
    const data: unknown = await r.json();
    const d = (data as { data?: Record<string, unknown> })?.data;
    const email = d && typeof d.email === "string" ? d.email.trim() : "";
    if (!email) return null;
    const score = d && typeof d.score === "number" ? d.score : null;
    const verif = d?.verification as { status?: unknown } | undefined;
    const etat = verif && typeof verif.status === "string" ? verif.status : null;
    return { email, score, etat, source: "hunter" };
  } finally {
    clearTimeout(minuteur);
  }
}
