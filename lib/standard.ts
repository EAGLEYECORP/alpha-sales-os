import type { Prospect, Meeting } from "./types";
import { palierFor, type Palier } from "./paliers";
import { vitalSigns } from "./vital-signs";
import { prioritized, urgency, daysLeft } from "./opportunites";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BARRE DU JOUR — ce qui doit être vrai avant de fermer la journée.
 *
 * Pas une liste de tâches de plus : une BARRE. Elle est tenue ou elle ne
 * l'est pas, et la série de jours consécutifs le dit sans complaisance.
 *
 * Trois sources, dans cet ordre de priorité :
 *   1. l'ÉCHÉANCE — un rendez-vous aujourd'hui, une opportunité qui ferme,
 *      des fonds débloqués : ça ne se reporte pas ;
 *   2. le PROSPECT MÛR — quelqu'un est prêt à signer et attend ;
 *   3. le PALIER — les actions structurelles de l'étape où on en est.
 *
 * ⚠ Ce qui rend une barre honnête : elle ne se coche pas toute seule. Les
 * items « mesurés » se valident sur les DONNÉES (un RDV passé, un audit
 * envoyé) ; les items « déclarés » se cochent à la main. On ne mélange
 * jamais les deux — sinon la série ne veut plus rien dire.
 * ─────────────────────────────────────────────────────────────────────
 */

export type BarItemKind = "echeance" | "closing" | "palier";

export interface BarItem {
  id: string;
  kind: BarItemKind;
  label: string;
  /** Pourquoi c'est là aujourd'hui. */
  why: string;
  /** Lien à ouvrir pour agir. */
  href?: string;
  /** Vrai = validé par les données, faux = à cocher à la main. */
  measured: boolean;
  /** Déjà satisfait ? (uniquement pour les items mesurés) */
  done: boolean;
  /** Plus le nombre est bas, plus c'est urgent. */
  rank: number;
}

export interface DailyStandard {
  date: string;
  palier: Palier;
  items: BarItem[];
  /** Items réellement faits (mesurés satisfaits + déclarés cochés). */
  doneCount: number;
  total: number;
  /** La barre est-elle tenue ? */
  held: boolean;
  /** Ce qui manque, en une phrase. */
  verdict: string;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const sameDay = (a: string, b: Date) => a.slice(0, 10) === dayKey(b);

/**
 * La barre du jour.
 * `checked` : ids cochés à la main aujourd'hui (persistés dans le store).
 */
export function dailyStandard(
  prospects: Prospect[],
  meetings: Meeting[],
  cashedEur: number,
  checked: string[] = [],
  now: Date = new Date()
): DailyStandard {
  const palier = palierFor(cashedEur);
  const items: BarItem[] = [];
  const isChecked = (id: string) => checked.includes(id);

  // ── 1. Les échéances du jour — elles ne se reportent pas ──
  const todayMeetings = meetings.filter((m) => !m.done && sameDay(m.date, now));
  for (const m of todayMeetings) {
    items.push({
      id: `rdv-${m.id}`,
      kind: "echeance",
      label: `Rendez-vous : ${m.title}`,
      why: `${new Date(m.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — ${m.kind}`,
      href: m.prospectId ? `/prospects/${m.prospectId}` : "/meetings",
      measured: true,
      done: m.done === true,
      rank: 0,
    });
  }

  // Fonds débloqués aujourd'hui : le moment exact où relancer.
  for (const p of prospects) {
    const at = p.funding?.availableAt;
    if (at && sameDay(at, now)) {
      items.push({
        id: `fonds-${p.id}`,
        kind: "echeance",
        label: `${p.company} — les fonds se débloquent aujourd'hui`,
        why: p.funding?.channel ? `Règlement prévu par ${p.funding.channel}.` : "C'est le jour convenu avec la compta.",
        href: `/prospects/${p.id}`,
        measured: false,
        done: isChecked(`fonds-${p.id}`),
        rank: 1,
      });
    }
  }

  // Opportunités qui ferment — French Tech et consorts.
  for (const o of prioritized(now)) {
    if (urgency(o, now) !== "critique") continue;
    const d = daysLeft(o, now);
    items.push({
      id: `opp-${o.id}`,
      kind: "echeance",
      label: `${o.name} — J-${d}`,
      why: "Une échéance passée ne se rattrape pas : le dossier ferme.",
      href: "/trajectoire",
      measured: false,
      done: isChecked(`opp-${o.id}`),
      rank: 1,
    });
  }

  // ── 2. Les prospects mûrs — quelqu'un attend ──
  const ready = prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .map((p) => ({ p, s: vitalSigns(p, now) }))
    .filter((x) => x.s.readiness >= 70 && x.s.fatigueLevel !== "sature")
    .sort((a, b) => b.s.readiness - a.s.readiness)
    .slice(0, 3);

  for (const { p, s } of ready) {
    items.push({
      id: `closing-${p.id}`,
      kind: "closing",
      label: `${p.company} est prêt à signer (${s.readiness}/100)`,
      why: "On ne fait pas attendre un acheteur. Chaque jour d'attente le refroidit.",
      href: `/prospects/${p.id}`,
      measured: false,
      done: isChecked(`closing-${p.id}`),
      rank: 2,
    });
  }

  // ── 3. Les actions du palier — le structurel ──
  for (const [i, action] of palier.daily.entries()) {
    items.push({
      id: `palier-${palier.id}-${i}`,
      kind: "palier",
      label: action,
      why: `Palier « ${palier.name.split(" — ")[0]} » : ${palier.constraint}`,
      measured: false,
      done: isChecked(`palier-${palier.id}-${i}`),
      rank: 3,
    });
  }

  items.sort((a, b) => a.rank - b.rank);

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  // La barre est tenue si TOUTES les échéances sont traitées et au moins
  // 70 % de l'ensemble. Une échéance manquée annule la journée : c'est le
  // seul type d'item qu'on ne peut pas rattraper demain.
  const echeances = items.filter((i) => i.kind === "echeance");
  const echeancesOk = echeances.every((i) => i.done);
  const held = total > 0 && echeancesOk && doneCount / total >= 0.7;

  const manquantes = echeances.filter((i) => !i.done);
  const verdict = total === 0
    ? "Rien d'imposé aujourd'hui. Va chercher du volume."
    : !echeancesOk
      ? `${manquantes.length} échéance(s) non traitée(s) — ça ne se reporte pas : ${manquantes[0].label}`
      : held
        ? `Barre tenue : ${doneCount}/${total}.`
        : `${doneCount}/${total} — il manque ${Math.ceil(total * 0.7) - doneCount} action(s) pour tenir la barre.`;

  return { date: dayKey(now), palier, items, doneCount, total, held, verdict };
}

export interface StandardDay {
  /** AAAA-MM-JJ. */
  date: string;
  /** Ids cochés ce jour-là. */
  checked: string[];
  /** La barre a-t-elle été tenue ? Figé en fin de journée. */
  held?: boolean;
}

/**
 * La série de jours consécutifs où la barre a été tenue.
 *
 * On ne compte QUE les jours ouvrés : exiger une série 7j/7 fabrique de
 * l'échec artificiel et fait abandonner. Un week-end non travaillé ne casse
 * donc pas la série.
 */
export function streak(history: StandardDay[], now: Date = new Date()): number {
  const held = new Set(history.filter((h) => h.held).map((h) => h.date));
  let count = 0;
  const cursor = new Date(now);

  // On part d'aujourd'hui et on remonte, en sautant les week-ends.
  for (let guard = 0; guard < 400; guard++) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (held.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Aujourd'hui pas encore tenu : ça ne casse pas la série en cours,
    // la journée n'est pas finie.
    if (dayKey(cursor) === dayKey(now)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return count;
}

/** Le texte de la notification — court, actionnable, jamais culpabilisant. */
export function reminderText(s: DailyStandard): { title: string; body: string } | null {
  const restantes = s.items.filter((i) => !i.done);
  if (restantes.length === 0) return null;

  const echeance = restantes.find((i) => i.kind === "echeance");
  const closing = restantes.find((i) => i.kind === "closing");
  const first = echeance ?? closing ?? restantes[0];

  return {
    title: echeance ? "Échéance aujourd'hui" : closing ? "Quelqu'un attend ta réponse" : "La barre du jour",
    body: `${first.label}${restantes.length > 1 ? ` · +${restantes.length - 1} autre(s)` : ""}`,
  };
}
