import type { Prospect, TimelineEvent } from "./types";
import { extractInsights, transcriptText, type CallSession } from "./call-log";

/**
 * ─────────────────────────────────────────────────────────────────────
 * RETOUR DU RÉSULTAT D'APPEL DANS LA FICHE — la boucle qui se ferme.
 *
 * L'autopilote écrit « Appel automatique — en attente du résultat » AVANT
 * d'appeler (anti-harcèlement, cf. lib/campaign-tick.ts). Cet événement est
 * volontairement lu comme « sans réponse » tant qu'on ne sait rien.
 *
 * Quand la session vocale se termine, on sait enfin ce qui s'est passé. Ce
 * module RÉCONCILIE : il retrouve l'événement en attente et le remplace par
 * le résultat réel.
 *
 * ⚠ La contrainte qui gouverne tout le fichier : le résumé écrit ici doit
 * être relu correctement par `attemptsFromEvents` (lib/master-rappel.ts).
 * C'est un aller-retour — résultat → texte → résultat — et il est testé.
 * Si le texte ne correspond plus aux motifs de lecture, la cadence se trompe
 * en silence : elle rappellerait quelqu'un qui a répondu, ou laisserait
 * dormir un dossier vivant.
 * ─────────────────────────────────────────────────────────────────────
 */

export type CallOutcome = NonNullable<CallSession["outcome"]>;

/** Marqueur des événements posés par l'autopilote avant l'appel. */
export const PENDING_MARK = "en attente du résultat";

/**
 * Le résumé d'événement pour un résultat donné.
 *
 * Chaque phrase est choisie pour être relue sans ambiguïté par
 * `attemptsFromEvents` — les mots-clés ne sont pas décoratifs.
 */
export function summaryFor(outcome: CallOutcome, extra?: string): string {
  const base: Record<CallOutcome, string> = {
    repondu: "Il a répondu — échange avec l'agent",
    "sans-reponse": "Sans réponse",
    opposition: "Opposition : ne plus appeler",
    invalide: "Numéro invalide",
  };
  return extra?.trim() ? `${base[outcome]} · ${extra.trim()}` : base[outcome];
}

/** L'événement en attente le plus proche de cette session, s'il existe. */
function findPending(p: Prospect, sessionStart: string, toleranceMs = 30 * 60_000): TimelineEvent | null {
  const t = new Date(sessionStart).getTime();
  const candidates = (p.events ?? []).filter(
    (e) => e.kind === "appel" && e.summary.includes(PENDING_MARK) && Math.abs(new Date(e.date).getTime() - t) <= toleranceMs
  );
  if (candidates.length === 0) return null;
  // Le plus proche dans le temps : deux appels rapprochés ne doivent pas
  // se voler leur résultat.
  return candidates.sort(
    (a, b) => Math.abs(new Date(a.date).getTime() - t) - Math.abs(new Date(b.date).getTime() - t)
  )[0];
}

export interface Reconciliation {
  prospect: Prospect;
  /** L'événement en attente a-t-il été retrouvé et corrigé ? */
  matched: boolean;
  /** Ce qu'on a appris de l'appel, à valider par un humain. */
  learned: string[];
  /** Le prospect doit-il sortir des campagnes ? */
  optOut: boolean;
}

/**
 * Applique le résultat d'une session à la fiche.
 *
 * Trois effets, dans cet ordre :
 *   1. l'événement en attente devient le résultat réel (ou un nouvel
 *      événement est créé si l'appel venait d'ailleurs — appel manuel) ;
 *   2. les insights de la transcription sont PROPOSÉS, jamais imposés :
 *      ils vont dans les notes, pas dans les champs structurés. Une
 *      heuristique lexicale n'a pas à réécrire un montant ou une date ;
 *   3. une opposition pose le tag « ne-pas-appeler » — définitif.
 */
export function applyOutcome(p: Prospect, session: CallSession, now: Date = new Date()): Reconciliation {
  const outcome: CallOutcome = session.outcome ?? (session.turns.length > 0 ? "repondu" : "sans-reponse");
  const insights = extractInsights(session);
  const learned = insights.map((i) => `${i.kind} : « ${i.quote} »`);

  const durationNote = session.turns.length > 0 ? `${session.turns.length} tours` : undefined;
  const summary = summaryFor(outcome, durationNote);

  const pending = findPending(p, session.startedAt);
  let events: TimelineEvent[];

  if (pending) {
    events = (p.events ?? []).map((e) => (e.id === pending.id ? { ...e, summary } : e));
  } else {
    // Aucun événement en attente : l'appel n'a pas été lancé par l'autopilote
    // (appel manuel, ou entrant). On en crée un plutôt que de perdre la trace.
    events = [
      {
        id: `call-${session.id}`,
        date: session.startedAt,
        kind: "appel",
        summary,
      },
      ...(p.events ?? []),
    ];
  }

  const optOut = outcome === "opposition";
  const tags = optOut && !(p.tags ?? []).includes("ne-pas-appeler")
    ? [...(p.tags ?? []), "ne-pas-appeler"]
    : (p.tags ?? []);

  // Les apprentissages vont dans les notes libres : visibles, relisibles,
  // et sans risque d'écraser une donnée saisie à la main.
  const notes = learned.length
    ? [p.notes?.trim(), `— Appel du ${new Date(session.startedAt).toLocaleDateString("fr-FR")} :`, ...learned.map((l) => `  ${l}`)]
        .filter(Boolean)
        .join("\n")
    : p.notes;

  return {
    prospect: { ...p, events, tags, notes, updatedAt: now.toISOString() },
    matched: Boolean(pending),
    learned,
    optOut,
  };
}

/** La transcription complète, prête à devenir une note du Cerveau. */
export function transcriptNote(session: CallSession, company: string): { title: string; body: string; tags: string[] } {
  const date = new Date(session.startedAt).toLocaleDateString("fr-FR");
  return {
    title: `Appel ${company} — ${date}`,
    body: [
      `Direction : ${session.direction} · ${session.turns.length} tours${session.outcome ? ` · ${session.outcome}` : ""}`,
      "",
      transcriptText(session) || "(aucune transcription)",
    ].join("\n"),
    tags: ["appel", "transcription"],
  };
}
