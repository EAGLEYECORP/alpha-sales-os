"use client";

import { useState } from "react";
import { Plus, Swords, Trash2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Competitor, Sector } from "@/lib/types";
import { dateFr, uid } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

export default function IntelPage() {
  const { competitors, upsertCompetitor, deleteCompetitor } = useAlpha();
  const [editing, setEditing] = useState<Competitor | null>(null);

  const newCompetitor = (): Competitor => ({
    id: uid(),
    name: "",
    sector: "tous",
    pricing: "",
    strengths: "",
    weaknesses: "",
    counter: "",
    updatedAt: new Date().toISOString(),
  });

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Intel Concurrents</h1>
          <p className="text-sm text-paper-faint">
            Ne jamais se battre sur le prix — se battre sur la preuve. Fiche à jour = objection concurrent morte.
          </p>
        </div>
        <button className="btn-bronze" onClick={() => setEditing(newCompetitor())}>
          <Plus size={15} /> Concurrent
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {competitors.map((c) => (
          <div key={c.id} className="card card-hover flex flex-col p-4">
            <div className="flex items-start justify-between">
              <p className="flex items-center gap-2 font-medium text-paper">
                <Swords size={15} className="text-bronze-400" /> {c.name}
              </p>
              <span className="text-[10px] text-paper-faint">maj {dateFr(c.updatedAt)}</span>
            </div>
            <p className="mt-1 font-mono text-[12px] text-bronze-400">{c.pricing}</p>
            <dl className="mt-3 flex-1 space-y-2 text-[12px]">
              <div>
                <dt className="text-paper-faint">Forces</dt>
                <dd className="text-paper-dim">{c.strengths}</dd>
              </div>
              <div>
                <dt className="text-paper-faint">Faiblesses</dt>
                <dd className="text-paper-dim">{c.weaknesses}</dd>
              </div>
              <div className="rounded-lg border border-bronze-700/50 bg-bronze-900/20 p-2.5">
                <dt className="font-medium text-bronze-400">⚔ Notre contre</dt>
                <dd className="mt-0.5 text-paper">{c.counter}</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setEditing(c)}>Éditer</button>
              <button className="btn-danger" onClick={() => deleteCompetitor(c.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Fiche concurrent" wide>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Secteur</label>
                <select
                  className="input"
                  value={editing.sector}
                  onChange={(e) => setEditing({ ...editing, sector: e.target.value as Sector | "tous" })}
                >
                  <option value="tous">Tous</option>
                  <option value="restaurant">Restaurants</option>
                  <option value="pub">Pubs</option>
                  <option value="ambulance">Ambulances</option>
                  <option value="artisan">Artisans</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Pricing</label>
              <input className="input" value={editing.pricing} onChange={(e) => setEditing({ ...editing, pricing: e.target.value })} />
            </div>
            <div>
              <label className="label">Forces</label>
              <textarea className="input" value={editing.strengths} onChange={(e) => setEditing({ ...editing, strengths: e.target.value })} />
            </div>
            <div>
              <label className="label">Faiblesses</label>
              <textarea className="input" value={editing.weaknesses} onChange={(e) => setEditing({ ...editing, weaknesses: e.target.value })} />
            </div>
            <div>
              <label className="label">Notre contre (phrase terrain)</label>
              <textarea className="input" value={editing.counter} onChange={(e) => setEditing({ ...editing, counter: e.target.value })} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
            <button
              className="btn-bronze"
              onClick={() => {
                if (!editing.name.trim()) return;
                upsertCompetitor({ ...editing, updatedAt: new Date().toISOString() });
                setEditing(null);
              }}
            >
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
