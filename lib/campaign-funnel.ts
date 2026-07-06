import type { Prospect, Stage } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Funnel de campagne — taux réels dérivés du tracking (par campaignId) ×
 * pipeline. Base = personnes touchées (dédupliquées par prospect) :
 *   délivré(nospam) → ouvert → réponse → follow-thru → follow-up → closed
 *   + LTV signée + satisfaction moyenne.
 *
 * Note honnête : sans ESP, on ne détecte pas le spam ni les bounces — on
 * considère « délivré » = envoyé. « réponse » et « follow-thru » sont dérivés
 * de l'avancement des prospects touchés (≥ audit, ≥ démo).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface FunnelRecord {
  id: string;
  campaignId?: string;
  prospectId?: string;
  opens: number;
  clicks: number;
}

export interface CampaignFunnel {
  people: number; // personnes touchées (délivré)
  sends: number; // nombre d'emails partis (≥ people si relances)
  opened: number;
  clicked: number;
  responded: number;
  followThru: number;
  followUp: number;
  closed: number;
  ltv: number;
  satisfaction: number | null; // moyenne /100 sur les signés (null si aucun)
}

const RANK: Record<Stage, number> = {
  prospect: 0, contact: 1, audit: 2, demo: 3, offre: 4, redzone: 5, signe: 6, perdu: -1,
};

export function computeCampaignFunnel(records: FunnelRecord[], prospects: Prospect[]): CampaignFunnel {
  const byPerson = new Map<string, { sends: number; opened: boolean; clicked: boolean; prospectId?: string }>();
  for (const r of records) {
    const key = r.prospectId || `anon:${r.id}`;
    const cur = byPerson.get(key) ?? { sends: 0, opened: false, clicked: false, prospectId: r.prospectId };
    cur.sends += 1;
    if (r.opens > 0) cur.opened = true;
    if (r.clicks > 0) cur.clicked = true;
    byPerson.set(key, cur);
  }

  let opened = 0, clicked = 0, followUp = 0, responded = 0, followThru = 0, closed = 0, ltv = 0;
  let satSum = 0, satN = 0;
  const byId = new Map(prospects.map((p) => [p.id, p]));

  for (const agg of byPerson.values()) {
    if (agg.opened) opened++;
    if (agg.clicked) clicked++;
    if (agg.sends > 1) followUp++;
    const p = agg.prospectId ? byId.get(agg.prospectId) : undefined;
    if (p) {
      const rank = RANK[p.stage];
      if (rank >= RANK.audit) responded++;
      if (rank >= RANK.demo) followThru++;
      if (p.stage === "signe") {
        closed++;
        ltv += p.setupValue + p.monthlyValue * 12;
        if (p.satisfaction !== undefined) {
          satSum += p.satisfaction;
          satN += 1;
        }
      }
    }
  }

  return {
    people: byPerson.size,
    sends: records.length,
    opened,
    clicked,
    responded,
    followThru,
    followUp,
    closed,
    ltv,
    satisfaction: satN > 0 ? Math.round(satSum / satN) : null,
  };
}

export function pct(n: number, base: number): number {
  return base > 0 ? Math.round((n / base) * 100) : 0;
}
