"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileUp, Loader2, X } from "lucide-react";
import { extractFile, suggestTitle, type Extraction } from "@/lib/file-extract";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * IMPORT DE FICHIERS DANS LE CERVEAU — audits PDF, emails .html, comptes rendus.
 *
 * Tout se passe DANS LE NAVIGATEUR : le fichier n'est jamais téléversé nulle
 * part. C'est volontaire — un audit client contient des données commerciales
 * sensibles, et il n'y a aucune raison qu'elles transitent par un serveur pour
 * être converties en texte.
 *
 * Chaque fichier devient une note du Cerveau, donc immédiatement cherchable
 * (BM25) et réinjectable dans les prompts.
 */
export function FileImport({ onImported }: { onImported?: (ids: string[]) => void }) {
  const upsertNote = useAlpha((s) => s.upsertNote);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [results, setResults] = useState<{ name: string; ex: Extraction; noteId?: string }[]>([]);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const out: { name: string; ex: Extraction; noteId?: string }[] = [];
    const ids: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const ex = await extractFile(file.name, await file.arrayBuffer(), file.type);
        let noteId: string | undefined;
        // On ne crée une note QUE si l'extraction a donné quelque chose :
        // une note vide pollue le Cerveau et fausse les recherches.
        if (ex.ok && ex.text.trim()) {
          noteId = upsertNote({
            title: suggestTitle(file.name, ex.text),
            body: ex.text,
            tags: ["import", ex.kind],
            source: "auto",
          });
          ids.push(noteId);
        }
        out.push({ name: file.name, ex, noteId });
      } catch (e) {
        out.push({
          name: file.name,
          ex: { kind: "inconnu", text: "", chars: 0, ok: false, warning: e instanceof Error ? e.message : "échec de lecture" },
        });
      }
    }

    setResults((p) => [...out, ...p]);
    setBusy(false);
    if (ids.length && onImported) onImported(ids);
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <FileUp size={15} className="text-bronze-400" /> Nourrir le Cerveau
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-xl border border-dashed p-6 text-center transition-colors",
          drag ? "border-bronze-500 bg-bronze-900/15" : "border-line/60 hover:border-bronze-700/60"
        )}
      >
        {busy ? (
          <p className="flex items-center justify-center gap-2 text-[12px] text-paper-dim">
            <Loader2 size={14} className="animate-spin" /> Lecture en cours…
          </p>
        ) : (
          <>
            <p className="text-[13px] text-paper">Dépose tes fichiers ici, ou clique</p>
            <p className="mt-1 text-[11.5px] text-paper-faint">
              PDF · DOCX · HTML · Markdown · TXT · CSV — audits envoyés, emails exportés, comptes rendus
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.html,.htm,.md,.txt,.csv"
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-[11px] text-paper-faint">
        Rien n&apos;est téléversé : la lecture se fait entièrement dans ton navigateur. Tes audits
        clients ne quittent pas ta machine.
      </p>

      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-start gap-2 text-[11.5px]">
              {r.ex.ok ? (
                <Check size={13} className="mt-0.5 shrink-0 text-signal-green" />
              ) : (
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-signal-amber" />
              )}
              <span>
                <span className="text-paper">{r.name}</span>
                {r.ex.ok ? (
                  <span className="text-paper-faint">
                    {" "}— {r.ex.chars.toLocaleString("fr-FR")} caractères ajoutés au Cerveau
                  </span>
                ) : (
                  <span className="text-signal-amber"> — {r.ex.warning}</span>
                )}
              </span>
            </li>
          ))}
          <li>
            <button
              onClick={() => setResults([])}
              className="mt-1 flex items-center gap-1 text-[11px] text-paper-faint hover:text-paper"
            >
              <X size={11} /> Effacer la liste
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
