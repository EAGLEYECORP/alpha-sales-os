"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  Clock,
  Mail,
  MapPin,
  PhoneCall,
  Scale,
  Target,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { construireJournee, parQuadrant, pourEcran, QUADRANT_META, type Quadrant, type Tache } from "@/lib/priorites";
import { REGLES, regleFor } from "@/lib/conformite";
import { cn, eur } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Aujourd'hui — le calculateur urgent / important.
 *
 * Eisenhower, mais rien n'est déclaré : l'urgence vient des échéances
 * réelles (RDV, next steps datés, âge du dernier contact), l'importance
 * de l'argent pondéré en jeu. On ne peut pas se mentir en cochant une
 * case « prioritaire ».
 *
 * L'écran répond à une seule question au réveil : par quoi je commence,
 * et combien de temps ça prend.
 */

const CANAL_ICON = { appel: PhoneCall, email: Mail, sms: Mail, visite: MapPin, linkedin: Target } as const;

export default function AujourdhuiPage() {
  const { prospects, meetings } = useAlpha();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loi, setLoi] = useState(false);
  const [digestReady, setDigestReady] = useState<boolean | null>(null);
  const [digestMsg, setDigestMsg] = useState("");
  const [sending, setSending] = useState(false);

  const j = useMemo(() => construireJournee({ prospects, meetings }), [prospects, meetings]);
  const restant = j.taches.filter((t) => t.quadrant === "faire" && !done[t.id]);
  const minutesRestantes = restant.reduce((s, t) => s + t.minutes, 0);

  // Le récap urgent peut-il partir sur ton téléphone (SMS/email) ?
  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((d) => setDigestReady(Boolean(d.sms || d.email)))
      .catch(() => setDigestReady(false));
  }, []);

  const sendDigest = async () => {
    setSending(true);
    setDigestMsg("");
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospects, meetings, force: true }),
      });
      const d = await res.json();
      setDigestMsg(
        !res.ok
          ? d.error ?? "Envoi impossible."
          : d.sent
            ? `✓ Récap envoyé par ${d.channel === "sms" ? "SMS" : "email"} — ${d.digest.count} priorité(s).`
            : "Rien de critique à envoyer aujourd'hui."
      );
    } catch {
      setDigestMsg("Serveur injoignable.");
    } finally {
      setSending(false);
    }
  };

  const heure = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ce que tu fais aujourd'hui · calculé, pas déclaré"
        title={new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-paper-faint">
              Critique <b className="ml-1 font-display text-base text-signal-red">{restant.length}</b>
            </span>
            <span className="text-paper-faint">
              Temps <b className="ml-1 font-display text-base text-paper">{heure(minutesRestantes)}</b>
            </span>
            {j.valeurEnJeu > 0 && (
              <span className="text-paper-faint">
                En jeu <b className="ml-1 font-display text-base text-bronze-400">{eur(Math.round(j.valeurEnJeu))}</b>
              </span>
            )}
            {digestReady && (
              <button
                className="btn-ghost px-2.5 py-1.5 text-[12px] normal-case tracking-normal"
                onClick={() => void sendDigest()}
                disabled={sending || restant.length === 0}
                title={restant.length === 0 ? "Rien de critique à envoyer" : "M'envoyer les priorités du jour sur mon téléphone"}
              >
                <BellRing size={13} /> {sending ? "Envoi…" : "M'envoyer le récap"}
              </button>
            )}
          </div>
        }
      />

      {digestMsg && <p className="px-1 text-[12px] text-paper-dim">{digestMsg}</p>}

      {/* La fenêtre d'appel — pas une règle de droit, une règle de terrain */}
      <section
        className={cn("card flex flex-wrap items-center gap-3 p-4", j.fenetre.open ? "border-signal-green/40" : "border-signal-amber/40")}
      >
        <Clock size={18} className={cn("shrink-0", j.fenetre.open ? "text-signal-green" : "text-signal-amber")} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-paper">
            {j.fenetre.open ? `Fenêtre d'appel ouverte — ${j.fenetre.label}` : `Hors fenêtre d'appel — ${j.fenetre.label}`}
          </p>
          <p className="text-[12px] text-paper-dim">{j.fenetre.why}</p>
        </div>
        <button className="btn-ghost shrink-0 px-2.5 py-1.5 text-[12px]" onClick={() => setLoi((v) => !v)}>
          <Scale size={13} /> {loi ? "Masquer" : "Ce que dit la loi"}
        </button>
      </section>

      {loi && (
        <section className="card p-4">
          <h2 className="font-display text-sm font-semibold text-paper">Prospection B2B en France — août 2026</h2>
          <p className="mt-1 text-[12px] text-paper-dim">
            Le point que presque tout le monde confond : la loi du 11 août 2026 sur le consentement préalable, et
            l&apos;encadrement des horaires qui l&apos;accompagne, visent le <b className="text-paper">consommateur</b>.
            La prospection B2B vers une ligne professionnelle, sur un sujet professionnel, reste licite au titre de
            l&apos;intérêt légitime — avec information et droit d&apos;opposition. S&apos;interdire ce qui est légal
            coûte aussi cher que se mettre en faute, mais en silence.
          </p>
          <ul className="mt-3 space-y-2">
            {REGLES.map((r) => (
              <li key={r.canal} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                <p className="text-[13px] font-medium capitalize text-paper">{r.canal}</p>
                <p className="mt-0.5 text-[12px] text-paper-dim">{r.regime}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {r.obligations.map((o, i) => (
                    <li key={i} className="text-[12px] text-paper">
                      · {o}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px] text-signal-amber">Le piège : {r.piege}</p>
                <p className="mt-1 font-mono text-[10px] text-paper-faint">{r.source}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-paper-faint">
            Ce n&apos;est pas un avis juridique — c&apos;est l&apos;état du droit tel qu&apos;on l&apos;applique ici,
            avec ses sources, pour pouvoir en discuter.
          </p>
        </section>
      )}

      {j.taches.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-paper-faint">
          Rien à faire aujourd&apos;hui d&apos;après le CRM — ce qui veut souvent dire que le CRM n&apos;est pas à
          jour, pas que la journée est libre.{" "}
          <Link href="/pipeline" className="text-bronze-400 hover:underline">
            Ouvrir le pipeline →
          </Link>
        </p>
      ) : (
        (["faire", "planifier", "deleguer", "abandonner"] as Quadrant[]).map((q) => {
          const list = parQuadrant(j, q);
          if (list.length === 0) return null;
          const meta = QUADRANT_META[q];
          const mins = list.filter((t) => !done[t.id]).reduce((s, t) => s + t.minutes, 0);
          // Plafonné : mille lignes ne sont pas un plan de journée. Ce qui est
          // replié est COMPTÉ sur une ligne, jamais escamoté.
          const ecran = pourEcran(j, q);
          return (
            <section key={q} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-paper">
                  {meta.label}
                  <span className={cn("ml-2 chip", meta.tone)}>{list.length}</span>
                </h2>
                <span className="font-mono text-[11px] text-paper-faint">{heure(mins)}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-paper-dim">{meta.sub}</p>
              <ul className="mt-3 space-y-1.5">
                {ecran.visibles.map((t) => (
                  <TacheRow key={t.id} tache={t} done={!!done[t.id]} onToggle={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))} />
                ))}
              </ul>
              {ecran.note && (
                <p
                  className={cn(
                    "mt-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed",
                    q === "faire"
                      ? "border-signal-amber/40 bg-signal-amber/5 text-signal-amber"
                      : "border-ink-700 text-paper-faint"
                  )}
                >
                  {ecran.note}{" "}
                  <Link href="/pipeline" className="text-bronze-400 hover:underline">
                    Ouvrir le pipeline →
                  </Link>
                </p>
              )}
            </section>
          );
        })
      )}

      <p className="px-1 text-[11px] text-paper-faint">
        L&apos;urgence vient des échéances réelles (rendez-vous, prochaines étapes datées, âge du dernier contact),
        l&apos;importance de l&apos;argent pondéré en jeu. Rien n&apos;est déclaré : on ne peut pas se mentir en
        cochant « prioritaire ». Une fiche ne produit qu&apos;une tâche — l&apos;écran doit rester lisible.
      </p>
    </div>
  );
}

function TacheRow({ tache: t, done, onToggle }: { tache: Tache; done: boolean; onToggle: () => void }) {
  const Icon = CANAL_ICON[t.canal] ?? PhoneCall;
  const regle = regleFor(t.canal);
  const [why, setWhy] = useState(false);

  return (
    <li className={cn("rounded-lg border border-ink-700 bg-ink-850 p-3", done && "opacity-50")}>
      <div className="flex items-start gap-2.5">
        <button className="mt-0.5 shrink-0" onClick={onToggle} aria-label={done ? "Rouvrir" : "Fait"}>
          {done ? (
            <Check size={16} className="text-signal-green" />
          ) : (
            <span className="block h-4 w-4 rounded-full border border-ink-600" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[13.5px] text-paper", done && "line-through")}>{t.action}</p>
          <p className="mt-0.5 text-[12px] text-paper-dim">{t.why}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="chip border-ink-700 text-[10px] text-paper-faint">
              <Icon size={10} /> {t.canal}
            </span>
            <span className="chip border-ink-700 text-[10px] text-paper-faint">
              <Clock size={10} /> {t.minutes} min
            </span>
            {t.value !== undefined && t.value > 0 && (
              <span className="chip border-ink-700 text-[10px] text-bronze-400">{eur(Math.round(t.value))} pondérés</span>
            )}
            <span className="font-mono text-[10px] text-paper-faint">
              U {t.urgence} · I {t.importance}
            </span>
            <button className="font-mono text-[10px] text-paper-faint underline" onClick={() => setWhy((v) => !v)}>
              règle {t.canal}
            </button>
          </div>
          {why && (
            <p className="mt-1.5 rounded border border-ink-700 bg-ink-900 p-2 text-[11px] text-paper-dim">
              <b className="text-paper">{regle.regime}</b> — {regle.piege}
            </p>
          )}
        </div>
        <Link href={t.href} className="btn-ghost shrink-0 px-2.5 py-1.5 text-[12px]">
          Y aller <ArrowRight size={12} />
        </Link>
      </div>
    </li>
  );
}
