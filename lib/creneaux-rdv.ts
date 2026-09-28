import { prochaineFenetreOuverte } from "@/lib/call-cadence";
import { BUSINESS_TZ } from "@/lib/business-hours";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PROPOSER DE VRAIS CRÉNEAUX — B3 de la boucle, sans doubler un RDV.
 *
 * Décidé le 28/09/2026. Quand un prospect dit « oui, parlons-nous »
 * (`veut-rdv`), la réponse auto proposait deux créneaux FIXES (« mardi 15h ou
 * jeudi 10h ») — faux dès que ces heures sont passées ou déjà prises. Ce module
 * calcule les prochains créneaux RÉELS : dans les heures ouvrées (une seule
 * définition, `fenetreOuverte`), en ÉVITANT les rendez-vous déjà calés
 * (« jamais doubler un RDV »), avec un préavis raisonnable.
 *
 * ⚠ On ne construit JAMAIS une heure locale à la main (le calcul de fuseau qui
 * se trompe une fois par an, en silence) : on réutilise `prochaineFenetreOuverte`
 * et on avance par pas d'heure entière — le décalage de Paris est en heures
 * pleines, donc un epoch calé sur l'heure tombe sur `:00` local. Le CLOSE reste
 * humain ; ceci ne fait que PROPOSER.
 * ─────────────────────────────────────────────────────────────────────
 */

const HEURE_MS = 3_600_000;
/** Même espacement minimal que la cadence : on ne colle pas un créneau à un RDV. */
const COLLISION_MS = 3 * HEURE_MS;
/** On ne propose pas « dans une heure » : 24 h de préavis par défaut. */
const PREAVIS_DEFAUT_MS = 24 * HEURE_MS;

function floorHeure(t: number): number {
  return Math.floor(t / HEURE_MS) * HEURE_MS;
}

/**
 * Les `n` prochains créneaux ouverts (un par jour), à partir de `maintenant`,
 * en sautant ceux qui collent à un RDV de `occupes`. Déterministe : `maintenant`
 * est injecté, jamais lu de l'horloge.
 */
export function prochainsCreneaux(
  maintenant: Date,
  opts: { n?: number; occupes?: Date[]; minPreavisMs?: number } = {},
): Date[] {
  const n = Math.max(1, Math.min(opts.n ?? 3, 5));
  const occupes = (opts.occupes ?? []).map((d) => d.getTime()).filter((t) => Number.isFinite(t));
  const preavis = opts.minPreavisMs ?? PREAVIS_DEFAUT_MS;

  const res: Date[] = [];
  let curseur = floorHeure(maintenant.getTime() + preavis);
  let garde = 0;
  while (res.length < n && garde < 2000) {
    garde++;
    const slot = prochaineFenetreOuverte(new Date(curseur));
    const st = slot.getTime();
    if (st <= maintenant.getTime()) {
      curseur = floorHeure(st + HEURE_MS);
      continue;
    }
    const collision =
      occupes.some((o) => Math.abs(o - st) < COLLISION_MS) || res.some((r) => Math.abs(r.getTime() - st) < COLLISION_MS);
    if (collision) {
      // Un créneau plus tard le même jour peut convenir : on avance d'un cran.
      curseur = floorHeure(st + COLLISION_MS);
      continue;
    }
    res.push(new Date(st));
    // Jour suivant : +20 h garantit un autre jour (deux créneaux ≥ 20 h d'écart).
    curseur = floorHeure(st + 20 * HEURE_MS);
  }
  return res;
}

/** Un créneau, en français, dans le fuseau métier — jamais reformaté à la main. */
export function labelCreneau(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: BUSINESS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function labelsCreneaux(dates: Date[]): string[] {
  return dates.map(labelCreneau);
}
