"use client";

import { useMemo, useState } from "react";
import { Brain, Plus, Search, Trash2, Link2, Sparkles, Loader2, Download, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { buildIdentity } from "@/lib/identity";
import { search, backlinks, extractLinks, contextFromNotes, type KnowledgeNote } from "@/lib/knowledge";
import { cn, relativeFr } from "@/lib/utils";

export default function CerveauPage() {
  const notes = useAlpha((s) => s.notes);
  const prospects = useAlpha((s) => s.prospects);
  const settings = useAlpha((s) => s.settings);
  const { upsertNote, deleteNote } = useAlpha();

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);

  // Liste : recherche RAG si requête, sinon les plus récentes.
  const list = useMemo(() => {
    if (q.trim()) return search(q, notes, 30).map((s) => s.note);
    return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [q, notes]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const newNote = () => {
    const id = upsertNote({ title: "Nouvelle note", body: "", tags: [] });
    setSelectedId(id);
    setQ("");
  };

  // Aspirer les prospects : une note par fiche, à partir de la donnée réelle.
  const ingestProspects = () => {
    let n = 0;
    for (const p of prospects) {
      const bits = [
        p.solution && `Solution : ${p.solution}`,
        p.personalizedOffer && `Offre : ${p.personalizedOffer}`,
        p.problems?.length ? `Problèmes : ${p.problems.join(" ; ")}` : "",
        p.deepAudit?.currentProcess && `Process actuel : ${p.deepAudit.currentProcess}`,
        p.deepAudit?.websiteState && `Site : ${p.deepAudit.websiteState}`,
        p.notes && `Notes : ${p.notes}`,
      ].filter(Boolean);
      if (bits.length === 0) continue;
      upsertNote({
        id: `prospect:${p.id}`,
        title: `${p.company} (${p.sector})`,
        body: bits.join("\n"),
        tags: [String(p.sector), p.stage],
        source: "intel",
      });
      n += 1;
    }
    alert(n > 0 ? `${n} fiche(s) aspirée(s) dans le Cerveau.` : "Aucune fiche avec du contenu à aspirer.");
  };

  return (
    <div className="animate-fade-up space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">RAG · zéro dépendance · hors-ligne</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-paper">
            <Brain size={22} className="text-bronze-400" /> Cerveau
          </h1>
          <p className="text-sm text-paper-faint">Toutes tes infos au même endroit — cherchées par pertinence, reliées en <code className="font-mono text-bronze-400">[[wikilinks]]</code>, interrogeables.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={ingestProspects}><Download size={14} /> Aspirer mes prospects</button>
          <button className="btn-bronze" onClick={newNote}><Plus size={14} /> Nouvelle note</button>
        </div>
      </header>

      <AskBrain notes={notes} settings={settings} onOpen={(id) => setSelectedId(id)} />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Colonne gauche : recherche + liste */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-faint" />
            <input
              className="input pl-9"
              placeholder="Chercher (BM25)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p className="px-1 text-[11px] text-paper-faint">{list.length} note{list.length > 1 ? "s" : ""}{q.trim() ? " · par pertinence" : ""}</p>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition",
                    n.id === selectedId ? "border-bronze-600 bg-bronze-900/30" : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  )}
                  onClick={() => setSelectedId(n.id)}
                >
                  <p className="truncate text-[13px] font-medium text-paper">{n.title}</p>
                  <p className="truncate text-[11px] text-paper-faint">{n.body.replace(/[#*[\]]/g, "").slice(0, 60) || "—"}</p>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="rounded-lg border border-dashed border-ink-700 px-3 py-4 text-center text-[12px] text-paper-faint">Rien trouvé.</li>}
          </ul>
        </div>

        {/* Colonne droite : éditeur + rétroliens */}
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            notes={notes}
            onSave={(patch) => upsertNote({ id: selected.id, title: patch.title, body: patch.body, tags: patch.tags, source: selected.source })}
            onDelete={() => { deleteNote(selected.id); setSelectedId(null); }}
            onOpenTitle={(title) => {
              const found = notes.find((x) => x.title.toLowerCase() === title.toLowerCase());
              if (found) setSelectedId(found.id);
              else { const id = upsertNote({ title, body: "" }); setSelectedId(id); }
            }}
          />
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-ink-700 p-10 text-center text-[13px] text-paper-faint">
            Sélectionne une note, ou crée-en une.
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEditor({
  note, notes, onSave, onDelete, onOpenTitle,
}: {
  note: KnowledgeNote;
  notes: KnowledgeNote[];
  onSave: (patch: { title: string; body: string; tags: string[] }) => void;
  onDelete: () => void;
  onOpenTitle: (title: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tagsRaw, setTagsRaw] = useState(note.tags.join(", "));
  const dirty = title !== note.title || body !== note.body || tagsRaw !== note.tags.join(", ");

  const save = () => onSave({ title: title.trim() || "Sans titre", body, tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) });

  const links = extractLinks(body);
  const back = backlinks(note.title, notes);

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <div className="flex items-center gap-2">
          <input className="input flex-1 font-display text-base font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn-bronze" onClick={save} disabled={!dirty}>Enregistrer</button>
          <button className="btn-ghost text-signal-red" onClick={() => confirm("Supprimer cette note ?") && onDelete()}><Trash2 size={14} /></button>
        </div>
        <input className="input mt-2 text-[12px]" placeholder="tags (séparés par des virgules)" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} />
        <textarea
          className="input mt-2 min-h-[42vh] font-mono text-[12.5px] leading-relaxed"
          placeholder="Corps de la note (markdown). Relie avec [[Titre d'une autre note]]."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-paper-faint">Maj {relativeFr(note.updatedAt)} · {note.source}</p>
      </section>

      {(links.length > 0 || back.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkPanel title="Liens sortants" icon={<Link2 size={13} />} items={links} onClick={onOpenTitle} />
          <LinkPanel title="Rétroliens (mentionnée par)" icon={<Link2 size={13} className="rotate-180" />} items={back.map((b) => b.title)} onClick={onOpenTitle} />
        </div>
      )}
    </div>
  );
}

function LinkPanel({ title, icon, items, onClick }: { title: string; icon: React.ReactNode; items: string[]; onClick: (t: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="card p-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">{icon} {title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <button key={t} className="chip border-bronze-700/50 text-bronze-400 hover:bg-bronze-900/30" onClick={() => onClick(t)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function AskBrain({ notes, settings, onOpen }: { notes: KnowledgeNote[]; settings: ReturnType<typeof useAlpha.getState>["settings"]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [engine, setEngine] = useState<string>("");
  const [sources, setSources] = useState<KnowledgeNote[]>([]);
  const [open, setOpen] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setAnswer("");
    const hits = search(q, notes, 6);
    setSources(hits.map((h) => h.note));
    setOpen(true);
    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, context: contextFromNotes(hits), identity: buildIdentity(settings) }),
      });
      const data = await res.json();
      setAnswer(data.answer ?? "");
      setEngine(data.engine ?? "");
    } catch {
      setEngine("hors-ligne");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-bronze-400" />
        <input
          className="input flex-1"
          placeholder="Demander au Cerveau… (ex : « quelle offre pour un garage qui rate des appels ? »)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button className="btn-bronze" onClick={ask} disabled={busy || !q.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Demander
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-bronze-700/40 bg-bronze-900/10 p-3">
          <div className="flex items-start justify-between gap-2">
            {answer ? (
              <p className="whitespace-pre-wrap text-[13px] text-paper-dim">{answer}</p>
            ) : busy ? (
              <p className="text-[12px] text-paper-faint">Le Cerveau réfléchit…</p>
            ) : (
              <p className="text-[12px] text-paper-faint">{sources.length ? "Pas de synthèse IA (aucune clé) — voici les notes pertinentes ci-dessous." : "Rien de pertinent dans le Cerveau. Ajoute des notes ou aspire tes prospects."}</p>
            )}
            <button className="text-paper-faint hover:text-paper" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>

          {sources.length > 0 && (
            <div className="mt-2 border-t border-ink-700 pt-2">
              <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">Sources ({sources.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((n) => (
                  <button key={n.id} className="chip border-ink-600 text-paper-dim hover:border-bronze-600 hover:text-bronze-400" onClick={() => onOpen(n.id)}>{n.title}</button>
                ))}
              </div>
            </div>
          )}
          {engine && <p className="mt-2 text-[10.5px] italic text-paper-faint">Moteur : {engine} · réponse fondée sur tes notes.</p>}
        </div>
      )}
    </section>
  );
}
