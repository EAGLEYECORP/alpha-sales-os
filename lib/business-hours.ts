/**
 * ─────────────────────────────────────────────────────────────────────
 * L'HEURE DU MÉTIER, pas celle du serveur.
 *
 * `Date.getHours()` rend l'heure du fuseau du PROCESSUS. En local, ça
 * ressemble à l'heure de Lyon, et tout a l'air juste. En production, une
 * fonction serverless tourne en UTC : en été, 9h00 UTC = 11h00 à Lyon.
 *
 * Conséquence concrète, et elle est grave : la fenêtre d'appel « 9h–12h »
 * devenait 11h–14h heure française. L'autopilote refusait donc d'appeler à
 * 9h du matin — le meilleur créneau chez les artisans — et appelait en
 * plein déjeuner, celui qu'on a explicitement décidé d'éviter. Le code
 * disait la bonne règle et faisait le contraire, sans jamais se plaindre.
 *
 * Tout ce qui décide « est-ce le bon moment » passe donc par ici, avec un
 * fuseau NOMMÉ. Par défaut Europe/Paris — Nuwacom se cadre sur
 * Europe/Luxembourg, d'où le paramètre.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le fuseau du métier. Lyon, sauf mention contraire. */
export const BUSINESS_TZ = "Europe/Paris";

export interface LocalTime {
  /** 0–23, dans le fuseau demandé. */
  hour: number;
  minute: number;
  /** 0 = dimanche … 6 = samedi, dans le fuseau demandé. */
  weekday: number;
  /** Vrai samedi ou dimanche, dans le fuseau demandé. */
  weekend: boolean;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * L'heure et le jour d'un instant, lus DANS un fuseau donné.
 *
 * On passe par `Intl` plutôt que par un décalage fixe : c'est la seule
 * façon correcte de gérer l'heure d'été. Un « +1 » codé en dur serait faux
 * la moitié de l'année, et faux au pire moment — les changements d'heure
 * tombent un week-end, donc le bug n'apparaît que le lundi.
 */
export function localTime(at: Date = new Date(), timeZone: string = BUSINESS_TZ): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // « 24 » apparaît à minuit dans certains environnements : on le ramène à 0.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = WEEKDAYS[get("weekday")] ?? at.getUTCDay();

  return { hour, minute, weekday, weekend: weekday === 0 || weekday === 6 };
}
