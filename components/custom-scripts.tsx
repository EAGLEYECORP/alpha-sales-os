"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageSquare, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { fillTemplate } from "@/lib/templates";
import type { CustomScript, Prospect } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { SendBar } from "@/components/send-bar";

/**
 * Mes scripts — le mode MANUEL / TEST : l'utilisateur écrit ses propres
 * scripts (email/DM), les personnalise avec un prospect (variables) et les
 * envoie. Zéro n8n requis — c'est la boucle de test avant l'automatisation.
 */
export function CustomScripts({ prospect }: { prospect: Prospect | null }) {
  const { customScripts, upsertCustomScript, deleteCustomScript, settings } = useAlpha();
  const [editing, setEditing] = useState<CustomScript | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const blank = (): CustomScript => ({
    id: uid(),
    name: "",
    channel: "email",
    subject: "",
    body: "Bonjour {prenom},\n\n",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <PenLine size={15} className="text-bronze-400" /> Mes scripts
            <span className="chip border-ink-600 text-paper-faint">{customScripts.length}</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-paper-faint">
            Tes propres messages, écrits à la main. Variables : <code className="code">{"{prenom}"}</code>{" "}
            <code className="code">{"{commerce}"}</code> <code className="code">{"{ville}"}</code>{" "}
            <code className="code">{"{taxe}"}</code> <code className="code">{"{closer}"}</code> — remplies avec le
            prospect sélectionné ci-dessus.
          </p>
        </div>
        <button className="btn-bronze" onClick={() => setEditing(blank())}>
          <Plus size={14} /> Nouveau script
        </button>
      </div>

      {customScripts.length === 0 && !editing && (
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-3 text-center text-sm text-paper-faint">
          Aucun script à toi pour l&apos;instant. « Nouveau script » → écris ton message → sélectionne un prospect → envoie.
          Les taux d&apos;ouverture/réponse arrivent tout seuls.
        </p>
      )}

      {/* Éditeur */}
      {editing && (
        <div className="mt-4 rounded-xl border border-bronze-700/50 bg-bronze-900/10 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="input"
              placeholder="Nom du script (ex. « Relance douce J+3 »)"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <div className="flex gap-1.5">
              {(["email", "dm"] as const).map((ch) => (
                <button
                  key={ch}
                  className={editing.channel === ch ? "btn-bronze px-3" : "btn-ghost px-3"}
                  onClick={() => setEditing({ ...editing, channel: ch })}
                >
                  {ch === "email" ? <Mail size={13} /> : <MessageSquare size={13} />} {ch === "email" ? "Email" : "DM"}
                </button>
              ))}
            </div>
          </div>
          {editing.channel === "email" && (
            <input
              className="input mt-2"
              placeholder="Objet (ex. « Vos mardis soirs, {prenom} »)"
              value={editing.subject}
              onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
            />
          )}
          <textarea
            className="input mt-2 min-h-40 font-body text-[13px] leading-relaxed"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
            <button
              className="btn-bronze"
              disabled={!editing.name.trim() || !editing.body.trim()}
              onClick={() => {
                upsertCustomScript(editing);
                setEditing(null);
              }}
            >
              <Check size={14} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {customScripts.map((sc) => {
          const body = fillTemplate(sc.body, prospect, settings.closerName);
          const subject = fillTemplate(sc.subject, prospect, settings.closerName);
          const leftover = [...new Set(`${subject}\n${body}`.match(/\{[a-zA-Zà-ÿ_]+\}/g) ?? [])];
          return (
            <div key={sc.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bronze-500">
                  {sc.channel === "email" ? <Mail size={12} /> : <MessageSquare size={12} />} {sc.name}
                </p>
                <div className="flex gap-1">
                  <button className="btn-ghost px-2 py-1" title="Modifier" onClick={() => setEditing(sc)}>
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn-danger px-2 py-1"
                    title="Supprimer"
                    onClick={() => confirm(`Supprimer « ${sc.name} » ?`) && deleteCustomScript(sc.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {sc.channel === "email" && subject && <p className="mt-1 text-sm font-medium text-paper">{subject}</p>}
              <pre className="mt-2 flex-1 whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-850 p-3 font-body text-[12px] leading-relaxed text-paper-dim">
                {body}
              </pre>
              {leftover.length > 0 && prospect && (
                <p className="mt-1.5 text-[11px] text-bronze-400">⚠ Variables non remplies : {leftover.join(" ")}</p>
              )}
              {!prospect && (
                <p className="mt-1.5 text-[11px] text-paper-faint">Sélectionne un prospect au-dessus pour remplir les variables et envoyer.</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button className={cn("btn-ghost px-2.5 py-1.5 text-[12px]")} onClick={() => copy(sc.id, body)}>
                  {copied === sc.id ? <Check size={13} className="text-signal-green" /> : <Copy size={13} />} Copier
                </button>
                {prospect && <SendBar prospect={prospect} subject={subject} body={body} compact />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
