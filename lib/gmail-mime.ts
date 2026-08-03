import MailComposer from "nodemailer/lib/mail-composer";
import type { DraftContent } from "./gmail-draft";

/**
 * Fabrique le message RFC 822 (MIME multipart html+texte) d'un brouillon.
 *
 * On réutilise `MailComposer` (livré avec Nodemailer, déjà en dépendance) :
 * il gère l'encodage UTF-8, les frontières multipart, le repli des lignes
 * longues et l'en-tête `Content-Transfer-Encoding` — exactement ce qu'un
 * MIME fait maison rate. Zéro dépendance nouvelle.
 */
export interface MimeParams extends DraftContent {
  /** Expéditeur affiché (ex. "EAGLEYE CORP <eagleyecorp.ad@gmail.com>"). */
  from: string;
}

export function buildDraftMime(p: MimeParams): Promise<Buffer> {
  const composer = new MailComposer({
    from: p.from,
    to: p.to,
    subject: p.subject,
    text: p.text,
    html: p.html,
  });
  return new Promise((resolve, reject) => {
    composer.compile().build((err: Error | null, message: Buffer) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}
