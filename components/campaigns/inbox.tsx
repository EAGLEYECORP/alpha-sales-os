"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Inbox, RefreshCw, UserPlus } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { InboundEvent, Prospect } from "@/lib/types";
import { prospectDefaults } from "@/lib/seed";
import { dateTimeFr, daysAhead, uid } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { SendBar } from "@/components/send-bar";

const TYPE_LABEL: Record<InboundEvent["type"], string> = {
  "email.reply": "✉ Réponse email",
  "email.open": "👁 Ouverture",
  "whatsapp.reply": "💬 WhatsApp",
  "form.submit": "📝 Formulaire",
  autre: "Événement",
};

export function InboundInbox() {
  const { prospects, campaigns, addEvent, upsertProspect, upsertCampaign, patchProspect, logActivity, settings } = useAlpha();
  const [events, setEvents] = useState<InboundEvent[]>([]);
  const [store, setStore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/inbound");
      const data = await res.json();
      setEvents(data.events ?? []);
      setStore(data.store ?? null);
    } catch {
      setStore("erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ack = async (ids: string[]) => {
    await fetch("/api/webhooks/inbound", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
    setEvents((cur) => cur.filter((e) => !ids.includes(e.id)));
  };

  const matchProspect = (ev: InboundEvent): Prospect | undefined =>
    prospects.find((p) => p.email && p.email.toLowerCase() === ev.email.toLowerCase());

  const attach = (ev: InboundEvent) => {
    let p = matchProspect(ev);
    if (!p) {
      // real inbound, unknown sender → create the prospect on the spot
      const now = new Date().toISOString();
      p = {
        ...prospectDefaults,
        id: uid(),
        company: ev.name || ev.email.split("@")[0],
        name: ev.name ?? "",
        sector: "autre",
        city: "",
        email: ev.email,
        stage: "contact",
        trust: 25,
        auditScore: 0,
        conviction: 8,
        monthlyValue: 0,
        setupValue: 0,
        probability: 15,
        ignoranceTax: 0,
        croyances: { produit: 5, soutien: 5, pourLui: 3 },
        obstacles: [],
        objections: [],
        events: [],
        demoShownBeforePrice: false,
        nextStep: { date: daysAhead(1), action: "Répondre au message entrant" },
        tags: ["inbound"],
        attachments: [],
        notes: "",
        problems: [],
        createdAt: now,
        updatedAt: now,
      } as Prospect;
      upsertProspect(p);
    }
    addEvent(p.id, {
      date: ev.receivedAt,
      kind: ev.type.startsWith("whatsapp") ? "whatsapp" : "email",
      summary: `↩ Entrant (${TYPE_LABEL[ev.type]}) : ${ev.message.slice(0, 300) || "(sans texte)"}`,
      nextStep: { date: daysAhead(1), action: "Répondre au message entrant" },
    });
    patchProspect(p.id, { trust: Math.min(100, p.trust + 5) });
    if (ev.campaignId) {
      const c = campaigns.find((x) => x.id === ev.campaignId);
      if (c) {
        const stats = { ...c.stats };
        if (ev.type === "email.open") stats.opened += 1;
        else stats.replied += 1;
        upsertCampaign({ ...c, stats });
      }
    }
    logActivity({ kind: "campagne", message: `Réponse entrante attachée : ${p.company}`, prospectId: p.id });
    ack([ev.id]);
  };

  const draftReply = async (ev: InboundEvent) => {
    const p = matchProspect(ev);
    setDrafting(ev.id);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "reply",
          prospect: p ?? { ...prospectDefaults, id: "x", company: ev.name ?? ev.email, name: ev.name ?? "", sector: "autre", city: "", stage: "contact", trust: 25, auditScore: 0, conviction: 8, monthlyValue: 0, setupValue: 0, probability: 15, ignoranceTax: 0, croyances: { produit: 5, soutien: 5, pourLui: 3 }, obstacles: [], objections: [], events: [], demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "", problems: [], createdAt: "", updatedAt: "" },
          businessRules: settings.businessRules,
          inboundMessage: ev.message,
        }),
      });
      const data = await res.json();
      setDrafts((d) => ({ ...d, [ev.id]: data.text ?? data.error ?? "Erreur" }));
    } catch {
      setDrafts((d) => ({ ...d, [ev.id]: "Erreur réseau." }));
    } finally {
      setDrafting(null);
    }
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Inbox size={15} className="text-bronze-400" /> Réponses entrantes
          <span className="chip border-ink-600 text-paper-faint">{events.length}</span>
          {store && <span className="text-[10px] text-paper-faint">stockage : {store}</span>}
        </h2>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Relever
        </button>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Webhook : <code className="font-mono text-bronze-400">POST /api/webhooks/inbound</code> (secret requis — config dans Réglages). Chaque réponse peut être attachée au prospect et traitée par l&apos;agent.
      </p>

      <ul className="mt-3 space-y-3">
        {events.map((ev) => {
          const p = matchProspect(ev);
          return (
            <li key={ev.id} className="rounded-lg border border-ink-600 bg-ink-850 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-paper">
                    <span className="text-bronze-400">{TYPE_LABEL[ev.type]}</span> · {ev.name ?? ev.email}
                    {p && <span className="text-paper-faint"> → {p.company}</span>}
                    {!p && <span className="text-signal-amber"> (nouveau contact)</span>}
                  </p>
                  <p className="text-[11px] text-paper-faint">{ev.email} · {dateTimeFr(ev.receivedAt)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => draftReply(ev)} disabled={drafting === ev.id}>
                    <Bot size={13} /> {drafting === ev.id ? "…" : "Réponse IA"}
                  </button>
                  <button className="btn-bronze px-2.5 py-1.5 text-[12px]" onClick={() => attach(ev)}>
                    {p ? <Check size={13} /> : <UserPlus size={13} />} {p ? "Attacher" : "Créer + attacher"}
                  </button>
                </div>
              </div>
              {ev.message && <p className="mt-2 rounded border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-paper-dim">{ev.message}</p>}
              {drafts[ev.id] && (
                <div className="mt-2 rounded-lg border border-bronze-700/50 bg-bronze-900/20 p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-bronze-500">Brouillon de réponse (agent)</p>
                  <Markdown>{drafts[ev.id]}</Markdown>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => navigator.clipboard.writeText(drafts[ev.id])}>
                      Copier
                    </button>
                    {p && <SendBar prospect={p} subject="Re : votre message" body={drafts[ev.id]} compact />}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {events.length === 0 && (
          <p className="py-4 text-center text-sm text-paper-faint">
            Aucune réponse en attente. Envoie un test :{" "}
            <code className="font-mono text-[11px] text-bronze-400">curl -X POST …/api/webhooks/inbound -H &quot;x-webhook-secret: …&quot;</code>
          </p>
        )}
      </ul>
    </section>
  );
}
