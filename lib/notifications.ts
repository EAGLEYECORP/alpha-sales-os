import type { EntreeJournal } from "./autopilote-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES NOTIFICATIONS — ce qu'ALPHA a fait et ce qui s'est passé, en un fil
 * (06/11/2026, demande de Zakaria : « ce que tu me dis comme suivi, il faut
 * que ce soit en onglet notifications sur ALPHA »).
 *
 * Jusqu'ici, savoir « est-ce qu'un mail est parti ? a-t-il été ouvert ? »
 * demandait de croiser trois endroits : le journal du pilote (`/autopilote`),
 * le suivi d'ouvertures (`/campaigns`) et sa boîte mail. Résultat mesuré le
 * jour même : le dossier « Envoyés » était vide (un envoi SMTP n'y laisse rien)
 * et l'utilisateur a conclu que rien n'était parti — alors que 5 messages
 * avaient été acceptés et 3 ouverts.
 *
 * ⚠ AUCUNE DÉFINITION DE PLUS : ce module ne décide rien. Il TRADUIT deux
 * sources qui existent déjà — le journal du pilote (`EntreeJournal`) et les
 * lignes de suivi (`/api/track/stats`) — en une liste datée.
 *
 * ⚠ UNE OUVERTURE N'EST PAS UNE LECTURE : Apple et Gmail préchargent les
 * images, un antivirus ouvre dans la minute. La notification le dit, et
 * seule une ouverture RÉPÉTÉE ou un clic est marqué important.
 * ─────────────────────────────────────────────────────────────────────
 */

export type GenreNotif = "envoi" | "ouverture" | "clic" | "reponse" | "rdv" | "attente" | "pilote" | "erreur";

export interface Notif {
  id: string;
  quand: string;
  genre: GenreNotif;
  titre: string;
  detail?: string;
  /** Mérite d'interrompre : une réponse, un RDV, un clic, ce qui attend un humain, une panne. */
  important: boolean;
}

/** Une ligne de suivi, telle que `/api/track/stats` la rend (sous-ensemble). */
export interface LigneSuivi {
  id: string;
  subject?: string;
  createdAt: string;
  opens: number;
  clicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
}

const AVERTISSEMENT_OUVERTURE = "Indicatif : une messagerie ou un antivirus peut ouvrir un message sans qu'un humain le lise.";

export function notifsDuSuivi(lignes: LigneSuivi[]): Notif[] {
  const out: Notif[] = [];
  for (const l of lignes) {
    const sujet = l.subject?.trim() ? `« ${l.subject.trim()} »` : "ton message";
    out.push({ id: `envoi-${l.id}`, quand: l.createdAt, genre: "envoi", titre: `Message parti : ${sujet}`, important: false });
    if (l.opens > 0 && l.lastOpenAt) {
      out.push({
        id: `ouverture-${l.id}-${l.opens}`,
        quand: l.lastOpenAt,
        genre: "ouverture",
        titre: `Ouvert${l.opens > 1 ? ` ${l.opens} fois` : ""} : ${sujet}`,
        detail: AVERTISSEMENT_OUVERTURE,
        important: l.opens > 1,
      });
    }
    if (l.clicks > 0 && l.lastClickAt) {
      out.push({
        id: `clic-${l.id}-${l.clicks}`,
        quand: l.lastClickAt,
        genre: "clic",
        titre: `Lien cliqué${l.clicks > 1 ? ` ${l.clicks} fois` : ""} : ${sujet}`,
        detail: "Un clic demande un geste : c'est un signal plus sûr qu'une ouverture.",
        important: true,
      });
    }
  }
  return out;
}

const GENRE_DU_JOURNAL: Record<EntreeJournal["type"], GenreNotif> = {
  cherche: "pilote",
  enrichit: "pilote",
  ecrit: "envoi",
  relance: "envoi",
  lit: "pilote",
  repond: "reponse",
  rdv: "rdv",
  escalade: "attente",
  pause: "pilote",
  erreur: "erreur",
};

/**
 * Le journal du pilote. `sansEnvois` : quand le suivi est lu, les envois y sont
 * déjà (avec leurs ouvertures) — on ne les compte pas deux fois.
 * Une ligne de machine IDENTIQUE répétée (une panne redite à chaque passage,
 * cinq minutes d'écart) ne fait qu'une notification : la plus récente, avec le
 * nombre de répétitions. Sinon le fil se remplit d'une seule phrase.
 */
export function notifsDuJournal(journal: EntreeJournal[], opts: { sansEnvois?: boolean } = {}): Notif[] {
  const out: Notif[] = [];
  for (const e of journal) {
    const genre = GENRE_DU_JOURNAL[e.type] ?? "pilote";
    if (opts.sansEnvois && genre === "envoi") continue;
    const prec = genre === "pilote" || genre === "erreur" ? out.find((n) => n.titre === e.texte) : undefined;
    if (prec) {
      const n = Number(prec.detail?.match(/^Répété (\d+) fois/)?.[1] ?? 1) + 1;
      prec.detail = `Répété ${n} fois.`;
      continue;
    }
    out.push({
      id: `journal-${e.le}-${e.type}`,
      quand: e.le,
      genre,
      titre: e.texte,
      important: genre === "reponse" || genre === "rdv" || genre === "attente" || genre === "erreur",
    });
  }
  return out;
}

/** Une liste, la plus récente en tête, sans doublon, bornée. */
export function fusionner(listes: Notif[][], max = 100): Notif[] {
  const vus = new Set<string>();
  return listes
    .flat()
    .filter((n) => (vus.has(n.id) ? false : (vus.add(n.id), true)))
    .sort((a, b) => b.quand.localeCompare(a.quand))
    .slice(0, max);
}

export function nonLues(notifs: Notif[], vuJusqua: string | null): number {
  if (!vuJusqua) return notifs.length;
  return notifs.filter((n) => n.quand > vuJusqua).length;
}

/** Le bilan du jour, en une phrase — compté sur la liste, jamais recalculé ailleurs. */
export function bilanDuJour(notifs: Notif[], jour: string): { envois: number; ouvertures: number; clics: number; reponses: number; rdv: number } {
  const du = notifs.filter((n) => n.quand.slice(0, 10) === jour);
  const c = (g: GenreNotif) => du.filter((n) => n.genre === g).length;
  return { envois: c("envoi"), ouvertures: c("ouverture"), clics: c("clic"), reponses: c("reponse"), rdv: c("rdv") };
}
