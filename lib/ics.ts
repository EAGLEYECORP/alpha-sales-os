import type { Meeting, Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CALENDRIER — iCalendar (RFC 5545), sans OAuth, sans dépendance.
 *
 * Pourquoi cette voie plutôt que l'API Google/Microsoft :
 *
 * L'OAuth exige un projet Google Cloud, un enregistrement d'application
 * Microsoft, un écran de consentement, et le stockage de jetons de
 * rafraîchissement. Rien de tout ça n'est vérifiable depuis
 * l'environnement de développement — je livrerais du code que personne
 * n'a jamais vu tourner, sur le chemin critique d'un rendez-vous client.
 *
 * L'iCalendar donne l'essentiel immédiatement, et il le donne PARTOUT :
 * Google Agenda, Outlook / Teams, Apple Calendrier, Thunderbird. Deux
 * usages :
 *   · un FICHIER par rendez-vous — « ajouter à mon agenda », un clic ;
 *   · un FLUX abonnable — l'agenda se met à jour tout seul, ~15 min de
 *     latence côté Google, quelques minutes côté Apple.
 *
 * Ce que l'iCalendar ne fait pas, et qu'il faut savoir : la synchro est à
 * SENS UNIQUE (l'OS écrit, l'agenda lit), et il ne crée pas de lien Meet
 * ou Teams — seule l'API du fournisseur le peut. Le champ `calLink` de la
 * fiche accueille un lien collé à la main en attendant.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Horodatage iCalendar en UTC : 20260825T140000Z. */
export function icsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide : ${iso}`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Échappement RFC 5545 §3.3.11.
 *
 * L'ordre compte : la barre oblique inverse d'abord, sinon on ré-échappe
 * celles qu'on vient d'introduire. Une virgule non échappée coupe la valeur
 * en deux et l'agenda affiche un titre tronqué — un bug qu'on ne voit qu'au
 * moment où un vrai nom d'entreprise contient une virgule.
 */
export function icsEscape(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Pliage des lignes à 75 OCTETS (RFC 5545 §3.1).
 *
 * En octets, pas en caractères : « é » en compte deux en UTF-8. Plier au
 * mauvais endroit coupe un caractère en deux et certains agendas rejettent
 * le fichier entier — sur un rendez-vous client, c'est un rendez-vous perdu
 * pour une raison invisible.
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Ne jamais couper au milieu d'une séquence UTF-8 : on recule jusqu'au
    // début du caractère (les octets de continuation valent 10xxxxxx).
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(dec.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // les lignes suivantes commencent par une espace
  }
  return out.join("\r\n ");
}

const line = (k: string, v: string): string => foldLine(`${k}:${v}`);

export interface IcsEvent {
  uid: string;
  start: string;
  durationMin: number;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** Incrémenté à chaque modification — sans ça, l'agenda ignore la mise à jour. */
  sequence?: number;
  /** Rappel avant l'événement, en minutes. 0 = aucun. */
  alarmMin?: number;
  cancelled?: boolean;
}

/** Un événement, prêt à être inséré dans un VCALENDAR. */
export function icsEvent(e: IcsEvent, stamp: Date = new Date()): string {
  const end = new Date(new Date(e.start).getTime() + Math.max(1, e.durationMin) * 60_000).toISOString();
  const lines = [
    "BEGIN:VEVENT",
    line("UID", e.uid),
    line("DTSTAMP", icsDate(stamp.toISOString())),
    line("DTSTART", icsDate(e.start)),
    line("DTEND", icsDate(end)),
    line("SUMMARY", icsEscape(e.title)),
    line("SEQUENCE", String(e.sequence ?? 0)),
    // Un rendez-vous annulé doit être POUSSÉ comme annulé, pas retiré du
    // flux : retiré, il resterait affiché dans l'agenda de l'abonné.
    line("STATUS", e.cancelled ? "CANCELLED" : "CONFIRMED"),
  ];
  if (e.description) lines.push(line("DESCRIPTION", icsEscape(e.description)));
  if (e.location) lines.push(line("LOCATION", icsEscape(e.location)));
  if (e.url) lines.push(line("URL", e.url));

  if (e.alarmMin && e.alarmMin > 0) {
    lines.push(
      "BEGIN:VALARM",
      line("TRIGGER", `-PT${Math.round(e.alarmMin)}M`),
      "ACTION:DISPLAY",
      line("DESCRIPTION", icsEscape(e.title)),
      "END:VALARM"
    );
  }
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/**
 * Le calendrier complet.
 *
 * `METHOD:PUBLISH` (et non REQUEST) : on publie un agenda à lire, on
 * n'envoie pas d'invitation. REQUEST déclencherait des réponses
 * « accepté / refusé » vers une adresse d'organisateur qui n'existe pas.
 */
export function icsCalendar(events: string[], name = "ALPHA SALES OS"): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EAGLEYE CORP//ALPHA SALES OS//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    line("X-WR-CALNAME", icsEscape(name)),
    // Fréquence de rafraîchissement suggérée. Les agendas en font ce qu'ils
    // veulent (Google tourne autour de 15 min), mais ne rien dire, c'est
    // accepter le pire des cas par défaut.
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Un rendez-vous de l'OS → événement iCalendar, avec le contexte utile. */
export function meetingToIcs(m: Meeting, prospect?: Prospect, appUrl?: string): string {
  const desc: string[] = [];
  if (prospect) {
    desc.push(`${prospect.company}${prospect.name ? ` — ${prospect.name}` : ""}`);
    if (prospect.phone) desc.push(`Tél. ${prospect.phone}`);
    if (prospect.email) desc.push(prospect.email);
  }
  if (m.calLink) desc.push(`Visio : ${m.calLink}`);
  if (m.outcome) desc.push(`Issue : ${m.outcome}`);
  // Le lien vers la fiche : c'est ce qui transforme une ligne d'agenda en
  // préparation d'entretien, depuis le téléphone, en salle d'attente.
  if (prospect && appUrl) desc.push(`Fiche : ${appUrl.replace(/\/$/, "")}/prospects/${prospect.id}`);

  return icsEvent({
    // Stable et propre à cette app : c'est lui qui permet la MISE À JOUR
    // d'un rendez-vous plutôt qu'un doublon à chaque rafraîchissement.
    uid: `${m.id}@alpha-sales-os`,
    start: m.date,
    durationMin: m.durationMin || 60,
    title: m.title,
    description: desc.join("\n"),
    location: m.calLink || m.location,
    url: m.calLink,
    sequence: m.done ? 1 : 0,
    alarmMin: 30,
  });
}
