/**
 * ─────────────────────────────────────────────────────────────────────
 * LIRE UN EMAIL REÇU — l'en-tête, le texte, et seulement ce que le prospect
 * vient d'écrire (29/10/2026).
 *
 * Fait main, sans dépendance, comme le reste de ce qui touche la donnée
 * métier. Il sert UN usage : comprendre la réponse d'un prospect pour que
 * l'autopilote sache quoi faire (`lib/reponses-inscrit.ts`). Il n'a donc pas à
 * tout lire — pièces jointes, HTML riche, images : rien de ça ne décide.
 *
 * ── CE QU'IL FAIT ──
 * · en-têtes repliés et mots encodés (=?UTF-8?B?…?=, =?ISO-8859-1?Q?…?=) ;
 * · corps multipart : la partie `text/plain` d'abord, sinon le HTML sans
 *   balises ; base64 et quoted-printable ; utf-8, latin-1, windows-1252 ;
 * · ⚠ il COUPE l'historique cité (« Le … a écrit : », « > … », séparateur
 *   Outlook). Sans ça, notre propre message — qui contient « STOP » et des
 *   créneaux numérotés — serait relu comme SA réponse : un « 2 » de notre
 *   liste deviendrait son choix, et notre ligne de désinscription son refus.
 * · il reconnaît les RÉPONSES AUTOMATIQUES (absence, congés) par leurs
 *   en-têtes normalisés (RFC 3834) puis par leur objet : un « je suis absent »
 *   n'est ni un oui, ni un non.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface MessageLu {
  /** Adresse de l'expéditeur, en minuscules. Vide si illisible. */
  de: string;
  date: string | null;
  sujet: string;
  messageId: string | null;
  inReplyTo: string | null;
  autoReponse: boolean;
  /** Ce qu'il vient d'écrire, sans l'historique cité. Borné. */
  texte: string;
}

export const TEXTE_MAX = 4000;

function decodeOctets(octets: Buffer, charset: string): string {
  const cs = charset.trim().toLowerCase().replace(/^"|"$/g, "");
  if (!cs || cs === "utf-8" || cs === "utf8" || cs === "us-ascii") return octets.toString("utf8");
  if (cs === "iso-8859-1" || cs === "latin1" || cs === "iso-8859-15") return octets.toString("latin1");
  try {
    return new TextDecoder(cs).decode(octets);
  } catch {
    return octets.toString("latin1");
  }
}

/** « =C3=A9 » → octets ; « _ » vaut espace dans un mot encodé (pas dans un corps). */
function quotedPrintable(s: string, dansEntete: boolean): Buffer {
  const t = (dansEntete ? s.replace(/_/g, " ") : s.replace(/=\r?\n/g, ""));
  const octets: number[] = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      octets.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      octets.push(t.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(octets);
}

/** RFC 2047 : les mots encodés d'un en-tête, collés quand ils se suivent. */
export function decoderEntete(v: string): string {
  return v
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, cs: string, enc: string, txt: string) => {
      const octets = enc.toUpperCase() === "B" ? Buffer.from(txt, "base64") : quotedPrintable(txt, true);
      return decodeOctets(octets, cs);
    })
    .trim();
}

/** En-têtes repliés → table (clés en minuscules, première occurrence). */
export function lireEntetes(bloc: string): Record<string, string> {
  const out: Record<string, string> = {};
  const deplie = bloc.replace(/\r?\n[ \t]+/g, " ");
  for (const ligne of deplie.split(/\r?\n/)) {
    const i = ligne.indexOf(":");
    if (i <= 0) continue;
    const cle = ligne.slice(0, i).trim().toLowerCase();
    if (!(cle in out)) out[cle] = ligne.slice(i + 1).trim();
  }
  return out;
}

/** « Jean <jean@x.fr> » · « jean@x.fr » → « jean@x.fr ». */
export function adresseDe(v: string): string {
  const m = v.match(/<([^<>\s]+@[^<>\s]+)>/) ?? v.match(/([^\s<>"',;]+@[^\s<>"',;]+)/);
  return m ? m[1].toLowerCase() : "";
}

function parametre(v: string, nom: string): string {
  const m = v.match(new RegExp(`${nom}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, "i"));
  return m ? (m[2] ?? m[1]) : "";
}

/** Sépare en-têtes et corps sur la première ligne vide. Travaille sur une chaîne « binaire » (1 char = 1 octet). */
function couper(binaire: string): { entetes: string; corps: string } {
  const m = binaire.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) return { entetes: binaire, corps: "" };
  return { entetes: binaire.slice(0, m.index), corps: binaire.slice(m.index + m[0].length) };
}

function sansBalises(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ");
}

/** Le texte d'une partie (ou du message entier), décodé. `null` = pas de texte ici. */
function texteDePartie(binaire: string, profondeur = 0): { texte: string; html: boolean } | null {
  if (profondeur > 5) return null;
  const { entetes, corps } = couper(binaire);
  const h = lireEntetes(entetes);
  const type = (h["content-type"] ?? "text/plain").toLowerCase();
  if (type.startsWith("multipart/")) {
    const bord = parametre(h["content-type"] ?? "", "boundary");
    if (!bord) return null;
    const parties = corps.split(`--${bord}`).slice(1).filter((p) => !p.startsWith("--"));
    let html: { texte: string; html: boolean } | null = null;
    for (const p of parties) {
      const t = texteDePartie(p.replace(/^\r?\n/, ""), profondeur + 1);
      if (t && !t.html) return t;
      if (t && t.html && !html) html = t;
    }
    return html;
  }
  if (!type.startsWith("text/")) return null;
  const enc = (h["content-transfer-encoding"] ?? "7bit").toLowerCase().trim();
  const octets =
    enc === "base64" ? Buffer.from(corps.replace(/\s+/g, ""), "base64") : enc === "quoted-printable" ? quotedPrintable(corps, false) : Buffer.from(corps, "latin1");
  const texte = decodeOctets(octets, parametre(h["content-type"] ?? "", "charset") || "utf-8");
  return type.startsWith("text/html") ? { texte: sansBalises(texte), html: true } : { texte, html: false };
}

/**
 * Coupe l'historique : tout ce qui suit la première marque de citation.
 * ⚠ « Le … a écrit : » se coupe parfois sur DEUX lignes chez Gmail : on le
 * cherche sur le texte replié, pas ligne à ligne.
 */
export function sansHistorique(texte: string): string {
  const t = texte.replace(/\r\n/g, "\n");
  const marques = [
    /\n\s*Le\s[^\n]{0,200}?(?:\n[^\n]{0,200}?)?a\s+écrit\s*:/i,
    /\n\s*On\s[^\n]{0,200}?(?:\n[^\n]{0,200}?)?wrote\s*:/i,
    /\n\s*-{2,}\s*(?:Original Message|Message d'origine|Message original)\s*-{2,}/i,
    /\n\s*_{10,}\s*\n/,
    /\n\s*(?:De|From)\s*:\s[^\n]*\n\s*(?:Envoyé|Sent|Date)\s*:/i,
    /\n\s*>/,
  ];
  let fin = t.length;
  for (const m of marques) {
    const r = ("\n" + t).search(m);
    if (r >= 0) fin = Math.min(fin, Math.max(0, r - 1));
  }
  return t
    .slice(0, fin)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const OBJET_AUTO = /^\s*(?:réponse automatique|reponse automatique|absence|absent|out of office|automatic reply|auto(?:matic)?[- ]?reply|auto:|congés|vacances)\b/i;

export function estReponseAutomatique(h: Record<string, string>, sujet: string): boolean {
  const auto = (h["auto-submitted"] ?? "").toLowerCase();
  if (auto && auto !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]?.toLowerCase().includes("all")) return true;
  if (/^(auto_reply|bulk|junk)$/i.test((h["precedence"] ?? "").trim())) return true;
  return OBJET_AUTO.test(sujet);
}

/** Lit un message brut (tel qu'IMAP le rend). */
export function lireMessage(brut: Buffer | string): MessageLu {
  const binaire = typeof brut === "string" ? brut : brut.toString("latin1");
  const { entetes } = couper(binaire);
  const h = lireEntetes(entetes);
  // Un en-tête en UTF-8 brut (sans mot encodé) arrive en « binaire » : on le relit en UTF-8.
  const brutUtf8 = (v: string | undefined) => (v ? Buffer.from(v, "latin1").toString("utf8") : "");
  const sujet = decoderEntete(brutUtf8(h["subject"]));
  const t = texteDePartie(binaire);
  const texte = sansHistorique(t?.texte ?? "").slice(0, TEXTE_MAX);
  const id = (v: string | undefined) => (v ? (v.match(/<[^<>]+>/)?.[0] ?? v.trim()) : null);
  return {
    de: adresseDe(decoderEntete(brutUtf8(h["from"]))),
    date: h["date"] ? (Number.isFinite(Date.parse(h["date"])) ? new Date(h["date"]).toISOString() : null) : null,
    sujet,
    messageId: id(h["message-id"]),
    inReplyTo: id(h["in-reply-to"]),
    autoReponse: estReponseAutomatique(h, sujet),
    texte,
  };
}
