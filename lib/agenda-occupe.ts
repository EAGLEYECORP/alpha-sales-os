import { BUSINESS_TZ } from "./business-hours";

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUAND EST-IL OCCUPÉ ? — l'agenda RÉEL de l'inscrit, lu sans OAuth (29/10/2026).
 *
 * Le pilote automatique proposait trois créneaux en n'évitant que les
 * rendez-vous qu'il avait posés lui-même. L'inscrit a une vie hors d'ALPHA :
 * un chantier le mardi, ses enfants le mercredi. Un créneau proposé sur une
 * plage déjà prise, c'est un prospect qui a dit oui et à qui l'on écrit le
 * lendemain « finalement, je ne peux pas » — la pire façon de commencer.
 *
 * Google Agenda et Outlook donnent tous deux une ADRESSE SECRÈTE au format
 * iCalendar (Outlook peut même n'y publier que les disponibilités). Pas de
 * projet Google Cloud, pas de jeton : une adresse collée, lue à la demande.
 * Ce module la LIT ; il ne rend que des PLAGES OCCUPÉES — jamais un titre, un
 * lieu ou un participant. Ce qu'il fait de l'agenda tient en une question.
 *
 * ⚠⚠ DANS LE DOUTE, ON BLOQUE. Les deux erreurs ne coûtent pas pareil : une
 * plage libre crue occupée fait proposer un autre jour ; une plage occupée
 * crue libre fait mentir à un prospect. Donc :
 *  · une règle de récurrence qu'on ne sait pas déplier exactement bloque la
 *    même heure TOUS LES JOURS (`approximes`, compté et dit) ;
 *  · un fuseau inconnu est lu dans le fuseau du métier, et compté aussi ;
 *  · seuls `TRANSP:TRANSPARENT` (« disponible ») et `STATUS:CANCELLED`
 *    libèrent une plage — ce sont les deux seules choses que l'agenda dit
 *    lui-même.
 *
 * Aucune dépendance : RFC 5545, la partie qu'un agenda réel publie.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Plage {
  /** Début, en millisecondes epoch. */
  debut: number;
  /** Fin (exclue), en millisecondes epoch. */
  fin: number;
}

export interface LectureAgenda {
  /** Les plages occupées dans la fenêtre, triées et fusionnées. */
  plages: Plage[];
  /** Événements lus (hors exceptions de récurrence). */
  evenements: number;
  /** Récurrences ou fuseaux lus par prudence plutôt qu'exactement. */
  approximes: number;
  /** Plages libres (« disponible ») ou annulées : écartées. */
  ignores: number;
}

const JOUR_MS = 86_400_000;
/** Une récurrence n'est jamais déroulée au-delà : 30 ans quotidiens. */
const ITERATIONS_MAX = 11_000;

// ══════════ LIGNES ══════════

interface Prop {
  nom: string;
  params: Record<string, string>;
  valeur: string;
}

/** RFC 5545 §3.1 : une ligne qui commence par un blanc continue la précédente. */
function deplier(texte: string): string[] {
  return texte.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n").filter((l) => l.trim());
}

function lirePropriete(ligne: string): Prop | null {
  // Le premier « : » hors guillemets sépare le nom (et ses paramètres) de la valeur.
  let guillemets = false;
  let i = 0;
  for (; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') guillemets = !guillemets;
    else if (c === ":" && !guillemets) break;
  }
  if (i >= ligne.length) return null;
  const tete = ligne.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of tete.slice(1)) {
    const eg = p.indexOf("=");
    if (eg > 0) params[p.slice(0, eg).toUpperCase()] = p.slice(eg + 1).replace(/^"|"$/g, "");
  }
  return { nom: tete[0].toUpperCase(), params, valeur: ligne.slice(i + 1).trim() };
}

// ══════════ FUSEAUX ══════════

/** Les noms Windows qu'Outlook écrit à la place d'un nom IANA. */
const FUSEAUX_WINDOWS: Record<string, string> = {
  "romance standard time": "Europe/Paris",
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "central european standard time": "Europe/Warsaw",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "utc": "UTC",
  "coordinated universal time": "UTC",
  "morocco standard time": "Africa/Casablanca",
  "w. central africa standard time": "Africa/Lagos",
  "eastern standard time": "America/New_York",
  "pacific standard time": "America/Los_Angeles",
  "reunion standard time": "Indian/Reunion",
  "mauritius standard time": "Indian/Mauritius",
};

function fuseauValide(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Le fuseau IANA d'un TZID, ou `null` s'il est inconnu. */
export function fuseauDe(tzid: string | undefined): string | null {
  if (!tzid) return null;
  const brut = tzid.trim();
  if (fuseauValide(brut)) return brut;
  const win = FUSEAUX_WINDOWS[brut.toLowerCase()];
  if (win) return win;
  // « /mozilla.org/20050126_1/Europe/Paris » et ses cousins : la queue IANA.
  const queue = brut.match(/([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/)?.[1];
  return queue && fuseauValide(queue) ? queue : null;
}

/** Décalage (ms) du fuseau `tz` à l'instant `t` : heure locale lue comme UTC, moins t. */
function decalage(t: number, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const v = (type: string) => Number(p.find((x) => x.type === type)?.value ?? 0);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second")) - (t - (t % 1000));
}

/** Une heure MURALE dans un fuseau → l'instant UTC. Deux passes : l'heure d'été se décide à l'instant visé. */
export function heureMuraleVersUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const naif = Date.UTC(y, mo - 1, d, h, mi, s);
  if (tz === "UTC") return naif;
  const premier = naif - decalage(naif, tz);
  const second = naif - decalage(premier, tz);
  return second;
}

// ══════════ DATES ══════════

interface Murale {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

interface Instant {
  /** L'instant UTC. */
  t: number;
  /** L'heure murale dans `tz` — ce que déroule une récurrence. */
  murale: Murale;
  tz: string;
  journee: boolean;
}

function lireDate(p: Prop): { instant: Instant | null; approx: boolean } {
  const v = p.valeur.split(",")[0];
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { instant: null, approx: false };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const journee = p.params.VALUE === "DATE" || m[4] === undefined;
  const murale: Murale = { y, mo, d, h: journee ? 0 : Number(m[4]), mi: journee ? 0 : Number(m[5]), s: journee ? 0 : Number(m[6]) };
  if (m[7] === "Z") return { instant: { t: Date.UTC(y, mo - 1, d, murale.h, murale.mi, murale.s), murale, tz: "UTC", journee }, approx: false };
  const tzLu = fuseauDe(p.params.TZID);
  // Sans fuseau (heure « flottante » ou jour entier) : celle du métier. Un TZID
  // illisible aussi — mais compté, puisque ce n'est plus ce qu'a écrit l'agenda.
  const tz = tzLu ?? BUSINESS_TZ;
  const approx = Boolean(p.params.TZID) && !tzLu;
  return { instant: { t: heureMuraleVersUtc(y, mo, d, murale.h, murale.mi, murale.s, tz), murale, tz, journee }, approx };
}

/** Toutes les dates d'une ligne EXDATE / RDATE (listes séparées par des virgules). */
function lireDates(p: Prop): number[] {
  return p.valeur
    .split(",")
    .map((v) => lireDate({ ...p, valeur: v.trim() }).instant?.t)
    .filter((t): t is number => typeof t === "number");
}

function lireDuree(v: string): number | null {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = ((Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * 24 * 3600 + Number(m[4] ?? 0) * 3600 + Number(m[5] ?? 0) * 60 + Number(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

// ══════════ RÉCURRENCES ══════════

const JOURS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface Regle {
  freq: string;
  intervalle: number;
  count?: number;
  until?: number;
  byday: { n: number; jour: number }[];
  bymonthday: number[];
  bymonth: number[];
  /** Une partie que ce lecteur ne sait pas déplier exactement. */
  inconnue: boolean;
}

function lireRegle(v: string): Regle {
  const p: Record<string, string> = {};
  for (const morceau of v.split(";")) {
    const eg = morceau.indexOf("=");
    if (eg > 0) p[morceau.slice(0, eg).toUpperCase()] = morceau.slice(eg + 1).toUpperCase();
  }
  const freq = p.FREQ ?? "";
  const byday = (p.BYDAY ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
      return m ? { n: m[1] ? Number(m[1]) : 0, jour: JOURS[m[2]] } : { n: 0, jour: -1 };
    });
  const bymonthday = (p.BYMONTHDAY ?? "").split(",").filter(Boolean).map(Number);
  const bymonth = (p.BYMONTH ?? "").split(",").filter(Boolean).map(Number);
  const untilLu = p.UNTIL ? lireDate({ nom: "UNTIL", params: {}, valeur: p.UNTIL }).instant : null;
  const nonGere = ["BYSETPOS", "BYHOUR", "BYMINUTE", "BYSECOND", "BYWEEKNO", "BYYEARDAY"].some((k) => k in p);
  const inconnue =
    nonGere ||
    !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq) ||
    byday.some((b) => b.jour < 0) ||
    bymonthday.some((x) => !Number.isInteger(x) || x === 0 || x > 31 || x < -31) ||
    (freq === "WEEKLY" && byday.some((b) => b.n !== 0)) ||
    (freq === "DAILY" && byday.some((b) => b.n !== 0)) ||
    (freq === "MONTHLY" && byday.length > 0 && bymonthday.length > 0) ||
    (freq === "YEARLY" && (byday.length > 0 || bymonthday.length > 0));
  return {
    freq,
    intervalle: Math.max(1, Number(p.INTERVAL ?? 1) || 1),
    count: p.COUNT ? Number(p.COUNT) : undefined,
    // Un UNTIL en DATE couvre toute la journée (RFC 5545) : le couper à minuit
    // libérerait la dernière occurrence — le sens qu'on refuse.
    until: untilLu ? (untilLu.journee ? untilLu.t + JOUR_MS - 1 : untilLu.t) : undefined,
    byday,
    bymonthday,
    bymonth,
    inconnue,
  };
}

/** Le jour de la semaine (0 = dimanche) d'une date civile. */
function jourSemaine(y: number, mo: number, d: number): number {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function joursDansMois(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Une date civile décalée de `n` jours. */
function plusJours(y: number, mo: number, d: number, n: number): [number, number, number] {
  const x = new Date(Date.UTC(y, mo - 1, d + n));
  return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
}

/** Les jours d'un mois qui satisfont la règle (BYMONTHDAY ou BYDAY ordinal), triés. */
function joursDuMois(r: Regle, y: number, mo: number, jourDepart: number): number[] {
  const n = joursDansMois(y, mo);
  if (r.bymonthday.length) return r.bymonthday.map((x) => (x > 0 ? x : n + 1 + x)).filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
  if (r.byday.length) {
    const res: number[] = [];
    for (const b of r.byday) {
      const candidats: number[] = [];
      for (let d = 1; d <= n; d++) if (jourSemaine(y, mo, d) === b.jour) candidats.push(d);
      if (b.n === 0) res.push(...candidats);
      else {
        const pick = b.n > 0 ? candidats[b.n - 1] : candidats[candidats.length + b.n];
        if (pick) res.push(pick);
      }
    }
    return [...new Set(res)].sort((a, b) => a - b);
  }
  return jourDepart <= n ? [jourDepart] : [];
}

/**
 * Les débuts (heure murale déroulée) d'une récurrence, jusqu'à `jusqua`.
 * Rend `null` si la règle n'est pas dépliable exactement.
 */
function deplierRegle(r: Regle, depart: Instant, jusqua: number): number[] | null {
  if (r.inconnue) return null;
  const { y, mo, d, h, mi, s } = depart.murale;
  const instant = (yy: number, mm: number, dd: number) => heureMuraleVersUtc(yy, mm, dd, h, mi, s, depart.tz);
  const res: number[] = [];
  let emis = 0;
  const garder = (t: number): boolean => {
    // COUNT compte depuis le DÉPART, même avant la fenêtre ; UNTIL est inclus.
    if (t < depart.t) return true;
    if (r.until !== undefined && t > r.until) return false;
    if (r.count !== undefined && emis >= r.count) return false;
    if (t > jusqua) return false;
    emis++;
    res.push(t);
    return true;
  };
  const moisOk = (m: number) => !r.bymonth.length || r.bymonth.includes(m);

  if (r.freq === "DAILY") {
    for (let k = 0; k < ITERATIONS_MAX; k++) {
      const [yy, mm, dd] = plusJours(y, mo, d, k * r.intervalle);
      if (!moisOk(mm)) continue;
      if (r.byday.length && !r.byday.some((b) => b.jour === jourSemaine(yy, mm, dd))) continue;
      if (!garder(instant(yy, mm, dd))) break;
    }
    return res;
  }
  if (r.freq === "WEEKLY") {
    const jours = r.byday.length ? r.byday.map((b) => b.jour) : [jourSemaine(y, mo, d)];
    // Semaines comptées depuis le lundi de la semaine de départ (WKST par défaut).
    const decalLundi = (jourSemaine(y, mo, d) + 6) % 7;
    const [ly, lm, ld] = plusJours(y, mo, d, -decalLundi);
    for (let w = 0; w < ITERATIONS_MAX / 7; w++) {
      let continuer = true;
      for (let j = 0; j < 7 && continuer; j++) {
        const [yy, mm, dd] = plusJours(ly, lm, ld, w * 7 * r.intervalle + j);
        if (!jours.includes(jourSemaine(yy, mm, dd)) || !moisOk(mm)) continue;
        continuer = garder(instant(yy, mm, dd));
      }
      if (!continuer) break;
    }
    return res;
  }
  if (r.freq === "MONTHLY") {
    for (let k = 0; k < ITERATIONS_MAX / 28; k++) {
      const total = mo - 1 + k * r.intervalle;
      const yy = y + Math.floor(total / 12);
      const mm = (total % 12) + 1;
      if (!moisOk(mm)) continue;
      let continuer = true;
      for (const dd of joursDuMois(r, yy, mm, d)) {
        continuer = garder(instant(yy, mm, dd));
        if (!continuer) break;
      }
      if (!continuer) break;
    }
    return res;
  }
  // YEARLY, sans BY* autre que BYMONTH : la même date chaque année.
  for (let k = 0; k < 200; k++) {
    const yy = y + k * r.intervalle;
    const mois = r.bymonth.length ? r.bymonth : [mo];
    let continuer = true;
    for (const mm of mois) {
      if (d > joursDansMois(yy, mm)) continue;
      continuer = garder(instant(yy, mm, d));
      if (!continuer) break;
    }
    if (!continuer) break;
  }
  return res;
}

// ══════════ LECTURE ══════════

interface Brut {
  uid: string;
  debut: Instant;
  duree: number;
  regle?: Regle;
  exdates: Set<number>;
  rdates: number[];
  recurrenceId?: number;
  libre: boolean;
  approx: boolean;
}

function fusionner(plages: Plage[]): Plage[] {
  const tri = plages.filter((p) => p.fin >= p.debut).sort((a, b) => a.debut - b.debut);
  const res: Plage[] = [];
  for (const p of tri) {
    const der = res[res.length - 1];
    if (der && p.debut <= der.fin) der.fin = Math.max(der.fin, p.fin);
    else res.push({ ...p });
  }
  return res;
}

/**
 * Les plages OCCUPÉES d'un agenda iCalendar, dans `fenetre`. Pur : le texte et
 * la fenêtre sont donnés, aucune horloge n'est lue.
 */
export function lireAgendaIcs(texte: string, fenetre: Plage): LectureAgenda {
  const lignes = deplier(texte);
  const bruts: Brut[] = [];
  let ignores = 0;
  let approximes = 0;

  // Les composants imbriqués (VALARM) ne se lisent pas comme l'événement.
  const pile: string[] = [];
  let ev: Prop[] | null = null;
  const fermer = (props: Prop[]) => {
    const get = (n: string) => props.find((p) => p.nom === n);
    const dt = get("DTSTART");
    if (!dt) return;
    const lu = lireDate(dt);
    if (!lu.instant) return;
    const statut = get("STATUS")?.valeur.toUpperCase();
    const libre = get("TRANSP")?.valeur.toUpperCase() === "TRANSPARENT" || statut === "CANCELLED";
    let duree: number;
    const fin = get("DTEND");
    const dur = get("DURATION");
    if (fin) {
      const f = lireDate(fin).instant;
      duree = f ? f.t - lu.instant.t : 0;
    } else if (dur) duree = lireDuree(dur.valeur) ?? 0;
    else duree = lu.instant.journee ? JOUR_MS : 0;
    const rid = get("RECURRENCE-ID");
    const rrule = get("RRULE");
    bruts.push({
      uid: get("UID")?.valeur ?? `sans-uid-${bruts.length}`,
      debut: lu.instant,
      duree: Math.max(0, duree),
      regle: rrule ? lireRegle(rrule.valeur) : undefined,
      exdates: new Set(props.filter((p) => p.nom === "EXDATE").flatMap(lireDates)),
      rdates: props.filter((p) => p.nom === "RDATE").flatMap(lireDates),
      recurrenceId: rid ? lireDate(rid).instant?.t : undefined,
      libre,
      approx: lu.approx,
    });
  };

  for (const l of lignes) {
    const p = lirePropriete(l);
    if (!p) continue;
    if (p.nom === "BEGIN") {
      pile.push(p.valeur.toUpperCase());
      if (p.valeur.toUpperCase() === "VEVENT") ev = [];
      continue;
    }
    if (p.nom === "END") {
      const fini = pile.pop();
      if (fini === "VEVENT" && ev) {
        fermer(ev);
        ev = null;
      }
      continue;
    }
    if (ev && pile[pile.length - 1] === "VEVENT") ev.push(p);
  }

  // Les exceptions (RECURRENCE-ID) remplacent une occurrence de leur série.
  const remplacees = new Map<string, Set<number>>();
  for (const b of bruts) {
    if (b.recurrenceId === undefined) continue;
    const set = remplacees.get(b.uid) ?? new Set<number>();
    set.add(b.recurrenceId);
    remplacees.set(b.uid, set);
  }

  const plages: Plage[] = [];
  let evenements = 0;
  for (const b of bruts) {
    if (b.recurrenceId === undefined) evenements++;
    if (b.libre) {
      ignores++;
      continue;
    }
    if (b.approx) approximes++;
    const ajouter = (debut: number) => {
      const fin = debut + b.duree;
      if (fin >= fenetre.debut && debut <= fenetre.fin) plages.push({ debut, fin });
    };
    if (!b.regle || b.recurrenceId !== undefined) {
      ajouter(b.debut.t);
      continue;
    }
    const exclus = new Set([...b.exdates, ...(remplacees.get(b.uid) ?? [])]);
    const debuts = deplierRegle(b.regle, b.debut, fenetre.fin);
    if (debuts === null) {
      // ⚠ Règle non dépliable : on bloque la même heure CHAQUE JOUR de la
      // fenêtre (depuis le départ, jusqu'à UNTIL). Trop large, jamais trop étroit.
      if (!b.approx) approximes++;
      const { h, mi, s } = b.debut.murale;
      const premier = new Date(Math.max(fenetre.debut, b.debut.t) - JOUR_MS);
      for (let k = 0; k < 400; k++) {
        const jour = new Date(premier.getTime() + k * JOUR_MS);
        const t = heureMuraleVersUtc(jour.getUTCFullYear(), jour.getUTCMonth() + 1, jour.getUTCDate(), h, mi, s, b.debut.tz);
        if (t > fenetre.fin || (b.regle.until !== undefined && t > b.regle.until)) break;
        if (t >= b.debut.t) ajouter(t);
      }
      continue;
    }
    for (const t of [...debuts, ...b.rdates]) if (!exclus.has(t)) ajouter(t);
  }

  return { plages: fusionner(plages), evenements, approximes, ignores };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ADRESSE DE L'AGENDA — ce qu'on accepte de lire.
 *
 * `webcal://` est la même adresse en `https://` (c'est ce que fait l'agenda
 * qui s'y abonne). Seul `https` est accepté : une adresse secrète en clair sur
 * le réseau n'est plus secrète. Le garde-fou réseau (SSRF) est celui de la
 * lecture de site, rejoué à chaque redirection — ici on ne fait que la forme.
 * ─────────────────────────────────────────────────────────────────────
 */
export function adresseAgenda(saisie: string): string | null {
  const v = (saisie ?? "").trim().replace(/^webcals?:\/\//i, "https://");
  if (!/^https:\/\/[^\s]+$/i.test(v)) return null;
  try {
    return new URL(v).toString();
  } catch {
    return null;
  }
}

/** Un instant tombe-t-il dans (ou trop près de) une plage occupée ? */
export function plageQuiGene(debut: number, dureeMs: number, plages: Plage[], margeMs: number): Plage | null {
  const fin = debut + dureeMs;
  return plages.find((p) => debut < p.fin + margeMs && fin > p.debut - margeMs) ?? null;
}

/** Ce que le pilote sait de l'agenda, au moment où il propose ou confirme. */
export type EtatAgenda =
  | { etat: "absent" }
  | { etat: "lu"; plages: Plage[]; approximes: number }
  | { etat: "non-lu"; raison: string };

/**
 * La réponse de `/api/agenda`, relue côté navigateur. Tout ce qui n'est pas un
 * « lu » bien formé est `non-lu` — jamais une liste vide, qui se lirait « libre
 * toute la semaine ».
 */
export function lireReponseAgenda(j: unknown, status: number): EtatAgenda {
  const o = (j ?? {}) as { etat?: unknown; plages?: unknown; approximes?: unknown; raison?: unknown };
  if (o.etat === "lu" && Array.isArray(o.plages)) {
    const plages: Plage[] = [];
    for (const p of o.plages as { debut?: unknown; fin?: unknown }[]) {
      const debut = typeof p?.debut === "string" ? Date.parse(p.debut) : NaN;
      const fin = typeof p?.fin === "string" ? Date.parse(p.fin) : NaN;
      if (!Number.isFinite(debut) || !Number.isFinite(fin)) return { etat: "non-lu", raison: "réponse d'agenda illisible" };
      plages.push({ debut, fin });
    }
    return { etat: "lu", plages, approximes: typeof o.approximes === "number" ? o.approximes : 0 };
  }
  return { etat: "non-lu", raison: typeof o.raison === "string" && o.raison ? o.raison : `erreur ${status}` };
}
