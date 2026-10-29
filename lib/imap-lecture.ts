import tls from "node:tls";
import type { Duplex } from "node:stream";
import { imapQuote } from "./imap-append";
import { lireMessage, type MessageLu } from "./mime-lecture";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LIRE LES RÉPONSES DES PROSPECTS DANS LA BOÎTE DE L'INSCRIT — IMAP, fait
 * main, en LECTURE SEULE (29/10/2026).
 *
 * Avant : les réponses arrivaient chez nous par n8n (`inbound_events`), pour
 * NOTRE boîte seulement. Un inscrit qui envoyait depuis la sienne ne voyait
 * jamais ALPHA lire une réponse : la chaîne s'arrêtait au premier « oui ».
 *
 * ── ⚠⚠ CE QUE LE SERVEUR VOIT, ET CE QU'IL NE GARDE PAS ──
 * · La boîte est ouverte par `EXAMINE`, jamais `SELECT` : lecture seule.
 *   Rien n'est marqué lu, déplacé ni effacé — l'inscrit retrouve sa boîte
 *   exactement comme il l'a laissée.
 * · On ne rapatrie le corps QUE des messages dont l'expéditeur est dans la
 *   liste que le navigateur envoie (ses prospects). Le reste de sa boîte —
 *   sa banque, ses clients, sa famille — n'est lu qu'au niveau de l'en-tête
 *   « De », et ne sort jamais du serveur.
 * · Rien n'est stocké : la route rend les messages et oublie.
 *
 * ── LES BORNES ──
 * 300 derniers messages de la période au plus, 30 corps, 64 Ko par corps.
 * Au-delà, la boîte d'un inscrit très actif ferait tomber la fonction sur sa
 * durée maximale — et une lecture coupée au milieu ne dit pas « rien de neuf ».
 *
 * ⚠ NON TESTÉ CONTRE UN VRAI SERVEUR : ce conteneur ne joint aucun serveur de
 * messagerie (le proxy refuse IMAP comme SMTP). Testé contre un faux serveur
 * qui parle le protocole (`tests/reponses-inscrit.test.ts`) ; le premier
 * inscrit qui branche sa boîte est le vrai test.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ConfigLecture {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Injecté par les tests (faux serveur en clair). Par défaut : TLS. */
  ouvrir?: () => Duplex;
}

export const MESSAGES_MAX = 300;
export const CORPS_MAX = 30;
export const OCTETS_PAR_CORPS = 65_536;

/** Une réponse IMAP (une ligne logique, littéraux compris). */
export interface ReponseImap {
  texte: string;
  litteraux: Buffer[];
}

/**
 * Découpe un tampon en réponses complètes, littéraux compris (« {n} » puis n
 * octets). `null` tant que la dernière réponse n'est pas entière.
 * ⚠ Travaille en OCTETS : un littéral compte des octets, pas des caractères —
 * un accent UTF-8 en compte deux, et un découpage en caractères décalerait tout
 * ce qui suit.
 */
export function decouper(buf: Buffer): { reponses: ReponseImap[]; reste: Buffer } {
  const reponses: ReponseImap[] = [];
  let i = 0;
  externe: while (i < buf.length) {
    let texte = "";
    const litteraux: Buffer[] = [];
    let j = i;
    for (;;) {
      const fin = buf.indexOf("\r\n", j);
      if (fin < 0) break externe;
      const ligne = buf.subarray(j, fin).toString("latin1");
      j = fin + 2;
      texte += ligne;
      const lit = ligne.match(/\{(\d+)\}$/);
      if (!lit) break;
      const n = Number(lit[1]);
      if (j + n > buf.length) break externe;
      litteraux.push(buf.subarray(j, j + n));
      j += n;
    }
    reponses.push({ texte, litteraux });
    i = j;
  }
  return { reponses, reste: buf.subarray(i) };
}

/** « 29-Oct-2026 » — le format de date d'IMAP (RFC 3501), en anglais, toujours. */
export function dateImap(d: Date): string {
  const mois = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, "0")}-${mois}-${d.getUTCFullYear()}`;
}

class Session {
  private buf = Buffer.alloc(0);
  private attente: { tag: string; ok: (r: ReponseImap[]) => void; ko: (e: Error) => void; recues: ReponseImap[] } | null = null;
  private accueil: ((ok: boolean) => void) | null = null;
  private n = 0;

  constructor(private socket: Duplex) {
    socket.on("data", (c: Buffer) => this.recevoir(c));
    socket.on("error", (e: Error) => this.echouer(e));
    socket.on("close", () => this.echouer(new Error("connexion fermée par le serveur")));
  }

  private echouer(e: Error) {
    const a = this.attente;
    this.attente = null;
    a?.ko(e);
    this.accueil?.(false);
    this.accueil = null;
  }

  private recevoir(c: Buffer) {
    this.buf = Buffer.concat([this.buf, c]);
    const { reponses, reste } = decouper(this.buf);
    this.buf = Buffer.from(reste);
    for (const r of reponses) {
      if (this.accueil) {
        const ok = /^\*\s+(OK|PREAUTH)\b/i.test(r.texte);
        this.accueil(ok);
        this.accueil = null;
        continue;
      }
      const a = this.attente;
      if (!a) continue;
      const m = r.texte.match(new RegExp(`^${a.tag} (OK|NO|BAD)\\b ?(.*)$`, "i"));
      if (!m) {
        a.recues.push(r);
        continue;
      }
      this.attente = null;
      if (m[1].toUpperCase() === "OK") a.ok(a.recues);
      else a.ko(new Error(`${m[1].toUpperCase()} ${m[2]}`.trim().slice(0, 200)));
    }
  }

  attendreAccueil(): Promise<void> {
    return new Promise((res, rej) => {
      this.accueil = (ok) => (ok ? res() : rej(new Error("le serveur n'a pas accueilli la connexion")));
    });
  }

  commande(cmd: string): Promise<ReponseImap[]> {
    const tag = `L${++this.n}`;
    return new Promise((ok, ko) => {
      this.attente = { tag, ok, ko, recues: [] };
      this.socket.write(`${tag} ${cmd}\r\n`, "utf8");
    });
  }

  fermer() {
    try {
      this.socket.write(`L${++this.n} LOGOUT\r\n`, "utf8");
      this.socket.end();
    } catch {
      /* déjà fermée */
    }
  }
}

/** « * SEARCH 4 8 15 » → [4, 8, 15]. */
export function uidsDeRecherche(reponses: ReponseImap[]): number[] {
  const out: number[] = [];
  for (const r of reponses) {
    const m = r.texte.match(/^\*\s+SEARCH\b(.*)$/i);
    if (m) for (const x of m[1].trim().split(/\s+/)) if (/^\d+$/.test(x)) out.push(Number(x));
  }
  return out;
}

/** Les réponses FETCH : l'UID et le premier littéral (l'élément demandé). */
export function itemsFetch(reponses: ReponseImap[]): { uid: number; contenu: Buffer }[] {
  const out: { uid: number; contenu: Buffer }[] = [];
  for (const r of reponses) {
    if (!/^\*\s+\d+\s+FETCH\b/i.test(r.texte)) continue;
    const uid = r.texte.match(/\bUID\s+(\d+)/i);
    if (!uid || !r.litteraux[0]) continue;
    out.push({ uid: Number(uid[1]), contenu: r.litteraux[0] });
  }
  return out;
}

export type ErreurLecture = "auth" | "connexion" | "protocole";

export class EchecLecture extends Error {
  constructor(public classe: ErreurLecture, message: string) {
    super(message);
  }
}

/**
 * Lit, depuis `depuis`, les messages des adresses données. Rend les messages
 * lus, les plus récents d'abord.
 */
export async function lireReponsesImap(cfg: ConfigLecture, adresses: readonly string[], depuis: Date): Promise<MessageLu[]> {
  const voulues = new Set(adresses.map((a) => a.trim().toLowerCase()).filter(Boolean));
  if (!voulues.size) return [];
  const socket = cfg.ouvrir ? cfg.ouvrir() : tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
  const s = new Session(socket);
  const minuteur = setTimeout(() => socket.destroy(new Error("délai dépassé")), 40_000);
  try {
    await s.attendreAccueil().catch((e: Error) => {
      throw new EchecLecture("connexion", e.message);
    });
    await s.commande(`LOGIN ${imapQuote(cfg.user)} ${imapQuote(cfg.pass)}`).catch((e: Error) => {
      throw new EchecLecture("auth", e.message);
    });
    await s.commande("EXAMINE INBOX");
    const uids = uidsDeRecherche(await s.commande(`UID SEARCH SINCE ${dateImap(depuis)}`)).slice(-MESSAGES_MAX);
    if (!uids.length) return [];

    const entetes = itemsFetch(await s.commande(`UID FETCH ${uids.join(",")} (UID BODY.PEEK[HEADER.FIELDS (FROM)])`));
    const retenus = entetes
      .filter((e) => {
        const de = lireMessage(e.contenu).de;
        return de && voulues.has(de);
      })
      .map((e) => e.uid)
      .slice(-CORPS_MAX);
    if (!retenus.length) return [];

    const corps = itemsFetch(await s.commande(`UID FETCH ${retenus.join(",")} (UID BODY.PEEK[]<0.${OCTETS_PAR_CORPS}>)`));
    return corps
      .map((c) => lireMessage(c.contenu))
      // Revérifié sur le message ENTIER : l'en-tête lu à part pourrait mentir
      // sur un serveur qui renumérote entre deux commandes.
      .filter((m) => voulues.has(m.de))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  } catch (e) {
    if (e instanceof EchecLecture) throw e;
    throw new EchecLecture("protocole", e instanceof Error ? e.message.slice(0, 200) : "erreur IMAP");
  } finally {
    clearTimeout(minuteur);
    s.fermer();
  }
}
