"use client";

import { Banknote, CalendarClock } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";

/**
 * DÉBLOCAGE DES FONDS — la réponse qui transforme un « oui » en virement.
 *
 * Un accord de principe sans date de déblocage n'est pas une vente : c'est une
 * intention. On note QUAND la compta peut payer, PAR QUEL canal et QUI valide,
 * puis la relance se cale sur cette date (lib/vital-signs → bestWindow).
 */
export function FundingEditor({ p }: { p: Prospect }) {
  const patchProspect = useAlpha((s) => s.patchProspect);
  const f = p.funding ?? {};
  const set = (patch: Partial<NonNullable<Prospect["funding"]>>) =>
    patchProspect(p.id, { funding: { ...f, ...patch } });

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <Banknote size={15} className="text-bronze-400" /> Déblocage des fonds
      </h2>
      <p className="text-[11.5px] text-paper-faint">
        Un « oui » sans date de déblocage n&apos;est pas une vente — c&apos;est une intention. La relance se calera
        automatiquement sur cette date : relancer avant que la compta puisse payer, c&apos;est se faire refuser
        pour une raison purement mécanique.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Fonds disponibles à partir du</label>
          <input
            type="date"
            className="input"
            value={f.availableAt ? f.availableAt.slice(0, 10) : ""}
            onChange={(e) => set({ availableAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
        <div>
          <label className="label">Canal de règlement</label>
          <input
            className="input"
            placeholder="virement, prélèvement, CB, mandat…"
            value={f.channel ?? ""}
            onChange={(e) => set({ channel: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Qui valide côté compta</label>
          <input
            className="input"
            placeholder="le gérant, la DAF, l'expert-comptable…"
            value={f.approver ?? ""}
            onChange={(e) => set({ approver: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Relance calée le</label>
          <input
            type="date"
            className="input"
            value={f.followUpAt ? f.followUpAt.slice(0, 10) : ""}
            onChange={(e) => set({ followUpAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
      </div>

      <div>
        <label className="label">Contrainte réelle</label>
        <input
          className="input"
          placeholder="clôture comptable, budget annuel voté en janvier, trésorerie tendue…"
          value={f.constraint ?? ""}
          onChange={(e) => set({ constraint: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 text-[12px] text-paper-dim">
        <input
          type="checkbox"
          checked={Boolean(f.confirmed)}
          onChange={(e) => set({ confirmed: e.target.checked })}
        />
        <span>
          Confirmé <strong className="text-paper">par lui</strong> — pas une supposition de notre part
        </span>
      </label>

      {f.availableAt && (
        <p className="flex items-center gap-1.5 rounded-lg border border-bronze-700/40 bg-bronze-900/10 px-3 py-2 text-[11.5px] text-paper-dim">
          <CalendarClock size={12} className="text-bronze-400" />
          {f.confirmed ? "Fonds confirmés" : "Date supposée, à faire confirmer"} pour le{" "}
          {new Date(f.availableAt).toLocaleDateString("fr-FR")}
          {f.channel ? ` · ${f.channel}` : ""}
          {f.approver ? ` · validé par ${f.approver}` : ""}
        </p>
      )}
    </section>
  );
}
