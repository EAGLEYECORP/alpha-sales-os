import type { Prospect } from "./types";
import { deepDiveBatch, type DeepDive, type FitLevel } from "./deep-dive";
import { getAccount } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TRIAGE À L'IMPORT — ce que vaut vraiment le fichier qu'on vient de charger.
 *
 * Importer 1 000 lignes ne veut rien dire. Ce qui compte, immédiatement :
 *   · combien sont réellement appelables aujourd'hui (chauds) ;
 *   · combien partent chez QUEL compte (l'escalier de routage) ;
 *   · ce qui MANQUE le plus souvent — parce que c'est ça qu'il faut aller
 *     chercher en priorité, et c'est souvent une seule colonne du fichier ;
 *   · combien sont inexploitables — à dire franchement plutôt que de les
 *     laisser polluer le pipe et fausser tous les taux.
 *
 * Déterministe, hors-ligne, instantané : tourne sur tout le lot à l'import.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface GapCount {
  gap: string;
  count: number;
  /** Part du lot concernée (0-100). */
  pct: number;
}

export interface AccountSplit {
  accountId: string;
  accountName: string;
  count: number;
  /** Valeur estimée du lot pour ce compte (€, setup + 12 mois). */
  estimatedHT: number;
}

export interface ImportTriage {
  total: number;
  byFit: Record<FitLevel, number>;
  /** Les fiches à appeler en premier (les plus chaudes), déjà triées. */
  callFirst: DeepDive[];
  /** Répartition par compte, la plus grosse part d'abord. */
  accounts: AccountSplit[];
  /** Les trous les plus fréquents, du plus bloquant au moins. */
  topGaps: GapCount[];
  /** Fiches sans aucun moyen de contact — inexploitables en l'état. */
  unusable: number;
  /** Le verdict en une phrase, sans enrobage. */
  verdict: string;
}

export function triageImport(prospects: Prospect[], accountId = "eagleye"): ImportTriage {
  const dives = deepDiveBatch(prospects, accountId);
  const total = dives.length;

  const byFit: Record<FitLevel, number> = { chaud: 0, tiede: 0, froid: 0, "hors-icp": 0 };
  for (const d of dives) byFit[d.fit] += 1;

  // Répartition par compte + valeur estimée.
  const byAccount = new Map<string, { count: number; estimatedHT: number }>();
  for (const d of dives) {
    const p = prospects.find((x) => x.id === d.prospectId);
    const value = (p?.setupValue ?? 0) + (p?.monthlyValue ?? 0) * 12;
    const cur = byAccount.get(d.accountId) ?? { count: 0, estimatedHT: 0 };
    byAccount.set(d.accountId, { count: cur.count + 1, estimatedHT: cur.estimatedHT + value });
  }
  const accounts: AccountSplit[] = [...byAccount.entries()]
    .map(([id, v]) => ({ accountId: id, accountName: getAccount(id).name, ...v }))
    .sort((a, b) => b.count - a.count);

  // Les trous les plus fréquents — c'est la colonne à réclamer à la source.
  const gapCounts = new Map<string, number>();
  for (const d of dives) for (const g of d.gaps) gapCounts.set(g, (gapCounts.get(g) ?? 0) + 1);
  const topGaps: GapCount[] = [...gapCounts.entries()]
    .map(([gap, count]) => ({ gap, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const unusable = dives.filter((d) => d.gaps.some((g) => /contact direct/i.test(g))).length;

  const callFirst = dives.filter((d) => d.fit === "chaud" || d.fit === "tiede").slice(0, 25);

  // Le verdict : on ne félicite pas pour un gros fichier vide.
  const usable = byFit.chaud + byFit.tiede;
  const verdict =
    total === 0
      ? "Aucun prospect importé."
      : usable === 0
        ? `${total} fiches importées, mais AUCUNE n'est exploitable en l'état. Il manque l'essentiel — voir les trous ci-dessous avant de lancer quoi que ce soit.`
        : `${usable} fiches sur ${total} sont appelables (${byFit.chaud} chaudes). ` +
          `${unusable > 0 ? `${unusable} sont injoignables (ni téléphone ni email). ` : ""}` +
          `Commence par les ${Math.min(callFirst.length, 10)} premières — le reste attendra d'être complété.`;

  return { total, byFit, callFirst, accounts, topGaps, unusable, verdict };
}
