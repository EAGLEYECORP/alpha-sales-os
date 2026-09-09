"use client";

import { useState } from "react";
import type { Prospect, Sector } from "@/lib/types";
import { STAGES } from "@/lib/hormozi";
import { daysAhead, uid } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { Modal } from "@/components/ui/modal";

const emptyProspect = (): Prospect => ({
  id: uid(),
  name: "",
  company: "",
  sector: "restaurant",
  city: "Lyon",
  stage: "prospect",
  trust: 10,
  auditScore: 0,
  conviction: 8,
  monthlyValue: 290,
  setupValue: 1800,
  probability: 5,
  ignoranceTax: 1500,
  croyances: { produit: 5, soutien: 5, pourLui: 3 },
  obstacles: [],
  objections: [],
  events: [],
  demoShownBeforePrice: false,
  nextStep: { date: daysAhead(2), action: "Premier contact terrain" },
  tags: [],
  attachments: [],
  notes: "",
  likeness: 50,
  deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
  problems: [],
  solution: "",
  personalizedOffer: "",
  payments: [],
  contract: { status: "aucun" },
  delivery: "non-demarre",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function ProspectFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Prospect;
}) {
  const upsert = useAlpha((s) => s.upsertProspect);
  const [form, setForm] = useState<Prospect>(initial ?? emptyProspect());

  const set = <K extends keyof Prospect>(key: K, value: Prospect[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.company.trim() || !form.name.trim()) return;
    upsert(form);
    onClose();
    if (!initial) setForm(emptyProspect());
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Modifier le prospect" : "Nouveau prospect"} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Commerce</label>
          <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="SCCV Les Terrasses des Canuts" />
        </div>
        <div>
          <label className="label">Décideur</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Marc Perrin" />
        </div>
        <div>
          <label className="label">Secteur</label>
          <select className="input" value={form.sector} onChange={(e) => set("sector", e.target.value as Sector)}>
            <option value="restaurant">Restaurant</option>
            <option value="pub">Pub</option>
            <option value="ambulance">Ambulance</option>
            <option value="artisan">Artisan</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="label">Ville / quartier</label>
          <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="label">LinkedIn (profil / page)</label>
          <input className="input" placeholder="linkedin.com/in/…" value={form.linkedin ?? ""} onChange={(e) => set("linkedin", e.target.value)} />
        </div>
        <div>
          <label className="label">Setup (€)</label>
          <input type="number" className="input" value={form.setupValue} onChange={(e) => set("setupValue", +e.target.value)} />
        </div>
        <div>
          <label className="label">Abonnement (€/mois)</label>
          <input type="number" className="input" value={form.monthlyValue} onChange={(e) => set("monthlyValue", +e.target.value)} />
        </div>
        <div>
          <label className="label">Taxe d&apos;Ignorance (€/mois perdus)</label>
          <input type="number" className="input" value={form.ignoranceTax} onChange={(e) => set("ignoranceTax", +e.target.value)} />
        </div>
        <div>
          <label className="label">Étape</label>
          <select
            className="input"
            value={form.stage}
            onChange={(e) => {
              const stage = e.target.value as Prospect["stage"];
              const prob = STAGES.find((s) => s.id === stage)?.probability ?? 5;
              setForm((f) => ({ ...f, stage, probability: prob }));
            }}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Next step daté (obligatoire — doctrine)</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="input w-40"
              value={form.nextStep?.date.slice(0, 10) ?? ""}
              onChange={(e) =>
                set("nextStep", { date: new Date(e.target.value).toISOString(), action: form.nextStep?.action ?? "" })
              }
            />
            <input
              className="input flex-1"
              value={form.nextStep?.action ?? ""}
              onChange={(e) => set("nextStep", { date: form.nextStep?.date ?? daysAhead(2), action: e.target.value })}
              placeholder="Passer au commerce à 15h avec la maquette mobile"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes terrain</label>
          <textarea className="input min-h-20" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn-bronze" onClick={submit}>
          {initial ? "Enregistrer" : "Ajouter au pipeline"}
        </button>
      </div>
    </Modal>
  );
}
