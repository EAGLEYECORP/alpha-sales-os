import crypto from "crypto";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Délivrabilité — « tout faire pour ne PAS finir dans les spams ».
 *
 * Désinscription = **réponse « STOP »**. Pas de page web ni de liste de
 * suppression côté app : le prospect répond STOP → le webhook entrant le
 * remonte → n8n le retire de la feuille et enfile un nouveau prospect.
 * On pose quand même un en-tête `List-Unsubscribe: <mailto:…>` : le bouton
 * natif de Gmail/Apple envoie alors… un email STOP, traité par le même flux.
 *
 *  · en-têtes de bonne conduite (List-Unsubscribe mailto, X-Mailer)
 *  · lint anti-spam (mots déclencheurs, MAJUSCULES, ratio texte/lien…)
 *  · rate-limit d'envoi (un pic de volume = signal spam)
 *
 * La partie infra (SPF / DKIM / DMARC) est côté DNS + SMTP : voir le README.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * En-têtes qui améliorent la délivrabilité. Si `stopMailto` est fourni, on
 * ajoute List-Unsubscribe en **mailto** : le clic natif « se désinscrire »
 * envoie un email (objet STOP) que le workflow n8n traite comme une réponse
 * STOP — cohérent avec le modèle, aucune page à héberger.
 */
export function deliverabilityHeaders(stopMailto?: string): Record<string, string> {
  const h: Record<string, string> = {
    "X-Entity-Ref-ID": crypto.randomUUID(),
    "X-Mailer": "ALPHA-SALES-OS",
  };
  if (stopMailto) {
    h["List-Unsubscribe"] = `<mailto:${stopMailto}?subject=STOP>`;
  }
  return h;
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

/**
 * Rate-limit d'envoi = nombre d'emails déjà partis dans la dernière heure
 * (compté dans le store de tracking → durable via Supabase, partagé entre
 * instances). La logique vit dans la route d'envoi via countRecentSends().
 */
export function maxSendsPerHour(): number {
  return Number(process.env.MAX_SENDS_PER_HOUR ?? 40);
}
