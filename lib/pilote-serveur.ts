import type { Meeting, Prospect } from "./types";
import type { EtatAgenda } from "./agenda-occupe";
import type { SuiteConversation } from "./relance-mail";
import type { MailSortant } from "./reponses-inscrit";
import { memeFiche } from "./fusion-fiches";
import { prospectDefaults } from "./seed";
import { LIMITE_LECTURE } from "./lecture-serveur";
import { CONFIGURATION_ALPHA_VEND_ALPHA } from "./alpha-vend-alpha";
import {
  ETAT_AUTOPILOTE_VIDE,
  REGLAGES_AUTOPILOTE_DEFAUT,
  type Envoi,
  type EtatAutopilote,
  type ReglagesAutopilote,
} from "./autopilote-inscrit";
import type { PortesPilote, RecuDeLecture } from "./pilote-executeur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PORTES DU SERVEUR — « ALPHA vend ALPHA » onglet fermé, sans n8n.
 *
 * Décision de Zakaria (30/10/2026) : « je ne veux pas brancher n8n, il faut que
 * tout soit dans le cloud ». Les ÉTAPES sont celles du navigateur
 * (`lib/pilote-executeur.ts`, une seule définition) ; ce module ne fournit que
 * l'endroit où elles s'appliquent : le pipe opérateur en base, chargé en
 * mémoire au début d'un passage, réécrit à la fin pour ce qui a bougé.
 *
 * ⚠⚠ MAÎTRE SEUL, ET PAR CONSTRUCTION. La frontière du 21/10 (« le pipe d'un
 * inscrit en ligne ne vit pas chez nous ») tient : ce module ne connaît qu'UNE
 * cible, celle de `CONFIGURATION_ALPHA_VEND_ALPHA` réglée par le maître, et
 * qu'UN pipe, `proprietaire = 'operateur'`. Aucun locataire n'y entre. C'est
 * aussi pourquoi la recherche au registre peut partir d'ici : la règle « du
 * navigateur, jamais par notre serveur » protège la cible d'un INSCRIT — la
 * nôtre ne nous apprend rien que nous ne sachions.
 *
 * ⚠ AUCUN SECRET EN BASE : la clé Dropcontact et l'adresse de l'agenda viennent
 * de l'environnement (la route les passe). Ce qui se stocke (`pilote_serveur`)
 * est ce que le maître a TAPÉ dans `/autopilote` : cible, plafonds, son nom.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'un passage manipule en mémoire, et ce qui a bougé (à réécrire). */
export interface MondeServeur {
  prospects: Prospect[];
  meetings: Meeting[];
  etat: EtatAutopilote;
  fichesModifiees: Set<string>;
  rdvModifies: Set<string>;
}

export function mondeServeur(prospects: Prospect[], meetings: Meeting[], etat: unknown): MondeServeur {
  return {
    prospects,
    meetings,
    etat: { ...ETAT_AUTOPILOTE_VIDE, ...(etat && typeof etat === "object" ? (etat as Partial<EtatAutopilote>) : {}) },
    fichesModifiees: new Set(),
    rdvModifies: new Set(),
  };
}

/**
 * Les réglages : la configuration ALPHA vend ALPHA, puis ce que le maître a
 * saisi à l'écran — clé par clé, MÊME TYPE seulement. Une valeur stockée
 * malformée (une main dans le SQL Editor, une version antérieure) retombe sur la
 * configuration au lieu de faire chercher le pilote dans une zone vide.
 */
export function reglagesServeur(actif: boolean, saisis: unknown): ReglagesAutopilote {
  const base: ReglagesAutopilote = { ...REGLAGES_AUTOPILOTE_DEFAUT, ...CONFIGURATION_ALPHA_VEND_ALPHA.autopilote, actif };
  if (!saisis || typeof saisis !== "object") return base;
  const s = saisis as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base) as (keyof ReglagesAutopilote)[]) {
    if (k === "actif") continue;
    const v = s[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(base[k])) {
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v;
    } else if (typeof v === typeof base[k] || (base[k] === undefined && typeof v === "string")) {
      if (typeof v === "number" && !(Number.isFinite(v) && v >= 0)) continue;
      out[k] = v;
    }
  }
  // `imapHost` n'est pas dans le défaut quand il est vide : on le lit à part.
  if (typeof s.imapHost === "string" && s.imapHost.trim()) out.imapHost = s.imapHost.trim();
  return out as unknown as ReglagesAutopilote;
}

/** Le nom et le lien de réservation tapés par le maître — jamais une configuration. */
export function expediteurServeur(saisi: unknown): { closerName: string; bookingUrl?: string } {
  const s = saisi && typeof saisi === "object" ? (saisi as Record<string, unknown>) : {};
  const closerName = typeof s.closerName === "string" ? s.closerName.trim().slice(0, 80) : "";
  const booking = typeof s.bookingUrl === "string" && /^https:\/\//.test(s.bookingUrl.trim()) ? s.bookingUrl.trim() : undefined;
  return { closerName, ...(booking ? { bookingUrl: booking } : {}) };
}

export interface DepsServeur {
  maintenant(): Date;
  uid(): string;
  reglages: ReglagesAutopilote;
  expediteur: { closerName: string; bookingUrl?: string };
  /** Le lien de création de compte du domaine servi (`/compte`), comme la configuration. */
  lienSignature: string;
  cleDropcontact: string;
  envoyer(p: Prospect, mail: MailSortant, suite?: SuiteConversation, copieExpediteur?: boolean): Promise<Envoi>;
  lireReponses(q: { adresses: string[]; depuis: string; imapHost?: string }): Promise<RecuDeLecture>;
  agenda(): Promise<EtatAgenda>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export function portesServeur(m: MondeServeur, d: DepsServeur): PortesPilote {
  const cfg = CONFIGURATION_ALPHA_VEND_ALPHA;
  const horodater = () => d.maintenant().toISOString();
  return {
    maintenant: d.maintenant,
    uid: d.uid,
    prospects: () => m.prospects,
    meetings: () => m.meetings,
    reglages: () => d.reglages,
    etat: () => m.etat,
    majEtat: (f) => {
      m.etat = f(m.etat);
    },
    patchProspect: (id, patch) => {
      m.prospects = m.prospects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: horodater() } : p));
      m.fichesModifiees.add(id);
    },
    addEvent: (id, ev) => {
      m.prospects = m.prospects.map((p) =>
        p.id === id ? { ...p, events: [{ ...ev, id: d.uid() }, ...p.events], nextStep: ev.nextStep ?? p.nextStep, updatedAt: horodater() } : p,
      );
      m.fichesModifiees.add(id);
    },
    upsertMeeting: (r) => {
      m.meetings = [...m.meetings.filter((x) => x.id !== r.id), r];
      m.rdvModifies.add(r.id);
    },
    importer: (fiches) => {
      /**
       * Le mur du serveur est la borne de lecture (`LIMITE_LECTURE`) : au-delà,
       * le passage suivant ne reverrait pas les fiches ajoutées — elles
       * existeraient en base sans que personne ne les travaille.
       */
      if (m.prospects.length + fiches.length > LIMITE_LECTURE) {
        return { refus: `Le pipe serveur approche ${LIMITE_LECTURE} fiches : ALPHA n'ajoute plus d'entreprises tant qu'il n'est pas allégé.` };
      }
      let added = 0;
      for (const brut of fiches) {
        // Même définition de « même entreprise » que le navigateur (SIREN d'abord).
        if (m.prospects.some((x) => memeFiche(x, brut))) continue;
        const p = { ...prospectDefaults, ...brut, createdAt: brut.createdAt || horodater(), updatedAt: horodater() } as Prospect;
        m.prospects = [...m.prospects, p];
        m.fichesModifiees.add(p.id);
        added++;
      }
      return { added };
    },
    expediteur: () => ({ accountId: "eagleye", closerName: d.expediteur.closerName, agencyName: cfg.agencyName, bookingUrl: d.expediteur.bookingUrl }),
    // Le maître écrit sur SON profil (`expediteurDuPilote`) : ALPHA vend ALPHA.
    inscrit: () => ({ profil: cfg.profil, agencyName: cfg.agencyName, city: cfg.ville }),
    profil: () => cfg.profil,
    closing: () => ({ prix: cfg.closing.prix, lienSignature: d.lienSignature }),
    cleDropcontact: () => d.cleDropcontact,
    envoyer: d.envoyer,
    lireReponses: d.lireReponses,
    agenda: d.agenda,
    fetch: d.fetch,
  };
}

/** Ce qui est à réécrire en base à la fin d'un passage. */
export function aReecrire(m: MondeServeur): { prospects: Prospect[]; meetings: Meeting[] } {
  return {
    prospects: m.prospects.filter((p) => m.fichesModifiees.has(p.id)),
    meetings: m.meetings.filter((r) => m.rdvModifies.has(r.id)),
  };
}

/** Le verrou d'un passage : 5 minutes, au-delà il expire seul (un passage tué ne bloque pas le pilote). */
export const VERROU_MS = 5 * 60_000;
