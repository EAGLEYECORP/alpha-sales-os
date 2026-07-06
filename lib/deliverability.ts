import crypto from "crypto";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Délivrabilité — « tout faire pour ne PAS finir dans les spams ».
 *
 *  · unsubscribe signé (List-Unsubscribe + One-Click, RFC 8058)
 *  · en-têtes de bonne conduite
 *  · lint anti-spam (mots déclencheurs, MAJUSCULES, ratio texte/lien…)
 *  · rate-limit d'envoi (un pic de volume = signal spam)
 *
 * La partie infra (SPF / DKIM / DMARC) est côté DNS + SMTP : voir le README.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Unsubscribe signé ──────────────────────────────────────────────────
function secret(): string {
  return process.env.UNSUB_SECRET || process.env.WEBHOOK_SECRET || "alpha-sales-os-dev-secret";
}

/** Jeton opaque et infalsifiable pour un email donné. */
export function makeUnsubToken(email: string): string {
  const payload = Buffer.from(email.toLowerCase().trim()).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 24);
  return `${payload}.${sig}`;
}

/** Vérifie un jeton, retourne l'email ou null. */
export function verifyUnsubToken(token: string): string | null {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 24);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function unsubscribeUrl(baseUrl: string, email: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/unsubscribe?t=${makeUnsubToken(email)}`;
}

/**
 * En-têtes qui améliorent la délivrabilité et donnent le bouton
 * « Se désinscrire » natif de Gmail/Apple (List-Unsubscribe + One-Click).
 */
export function deliverabilityHeaders(unsubUrl?: string): Record<string, string> {
  const h: Record<string, string> = {
    "X-Entity-Ref-ID": crypto.randomUUID(),
    "X-Mailer": "ALPHA-SALES-OS",
  };
  if (unsubUrl) {
    h["List-Unsubscribe"] = `<${unsubUrl}>`;
    h["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return h;
}

// ── Suppression list (désinscrits) ─────────────────────────────────────
const suppressed = new Set<string>();
export function isSuppressed(email: string): boolean {
  return suppressed.has(email.toLowerCase().trim());
}
export function suppress(email: string): void {
  suppressed.add(email.toLowerCase().trim());
}

// ── Lint anti-spam ─────────────────────────────────────────────────────
const SPAM_WORDS = [
  "gratuit", "100%", "urgent", "gagnez", "cliquez ici", "argent facile",
  "offre limitée", "sans engagement", "félicitations", "promotion", "cash",
  "viagra", "crédit", "remboursement", "garanti", "risque zéro",
];

export interface SpamLint {
  score: number; // 0 (nickel) → plus c'est haut, plus ça spamme
  level: "ok" | "attention" | "risque";
  warnings: string[];
}

export function lintForSpam(subject: string, body: string, hasText: boolean, linkCount: number): SpamLint {
  const warnings: string[] = [];
  let score = 0;
  const subj = subject || "";
  const full = `${subj}\n${body}`.toLowerCase();

  const caps = subj.replace(/[^A-ZÀ-Ÿ]/g, "").length;
  const letters = subj.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
  if (letters > 6 && caps / letters > 0.6) {
    score += 2;
    warnings.push("Objet en MAJUSCULES — adoucis-le.");
  }

  const bangs = (subj.match(/!/g) || []).length;
  if (bangs >= 2) {
    score += 1;
    warnings.push("Trop de points d'exclamation dans l'objet.");
  }

  const hits = SPAM_WORDS.filter((w) => full.includes(w));
  if (hits.length) {
    score += hits.length;
    warnings.push(`Mots à risque : ${hits.join(", ")}.`);
  }

  if (!hasText) {
    score += 2;
    warnings.push("Pas de version texte — envoie en multipart html + texte.");
  }

  const words = body.split(/\s+/).filter(Boolean).length;
  if (linkCount > 0 && words / Math.max(linkCount, 1) < 20) {
    score += 2;
    warnings.push("Trop de liens pour peu de texte.");
  }
  if (linkCount > 6) {
    score += 1;
    warnings.push(`${linkCount} liens — réduis si possible.`);
  }

  if (subj.length > 90) {
    score += 1;
    warnings.push("Objet trop long (> 90 caractères).");
  }
  if (/(\$|€|£)\s?\d/.test(subj)) {
    score += 1;
    warnings.push("Un prix dans l'objet déclenche les filtres.");
  }

  const level: SpamLint["level"] = score <= 1 ? "ok" : score <= 3 ? "attention" : "risque";
  return { score, level, warnings };
}

// ── Rate limiting (anti-pic) ───────────────────────────────────────────
const windows = new Map<string, number[]>();

/**
 * Autorise ou non un envoi. Défaut : 40 emails / heure global (surchargeable
 * via MAX_SENDS_PER_HOUR). Un envoi régulier et modéré protège la réputation.
 */
export function allowSend(key = "global"): { ok: boolean; retryAfterSec?: number } {
  const max = Number(process.env.MAX_SENDS_PER_HOUR ?? 40);
  const now = Date.now();
  const hourAgo = now - 3600_000;
  const arr = (windows.get(key) ?? []).filter((t) => t > hourAgo);
  if (arr.length >= max) {
    const retryAfterSec = Math.ceil((arr[0] + 3600_000 - now) / 1000);
    windows.set(key, arr);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  windows.set(key, arr);
  return { ok: true };
}
