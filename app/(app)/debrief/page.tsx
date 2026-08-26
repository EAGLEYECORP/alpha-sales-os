"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Keyboard,
  Loader2,
  Mic,
  Save,
  Server,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { useSpeech } from "@/components/voice/use-speech";
import { useRecorder } from "@/components/voice/use-recorder";
import { extractDebrief, type DebriefDraft } from "@/lib/debrief";
import { leconDeDebrief } from "@/lib/apprentissage";
import { stageById } from "@/lib/hormozi";
import { cn } from "@/lib/utils";

/**
 * Débriefing vocal post-terrain.
 *
 * Le geste : tu sors du rendez-vous, tu ouvres cette page sur ton
 * téléphone, tu appuies, tu parles quarante secondes. ALPHA en tire
 * l'interlocuteur, les objections et la prochaine étape datée, tu
 * relis, tu écris dans le CRM. Trente secondes au lieu de dix minutes
 * le soir — dix minutes qu'on ne prend jamais.
 *
 * Rien n'est écrit sans relecture. Le brouillon est modifiable champ
 * par champ, et l'écran dit ce qu'il n'a PAS trouvé.
 */
export default function DebriefPage() {
  const { prospects, addEvent, setNextStep, moveStage, patchProspect, apprendre, settings } = useAlpha();
  const speech = useSpeech({ lang: "fr-FR", continuous: true });
  const recorder = useRecorder();

  // La transcription serveur (marche sur TOUS les navigateurs) est-elle branchée ?
  const [serverASR, setServerASR] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d) => setServerASR(Boolean(d.configured)))
      .catch(() => setServerASR(false));
  }, []);

  // Enregistrer → transcrire côté serveur → ajouter au texte (même champ que la voix).
  const dicterServeur = async () => {
    if (recorder.recording) {
      const t = await recorder.stop();
      if (t) speech.setTranscript([speech.transcript, t].filter(Boolean).join(" ").trim());
    } else {
      void recorder.start();
    }
  };

  const [prospectId, setProspectId] = useState("");
  const [draft, setDraft] = useState<DebriefDraft | null>(null);
  const [engine, setEngine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [typing, setTyping] = useState(false);
  const [applyStage, setApplyStage] = useState(true);
  const [cequiAMarche, setCequiAMarche] = useState("");

  // Les fiches les plus plausibles en premier : celles touchées récemment.
  const candidates = useMemo(
    () =>
      [...prospects]
        .filter((p) => p.stage !== "perdu")
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
        .slice(0, 60),
    [prospects]
  );

  const prospect = prospects.find((p) => p.id === prospectId) ?? null;
  const text = [speech.transcript, speech.interim].filter(Boolean).join(" ").trim();

  const analyse = async () => {
    if (text.length < 10) {
      setError("Parle au moins une phrase complète — ou écris-la.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction impossible");
      setDraft(json.draft as DebriefDraft);
      setEngine(json.engine ?? "");
    } catch (e) {
      // Le serveur est injoignable ? L'extraction tourne aussi côté client.
      setDraft(extractDebrief(text));
      setEngine("déterministe (hors-ligne)");
      setError(e instanceof Error ? `Serveur injoignable — extraction locale utilisée (${e.message})` : "");
    } finally {
      setBusy(false);
    }
  };

  const write = () => {
    if (!draft || !prospect) return;
    const now = new Date().toISOString();

    const parts = [
      draft.summary,
      draft.interlocutor ? `Interlocuteur : ${draft.interlocutor}` : "",
      draft.objections.length ? `Freins : ${draft.objections.map((o) => o.label).join(" ; ")}` : "",
    ].filter(Boolean);

    addEvent(prospect.id, {
      date: now,
      kind: draft.channel,
      summary: parts.join(" — ").slice(0, 400),
      ...(draft.nextStep ? { nextStep: draft.nextStep } : {}),
    });

    if (draft.nextStep) setNextStep(prospect.id, draft.nextStep);

    // Le transcript complet finit dans les notes : c'est la matière brute,
    // et c'est elle qu'on relit avant le rendez-vous suivant.
    const stamp = new Date().toLocaleDateString("fr-FR");
    patchProspect(prospect.id, {
      notes: [prospect.notes, `[Débrief ${stamp}] ${draft.notes}`].filter(Boolean).join("\n\n").slice(0, 6000),
    });

    /**
     * ── LE DÉBRIEF REVIENT DANS LE CERVEAU, PAS SEULEMENT DANS LA FICHE ──
     *
     * Jusqu'ici tout finissait dans les notes du prospect : relisible avant
     * SON rendez-vous suivant, invisible partout ailleurs. `leconDeDebrief`
     * existait et n'était appelée nulle part — la mémoire de terrain ne se
     * remplissait qu'aux objections et aux pertes.
     *
     * Les freins entendus valent comme « ce qui a coûté » : ce sont les
     * points où l'échange a accroché. La phrase qui a débloqué, elle, se
     * saisit — aucune extraction lexicale ne peut la trouver.
     *
     * `apprendre` rend null quand il n'y a aucun fait : un débrief vide ne
     * pollue pas le Cerveau, et l'identifiant déterministe fait qu'un
     * débrief rejoué met à jour au lieu d'empiler.
     */
    const leconEcrite = apprendre(
      leconDeDebrief({
        prospect,
        accountId: settings.accountId,
        resume: draft.summary,
        cequiAMarche,
        cequiACoute: draft.objections.map((o) => o.label).join(" ; "),
      })
    );

    let stageMsg = "";
    if (applyStage && draft.stageHint && draft.stageHint !== prospect.stage) {
      const r = moveStage(prospect.id, draft.stageHint);
      stageMsg = r.ok
        ? ` · étape → ${stageById(draft.stageHint).label}`
        : ` · étape non changée (${r.blockers[0]})`;
    }

    setSaved(
      `Écrit dans la fiche ${prospect.company}${stageMsg}${
        leconEcrite ? " · leçon versée au Cerveau" : ""
      }.`
    );
    setDraft(null);
    setCequiAMarche("");
    speech.reset();
  };

  const patchDraft = (over: Partial<DebriefDraft>) => setDraft((d) => (d ? { ...d, ...over } : d));

  return (
    <div className="space-y-4 animate-fade-up">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
          40 secondes de voix · au lieu de 10 minutes de saisie
        </p>
        <h1 className="font-display text-2xl font-bold text-paper">Débrief terrain</h1>
      </header>

      {/* ── 1. LA FICHE ── */}
      <section className="card p-4">
        <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
          Sur quelle fiche ?
        </label>
        <select
          className="input mt-1.5 w-full"
          value={prospectId}
          onChange={(e) => setProspectId(e.target.value)}
        >
          <option value="">— choisis la fiche —</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.company} — {p.name} ({stageById(p.stage).label})
            </option>
          ))}
        </select>
        {prospect && (
          <p className="mt-1.5 text-[11px] text-paper-faint">
            {prospect.city} · {prospect.sector} ·{" "}
            <Link href={`/prospects/${prospect.id}`} className="text-bronze-400 underline">
              ouvrir la fiche
            </Link>
          </p>
        )}
      </section>

      {/* ── 2. LA VOIX ── */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-paper">Ce que tu racontes</h2>
          <div className="flex flex-wrap items-center gap-2">
            {serverASR && !typing && (
              <button
                className={cn("px-2.5 py-1.5 text-[12px]", recorder.recording ? "btn-bronze animate-pulse" : "btn-ghost")}
                onClick={() => void dicterServeur()}
                disabled={recorder.transcribing}
                title="Dicter via le serveur — marche sur tous les navigateurs (Chromium, Brave, Firefox…)"
              >
                {recorder.transcribing ? (
                  <><Loader2 size={13} className="animate-spin" /> Transcription…</>
                ) : recorder.recording ? (
                  <><Square size={13} /> Arrêter</>
                ) : (
                  <><Server size={13} /> Dicter (serveur)</>
                )}
              </button>
            )}
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => setTyping((v) => !v)}>
              <Keyboard size={13} /> {typing ? "Revenir au micro" : "Écrire au clavier"}
            </button>
          </div>
        </div>

        {speech.supported === false && !typing && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] text-signal-amber">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {serverASR
              ? "La dictée du navigateur n'est pas dispo ici — utilise « Dicter (serveur) », ça marche partout."
              : "Ce navigateur ne sait pas transcrire (Chrome et Edge le savent, pas Firefox). Écris ton débrief, ou branche la transcription serveur (docs)."}
          </p>
        )}
        {recorder.error && <p className="mt-2 text-[12px] text-signal-red">{recorder.error}</p>}

        {typing || speech.supported === false ? (
          <textarea
            className="input mt-2 min-h-[140px] w-full font-sans text-[13px]"
            placeholder="Garage Bouchon, j'ai vu Marc le gérant, ils ratent des appels le samedi, il veut en parler à son associé, je rappelle jeudi."
            value={speech.transcript}
            onChange={(e) => speech.setTranscript(e.target.value)}
          />
        ) : (
          <>
            <div className="mt-3 flex items-center gap-3">
              <button
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition",
                  speech.listening
                    ? "animate-pulse bg-signal-red text-white"
                    : "bg-bronze-600 text-ink-900 hover:bg-bronze-500"
                )}
                onClick={speech.listening ? speech.stop : speech.start}
                aria-label={speech.listening ? "Arrêter" : "Parler"}
              >
                {speech.listening ? <Square size={22} /> : <Mic size={26} />}
              </button>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-paper">
                  {speech.listening ? "J'écoute — parle normalement." : "Appuie et raconte ton rendez-vous."}
                </p>
                <p className="text-[11px] text-paper-faint">
                  Qui tu as vu, ce qui bloque, ce que tu fais ensuite et quand. La date est le point qui compte.
                </p>
              </div>
            </div>
            <p className="mt-3 min-h-[80px] whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-850 p-3 text-[13px] text-paper">
              {speech.transcript}
              {speech.interim && <span className="text-paper-faint"> {speech.interim}</span>}
              {!text && <span className="text-paper-faint">Rien encore.</span>}
            </p>
          </>
        )}

        {speech.error && (
          <p className="mt-2 text-[12px] text-signal-red">
            {speech.error}
            {serverASR && " — ou clique « Dicter (serveur) » en haut, ça marche ici."}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-bronze px-3 py-2 text-[13px]" onClick={analyse} disabled={busy || text.length < 10}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Extraire
          </button>
          <button
            className="btn-ghost px-3 py-2 text-[13px]"
            onClick={() => {
              speech.reset();
              setDraft(null);
              setSaved("");
              setError("");
            }}
            disabled={!text && !draft}
          >
            <Trash2 size={13} /> Effacer
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-signal-amber">{error}</p>}
        {saved && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-signal-green">
            <Check size={13} /> {saved}
          </p>
        )}
      </section>

      {/* ── 3. LE BROUILLON ── */}
      {draft && (
        <section className="card border-bronze-700 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-paper">Brouillon — relis avant d&apos;écrire</h2>
            {engine && <span className="chip border-ink-700 text-paper-faint">{engine}</span>}
          </div>

          {draft.missing.length > 0 && (
            <ul className="mt-2 space-y-1">
              {draft.missing.map((m) => (
                <li key={m} className="flex items-start gap-1.5 text-[12px] text-signal-amber">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Résumé (va dans la timeline)">
              <textarea
                className="input min-h-[60px] w-full text-[13px]"
                value={draft.summary}
                onChange={(e) => patchDraft({ summary: e.target.value })}
              />
            </Field>

            <Field label="Interlocuteur">
              <input
                className="input w-full text-[13px]"
                placeholder="non entendu"
                value={draft.interlocutor ?? ""}
                onChange={(e) => patchDraft({ interlocutor: e.target.value })}
              />
            </Field>

            {/* Le seul champ qu'aucune extraction ne trouvera : la phrase qui
                a débloqué. C'est aussi le plus rentable — les objections se
                répètent par métier, presque mot pour mot, donc une réponse
                qui a marché ici marchera au rendez-vous suivant du même
                métier. Facultatif : un débrief vide n'écrit rien. */}
            <Field label="Ce qui a marché — la phrase qui a débloqué (va dans le Cerveau)">
              <input
                className="input w-full text-[13px]"
                placeholder="ex. « je lui ai fait compter ses appels manqués du samedi »"
                value={cequiAMarche}
                onChange={(e) => setCequiAMarche(e.target.value)}
              />
            </Field>

            <Field label="Prochaine étape — DATÉE">
              <div className="flex gap-2">
                <input
                  className="input w-full text-[13px]"
                  placeholder="Rappeler"
                  value={draft.nextStep?.action ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      nextStep: {
                        date: draft.nextStep?.date ?? new Date().toISOString(),
                        action: e.target.value,
                      },
                    })
                  }
                />
                <input
                  type="date"
                  className="input w-[150px] text-[13px]"
                  value={draft.nextStep?.date?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      nextStep: e.target.value
                        ? {
                            action: draft.nextStep?.action ?? "Reprendre contact",
                            date: new Date(`${e.target.value}T12:00:00`).toISOString(),
                          }
                        : undefined,
                    })
                  }
                />
              </div>
              {!draft.nextStep?.date && (
                <p className="mt-1 text-[11px] text-signal-amber">
                  Sans date, aucune prochaine étape n&apos;est écrite. La doctrine ne fait pas d&apos;exception.
                </p>
              )}
            </Field>

            <Field label="Canal">
              <div className="flex gap-2">
                {(["visite", "appel"] as const).map((c) => (
                  <button
                    key={c}
                    className={cn("chip", draft.channel === c ? "border-bronze-600 text-bronze-300" : "border-ink-700 text-paper-faint")}
                    onClick={() => patchDraft({ channel: c })}
                  >
                    {c === "visite" ? "Visite sur place" : "Appel"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {draft.objections.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">Freins entendus</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {draft.objections.map((o) => (
                  <li key={o.id} className="chip border-ink-700 text-paper">
                    {o.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.stageHint && prospect && draft.stageHint !== prospect.stage && (
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={applyStage}
                onChange={(e) => setApplyStage(e.target.checked)}
              />
              <span className="text-[12px] text-paper">
                Passer la fiche en <strong>{stageById(draft.stageHint).label}</strong>
                <span className="block text-[11px] text-paper-faint">
                  Suggestion tirée de tes mots. Décoche si la réalité ne l&apos;a pas encore fait : une fiche change
                  d&apos;étape quand la réalité change, jamais avant.
                </span>
              </span>
            </label>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-bronze px-3 py-2 text-[13px]" onClick={write} disabled={!prospect}>
              <Save size={14} /> Écrire dans le CRM
            </button>
            {!prospect && <span className="text-[12px] text-signal-amber">Choisis d&apos;abord la fiche.</span>}
            {prospect && (
              <Link href={`/prospects/${prospect.id}`} className="btn-ghost px-3 py-2 text-[13px]">
                Voir la fiche <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </section>
      )}

      <p className="px-1 text-[11px] text-paper-faint">
        Le micro du navigateur marche sur Chrome, Edge et Safari. Sur les autres (Chromium, Brave, Firefox),{" "}
        {serverASR ? "« Dicter (serveur) » prend le relais et marche partout." : "branche la transcription serveur (docs/VOIX.md) ou écris ton débrief."}{" "}
        L&apos;extraction tourne d&apos;abord sans IA — déterministe, hors-ligne, elle ne peut pas inventer de date.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">{label}</p>
      {children}
    </div>
  );
}
