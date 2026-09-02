"use client";

import { useRef, useState } from "react";
import { Bot, CircleStop, Send, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { buildIdentity } from "@/lib/identity";
import { search, contextFromNotes } from "@/lib/knowledge";
import { weightedValue, nextBestAction } from "@/lib/hormozi";
import { computeRoutines } from "@/lib/routines";
import { buildDailyPlan } from "@/lib/daily-plan";
import { proofStats } from "@/lib/proof";
import { verticalForProspect } from "@/lib/playbook";
import { isOverdue } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Prépare ma journée : par quoi je commence, dans quel ordre ?",
  "Quels deals sont en danger et pourquoi ?",
  "Analyse le deal le plus chaud et donne-moi le plan de closing.",
  "Est-ce que je vais atteindre mon volume aujourd'hui ? Sinon, qu'est-ce qui manque ?",
  "Rédige la relance la plus urgente.",
  "Où est-ce que je perds le plus dans mon pipe en ce moment ?",
];

export default function AgentPage() {
  const { prospects, meetings, campaigns, drafts, settings, notes } = useAlpha();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Compact live snapshot — real data only, capped for token budget. */
  const buildContext = () => {
    const active = prospects.filter((p) => !["perdu"].includes(p.stage));
    // Conscience de situation : ce que l'opérateur voit sur son écran du
    // matin. Sans ça, l'agent connaît les fiches mais ignore ce qui
    // bloque, ce qui reste à faire aujourd'hui, et ce qui a été produit.
    const routines = computeRoutines({ prospects, meetings, campaigns, drafts });
    const plan = buildDailyPlan(prospects);
    const preuves = proofStats(prospects, meetings, settings.commissionPct);
    return JSON.stringify({
      date: new Date().toISOString(),
      fileDeDecision: {
        total: routines.length,
        urgentes: routines.filter((r) => r.priority === "haute").length,
        top: routines.slice(0, 12).map((r) => ({ quoi: r.title, pourquoi: r.detail, ou: r.href })),
      },
      volumeDuJour: {
        faites: plan.done,
        objectif: plan.target,
        parCanal: plan.channels.map((c) => ({ canal: c.label, faites: c.done, plafond: c.capacity, pretes: c.ready, aFaire: c.todo, ou: c.href })),
        carburant: plan.fuel,
        objectifAtteignable: plan.reachable,
      },
      preuves: {
        caEncaisse: preuves.encaisse,
        taxeRendueMensuelle: preuves.taxeRendueMensuelle,
        signes: preuves.signes,
        tauxClosing: preuves.closingRate,
        cycleMedianJours: preuves.cycleJours,
        touchesTotal: preuves.touchesTotal,
        temoignages: preuves.temoignages.length,
      },
      mrrSigned: prospects.filter((p) => p.stage === "signe").reduce((s, p) => s + p.monthlyValue, 0),
      pipeWeighted: prospects.reduce((s, p) => s + weightedValue(p), 0),
      prospects: active.slice(0, 40).map((p) => ({
        id: p.id,
        fiche: `/prospects/${p.id}`,
        company: p.company,
        name: p.name,
        sector: p.sector,
        verticale: verticalForProspect(p)?.label,
        city: p.city,
        stage: p.stage,
        trust: p.trust,
        likeness: p.likeness,
        conviction: p.conviction,
        probability: p.probability,
        monthly: p.monthlyValue,
        setup: p.setupValue,
        weighted: Math.round(weightedValue(p)),
        taxe: p.ignoranceTax,
        croyances: p.croyances,
        demoBeforePrice: p.demoShownBeforePrice,
        openObstacles: p.obstacles.filter((o) => !o.resolved).map((o) => o.label),
        openObjections: p.objections.filter((o) => o.status !== "traitee").length,
        objections: p.objections.filter((o) => o.status !== "traitee").map((o) => o.label),
        problems: p.problems,
        solution: p.solution,
        offer: p.personalizedOffer,
        audit: p.deepAudit,
        contract: p.contract.status,
        delivery: p.delivery,
        nextStep: p.nextStep?.action,
        nextStepDate: p.nextStep?.date,
        overdue: p.nextStep ? isOverdue(p.nextStep.date) : true,
        nba: nextBestAction(p).action,
        lastEvents: p.events.slice(0, 3).map((e) => `[${e.kind}] ${e.summary}`),
        notes: p.notes,
      })),
      meetings: meetings
        .filter((m) => !m.done)
        .slice(0, 10)
        .map((m) => ({ title: m.title, date: m.date, kind: m.kind, channel: m.channel })),
      campaigns: campaigns.map((c) => ({ name: c.name, status: c.status, cible: c.cible, stats: c.stats })),
    });
  };

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const appendAssistant = (chunk: string, replace = false) =>
      setMessages((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: replace ? chunk : last.content + chunk };
        return copy;
      });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: nextMessages,
          context: buildContext(),
          businessRules: settings.businessRules,
          identity: buildIdentity(settings),
          brainContext: contextFromNotes(search(text, notes)),
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        appendAssistant(data.text ?? data.error ?? "Erreur", true);
      } else if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          appendAssistant(decoder.decode(value, { stream: true }));
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") appendAssistant("\n\n*Erreur réseau — réessaie.*");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col animate-fade-up md:h-[calc(100vh-4rem)]">
      {/* ⚠ Pas de `.page` ici : cet écran est une conversation à hauteur
          fixe. `space-y-*` sur un parent `flex-col` ajouterait une marge
          entre l'en-tête et la zone `flex-1`, qui recalcule alors sa
          hauteur — la zone de saisie sortirait du cadre. */}
      <PageHeader
        className="mb-4"
        icon={<Bot size={24} className="text-bronze-400" />}
        title="Agent ALPHA"
        subtitle="Copilote conversationnel branché sur tout l'OS : pipeline, audits, campagnes, doctrine."
      />

      <div ref={scrollRef} className="card flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center">
            <div className="max-w-md text-center">
              <Sparkles size={28} className="mx-auto text-bronze-600" />
              <p className="mt-3 text-sm text-paper-faint">
                Pose une question sur ton pipeline, ou lance-toi :
              </p>
              <div className="mt-4 grid gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} className="btn-ghost justify-start text-left" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-2.5",
                m.role === "user"
                  ? "bg-bronze-900/70 text-paper"
                  : "border border-ink-700 bg-ink-850"
              )}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  <span className="text-sm text-paper-faint animate-pulse-ring">ALPHA réfléchit…</span>
                )
              ) : (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="« Prépare mon closing chez le Bouchon des Canuts »…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={streaming}
        />
        {streaming ? (
          <button className="btn-danger" onClick={() => abortRef.current?.abort()}>
            <CircleStop size={15} /> Stop
          </button>
        ) : (
          <button className="btn-bronze" onClick={() => send(input)} disabled={!input.trim()}>
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
