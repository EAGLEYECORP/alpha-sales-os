import type { Prospect } from "./types";
import { emailSubject, emailBody, type ComposeOptions } from "./mail-compose";
import { renderEmail, plainText, type EmailOptions } from "./email-html";
import { isDemoProspect } from "./seed";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Brouillons Gmail HTML — un prospect ou plusieurs, prêts à envoyer.
 *
 * Différence avec `/outbox` (mail-compose) : là on ouvre une fenêtre de
 * rédaction Gmail pré-remplie en TEXTE. Ici on dépose un vrai BROUILLON
 * HTML — la DA « calme » de `renderEmail` — directement dans la boîte
 * `[Gmail]/Drafts`. Zakaria ouvre Gmail, relit, clique « Envoyer ».
 *
 * Ce fichier ne fait QUE fabriquer les brouillons (sujet + HTML + texte),
 * de façon pure et testable. Le dépôt réel dans Gmail vit dans
 * `lib/gmail-mime.ts` (MIME) + `lib/imap-append.ts` (IMAP APPEND), appelés
 * par la route `/api/gmail/draft`.
 *
 * Deux règles non négociables, héritées de l'outbox :
 *  · une fiche sans email exploitable est ignorée (rien à déposer) ;
 *  · une fiche de DÉMO a une adresse INVENTÉE — la déposer risquerait un
 *    envoi manuel vers un domaine qui rebondit. On la marque `demo` et on
 *    l'exclut du lot par défaut.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Un email exploitable — même règle que l'outbox. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function hasSendableEmail(p: Prospect): boolean {
  return EMAIL_RE.test((p.email ?? "").trim());
}

export interface GmailDraftOptions extends ComposeOptions {
  /** URL publique du logo aigle (PNG hébergé) pour l'en-tête HTML. */
  logoUrl?: string;
  /** Texte d'aperçu (inbox preview). Défaut : début du corps. */
  preheader?: string;
}

/** Le contenu prêt à déposer : ce que Gmail montrera dans le brouillon. */
export interface DraftContent {
  to: string;
  subject: string;
  /** Corps HTML « calme » (renderEmail). */
  html: string;
  /** Alternative texte brut (multipart) — délivrabilité. */
  text: string;
}

export interface DraftBatchItem {
  prospect: Prospect;
  content: DraftContent;
  /** Fiche de démonstration : adresse inventée, exclue par défaut. */
  demo: boolean;
}

/**
 * Fabrique le contenu d'un brouillon pour une fiche. Ne filtre rien —
 * suppose que l'appelant a vérifié `hasSendableEmail`.
 */
export function draftContentFor(p: Prospect, opts: GmailDraftOptions = {}): DraftContent {
  const subject = emailSubject(p);
  const body = emailBody(p, opts);
  const emailOpts: EmailOptions = {
    subject,
    body,
    closerName: opts.closerName?.trim() || "Zakaria",
    addressLine: opts.agencyName?.trim() ? `${opts.agencyName.trim()} — Lyon, France` : undefined,
    logoUrl: opts.logoUrl,
    preheader: opts.preheader,
  };
  return {
    to: p.email!.trim(),
    subject,
    html: renderEmail(emailOpts),
    text: plainText(emailOpts),
  };
}

/**
 * Le lot de brouillons pour un ensemble de fiches — un seul prospect ou
 * plusieurs, c'est le même chemin.
 *
 * Exclut les fiches gagnées/perdues (plus rien à envoyer) et celles sans
 * email. Les fiches de démo sont incluses dans le retour mais marquées
 * `demo:true` : la surface d'appel les affiche pour expliquer pourquoi elle
 * ne les dépose pas, exactement comme l'outbox.
 */
export function buildDraftBatch(prospects: Prospect[], opts: GmailDraftOptions = {}): DraftBatchItem[] {
  return prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .filter((p) => hasSendableEmail(p))
    .sort((a, b) => b.probability - a.probability || b.trust - a.trust)
    .map((p) => ({
      prospect: p,
      content: draftContentFor(p, opts),
      demo: isDemoProspect(p.id),
    }));
}

/** Les fiches déposables (hors démo) — celles qui partiront vraiment. */
export function sendableDrafts(batch: DraftBatchItem[]): DraftBatchItem[] {
  return batch.filter((it) => !it.demo);
}
