"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellOff, CalendarDays, Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Meeting, MeetingChannel, MeetingKind } from "@/lib/types";
import { cn, dateTimeFr, daysAhead, isOverdue, relativeFr, uid } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

const KIND_LABEL: Record<MeetingKind, string> = {
  audit: "Audit terrain",
  demo: "Démo mobile",
  closing: "Closing",
  suivi: "Suivi client",
};

const CHANNEL_LABEL: Record<MeetingChannel, string> = {
  appel: "📞 Appel",
  visio: "🎥 Visio",
  physique: "🤝 Physique",
};

export default function MeetingsPage() {
  const { meetings, prospects, upsertMeeting, deleteMeeting } = useAlpha();
  const [adding, setAdding] = useState(false);

  const upcoming = meetings.filter((m) => !m.done).sort((a, b) => a.date.localeCompare(b.date));
  const done = meetings.filter((m) => m.done).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Rendez-vous</h1>
          <p className="text-sm text-paper-faint">
            La démo mobile AVANT le prix — chaque RDV a un objectif d&apos;étape unique.
          </p>
        </div>
        <button className="btn-bronze" onClick={() => setAdding(true)}>
          <Plus size={15} /> RDV
        </button>
      </header>

      <section className="space-y-2">
        {upcoming.map((m) => {
          const p = prospects.find((x) => x.id === m.prospectId);
          const late = isOverdue(m.date);
          return (
            <div key={m.id} className={cn("card flex flex-wrap items-center gap-3 p-4", late && "border-signal-red/40")}>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-bronze-900/60 text-bronze-400">
                <CalendarDays size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-paper">{m.title}</p>
                <p className="text-[12px] text-paper-faint">
                  {KIND_LABEL[m.kind]} · {CHANNEL_LABEL[m.channel]} · {dateTimeFr(m.date)} ({relativeFr(m.date)}) · {m.durationMin} min · {m.location}
                  {p && (
                    <>
                      {" · "}
                      <Link href={`/prospects/${p.id}`} className="text-bronze-400 hover:underline">
                        {p.company}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.calLink && (
                  <a href={m.calLink} target="_blank" rel="noreferrer" className="btn-ghost px-2.5" title="Lien Cal.com">
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  className={cn("btn-ghost px-2.5", m.reminded && "border-bronze-700 text-bronze-400")}
                  title={m.reminded ? "Rappel envoyé" : "Marquer rappel envoyé"}
                  onClick={() => upsertMeeting({ ...m, reminded: !m.reminded })}
                >
                  {m.reminded ? <Bell size={14} /> : <BellOff size={14} />}
                </button>
                <button
                  className="btn-ghost px-2.5"
                  title="Marquer fait"
                  onClick={() => {
                    const outcome = prompt("Feedback du RDV + next step daté ? (alimente l'IA)") ?? "";
                    upsertMeeting({ ...m, done: true, outcome, feedback: outcome });
                  }}
                >
                  <Check size={14} />
                </button>
                <button className="btn-danger px-2.5" onClick={() => deleteMeeting(m.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {upcoming.length === 0 && (
          <p className="card p-6 text-center text-sm text-paper-faint">
            Aucun RDV à venir. Un pipeline sans rendez-vous est un pipeline qui refroidit.
          </p>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-sm font-semibold text-paper-faint">Passés</h2>
          <div className="space-y-2 opacity-70">
            {done.slice(0, 6).map((m) => (
              <div key={m.id} className="card flex items-center justify-between p-3 text-sm">
                <span className="text-paper-dim">
                  ✓ {m.title} — {dateTimeFr(m.date)}
                </span>
                {m.outcome && <span className="truncate text-[12px] text-paper-faint">{m.outcome}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {adding && <MeetingForm onClose={() => setAdding(false)} />}
    </div>
  );
}

function MeetingForm({ onClose }: { onClose: () => void }) {
  const { prospects, upsertMeeting } = useAlpha();
  const active = prospects.filter((p) => p.stage !== "perdu");
  const [form, setForm] = useState<Meeting>({
    id: uid(),
    prospectId: active[0]?.id ?? "",
    title: "",
    date: daysAhead(1),
    durationMin: 30,
    kind: "audit",
    channel: "physique",
    location: "Sur place",
    calLink: "",
    reminded: false,
    done: false,
  });

  return (
    <Modal open onClose={onClose} title="Nouveau rendez-vous">
      <div className="space-y-3">
        <div>
          <label className="label">Prospect</label>
          <select
            className="input"
            value={form.prospectId}
            onChange={(e) => {
              const p = active.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, prospectId: e.target.value, title: f.title || `${KIND_LABEL[f.kind]} — ${p?.company ?? ""}` }));
            }}
          >
            {active.map((p) => (
              <option key={p.id} value={p.id}>{p.company}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as MeetingKind }))}
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Canal</label>
            <select
              className="input"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as MeetingChannel }))}
            >
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Titre</label>
          <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date & heure</label>
            <input
              type="datetime-local"
              className="input"
              value={form.date.slice(0, 16)}
              onChange={(e) => setForm((f) => ({ ...f, date: new Date(e.target.value).toISOString() }))}
            />
          </div>
          <div>
            <label className="label">Durée (min)</label>
            <input
              type="number"
              className="input"
              value={form.durationMin}
              onChange={(e) => setForm((f) => ({ ...f, durationMin: +e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label">Lieu</label>
          <input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div>
          <label className="label">Lien Cal.com (optionnel)</label>
          <input
            className="input"
            placeholder="https://cal.com/eagleye/audit"
            value={form.calLink ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, calLink: e.target.value }))}
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button
          className="btn-bronze"
          onClick={() => {
            if (!form.title.trim()) return;
            upsertMeeting(form);
            onClose();
          }}
        >
          Planifier
        </button>
      </div>
    </Modal>
  );
}
