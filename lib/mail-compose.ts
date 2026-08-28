import type { Prospect } from "./types";
import { isDemoProspect } from "./seed";
// L'angle du message vient de l'aimant routé par le deep-dive, pas d'une
// phrase figée : voir l'en-tête de ce module pour ce que ça corrigeait.
import { approcheEcrite } from "./approche-ecrite";
import { signataire } from "./signature";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Envoi manuel — ALPHA rédige, TU envoies depuis ta propre messagerie.
 *
 * Le même geste que la machine LinkedIn : l'app prépare le message
 * personnalisé, ouvre la fenêtre de rédaction pré-remplie, et c'est
 * l'humain qui clique « Envoyer ». Rien ne part tout seul.
 *
 * Pourquoi ce mode existe, et pourquoi il n'est pas un pis-aller :
 *  · aucun identifiant SMTP à configurer — donc utilisable tout de suite ;
 *  · chaque message part de la main de l'opérateur, dans sa boîte, avec
 *    son historique de conversation. Ce n'est pas de l'envoi en masse
 *    déguisé : c'est de la correspondance, une par une ;
 *  · le message est en TEXTE BRUT. Pour un premier contact, c'est
 *    supérieur au HTML : ça ressemble à un humain qui écrit.
 *
 * Ce qu'on y perd, et il faut le dire : le suivi des OUVERTURES. Un
 * message sans images n'a pas de pixel. Les CLICS restent mesurables
 * (liens réécrits côté serveur), et la réponse — le seul indicateur qui
 * décide — arrive dans la boîte comme d'habitude.
 * ─────────────────────────────────────────────────────────────────────
 */

const firstName = (p: Prospect): string => (p.name || "").trim().split(/\s+/)[0] ?? "";

/**
 * Objet court, sans promesse, sans majuscules criardes.
 *
 * ⚠ Il annonçait « une question sur vos appels » dès qu'une verticale était
 * connue — c'est-à-dire l'angle Callflow, sur toutes les fiches. À quelqu'un
 * de routé vers la visibilité, l'objet parlait déjà d'autre chose que le
 * corps du message et que la pièce jointe.
 */
export function emailSubject(p: Prospect, accountId?: string): string {
  return `${p.company} — ${approcheEcrite(p, accountId).objet}`;
}

export interface ComposeOptions {
  bookingUrl?: string;
  closerName?: string;
  agencyName?: string;
  /**
   * Compte au nom duquel on écrit. Il décide des aimants disponibles — donc
   * de ce qu'on a le droit d'annoncer. Absent, on retombe sur EAGLEYE.
   */
  accountId?: string;
}

/**
 * Corps du message — texte brut, personnalisé par la verticale du
 * playbook. Posture PULL : on ne propose pas l'audit, on signale qu'il
 * existe. C'est ce qui fait la différence entre un cadeau et une relance.
 */
export function emailBody(p: Prospect, opts: ComposeOptions = {}): string {
  const hi = firstName(p) ? `Bonjour ${firstName(p)},` : "Bonjour,";
  // Critère, question et signal viennent tous les trois de l'aimant routé :
  // un seul endroit décide de QUOI parle ce message.
  const a = approcheEcrite(p, opts.accountId);
  const agency = opts.agencyName?.trim() || "EAGLEYE CORP";
  // Un seul endroit décide QUI signe (`lib/signature`). Le repli en dur qui
  // vivait ici signait « Zakaria » — le prénom du propriétaire de l'outil —
  // dans les emails d'un revendeur white-label.
  const closer = signataire(opts.closerName, agency).nom;

  const booking = opts.bookingUrl?.trim()
    ? ["", `Si un jour vous voulez en parler, mon agenda est ouvert : ${opts.bookingUrl.trim()}`]
    : [];

  return [
    hi,
    "",
    `Je vous écris directement, ce sera court.`,
    "",
    `Je n'écris pas au hasard : je travaille avec ${a.critere}.${a.critereMetier ? ` ${a.critereMetier}` : ""}`,
    "",
    `Une seule question, celle qui m'intéresse vraiment : ${a.question}`,
    ...(a.signal ? ["", a.signal] : []),
    ...booking,
    "",
    `${closer} — ${agency}, Lyon`,
    "",
    `Si vous ne souhaitez plus recevoir de message de ma part, répondez STOP : je vous retire immédiatement.`,
  ].join("\n");
}

export interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
}

/**
 * Longueur au-delà de laquelle on ne passe plus par l'URL.
 *
 * Les navigateurs acceptent des URL très longues, mais les serveurs qui
 * les reçoivent tronquent souvent autour de 8 Ko — et un message tronqué
 * en silence est pire qu'un message qu'on colle à la main. En dessous de
 * cette borne, le pré-remplissage est fiable ; au-dessus, on bascule sur
 * le presse-papier et on le dit.
 */
export const COMPOSE_URL_LIMIT = 7000;

/**
 * Fenêtre de rédaction Gmail pré-remplie.
 *
 * `authuser` sélectionne le bon compte quand plusieurs sessions Google
 * sont ouvertes — sans lui, Gmail rédige depuis le dernier compte utilisé,
 * ce qui est exactement le genre d'erreur qu'on ne remarque qu'après.
 */
export function gmailComposeUrl(d: ComposeDraft, authuser?: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", to: d.to, su: d.subject, body: d.body });
  if (authuser?.trim()) q.set("authuser", authuser.trim());
  return `https://mail.google.com/mail/?${q.toString()}`;
}

/** Client de messagerie du système — pour qui n'utilise pas Gmail dans le navigateur. */
export function mailtoUrl(d: ComposeDraft): string {
  const q = new URLSearchParams({ subject: d.subject, body: d.body });
  return `mailto:${encodeURIComponent(d.to)}?${q.toString()}`;
}

/** Le pré-remplissage par URL tiendra-t-il ? Sinon : presse-papier. */
export function composeFitsInUrl(d: ComposeDraft, authuser?: string): boolean {
  return gmailComposeUrl(d, authuser).length <= COMPOSE_URL_LIMIT;
}

/** Message complet pour le presse-papier, objet compris. */
export function clipboardText(d: ComposeDraft): string {
  return `Objet : ${d.subject}\n\n${d.body}`;
}

/** Un email exploitable, et une fiche encore active. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export interface OutboxTarget {
  prospect: Prospect;
  draft: ComposeDraft;
  /** Pourquoi cette fiche est dans la file aujourd'hui. */
  reason: string;
  /**
   * Fiche de démonstration : son adresse est INVENTÉE. Écrire dessus
   * produit un rebond dur, et les rebonds comptent contre le domaine
   * pendant longtemps. La file la montre — pour qu'on comprenne pourquoi
   * l'envoi est refusé — mais aucune surface ne doit la laisser partir.
   */
  demo: boolean;
}

const isToday = (iso: string) => iso.slice(0, 10) === new Date().toISOString().slice(0, 10);

/**
 * La file d'envoi manuel du jour.
 *
 * Ordre : les plus chaudes d'abord — probabilité puis confiance. À volume
 * réduit (5 à 40 par jour), l'ordre compte plus que le nombre : autant
 * que les cinq messages du jour partent vers les cinq meilleures fiches.
 *
 * `limit` vient du palier de montée en charge (lib/email-ramp.ts). Il
 * n'est pas décoratif : la file s'arrête là.
 */
export function buildOutbox(prospects: Prospect[], limit: number, opts: ComposeOptions = {}): OutboxTarget[] {
  return prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .filter((p) => EMAIL_RE.test((p.email ?? "").trim()))
    .filter((p) => !p.events.some((e) => isToday(e.date) && e.kind === "email"))
    .sort((a, b) => b.probability - a.probability || b.trust - a.trust)
    .slice(0, Math.max(0, limit))
    .map((p) => ({
      prospect: p,
      // Même compte pour l'objet et pour le corps : c'est la seule façon
      // qu'ils annoncent le même audit.
      draft: { to: p.email!.trim(), subject: emailSubject(p, opts.accountId), body: emailBody(p, opts) },
      reason:
        p.events.length === 0
          ? "jamais contactée"
          : `dernière touche : ${p.events[0].kind}`,
      demo: isDemoProspect(p.id),
    }));
}
