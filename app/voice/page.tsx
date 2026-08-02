"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, Copy, Loader2, PhoneOutgoing, ShieldCheck, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { CALL_MODES, COLD_CALLING_REFUSED, type CallMode } from "@/lib/voice-script";
import { VERTICALS, verticalForProspect } from "@/lib/playbook";
import { cn } from "@/lib/utils";

/**
 * ALPHA VOICE — l'écran de commande.
 *
 * L'agent sert la DÉMONSTRATION : faire entendre au prospect, sur son
 * propre métier, ce que vivraient ses clients. C'est la doctrine maison
 * appliquée — émotion d'abord, démo avant le prix — et c'est ce qui a
 * converti la Carrosserie des Brotteaux.
 *
 * Le démarchage à froid n'est pas proposé. Techniquement identique à la
 * démo sortante ; la décision est documentée et assumée.
 */
export default function VoicePage() {
  const { prospects, settings } = useAlpha();
  const [mode, setMode] = useState<CallMode>("demo-sortante");
  const [prospectId, setProspectId] = useState("");
  const [phone, setPhone] = useState("");
  const [agentName, setAgentName] = useState("ALPHA");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);

  const prospect = prospects.find((p) => p.id === prospectId) ?? null;
  const vertical = prospect ? verticalForProspect(prospect) : null;

  const payload = useMemo(
    () => ({
      mode,
      phone: phone.trim() || prospect?.phone || "",
      company: prospect?.company ?? "",
      verticalId: vertical?.id,
      agentName,
      onBehalfOf: settings.agencyName || "EAGLEYE CORP",
    }),
    [mode, phone, prospect, vertical, agentName, settings.agencyName]
  );

  // Relecture permanente : on voit ce que dirait l'agent avant tout appel.
  useEffect(() => {
    const q = new URLSearchParams({
      mode: payload.mode,
      agentName: payload.agentName,
      onBehalfOf: payload.onBehalfOf,
      ...(payload.company ? { company: payload.company } : {}),
      ...(payload.verticalId ? { verticalId: payload.verticalId } : {}),
    });
    fetch(`/api/voice/call?${q}`)
      .then((r) => r.json())
      .then((j) => {
        setScript(j.script ?? "");
        setResult((prev) => (prev ? prev : { window: j.window, livekit: j.livekit, audit: j.audit }));
      })
      .catch(() => setScript(""));
  }, [payload]);

  const call = async (force = false) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/voice/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, force }),
      });
      setResult({ ...(await res.json()), status: res.status });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "réseau" });
    } finally {
      setBusy(false);
    }
  };

  const disclosureLine = script.split("\n").find((l) => l.startsWith("Bonjour, je suis")) ?? "";
  const audit = result?.audit as { ok: boolean; manquantes: string[] } | undefined;
  const win = result?.window as { allowed: boolean; why: string } | undefined;

  return (
    <div className="space-y-4 animate-fade-up">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
          Faire ENTENDRE · l&apos;émotion avant le prix
        </p>
        <h1 className="font-display text-2xl font-bold text-paper">Alpha Voice</h1>
      </header>

      {/* La divulgation — en haut, parce que c'est ce qui structure tout */}
      <section className="card border-bronze-700 p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ShieldCheck size={15} className="text-bronze-400" /> La première phrase, toujours
        </h2>
        <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850 p-3 text-[13.5px] italic text-paper">
          {disclosureLine || "…"}
        </p>
        <p className="mt-2 text-[12px] text-paper-dim">
          Elle est <b className="text-paper">prononcée par le code</b>, pas par le modèle, et sans interruption
          possible — un modèle peut reformuler ou sauter une consigne, pas une ligne de code. L&apos;article 50 du
          règlement européen sur l&apos;IA, applicable depuis le 2 août 2026, impose que l&apos;agent se déclare
          artificiel et dise pour le compte de qui il agit. Si une mention manque, l&apos;agent{" "}
          <b className="text-paper">refuse de démarrer</b>.
        </p>
      </section>

      {/* Le mode */}
      <section className="card p-4">
        <h2 className="font-display text-sm font-semibold text-paper">Ce que fait l&apos;agent</h2>
        <ul className="mt-2 space-y-1.5">
          {CALL_MODES.map((m) => (
            <li key={m.id}>
              <button
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  mode === m.id ? "border-bronze-600 bg-bronze-900/40" : "border-ink-700 bg-ink-850 hover:border-ink-600"
                )}
                onClick={() => setMode(m.id)}
              >
                <p className="text-[13px] font-medium text-paper">{m.label}</p>
                <p className="mt-0.5 text-[12px] text-paper-dim">{m.what}</p>
                <p className="mt-1 text-[11px] text-paper-faint">{m.legal}</p>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-signal-amber">
          <X size={12} className="mt-0.5 shrink-0" /> {COLD_CALLING_REFUSED}
        </p>
      </section>

      {/* La cible */}
      <section className="card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">Fiche</p>
            <select className="input w-full text-[13px]" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
              <option value="">— sans fiche —</option>
              {prospects
                .filter((p) => p.stage !== "perdu")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company} {p.phone ? `· ${p.phone}` : ""}
                  </option>
                ))}
            </select>
            {vertical && <p className="mt-1 text-[11px] text-paper-faint">Playbook : {vertical.label}</p>}
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
              Numéro {mode === "demo-entrante" ? "(inutile en démo entrante)" : ""}
            </p>
            <input
              className="input w-full text-[13px]"
              placeholder={prospect?.phone || "06 12 34 56 78"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={mode === "demo-entrante"}
            />
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">Nom de l&apos;agent</p>
            <input className="input w-full text-[13px]" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            <p className="mt-1 text-[11px] text-paper-faint">
              Évite un prénom humain : il ne doit pas laisser croire à une personne.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-bronze px-3 py-2 text-[13px]" onClick={() => void call(false)} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <PhoneOutgoing size={14} />} Lancer l&apos;appel
          </button>
          {win && !win.allowed && (
            <button className="btn-ghost px-3 py-2 text-[13px]" onClick={() => void call(true)} disabled={busy}>
              <Clock size={13} /> Forcer malgré l&apos;horaire
            </button>
          )}
        </div>

        {result && (
          <div className="mt-3 space-y-1.5">
            {typeof result.error === "string" && (
              <p className="flex items-start gap-1.5 text-[12px] text-signal-red">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {result.error}
                {typeof result.why === "string" && <span className="text-paper-dim"> — {result.why}</span>}
              </p>
            )}
            {Array.isArray(result.manquantes) && result.manquantes.length > 0 && (
              <p className="text-[12px] text-signal-red">Mentions manquantes : {result.manquantes.join(", ")}</p>
            )}
            {result.dispatched === true && (
              <p className="flex items-center gap-1.5 text-[12px] text-signal-green">
                <Check size={13} /> Appel lancé — salle {String(result.room)}
              </p>
            )}
            {result.dispatched === false && typeof result.reason === "string" && (
              <p className="text-[12px] text-signal-amber">Rien n&apos;a été lancé : {result.reason}</p>
            )}
            {typeof result.detail === "string" && <p className="text-[11px] text-paper-faint">{result.detail}</p>}
            {typeof result.hint === "string" && <p className="text-[11px] text-paper-faint">{result.hint}</p>}
          </div>
        )}
      </section>

      {/* Le script, en clair */}
      {script && (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-paper">Ce que l&apos;agent va dire</h2>
            <div className="flex items-center gap-2">
              {audit && (
                <span className={cn("chip", audit.ok ? "border-signal-green/50 text-signal-green" : "border-signal-red/50 text-signal-red")}>
                  {audit.ok ? "conforme art. 50" : "non conforme"}
                </span>
              )}
              <button
                className="btn-ghost px-2.5 py-1.5 text-[12px]"
                onClick={() => {
                  void navigator.clipboard.writeText(script);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy size={12} /> {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>
          </div>
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-850 p-3 font-sans text-[12.5px] leading-relaxed text-paper">
            {script}
          </pre>
        </section>
      )}

      <p className="px-1 text-[11px] text-paper-faint">
        L&apos;agent tourne dans un service séparé : <code className="font-mono text-bronze-400">voice/agent.py</code>{" "}
        (LiveKit Agents, SIP natif). Le modèle passe par la même clé NVIDIA que le reste d&apos;ALPHA. Sans
        identifiants LiveKit, cet écran reste utile : il montre exactement ce que dirait l&apos;agent. Installation :{" "}
        <code className="font-mono text-bronze-400">voice/README.md</code> ·{" "}
        <Link href="/appels" className="text-bronze-400 underline">
          l&apos;assistant d&apos;appel, lui, souffle pendant que TU parles →
        </Link>
      </p>
    </div>
  );
}
