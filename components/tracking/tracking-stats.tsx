"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, MailOpen, MousePointerClick, RefreshCw, Send, TrendingUp } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Sector } from "@/lib/types";
import { LIBELLE_SECTEUR } from "@/lib/secteurs";
import { cn, dateTimeFr } from "@/lib/utils";

/* ── Types (miroir de lib/tracking.ts) ─────────────────────────────── */
interface TrackedLink {
  idx: number;
  url: string;
  clicks: number;
}
interface TrackRecord {
  id: string;
  channel: string;
  prospectId?: string;
  campaignId?: string;
  email?: string;
  subject?: string;
  createdAt: string;
  opens: number;
  clicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  links: TrackedLink[];
}
interface Summary {
  messages: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
  records: TrackRecord[];
}

const EMPTY: Summary = { messages: 0, opens: 0, clicks: 0, openRate: 0, clickRate: 0, records: [] };

/**
 * ⚠ Troisieme copie de la meme table de libelles, trouvee par le compilateur
 * en ajoutant un secteur. Elle vit maintenant dans `lib/secteurs.ts` : une
 * copie oubliee affiche « undefined » dans une colonne, ce qui ne casse rien
 * et ne se remarque que sur une capture d'ecran.
 */
const SECTOR_LABELS = LIBELLE_SECTEUR;

function useStats(qs: string) {
  const [data, setData] = useState<Summary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/track/stats${qs}`);
      const json = (await res.json()) as Summary & { error?: string };
      if (json.error) setError(json.error);
      else setData({ ...EMPTY, ...json, records: json.records ?? [] });
    } catch {
      setError("Réseau — réessaie.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/**
 * Le taux d'ouverture ment, et il faut le dire à l'écran.
 *
 * Apple Mail Privacy Protection précharge les images de tous les messages,
 * ouverts ou non ; Gmail les fait passer par son proxy. Résultat : des
 * ouvertures comptées pour des messages que personne n'a lus, et des
 * ouvertures manquées chez ceux qui bloquent les images. Un taux
 * d'ouverture est un indicateur de tendance, pas une mesure.
 *
 * Le clic, lui, demande un geste humain délibéré. C'est le seul des deux
 * sur lequel on prend une décision — et la réponse reste au-dessus des
 * deux.
 */
function RateCaveat() {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-paper-faint">
      <Info size={12} className="mt-0.5 shrink-0" />
      <span>
        Le <b>taux d&apos;ouverture</b> est indicatif : Apple et Gmail préchargent les images, ce qui gonfle les
        ouvertures et en masque d&apos;autres. Le <b>taux de clic</b> demande un geste réel — c&apos;est lui qui décide.
        Et une réponse vaut plus que les deux.
      </span>
    </p>
  );
}

/* ── Tuiles KPI ────────────────────────────────────────────────────── */
function Tiles({ s }: { s: Summary }) {
  const tiles = [
    { icon: <Send size={14} />, label: "Messages", value: s.messages, tone: "paper" },
    { icon: <MailOpen size={14} />, label: "Ouvertures", value: s.opens, tone: "paper" },
    { icon: <MousePointerClick size={14} />, label: "Clics", value: s.clicks, tone: "bronze" },
    { icon: <TrendingUp size={14} />, label: "Taux d'ouverture", value: `${s.openRate}%`, tone: "paper" },
    { icon: <TrendingUp size={14} />, label: "Taux de clic", value: `${s.clickRate}%`, tone: "bronze" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-paper-faint">
            <span className="text-bronze-500">{t.icon}</span> {t.label}
          </p>
          <p className={cn("mt-1 font-mono text-lg", t.tone === "bronze" ? "text-bronze-400" : "text-paper")}>
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Bar({ pct, tone = "bronze" }: { pct: number; tone?: "bronze" | "green" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={cn("h-full rounded-full", tone === "green" ? "bg-signal-green" : "bg-bronze-500")}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function RefreshBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={onClick} disabled={loading}>
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "…" : "Rafraîchir"}
    </button>
  );
}

/* ── Panneau par CLIENT ────────────────────────────────────────────── */
export function ClientTrackingStats({ prospectId }: { prospectId: string }) {
  const { data, loading, error, reload } = useStats(`?prospectId=${encodeURIComponent(prospectId)}`);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <MousePointerClick size={15} className="text-bronze-400" /> Tracking email de ce client
          </h2>
          <p className="mt-0.5 text-[11px] text-paper-faint">
            Ouvertures & clics des emails envoyés depuis l&apos;app à ce prospect.
          </p>
        </div>
        <RefreshBtn onClick={reload} loading={loading} />
      </div>

      <div className="mt-3">
        <Tiles s={data} />
        <RateCaveat />
      </div>

      {error && <p className="mt-3 text-[12px] text-signal-red">{error}</p>}

      {data.records.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.records.map((r) => (
            <li key={r.id} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm text-paper" title={r.subject}>
                  {r.subject || "(sans objet)"}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-paper-faint">{dateTimeFr(r.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px]">
                <span className="flex items-center gap-1 text-paper-dim">
                  <MailOpen size={12} className="text-bronze-500" /> {r.opens} ouverture{r.opens > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-bronze-400">
                  <MousePointerClick size={12} /> {r.clicks} clic{r.clicks > 1 ? "s" : ""}
                </span>
                {r.lastOpenAt && (
                  <span className="text-paper-faint">dernière ouverture {dateTimeFr(r.lastOpenAt)}</span>
                )}
              </div>
              {r.links.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-ink-700 pt-2">
                  {r.links.map((l) => (
                    <li key={l.idx} className="flex items-center gap-2 text-[11px]">
                      <span className="w-10 shrink-0 font-mono text-bronze-400">{l.clicks}×</span>
                      <span className="min-w-0 truncate text-paper-faint" title={l.url}>
                        {l.url}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !loading && (
          <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[12px] text-paper-faint">
            Aucun email tracké pour ce prospect. Envoie un email depuis l&apos;onglet Templates — les ouvertures et
            clics apparaîtront ici automatiquement.
          </p>
        )
      )}
    </section>
  );
}

/* ── Panneau par INDUSTRIE ─────────────────────────────────────────── */
interface SectorAgg {
  sector: Sector;
  messages: number;
  opens: number;
  clicks: number;
  openedMsgs: number;
  clickedMsgs: number;
}

export function IndustryTrackingStats() {
  const { prospects } = useAlpha();
  const { data, loading, error, reload } = useStats("");

  const byId = useMemo(() => {
    const m = new Map<string, Sector>();
    for (const p of prospects) m.set(p.id, p.sector);
    return m;
  }, [prospects]);

  const agg = useMemo(() => {
    const map = new Map<Sector, SectorAgg>();
    for (const r of data.records) {
      const sector = (r.prospectId && byId.get(r.prospectId)) || "autre";
      const cur =
        map.get(sector) ??
        { sector, messages: 0, opens: 0, clicks: 0, openedMsgs: 0, clickedMsgs: 0 };
      cur.messages += 1;
      cur.opens += r.opens;
      cur.clicks += r.clicks;
      if (r.opens > 0) cur.openedMsgs += 1;
      if (r.clicks > 0) cur.clickedMsgs += 1;
      map.set(sector, cur);
    }
    return [...map.values()].sort((a, b) => b.messages - a.messages);
  }, [data.records, byId]);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <TrendingUp size={15} className="text-bronze-400" /> Tracking par industrie
          </h2>
          <p className="mt-0.5 text-[11px] text-paper-faint">
            Quel secteur ouvre et clique le plus — pour concentrer l&apos;effort là où ça répond.
          </p>
        </div>
        <RefreshBtn onClick={reload} loading={loading} />
      </div>

      <div className="mt-3">
        <Tiles s={data} />
        <RateCaveat />
      </div>

      {error && <p className="mt-3 text-[12px] text-signal-red">{error}</p>}

      {agg.length > 0 ? (
        <div className="mt-4 space-y-3">
          {agg.map((a) => {
            const openRate = a.messages ? Math.round((a.openedMsgs / a.messages) * 100) : 0;
            const clickRate = a.messages ? Math.round((a.clickedMsgs / a.messages) * 100) : 0;
            return (
              <div key={a.sector} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-paper">{SECTOR_LABELS[a.sector]}</p>
                  <p className="font-mono text-[12px] text-paper-faint">
                    {a.messages} msg · <span className="text-paper-dim">{a.opens} ouv.</span> ·{" "}
                    <span className="text-bronze-400">{a.clicks} clics</span>
                  </p>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-paper-faint">
                      <span>Taux d&apos;ouverture</span>
                      <span className="font-mono text-paper-dim">{openRate}%</span>
                    </p>
                    <Bar pct={openRate} tone="green" />
                  </div>
                  <div>
                    <p className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-paper-faint">
                      <span>Taux de clic</span>
                      <span className="font-mono text-bronze-400">{clickRate}%</span>
                    </p>
                    <Bar pct={clickRate} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[12px] text-paper-faint">
            Aucun email tracké pour l&apos;instant. Dès que tu envoies des emails depuis l&apos;app, les taux
            d&apos;ouverture et de clic se répartissent ici par secteur.
          </p>
        )
      )}
    </section>
  );
}
