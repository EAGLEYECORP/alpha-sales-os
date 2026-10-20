import { fenetreOuverte } from "./conformite";
import type { Routine } from "./routines";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PRÉSENCE D'ALPHA — « ALPHA a besoin de toi », sur chaque écran.
 *
 * Décidé le 20/10/2026 : ALPHA doit se vivre comme un agent qui travaille et
 * qui PRÉVIENT quand un humain est nécessaire — pas comme un tableau qu'on
 * ouvre pour chercher quoi faire. Ce module est la moitié « prévenir ».
 *
 * ⚠⚠ UNE SEULE DÉFINITION DE « CE QUI ATTEND UN HUMAIN ». Elle existe déjà :
 * `computeRoutines` (`lib/routines.ts`), que lisent l'accueil, `/pilote` et
 * l'Agent ALPHA. Ce module ne recalcule RIEN — il lit ses résultats. La
 * cinquième définition de la même question est exactement le défaut que ce
 * dépôt a le plus payé : `/decisions`, `lib/priorites`, `lib/push-digest` et
 * `lib/alpha-ceo` posent chacun une variante, et personne ne vérifie qu'elles
 * répondent pareil.
 *
 * ── CE QUE ÇA NE FAIT PAS, ET IL FAUT LE DIRE ──
 *
 * Tout ceci tourne DANS LE NAVIGATEUR, onglet ouvert. Le CRM d'un compte
 * gratuit vit dans son `localStorage` : le serveur ne voit pas ses fiches
 * (c'est la promesse de souveraineté), donc il ne peut ni travailler à sa
 * place ni le prévenir app fermée. Un agent qui agit SANS l'onglet exige que
 * le pipe vive sur un serveur (`pipeServeur`, opt-in) et qu'un tick tourne par
 * locataire — ce qui n'existe aujourd'hui que pour notre pipe (opérateur) et
 * pour une installation « chez vous ». Ne pas le promettre à un inscrit.
 *
 * ── LES RÈGLES DE LA NOTIFICATION (celles de `lib/push-digest.ts`) ──
 *
 *  1. Hors fenêtre utile, on se tait (`fenetreOuverte`, la même que le push).
 *  2. UNE notification par passage : « 3 nouveaux » en une seule, jamais trois.
 *  3. Seules les routines de priorité HAUTE interrompent — une relecture de
 *     campagne ou un point satisfaction attendent qu'on ouvre l'app.
 *  4. Au chargement on NE notifie PAS : l'état de départ est une ligne de
 *     base, pas une nouveauté. Sinon chaque ouverture de l'onglet rejouerait
 *     tout l'arriéré.
 *  5. Un intervalle minimal entre deux notifications.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatPresence = "attend" | "rien";

export interface PresenceAlpha {
  etat: EtatPresence;
  /** Routines de priorité haute ou moyenne : ce qui attend un humain. */
  aToi: number;
  /** Dont les HAUTES — ce qui ne se rattrape pas en attendant. */
  urgentes: number;
  /** La première chose à faire, ou `null` quand rien n'attend. */
  premiere: Routine | null;
  /** Ce que dit la bande. */
  phrase: string;
  /** Préfixe de l'onglet : « (3) », ou rien. */
  prefixeOnglet: string;
}

const RANG = { haute: 0, moyenne: 1, basse: 2 } as const;

export function presenceAlpha(routines: Routine[]): PresenceAlpha {
  const attendent = routines
    .filter((r) => r.priority !== "basse")
    .sort((a, b) => RANG[a.priority] - RANG[b.priority]);
  const urgentes = attendent.filter((r) => r.priority === "haute").length;
  const n = attendent.length;

  if (n === 0) {
    return { etat: "rien", aToi: 0, urgentes: 0, premiere: null, phrase: "Rien n'attend de décision.", prefixeOnglet: "" };
  }
  const pluriel = n > 1;
  return {
    etat: "attend",
    aToi: n,
    urgentes,
    premiere: attendent[0],
    phrase:
      urgentes > 0
        ? `${n} ${pluriel ? "choses attendent" : "chose attend"} un humain, dont ${urgentes} urgente${urgentes > 1 ? "s" : ""}.`
        : `${n} ${pluriel ? "choses attendent" : "chose attend"} un humain.`,
    prefixeOnglet: `(${n > 99 ? "99+" : n}) `,
  };
}

// ── LA NOTIFICATION ────────────────────────────────────────────────────

/** Entre deux notifications : une rafale de rappels n'est plus un signal. */
export const INTERVALLE_NOTIFICATION_MS = 10 * 60_000;

export interface EtatNotification {
  /** Les routines HAUTES déjà connues. `null` = premier passage : ligne de base. */
  vus: ReadonlySet<string> | null;
  /** Quand la dernière notification est partie (ms), ou `null`. */
  dernierEnvoiMs: number | null;
}

export const ETAT_NOTIFICATION_INITIAL: EtatNotification = { vus: null, dernierEnvoiMs: null };

export interface MessageNotification {
  title: string;
  body: string;
  /** L'écran où l'action se fait — jamais l'accueil. */
  url: string;
  /** Remplace la notification précédente du même sujet au lieu d'empiler. */
  tag: string;
}

/**
 * Faut-il interrompre l'opérateur MAINTENANT, et par quoi ?
 *
 * Pure : l'horloge et l'état précédent sont injectés, la fonction rend le
 * message ET l'état suivant. Rien n'est lu ni écrit en cachette.
 *
 * ⚠ Une nouveauté qu'on a tue (hors fenêtre, ou trop tôt après la précédente)
 * RESTE nouvelle : elle n'entre pas dans `vus`. Sinon une fiche en retard qui
 * apparaît à 23 h ne serait jamais notifiée — on l'aurait marquée « vue » sans
 * l'avoir dite.
 */
export function prochaineNotification(
  etat: EtatNotification,
  routines: Routine[],
  maintenant: Date
): { message: MessageNotification | null; suivant: EtatNotification } {
  const hautes = routines.filter((r) => r.priority === "haute");
  const ids = new Set(hautes.map((r) => r.id));

  // Règle 4 — le premier passage est une ligne de base, pas une nouveauté.
  if (etat.vus === null) return { message: null, suivant: { ...etat, vus: ids } };

  const nouvelles = hautes.filter((r) => !etat.vus!.has(r.id));
  const connues = new Set([...etat.vus].filter((id) => ids.has(id)));
  if (nouvelles.length === 0) return { message: null, suivant: { ...etat, vus: connues } };

  const fenetreUtile = fenetreOuverte(maintenant).open;
  const assezTard = etat.dernierEnvoiMs === null || maintenant.getTime() - etat.dernierEnvoiMs >= INTERVALLE_NOTIFICATION_MS;
  if (!fenetreUtile || !assezTard) return { message: null, suivant: { ...etat, vus: connues } };

  const [premiere] = nouvelles;
  const autres = nouvelles.length - 1;
  return {
    message: {
      title: autres > 0 ? `ALPHA a besoin de toi — ${nouvelles.length} nouveaux` : "ALPHA a besoin de toi",
      body: `${premiere.title}${premiere.detail ? ` — ${premiere.detail}` : ""}${autres > 0 ? ` (+${autres} autre${autres > 1 ? "s" : ""})` : ""}`,
      url: premiere.href,
      tag: "alpha-besoin",
    },
    // Règle 2 : tout ce qui est nouveau part dans CETTE notification.
    suivant: { vus: ids, dernierEnvoiMs: maintenant.getTime() },
  };
}
