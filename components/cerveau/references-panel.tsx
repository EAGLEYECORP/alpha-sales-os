"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Check, ChevronDown, Download, Lock, Plus } from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  FIABILITES, STATUTS, referenceVersNotes, resumer, validerReference,
  type Reference, type StatutLecon,
} from "@/lib/references";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * RÉFÉRENCES — faire entrer un livre dans le Cerveau, sans l'y dissoudre.
 *
 * Ce que l'écran impose, et pourquoi :
 *
 *  · LE VERDICT AVANT LE BOUTON. On lit d'abord combien de leçons contredisent
 *    la doctrine et combien sont inapplicables faute de client. Une source
 *    s'ajoute en dix secondes ; ses conflits se paient sur un vrai prospect.
 *  · LES CONFLITS SONT DÉPLIÉS PAR DÉFAUT. Ce sont eux qui évitent l'erreur —
 *    les replier reviendrait à cacher la seule chose qui vaut d'être lue.
 *  · RIEN N'EST SEMÉ D'OFFICE. Une référence entre parce que quelqu'un a lu et
 *    cliqué. Un socle, on le subit ; une référence, on la choisit.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON: Record<StatutLecon, string> = {
  applicable: "border-signal-green/50 text-signal-green",
  "sous-condition": "border-signal-amber/60 text-signal-amber",
  "conflit-doctrine": "border-signal-red/60 text-signal-red",
  bloque: "border-ink-600 text-paper-faint",
};

export function ReferencesPanel() {
  const { upsertNote, logActivity } = useAlpha();
  const notes = useAlpha((s) => s.notes);

  const [livrees, setLivrees] = useState<Reference[] | null>(null);
  const [indispo, setIndispo] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [colle, setColle] = useState("");
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [fait, setFait] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/references")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { references: Reference[] }) => setLivrees(d.references ?? []))
      .catch(() => setIndispo("Le catalogue de références n'a pas répondu."));
  }, []);

  /** Une référence devient N notes. L'identifiant est déterministe : réimporter met à jour. */
  const importer = useCallback(
    (r: Reference) => {
      const produites = referenceVersNotes(r);
      for (const n of produites) {
        upsertNote({ id: n.id, title: n.title, body: n.body, tags: n.tags, source: "reference" });
      }
      const s = resumer(r);
      setFait(`${r.titre} — ${produites.length} note(s) dans le Cerveau.`);
      logActivity({
        kind: "campagne",
        message: `Référence importée : ${r.titre} (${s.total} leçons, ${s.conflits} conflit(s) de doctrine)`,
      });
    },
    [upsertNote, logActivity]
  );

  /** Import d'une source à toi, en JSON. La validation refuse ce qui n'est pas arbitrable. */
  const importerCollee = () => {
    setFait(null);
    let r: Reference;
    try {
      r = JSON.parse(colle) as Reference;
    } catch {
      setErreurs(["JSON invalide — vérifie les virgules et les guillemets."]);
      return;
    }
    const err = validerReference(r);
    if (err.length) {
      setErreurs(err.map((e) => `${e.champ} : ${e.message}`));
      return;
    }
    setErreurs([]);
    importer(r);
    setColle("");
  };

  const dejaImportee = (r: Reference) =>
    notes.some((n) => n.id === `ref-${r.id}-index` || n.id.startsWith(`ref-${r.id}-`));

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <BookOpen size={15} className="text-bronze-400" /> Références
        </h2>
        <span className="text-[11px] text-paper-faint">livres, vidéos, cours</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">
        Une source extérieure n&apos;est pas une vérité : c&apos;est l&apos;affirmation de quelqu&apos;un. Chaque leçon
        entre avec sa provenance, son niveau de preuve, et — surtout — le fait qu&apos;elle contredise ou non une règle
        maison. C&apos;est ça qui évite l&apos;erreur, pas le volume.
      </p>

      {indispo && (
        <p className="mt-2 rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-[11.5px] text-paper">
          {indispo}
        </p>
      )}
      {fait && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-2 text-[12px] text-signal-green">
          <Check size={13} /> {fait}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {(livrees ?? []).map((r) => {
          const s = resumer(r);
          const ouvert = ouverte === r.id;
          const dedans = dejaImportee(r);
          const aArbitrer = r.lecons.filter((l) => l.statut === "conflit-doctrine" || l.statut === "bloque");

          return (
            <li key={r.id} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-[14px] font-bold text-paper">{r.titre}</p>
                  <p className="text-[11.5px] text-paper-faint">
                    {[r.auteur, r.type, r.annee].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="chip border-bronze-700/50 text-bronze-400">
                  {FIABILITES.find((f) => f.id === r.fiabilite)?.label ?? r.fiabilite}
                </span>
              </div>

              <p className="mt-1.5 text-[12px] leading-relaxed text-paper-dim">{r.pourquoi}</p>

              <p
                className={cn(
                  "mt-2 rounded-lg px-2.5 py-1.5 text-[12px]",
                  s.conflits + s.bloquees > 0
                    ? "border border-signal-amber/40 bg-signal-amber/10 text-signal-amber"
                    : "border border-ink-700 text-paper-faint"
                )}
              >
                {s.verdict}
              </p>

              {/* Les conflits sont DÉPLIÉS : c'est la seule chose qui évite l'erreur. */}
              {aArbitrer.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {aArbitrer.map((l) => (
                    <li key={l.id} className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={cn("chip", TON[l.statut])}>
                          {l.statut === "conflit-doctrine" ? <AlertTriangle size={10} /> : <Lock size={10} />}
                          {STATUTS.find((x) => x.id === l.statut)?.label}
                        </span>
                        <span className="text-[12px] font-medium text-paper">{l.titre}</span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-paper-dim">{l.reserve}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  className="btn-bronze px-3 py-1.5 text-[12px]"
                  onClick={() => importer(r)}
                  title={dedans ? "Réimporter met à jour les notes existantes" : undefined}
                >
                  <Download size={13} /> {dedans ? "Mettre à jour" : `Importer ${r.lecons.length} leçons`}
                </button>
                <button
                  className="btn-ghost px-2.5 py-1.5 text-[12px]"
                  onClick={() => setOuverte(ouvert ? null : r.id)}
                >
                  <ChevronDown size={13} className={cn("transition-transform", ouvert && "rotate-180")} />
                  {ouvert ? "Replier" : "Voir les leçons"}
                </button>
                {dedans && <span className="text-[11px] text-signal-green">déjà dans le Cerveau</span>}
              </div>

              {ouvert && (
                <ul className="mt-2 space-y-1">
                  {r.lecons.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-baseline gap-2 text-[11.5px]">
                      <span className={cn("chip", TON[l.statut])}>{STATUTS.find((x) => x.id === l.statut)?.label}</span>
                      <span className="text-paper-dim">{l.titre}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Ta propre source. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-bronze-400">
          <Plus size={12} className="inline" /> Ajouter ta propre source (JSON)
        </summary>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-paper-faint">
          Chaque leçon doit porter un <code>statut</code>. Un statut{" "}
          <code>conflit-doctrine</code>, <code>bloque</code> ou <code>sous-condition</code> exige une{" "}
          <code>reserve</code> écrite : sans elle, personne ne saura quoi arbitrer dans six mois.
        </p>
        <textarea
          className="input mt-2 h-40 font-mono text-[11px]"
          placeholder={`{
  "id": "hormozi-100m-offers",
  "titre": "$100M Offers",
  "auteur": "Alex Hormozi",
  "type": "livre",
  "fiabilite": "praticien",
  "pourquoi": "La méthode pour rendre une offre impossible à comparer.",
  "lecons": [
    {
      "id": "grand-slam",
      "titre": "L'offre qu'on ne peut pas comparer",
      "quoi": "Empiler valeur, garantie et délai jusqu'à ce que le prix devienne secondaire.",
      "statut": "sous-condition",
      "reserve": "La garantie doit porter sur ce qu'on maîtrise — pas sur les ventes du client."
    }
  ]
}`}
          value={colle}
          onChange={(e) => {
            setColle(e.target.value);
            setErreurs([]);
            setFait(null);
          }}
        />
        {erreurs.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {erreurs.map((e) => (
              <li key={e} className="text-[11.5px] text-signal-red">
                {e}
              </li>
            ))}
          </ul>
        )}
        <button className="btn-bronze mt-2 px-3 py-1.5 text-[12px]" disabled={!colle.trim()} onClick={importerCollee}>
          <Plus size={13} /> Ajouter au Cerveau
        </button>
      </details>
    </section>
  );
}
