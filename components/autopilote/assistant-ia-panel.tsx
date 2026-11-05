"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy } from "lucide-react";
import { OU_VIVENT_LES_DONNEES, promptMission } from "@/lib/mission-assistant";

/**
 * « Fais travailler ton assistant IA » — le texte à coller dans un assistant
 * qui sait se servir d'un navigateur (`lib/mission-assistant.ts`, une seule
 * rédaction, la même que `/llms.txt`). L'adresse est celle de l'onglet ouvert :
 * l'assistant doit travailler dans CE déploiement.
 */
export function AssistantIaPanel() {
  const [base, setBase] = useState("");
  const [copie, setCopie] = useState(false);
  useEffect(() => setBase(window.location.origin), []);
  const texte = base ? promptMission(base) : "";

  return (
    <section className="card space-y-3 p-4" aria-labelledby="assistant-ia-titre">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-bronze-400" aria-hidden />
        <h2 id="assistant-ia-titre" className="font-display text-lg font-bold text-paper">
          Fais travailler ton assistant IA
        </h2>
      </div>
      <p className="text-[13px] text-paper-dim">
        Un assistant IA qui sait se servir d&apos;un navigateur peut faire ce travail à ta place : copie ce texte et
        colle-le-lui. Il ne tape jamais tes mots de passe, n&apos;invente aucun prix et ne signe rien.
      </p>
      <p className="text-[12px] text-paper-dim">{OU_VIVENT_LES_DONNEES}</p>
      <pre className="panel max-h-56 overflow-auto whitespace-pre-wrap p-3 text-xs text-paper">{texte}</pre>
      <button
        type="button"
        disabled={!texte}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texte);
            setCopie(true);
            setTimeout(() => setCopie(false), 2000);
          } catch {
            setCopie(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-bronze-400/40 px-3 py-1.5 text-sm text-paper hover:bg-bronze-400/10 disabled:opacity-50"
      >
        {copie ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copie ? "Copié" : "Copier la mission"}
      </button>
    </section>
  );
}
