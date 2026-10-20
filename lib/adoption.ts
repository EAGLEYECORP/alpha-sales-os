import {
  MUR_EMAILS_PAR_HEURE_SUPPOSE,
  etatDuMur,
  type ComptesCrees,
  type EtatMur,
} from "./comptes-crees";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ADOPTION D'ALPHA SALES OS — le tableau de bord des PROPRIÉTAIRES.
 *
 * Décidé le 20/10/2026 : « alpha sales os dépasse EAGLEYE CORP maintenant ».
 * Le produit est fait pour être utilisé par des gens qui n'ont rien à voir
 * avec notre société ; le chiffre qui dit s'ils l'utilisent est NOTRE tableau
 * de bord, pas une tuile de la console qu'on livre aux installations client.
 * Il a donc quitté `/ceo` (livré chez le client) pour son propre écran,
 * `/adoption`, maître seul — la même famille que `/payouts` et `/offre`.
 *
 * ── CE QUE ÇA MESURE, ET CE QUE ÇA NE MESURERA JAMAIS ──
 *
 * Des COMPTES : combien sont nés, combien ont confirmé leur adresse, combien se
 * sont connectés. C'est tout ce que le serveur sait, et ce n'est pas une
 * lacune : le CRM d'un compte gratuit vit dans son navigateur, aucune table
 * d'usage n'existe, et « rien de ce qui touche la donnée MÉTIER ne passe par un
 * tiers » est l'argument de souveraineté qui tient la vitrine. Mesurer ce
 * qu'un inscrit FAIT dans l'app (fiches, appels, rendez-vous) serait une
 * télémétrie — **elle se décide, elle ne se code pas en douce** (CLAUDE.md,
 * « tarifer chacun sur ce qu'Alpha lui a rapporté »).
 *
 * ── LES RÈGLES QUI EMPÊCHENT DE SE MENTIR ──
 *
 * · `null` n'est pas `0` : une base injoignable ne dit pas « personne ».
 * · Les comptes des PROPRIÉTAIRES sont exclus — le palier « 10 » dit « dix
 *   comptes qui ne sont pas les nôtres ». Et quand l'exclusion n'a pas eu lieu
 *   (repli, ou `OWNER_EMAILS` vide), l'écran le dit.
 * · Jamais un taux nu : « 41 confirmés sur 50 », pas « 82 % ».
 * · « Connectés » SOUS-COMPTE l'usage réel : `last_sign_in_at` est la dernière
 *   saisie du mot de passe, pas la dernière visite.
 * ─────────────────────────────────────────────────────────────────────
 */

/** D'où viennent les chiffres. `aucune` = on ne sait rien, et on le dit. */
export type SourceAdoption = "base" | "api-admin" | "aucune";

export interface JourAdoption {
  /** AAAA-MM-JJ, heure de Paris. */
  jour: string;
  n: number;
}

export interface Adoption {
  source: SourceAdoption;
  /** Comptes existants (hors les nôtres quand l'exclusion a eu lieu). */
  total: number | null;
  confirmes: number | null;
  inscrits1h: number | null;
  inscrits24h: number | null;
  inscrits7j: number | null;
  inscrits30j: number | null;
  connectes24h: number | null;
  connectes7j: number | null;
  connectes30j: number | null;
  /** Les jours où quelqu'un s'est inscrit (les jours à zéro sont ajoutés à l'affichage). */
  parJour: JourAdoption[] | null;
  /** Les comptes des propriétaires sont-ils EXCLUS du total ? */
  excluLesNotres: boolean;
  /** Vrai quand `inscrits1h` n'est qu'un plancher (lecture des 100 plus récents). */
  heureMinimum: boolean;
  /** Ce qui manque et pourquoi. `null` quand tout est lu. */
  raison: string | null;
}

const AVEUGLE = (raison: string): Adoption => ({
  source: "aucune",
  total: null,
  confirmes: null,
  inscrits1h: null,
  inscrits24h: null,
  inscrits7j: null,
  inscrits30j: null,
  connectes24h: null,
  connectes7j: null,
  connectes30j: null,
  parJour: null,
  excluLesNotres: false,
  heureMinimum: false,
  raison,
});

/** Le pas à franchir, du plus petit au plus grand — `docs/OBJECTIF-10M.md`, § 3. */
export const PALIERS_ADOPTION = [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000] as const;

export interface PositionPalier {
  /** Le plus haut palier atteint, ou `null` si on n'en a atteint aucun. */
  atteint: number | null;
  /** Le suivant, ou `null` une fois le dernier atteint. */
  prochain: number | null;
  /** Combien de comptes manquent pour le suivant. */
  manque: number | null;
}

export function positionPalier(total: number | null): PositionPalier | null {
  if (total === null) return null;
  const atteint = [...PALIERS_ADOPTION].reverse().find((p) => total >= p) ?? null;
  const prochain = PALIERS_ADOPTION.find((p) => total < p) ?? null;
  return { atteint, prochain, manque: prochain === null ? null : prochain - total };
}

// ── LA LECTURE ─────────────────────────────────────────────────────────

type ReponseRpc = { data: unknown; error: { message?: string; code?: string } | null };
/** `supabase.rpc(nom, args)`, réduit à ce dont on a besoin — testable sans réseau. */
export type AppelRpc = (nom: string, args: Record<string, unknown>) => PromiseLike<ReponseRpc>;

export interface SourcesAdoption {
  /** `null` quand Supabase n'est pas configuré. */
  rpc: AppelRpc | null;
  /** Le repli : la liste d'administration (total + dernière heure seulement). */
  repli: () => Promise<ComptesCrees>;
  /** Adresses des propriétaires, à exclure du compte. Jamais stockées. */
  exclure: string[];
}

/** Un entier ≥ 0, ou `null` — jamais un texte, jamais un NaN, jamais un négatif. */
const entier = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;

function lireJours(v: unknown): JourAdoption[] | null {
  if (!Array.isArray(v)) return null;
  const jours: JourAdoption[] = [];
  for (const x of v) {
    const jour = (x as { jour?: unknown })?.jour;
    const n = entier((x as { n?: unknown })?.n);
    if (typeof jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(jour) && n !== null) jours.push({ jour, n });
  }
  return jours;
}

const MIGRATION_ABSENTE =
  "La fonction `adoption_stats` n'est pas installée : applique `supabase/migrations/017-adoption.sql` dans l'éditeur SQL de Supabase pour voir les confirmations, les connexions et la courbe.";

export async function lireAdoption(src: SourcesAdoption): Promise<Adoption> {
  const exclure = src.exclure.map((e) => e.trim().toLowerCase()).filter(Boolean);

  if (src.rpc) {
    let rep: ReponseRpc | null = null;
    try {
      rep = await src.rpc("adoption_stats", { exclure });
    } catch {
      rep = null;
    }
    const d = rep && !rep.error ? (rep.data as Record<string, unknown> | null) : null;
    if (d && typeof d === "object" && !Array.isArray(d) && entier(d.total) !== null) {
      const adoption: Adoption = {
        source: "base",
        total: entier(d.total),
        confirmes: entier(d.confirmes),
        inscrits1h: entier(d.inscrits_1h),
        inscrits24h: entier(d.inscrits_24h),
        inscrits7j: entier(d.inscrits_7j),
        inscrits30j: entier(d.inscrits_30j),
        connectes24h: entier(d.connectes_24h),
        connectes7j: entier(d.connectes_7j),
        connectes30j: entier(d.connectes_30j),
        parJour: lireJours(d.par_jour),
        excluLesNotres: exclure.length > 0,
        heureMinimum: false,
        raison: exclure.length > 0 ? null : "OWNER_EMAILS est vide : nos propres comptes sont comptés.",
      };
      return adoption;
    }
  }

  // Repli : la liste d'administration. Elle ne sait ni exclure les nôtres ni
  // compter les confirmations — et on ne fait pas semblant du contraire.
  const l = await src.repli();
  if (l.total === null && l.derniereHeure === null) {
    return AVEUGLE(l.raison ?? "Supabase ne répond pas.");
  }
  return {
    ...AVEUGLE(""),
    source: "api-admin",
    total: l.total,
    inscrits1h: l.derniereHeure,
    heureMinimum: l.derniereHeureMinimum,
    excluLesNotres: false,
    raison: src.rpc
      ? MIGRATION_ABSENTE
      : [l.raison, "Supabase n'est pas configuré pour la lecture agrégée."].filter(Boolean).join(" "),
  };
}

// ── L'AFFICHAGE, DÉCIDÉ ICI POUR ÊTRE TESTABLE ─────────────────────────

/** AAAA-MM-JJ en heure de Paris. */
export function jourDeParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Les 30 derniers jours, jour par jour, du plus ancien à aujourd'hui.
 *
 * Les jours sans inscription valent 0 — un VRAI zéro, parce que la base a
 * répondu. Quand la source n'est pas la base, il n'y a pas de courbe (`null`) :
 * remplir de zéros une lecture qu'on n'a pas faite serait inventer une semaine
 * creuse.
 */
export function serie30Jours(parJour: JourAdoption[] | null, maintenant: Date): JourAdoption[] | null {
  if (parJour === null) return null;
  const connus = new Map(parJour.map((j) => [j.jour, j.n]));
  const [a, m, j] = jourDeParis(maintenant).split("-").map(Number);
  const midi = Date.UTC(a, m - 1, j, 12);
  const serie: JourAdoption[] = [];
  for (let i = 29; i >= 0; i--) {
    const jour = new Date(midi - i * 86_400_000).toISOString().slice(0, 10);
    serie.push({ jour, n: connus.get(jour) ?? 0 });
  }
  return serie;
}

export interface AffichageAdoption {
  total: string;
  palier: string;
  inscrits: { h1: string; j1: string; j7: string; j30: string };
  confirmation: string;
  connexions: { j1: string; j7: string; j30: string };
  etatMur: EtatMur;
  mur: string;
  /** Les réserves à lire AVANT les chiffres, de la plus grave à la moins grave. */
  reserves: string[];
}

const nb = (v: number | null): string => (v === null ? "—" : new Intl.NumberFormat("fr-FR").format(v));

export function affichageAdoption(a: Adoption | null): AffichageAdoption {
  const reserveMur = `Mur supposé : ~${MUR_EMAILS_PAR_HEURE_SUPPOSE} inscriptions par heure (emails de confirmation) — chiffre secondaire, non lu dans Supabase (Authentication → Rate Limits).`;
  if (!a) {
    return {
      total: "—",
      palier: "Palier inconnu — le compteur n'a pas répondu.",
      inscrits: { h1: "—", j1: "—", j7: "—", j30: "—" },
      confirmation: "—",
      connexions: { j1: "—", j7: "—", j30: "—" },
      etatMur: "inconnu",
      mur: reserveMur,
      reserves: ["Le compteur n'a pas répondu — ce n'est pas « zéro compte »."],
    };
  }

  const pos = positionPalier(a.total);
  const palier = !pos
    ? "Palier inconnu."
    : pos.prochain === null
      ? `Dernier palier atteint (${nb(pos.atteint)}).`
      : `${pos.atteint === null ? "Aucun palier atteint" : `Palier ${nb(pos.atteint)} atteint`} · prochain ${nb(pos.prochain)} : il manque ${nb(pos.manque)}.`;

  // Jamais un taux nu : le numérateur ET le dénominateur.
  const confirmation =
    a.confirmes === null || a.total === null
      ? "—"
      : `${nb(a.confirmes)} confirmés sur ${nb(a.total)} · ${nb(Math.max(0, a.total - a.confirmes))} sans confirmation`;

  const reserves: string[] = [];
  if (a.raison) reserves.push(a.raison);
  if (a.source !== "aucune" && !a.excluLesNotres) {
    reserves.push("Nos propres comptes ne sont PAS exclus du total : le palier « 10 » veut dix comptes qui ne sont pas les nôtres.");
  }
  if (a.heureMinimum) reserves.push("La dernière heure est un PLANCHER : les 100 comptes les plus récents sont tous dedans.");
  if (a.source === "base") {
    reserves.push(
      "« Connectés » sous-compte l'usage réel : c'est la dernière saisie du mot de passe, pas la dernière visite — une session reste ouverte des semaines."
    );
  }

  return {
    total: nb(a.total),
    palier,
    inscrits: {
      h1: a.inscrits1h === null ? "—" : `${a.heureMinimum ? "≥ " : ""}${nb(a.inscrits1h)}`,
      j1: nb(a.inscrits24h),
      j7: nb(a.inscrits7j),
      j30: nb(a.inscrits30j),
    },
    confirmation,
    connexions: { j1: nb(a.connectes24h), j7: nb(a.connectes7j), j30: nb(a.connectes30j) },
    etatMur: etatDuMur({ total: a.total, derniereHeure: a.inscrits1h, derniereHeureMinimum: a.heureMinimum, raison: null }),
    mur: reserveMur,
    reserves,
  };
}
