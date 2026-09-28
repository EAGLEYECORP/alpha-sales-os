import type { Stage } from "./types";
import { normalize } from "./speech-text";
import { OBJECTION_CUES } from "./live-assist";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Débriefing vocal post-terrain — l'extraction.
 *
 * Tu sors d'un rendez-vous, tu parles quarante secondes, et l'app en
 * tire l'interlocuteur, les objections, la prochaine étape DATÉE. C'est
 * là que le temps se perd réellement : pas dans l'envoi, dans la saisie
 * d'après-coup — celle qu'on repousse au soir et qu'on ne fait jamais.
 *
 * Deux moteurs, dans cet ordre :
 *   1. celui-ci, déterministe, hors-ligne, instantané ;
 *   2. l'IA (Ollama puis Anthropic), qui affine s'il y en a une.
 *
 * Le déterministe n'est pas un repli au rabais : il tourne sans modèle,
 * sans réseau, et il ne peut pas halluciner une date. Quand l'IA n'est
 * pas configurée — ce qui est le cas par défaut — c'est LUI la
 * fonctionnalité, pas un lot de consolation.
 *
 * Règle absolue : rien n'est écrit dans le CRM sans relecture humaine.
 * Cette fonction produit un BROUILLON.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface DebriefDraft {
  /** Nom de l'interlocuteur si on l'a entendu. */
  interlocutor?: string;
  /** Identifiants d'objections reconnues (catalogue live-assist). */
  objections: { id: string; label: string }[];
  /** Prochaine étape datée — l'invariant doctrine n° 1. */
  nextStep?: { date: string; action: string };
  /** Étape suggérée — JAMAIS appliquée d'office, seulement proposée. */
  stageHint?: Stage;
  /** Canal deviné : visite sur place ou appel. */
  channel: "visite" | "appel";
  /** Résumé d'une ligne pour la timeline. */
  summary: string;
  /** Le transcript nettoyé, conservé tel quel dans les notes. */
  notes: string;
  /** Ce que l'extraction n'a PAS trouvé — dit à l'écran, pas caché. */
  missing: string[];
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, quinze: 15, vingt: 20, trente: 30,
};

const iso = (d: Date) => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0); // midi : immunisé aux décalages de fuseau
  return x.toISOString();
};

const plus = (now: Date, days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Verbes qui annoncent la prochaine étape. Ils servent d'ancre : dans
 * « ils ratent des appels le samedi, je rappelle jeudi », c'est jeudi la
 * date, pas samedi. Sans cette ancre, le premier jour prononcé gagne —
 * et on pose un rendez-vous le mauvais jour.
 */
const ACTION_ANCHOR =
  /\b(rappelle|rappeler|rappellerai|repasse|repasser|repasserai|revient|reviens|revenir|envoie|envoyer|enverrai|relance|relancer|on se voit|rendez vous|rdv|je le vois|je passe)\b/;

/**
 * Date française parlée → ISO. Retourne null si aucune date n'est dite —
 * on ne devine JAMAIS une date : une prochaine étape inventée est pire
 * que pas de prochaine étape, parce qu'elle a l'air vraie.
 */
export function parseFrenchDate(text: string, now = new Date()): string | null {
  const whole = normalize(text);

  // On lit d'abord ce qui suit le verbe d'action : c'est là qu'est la
  // date de la prochaine étape. Le reste de la phrase parle du passé ou
  // d'habitudes (« ils ratent des appels le samedi »).
  const anchor = whole.search(ACTION_ANCHOR);
  if (anchor >= 0) {
    const after = scanDate(whole.slice(anchor), now);
    if (after) return after;
  }
  return scanDate(whole, now);
}

function scanDate(t: string, now: Date): string | null {

  if (/\bapres demain\b/.test(t)) return iso(plus(now, 2));
  if (/\bdemain\b/.test(t)) return iso(plus(now, 1));
  if (/\b(ce soir|aujourd hui|tout a l heure|en fin de journee)\b/.test(t)) return iso(now);

  // « dans 3 jours », « dans deux semaines », « dans un mois »
  const rel = t.match(/\bdans\s+(\d+|[a-z]+)\s+(jours?|semaines?|mois)\b/);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : NUMBER_WORDS[rel[1]];
    if (n && n <= 60) {
      if (rel[2].startsWith("jour")) return iso(plus(now, n));
      if (rel[2].startsWith("semaine")) return iso(plus(now, n * 7));
      const d = new Date(now);
      d.setMonth(d.getMonth() + n);
      return iso(d);
    }
  }

  if (/\b(la )?semaine prochaine\b/.test(t)) return iso(plus(now, 7));
  if (/\b(le )?mois prochain\b/.test(t)) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return iso(d);
  }

  // « le 12 septembre » — date explicite, la plus fiable quand elle est dite
  const full = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join("|")})\\b`));
  if (full) {
    const day = Number(full[1]);
    const month = MONTHS.indexOf(full[2]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), month, day);
      // Une date déjà passée désigne l'année suivante.
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
      return iso(d);
    }
  }

  // « jeudi », « jeudi prochain », « lundi matin » → prochaine occurrence stricte
  const day = t.match(new RegExp(`\\b(${DAYS.join("|")})\\b`));
  if (day) {
    const target = DAYS.indexOf(day[1]);
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // « jeudi » dit un jeudi = jeudi prochain
    if (/\ben (\d+ )?(semaines?|quinze jours)\b/.test(t) || /\bdans quinze jours\b/.test(t)) delta += 7;
    return iso(plus(now, delta));
  }

  // « le 12 » seul → prochaine occurrence de ce quantième
  const dom = t.match(/\ble\s+(\d{1,2})\b/);
  if (dom) {
    const n = Number(dom[1]);
    if (n >= 1 && n <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), n);
      if (d <= now) d.setMonth(d.getMonth() + 1);
      return iso(d);
    }
  }

  return null;
}

/** Verbe d'action de la prochaine étape, tel qu'il a été dit. */
function actionFrom(t: string): string | null {
  const rules: [RegExp, string][] = [
    [/\brepasser?\b|\breviens\b|\brepasse\b/, "Repasser sur place"],
    [/\brappeler?\b|\brappelle\b|\bje le rappelle\b/, "Rappeler"],
    [/\bdevis\b/, "Envoyer le devis"],
    [/\baudit\b/, "Envoyer l'audit"],
    [/\bdemo\b|\bdemonstration\b|\bmontrer\b/, "Faire la démo mobile"],
    [/\benvoyer\b|\benvoie\b|\bmail\b|\bmel\b/, "Envoyer le récapitulatif"],
    [/\brelancer?\b|\brelance\b/, "Relancer"],
    [/\brendez vous\b|\brdv\b/, "Rendez-vous"],
  ];
  for (const [re, label] of rules) if (re.test(t)) return label;
  return null;
}

/** Nom de l'interlocuteur — seulement s'il est explicitement nommé. */
function interlocutorFrom(raw: string): string | undefined {
  const patterns = [
    /(?:il|elle)\s+s['’]appelle\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]+(?:\s+[A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]+)?)/,
    /(?:le|la)\s+(?:g[ée]rant|patron|directeur|directrice|responsable|proprio|propri[ée]taire)\s*,?\s*(?:c['’]est|s['’]appelle)\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]+)/i,
    /j['’]ai\s+(?:vu|rencontr[ée]|parl[ée]\s+à|eu)\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]+)/,
    /(?:re[çc]u\s+par|avec)\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]+)\b/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const name = m[1].trim();
      // Un mot courant capitalisé en début de phrase n'est pas un prénom.
      if (!/^(Le|La|Les|Il|Elle|On|Je|Bon|Donc|Alors|Voilà)$/i.test(name)) return name;
    }
  }
  return undefined;
}

/** Étape suggérée — une suggestion, jamais une décision. */
function stageHintFrom(t: string): Stage | undefined {
  if (/\bpas interesse\b|\binteresse pas\b|\bne veut rien\b|\bil a dit non\b/.test(t)) return "perdu";
  if (/\bobjection\b|\btrop cher\b|\bil bloque\b|\bfrein\b/.test(t)) return "redzone";
  if (/\bdevis\b|\bproposition\b|\boffre envoyee\b|\bje lui ai fait un prix\b/.test(t)) return "offre";
  if (/\bdemo\b|\bje lui ai montre\b|\bmontre sur le telephone\b/.test(t)) return "demo";
  if (/\baudit\b|\bdiagnostic\b/.test(t)) return "audit";
  return undefined;
}

const CHANNEL_VISITE = /\bsur place\b|\bje suis passe\b|\bje sors de\b|\ben boutique\b|\bau comptoir\b|\bdans son garage\b|\bje suis alle\b/;

/**
 * Extrait un brouillon de débrief. Déterministe : mêmes mots, même
 * résultat. Ce qui n'est pas dit n'est pas inventé — c'est listé dans
 * `missing`, pour que l'opérateur sache quoi compléter.
 */
export function extractDebrief(transcript: string, now = new Date()): DebriefDraft {
  const raw = transcript.trim();
  const t = normalize(raw);

  const objections = OBJECTION_CUES.filter((o) =>
    o.cues.some((cue) => cue.every((token) => new RegExp(`\\b${token}`).test(t)))
  ).map((o) => ({ id: o.id, label: o.label }));

  const date = parseFrenchDate(raw, now);
  const action = actionFrom(t);
  const interlocutor = interlocutorFrom(raw);
  const stageHint = stageHintFrom(t);
  const channel: DebriefDraft["channel"] = CHANNEL_VISITE.test(t) ? "visite" : "appel";

  // Une prochaine étape n'existe que si elle est DATÉE. Une action sans
  // date ne se transforme pas en tâche : elle se signale comme manquante.
  const nextStep = date ? { date, action: action ?? "Reprendre contact" } : undefined;

  const missing: string[] = [];
  if (!date) missing.push("aucune date entendue — la prochaine étape doit être datée");
  if (!interlocutor) missing.push("interlocuteur non nommé");
  if (objections.length === 0) missing.push("aucune objection identifiée");

  // Résumé : la première phrase utile, bornée — la timeline reste lisible.
  const firstSentence = raw.split(/[.!?\n]/).map((s) => s.trim()).find((s) => s.length > 8) ?? raw;
  const summary = firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence;

  return {
    interlocutor,
    objections,
    nextStep,
    stageHint,
    channel,
    summary: summary || "Débrief terrain",
    notes: raw,
    missing,
  };
}
