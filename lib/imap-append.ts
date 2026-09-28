import tls from "node:tls";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Dépôt d'un brouillon Gmail via IMAP APPEND — zéro dépendance.
 *
 * Pourquoi IMAP et pas l'API Gmail : le MÊME mot de passe d'application
 * Gmail qui sert déjà à ENVOYER en SMTP (SMTP_USER / SMTP_PASS) sert à
 * DÉPOSER un brouillon en IMAP. Aucun OAuth à mettre en place, aucune clé
 * de plus. Une seule config, deux gestes : envoyer et brouillonner.
 *
 * On parle IMAP « à la main » sur `node:tls`, dans l'esprit du reste du
 * code (le JWT LiveKit est signé à la main avec node:crypto). Le protocole
 * utilisé est minimal et standard (RFC 3501) :
 *   LOGIN → LIST (trouver le dossier Brouillons) → APPEND → LOGOUT
 *
 * La découverte du dossier via SPECIAL-USE (\Drafts) rend le dépôt robuste
 * aux noms localisés : « [Gmail]/Drafts » en anglais, « [Gmail]/Brouillons »
 * en français. On ne devine pas, on demande au serveur.
 *
 * ⚠️ Honnêteté : ce client n'a pas pu être vérifié contre un vrai serveur
 * Gmail dans cet environnement (pas d'identifiants). Le cadrage des
 * littéraux et l'analyse SPECIAL-USE sont testés unitairement
 * (tests/gmail-draft.test.ts) ; le premier dépôt réel se fait vers ta
 * propre boîte, jamais vers un prospect.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Dossier forcé (sinon découverte SPECIAL-USE puis repli [Gmail]/Drafts). */
  draftsMailbox?: string;
}

/** Guillemet IMAP d'une chaîne (RFC 3501 : échapper \ et "). */
export function imapQuote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * La commande APPEND avec littéral synchronisant. Le serveur répond `+`
 * avant qu'on envoie les octets du message. La longueur est en OCTETS,
 * pas en caractères — d'où le Buffer.byteLength ailleurs.
 */
export function appendCommand(tag: string, mailbox: string, byteLength: number): string {
  return `${tag} APPEND ${imapQuote(mailbox)} (\\Draft) {${byteLength}}\r\n`;
}

/**
 * Extrait le dossier marqué \Drafts d'une réponse LIST SPECIAL-USE.
 * Lignes typiques :
 *   * LIST (\HasNoChildren \Drafts) "/" "[Gmail]/Brouillons"
 * Renvoie le nom du dossier (déguillemeté) ou null si absent.
 */
export function parseDraftsMailbox(listResponse: string): string | null {
  for (const line of listResponse.split(/\r?\n/)) {
    if (!/^\*\s+LIST\b/i.test(line)) continue;
    const flags = line.match(/\(([^)]*)\)/)?.[1] ?? "";
    if (!/\\Drafts\b/i.test(flags)) continue;
    // Le nom du dossier est le dernier atome : soit "…" entre guillemets,
    // soit un atome nu.
    const quoted = line.match(/"((?:[^"\\]|\\.)*)"\s*$/);
    if (quoted) return quoted[1].replace(/\\(.)/g, "$1");
    const atom = line.trim().match(/(\S+)\s*$/);
    return atom ? atom[1] : null;
  }
  return null;
}

/** Une réponse taguée est-elle un succès (`<tag> OK`) ? Sinon on lève le texte. */
function isTaggedOk(buf: string, tag: string): boolean | null {
  const re = new RegExp(`^${tag} (OK|NO|BAD)\\b(.*)$`, "im");
  const m = buf.match(re);
  if (!m) return null;
  if (m[1].toUpperCase() === "OK") return true;
  throw new Error(`IMAP ${m[1]}${m[2] ? ` —${m[2]}` : ""}`.trim());
}

/**
 * Dépose un message (MIME complet) comme brouillon. Résout avec le nom du
 * dossier utilisé. Le message est normalisé en CRLF (exigence IMAP).
 */
export function imapAppendDraft(cfg: ImapConfig, mime: Buffer): Promise<{ mailbox: string }> {
  // IMAP exige des fins de ligne CRLF dans le littéral.
  const normalized = Buffer.from(mime.toString("utf8").replace(/\r?\n/g, "\r\n"), "utf8");

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    let buf = "";
    let stage: "greet" | "login" | "list" | "append-cont" | "append-done" | "logout" = "greet";
    let mailbox = cfg.draftsMailbox || "";
    let settled = false;

    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      reject(e);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      try { socket.end(); } catch { /* ignore */ }
      resolve({ mailbox });
    };

    socket.setTimeout(20_000, () => fail(new Error("IMAP timeout")));
    socket.on("error", fail);

    const send = (s: string) => socket.write(s, "utf8");

    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      try {
        switch (stage) {
          case "greet":
            if (/^\*\s+OK/im.test(buf)) {
              buf = "";
              stage = "login";
              send(`A1 LOGIN ${imapQuote(cfg.user)} ${imapQuote(cfg.pass)}\r\n`);
            }
            return;
          case "login":
            if (isTaggedOk(buf, "A1")) {
              buf = "";
              if (mailbox) {
                stage = "append-cont";
                send(appendCommand("A3", mailbox, normalized.length));
              } else {
                stage = "list";
                send(`A2 LIST (SPECIAL-USE) "" "*"\r\n`);
              }
            }
            return;
          case "list":
            if (isTaggedOk(buf, "A2")) {
              mailbox = parseDraftsMailbox(buf) || "[Gmail]/Drafts";
              buf = "";
              stage = "append-cont";
              send(appendCommand("A3", mailbox, normalized.length));
            }
            return;
          case "append-cont":
            // Le serveur envoie une continuation « + » avant le littéral.
            if (/^\+/m.test(buf)) {
              buf = "";
              stage = "append-done";
              socket.write(normalized);
              send("\r\n");
            }
            return;
          case "append-done":
            if (isTaggedOk(buf, "A3")) {
              buf = "";
              stage = "logout";
              send("A4 LOGOUT\r\n");
            }
            return;
          case "logout":
            done();
            return;
        }
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    });

    socket.on("close", () => {
      // Fermeture propre après LOGOUT lancé : considérer comme succès.
      if (!settled && stage === "logout") done();
      else if (!settled) fail(new Error("IMAP: connexion fermée avant la fin"));
    });
  });
}
