"use client";

import { useState } from "react";
import { Check, Clapperboard, Copy, ExternalLink, Loader2, Megaphone, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { PLATFORMS, shareIntentUrl, splitThread, type Platform } from "@/lib/social";
import { SEGMENTS } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Studio contenu — posts LinkedIn · X · Meta sur un sujet tech pour EAGLEYE.
 * Doctrine « assisté, jamais automatisé » : l'app rédige, l'humain publie
 * (intent de partage ou copier-coller). Vidéo optionnelle via json2video.
 */
export default function SocialPage() {
  const { settings } = useAlpha();
  const shareUrl = settings.bookingUrl?.trim() || "https://eagleyecorp.fr";

  const [topic, setTopic] = useState("");
  // À QUI on écrit. Vide = l'ICP du compte actif ; un segment = le métier
  // précis, avec ses mots. Un post qui ne nomme personne ne convertit personne.
  const [segmentId, setSegmentId] = useState("");
  const [angle, setAngle] = useState("");
  const [drafts, setDrafts] = useState<Record<Platform, string> | null>(null);
  const [engine, setEngine] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [video, setVideo] = useState<{ status: string; url?: string; error?: string } | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);

  const generate = async () => {
    if (topic.trim().length < 3) return setErr("Donne un sujet (quelques mots).");
    setLoading(true);
    setErr(null);
    setDrafts(null);
    setVideo(null);
    try {
      const res = await fetch("/api/social/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          angle,
          agencyName: settings.agencyName,
          offerLine: settings.offer?.whatYouSell,
          valueProp: settings.offer?.valueProp,
          audience: { accountId: settings.accountId, segmentId: segmentId || undefined },
        }),
      });
      const json = await res.json();
      if (!res.ok) setErr(json.error ?? "Échec.");
      else {
        setDrafts(json.drafts);
        setEngine(json.engine ?? "");
        setAudience(json.audience ?? "");
      }
    } catch {
      setErr("Réseau.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  };

  const makeVideo = async () => {
    if (!drafts) return;
    setVideoBusy(true);
    setVideo({ status: "rendering" });
    // Découpe le post LinkedIn en répliques courtes → une scène par ligne.
    const lines = drafts.linkedin
      .split(/\n+/)
      .map((l) => l.replace(/#\S+/g, "").trim())
      .filter((l) => l.length > 0 && l.length < 120)
      .slice(0, 8);
    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines, subtitle: topic }),
      });
      const job = await res.json();
      if (!res.ok) {
        setVideo({ status: "error", error: job.error });
        setVideoBusy(false);
        return;
      }
      if (job.status === "done") {
        setVideo({ status: "done", url: job.url });
        setVideoBusy(false);
        return;
      }
      // Sonder jusqu'à done/error.
      const project = job.id as string;
      const poll = async (n: number) => {
        if (n > 40) {
          setVideo({ status: "error", error: "délai dépassé" });
          setVideoBusy(false);
          return;
        }
        const r = await fetch(`/api/video/render?project=${encodeURIComponent(project)}`);
        const s = await r.json();
        if (s.status === "done") {
          setVideo({ status: "done", url: s.url });
          setVideoBusy(false);
        } else if (s.status === "error") {
          setVideo({ status: "error", error: s.error });
          setVideoBusy(false);
        } else {
          setTimeout(() => poll(n + 1), 3000);
        }
      };
      setTimeout(() => poll(0), 3000);
    } catch {
      setVideo({ status: "error", error: "réseau" });
      setVideoBusy(false);
    }
  };

  return (
    <div className="page mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Contenu · assisté, jamais automatisé"
        icon={<Megaphone size={22} className="text-bronze-400" />}
        title="Studio social"
        subtitle="Un sujet tech → un post calibré par plateforme. Tu relis, tu publies. Aucun auto-post."
      />

      <section className="card p-4">
        <label className="label">Sujet (tech, EAGLEYE)</label>
        <input
          className="input"
          placeholder="ex. L'IA qui répond aux appels manqués d'un resto"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && generate()}
        />
        <label className="label mt-3">Pour qui (le métier visé)</label>
        <select className="input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
          <option value="">Le client idéal du compte (ICP par défaut)</option>
          {SEGMENTS.map((sg) => (
            <option key={sg.id} value={sg.id}>
              {sg.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-paper-faint">
          Le post nomme SON métier et SA douleur. Sans cible, il ressemble à celui de toutes les agences.
        </p>

        <label className="label mt-3">Angle (optionnel)</label>
        <input
          className="input"
          placeholder="ex. retour d'expérience terrain, chiffre marquant, mythe à casser…"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
        />
        <button className="btn-bronze mt-3" onClick={generate} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? "Rédaction…" : "Générer les posts"}
        </button>
        {err && <p className="mt-2 text-[12px] text-signal-red">{err}</p>}
        {engine && drafts && (
          <p className="mt-2 text-[11px] text-paper-faint">
            Moteur : {engine}
            {audience && <> · écrit pour : <span className="text-paper-dim">{audience}</span></>}
          </p>
        )}
      </section>

      {drafts &&
        (Object.keys(PLATFORMS) as Platform[]).map((p) => {
          const text = drafts[p];
          const intent = shareIntentUrl(p, { text, url: shareUrl });
          const thread = p === "x" ? splitThread(text) : null;
          return (
            <section key={p} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-paper">{PLATFORMS[p].label}</h2>
                <span className="font-mono text-[10px] text-paper-faint">
                  {text.length}/{PLATFORMS[p].limit} car{thread && thread.length > 1 ? ` · fil ${thread.length}` : ""}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900 p-3 font-sans text-[13px] text-paper-dim">
                {text}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => copy(p, text)}>
                  {copied === p ? <Check size={14} className="text-signal-green" /> : <Copy size={14} />}
                  {copied === p ? "Copié" : "Copier"}
                </button>
                {intent && (
                  <a className="btn-ghost" href={intent} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> {p === "x" ? "Ouvrir X" : p === "linkedin" ? "Ouvrir LinkedIn" : "Partager (Meta)"}
                  </a>
                )}
              </div>
              {p !== "x" && (
                <p className="mt-1.5 text-[10.5px] text-paper-faint">
                  {PLATFORMS[p].label} ne pré-remplit que le lien — copie le texte, il ne partira pas tout seul.
                </p>
              )}
            </section>
          );
        })}

      {drafts && (
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Clapperboard size={15} className="text-bronze-400" /> Vidéo (optionnel)
          </h2>
          <p className="mt-1 text-[12px] text-paper-faint">
            Rend une vidéo verticale à partir du post LinkedIn (json2video). Nécessite{" "}
            <code className="code">JSON2VIDEO_API_KEY</code>. Un endpoint GPU (HunyuanVideo) peut être branché via{" "}
            <code className="code">VIDEO_GEN_ENDPOINT</code>.
          </p>
          <button className="btn-bronze mt-3" onClick={makeVideo} disabled={videoBusy}>
            {videoBusy ? <Loader2 size={15} className="animate-spin" /> : <Clapperboard size={15} />}
            {videoBusy ? "Rendu en cours…" : "Générer une vidéo"}
          </button>
          {video?.status === "done" && video.url && (
            <a className="mt-3 block text-[13px] text-bronze-400 hover:underline" href={video.url} target="_blank" rel="noopener noreferrer">
              ▶ Vidéo prête — ouvrir / télécharger
            </a>
          )}
          {video?.status === "error" && <p className="mt-2 text-[12px] text-signal-red">Échec : {video.error}</p>}
        </section>
      )}

      <p className={cn("px-1 text-[10.5px] italic text-paper-faint")}>
        Publier via API (LinkedIn/Meta) demande des apps OAuth approuvées + jetons par compte — hors périmètre
        volontairement : l&apos;humain garde la main sur ce qui sort.
      </p>
    </div>
  );
}
