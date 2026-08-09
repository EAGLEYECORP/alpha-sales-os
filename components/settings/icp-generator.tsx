"use client";

import { useState } from "react";
import { Crosshair, Copy, Loader2, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { buildIdentity } from "@/lib/identity";
import { deriveICP, type ICP } from "@/lib/icp";

/**
 * ICP par offre — Alpha Sales OS sort le client parfait de CE que le compte
 * vend. White-label : l'offre vient des réglages, pas d'EAGLEYE en dur.
 * L'IA affine si une clé est là ; sinon squelette déterministe (jamais vide).
 */
export function IcpGenerator() {
  const settings = useAlpha((s) => s.settings);
  const offer = {
    agencyName: settings.agencyName,
    whatYouSell: settings.offer?.whatYouSell,
    valueProp: settings.offer?.valueProp,
    city: settings.offer?.city,
  };

  const [icp, setIcp] = useState<ICP | null>(null);
  const [engine, setEngine] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/icp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offer, businessRules: settings.businessRules, identity: buildIdentity(settings) }),
      });
      const data = await res.json();
      setIcp(data.icp as ICP);
      setEngine(data.engine ?? "");
    } catch {
      // Repli hors-ligne total : le squelette déterministe, sans réseau.
      setIcp(deriveICP(offer));
      setEngine("squelette (hors-ligne)");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!icp) return;
    const txt = [
      `ICP — ${icp.label}`,
      `Qui signe : ${icp.buyer}`,
      `Secteur : ${icp.sector}`,
      `Taille : ${icp.companySize}`,
      `Zone : ${icp.geo}`,
      ``,
      `Douleurs :\n- ${icp.pains.join("\n- ")}`,
      `Déclencheurs :\n- ${icp.triggers.join("\n- ")}`,
      `Canaux :\n- ${icp.channels.join("\n- ")}`,
      `À exclure :\n- ${icp.disqualifiers.join("\n- ")}`,
      ``,
      `Angle : ${icp.angle}`,
    ].join("\n");
    navigator.clipboard.writeText(txt);
  };

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Crosshair size={15} className="text-bronze-400" /> Client parfait (ICP) — déduit de mon offre
        </h2>
        <div className="flex items-center gap-2">
          {icp && (
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={copy}>
              <Copy size={13} /> Copier
            </button>
          )}
          <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={generate} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {icp ? "Régénérer" : "Générer l'ICP"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Alpha Sales OS sort le client parfait de <strong className="text-paper-dim">ce que TU vends</strong> (Agence + Mon
        offre ci-dessus). Change l&apos;offre → l&apos;ICP change. Sers-t&apos;en pour cibler ta liste et écrire l&apos;accroche.
      </p>

      {!icp && !busy && (
        <p className="mt-3 rounded-lg border border-dashed border-ink-700 px-3 py-4 text-center text-[12px] text-paper-faint">
          Renseigne « Mon offre » ci-dessus, puis génère — tu obtiens qui signe, ses douleurs, ses déclencheurs d&apos;achat et l&apos;angle d&apos;ouverture.
        </p>
      )}

      {icp && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-bronze-700/40 bg-bronze-900/10 p-3">
            <p className="font-display text-[15px] font-bold text-paper">{icp.label}</p>
            <p className="mt-1 text-[12px] text-bronze-400">{icp.angle}</p>
            <div className="mt-2 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
              <Row k="Qui signe" v={icp.buyer} />
              <Row k="Secteur" v={icp.sector} />
              <Row k="Taille" v={icp.companySize} />
              <Row k="Zone" v={icp.geo} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <IcpList title="Douleurs" items={icp.pains} tone="text-signal-red" />
            <IcpList title="Déclencheurs d'achat" items={icp.triggers} tone="text-signal-green" />
            <IcpList title="Canaux pour les atteindre" items={icp.channels} tone="text-bronze-400" />
            <IcpList title="À exclure (faux positifs)" items={icp.disqualifiers} tone="text-paper-faint" />
          </div>
          <p className="text-[10.5px] italic text-paper-faint">
            Moteur : {engine}. {engine.includes("hors-ligne") ? "Squelette déterministe — renseigne une clé IA (NVIDIA gratuit) pour l'affiner sur ton offre." : "Affiné par l'IA au nom de ton offre."}
          </p>
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-paper-faint">{k} :</span>
      <span className="text-paper-dim">{v}</span>
    </div>
  );
}

function IcpList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
      <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">{title}</p>
      <ul className="space-y-1">
        {items.map((it, n) => (
          <li key={n} className="flex items-start gap-2 text-[12px] text-paper-dim">
            <span className={tone}>›</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
