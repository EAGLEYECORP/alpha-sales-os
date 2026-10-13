"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import type { Clientele, LectureSite, PropositionConfig, Provenance, Trouvaille } from "@/lib/lecture-site";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « TON SITE WEB » — le premier champ, et souvent le seul à remplir.
 *
 * L'inscrit colle son adresse ; le serveur lit son site
 * (`app/api/onboarding/site`) et rend ce qu'il a trouvé. Cet écran MONTRE la
 * lecture — chaque valeur avec d'où elle vient — et passe la proposition au
 * formulaire, qui reste modifiable.
 *
 * ⚠ ON MONTRE LA SOURCE, PAS SEULEMENT LA VALEUR. « Promotion immobilière »
 * lu dans « nous travaillons pour les promoteurs » et deviné au hasard ont
 * la même tête dans un champ texte. L'extrait, au survol, est ce qui permet
 * à l'inscrit de dire « non, ça c'est un ancien client ».
 *
 * ⚠ ET ON DIT CE QU'ON N'A PAS TROUVÉ. Un formulaire à moitié pré-rempli qui
 * ne dit rien ressemble à un formulaire complet.
 * ─────────────────────────────────────────────────────────────────────
 */

const SOURCE: Record<Provenance, string> = {
  "donnees-structurees": "données du site",
  balise: "description du site",
  titre: "titre de page",
  texte: "texte du site",
  lien: "lien du site",
  registre: "registre national",
};

function Ligne({ label, t }: { label: string; t: Trouvaille | null }) {
  if (!t) return null;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-[12px]" title={`${t.extrait}\n— ${t.page}`}>
      <span className="text-paper-faint">{label}</span>
      <span className="min-w-0 break-words text-paper">{t.valeur}</span>
      <span className="text-[10.5px] uppercase tracking-wide text-paper-faint">· {SOURCE[t.source]}</span>
    </li>
  );
}

export function LireMonSite({
  onProposition,
  onClientele,
}: {
  onProposition: (p: PropositionConfig) => void;
  onClientele: (c: Clientele) => void;
}) {
  const [url, setUrl] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState<LectureSite | null>(null);
  const [choisie, setChoisie] = useState("");

  const lire = async () => {
    if (!url.trim() || enCours) return;
    setEnCours(true);
    setErreur("");
    try {
      const res = await fetch("/api/onboarding/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        lecture?: LectureSite;
        proposition?: PropositionConfig;
      };
      if (!res.ok || !json.lecture || !json.proposition) {
        setErreur(json.error ?? `Lecture impossible (HTTP ${res.status}).`);
        setLecture(null);
        return;
      }
      setLecture(json.lecture);
      setChoisie(json.lecture.clienteles[0]?.id ?? "");
      onProposition(json.proposition);
    } catch {
      setErreur("Réseau indisponible — réessaie dans un instant.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="panel space-y-3 p-3">
      <div>
        <label className="label" htmlFor="site-inscrit">
          Ton site web <span className="text-bronze-400">— on configure Alpha à partir de lui</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="site-inscrit"
            className="input min-w-0 flex-1"
            inputMode="url"
            placeholder="monentreprise.fr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lire();
              }
            }}
          />
          <button type="button" onClick={() => void lire()} disabled={!url.trim() || enCours} className="btn-bronze disabled:opacity-40">
            {enCours ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            {enCours ? "Lecture…" : "Lire mon site"}
          </button>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
          On lit ton accueil, ta page contact et tes mentions légales — rien d&apos;autre. Tout ce qu&apos;on trouve
          remplit le formulaire ci-dessous : tu relis, tu corriges, tu valides.
        </p>
      </div>

      {erreur && <p className="text-[12px] text-signal-red">{erreur}</p>}

      {lecture && (
        <div className="space-y-2 border-t border-ink-700 pt-2">
          <p className="text-[11.5px] text-paper-faint">
            {lecture.pagesLues.length} page{lecture.pagesLues.length > 1 ? "s" : ""} lue
            {lecture.pagesLues.length > 1 ? "s" : ""} sur {lecture.site.replace(/^https?:\/\//, "")}. Survole une valeur
            pour voir où elle a été lue.
          </p>
          <ul className="space-y-1">
            <Ligne label="Société" t={lecture.nom} />
            <Ligne label="Activité" t={lecture.activite} />
            <Ligne label="Promesse" t={lecture.promesse} />
            <Ligne label="Ville" t={lecture.ville} />
            <Ligne label="Zone" t={lecture.zone} />
            <Ligne label="Email" t={lecture.email} />
            <Ligne label="Téléphone" t={lecture.telephone} />
            <Ligne label="Rendez-vous" t={lecture.lienRdv} />
            <Ligne label="Dirigeant" t={lecture.dirigeant} />
            <Ligne label="SIREN" t={lecture.siren} />
            {lecture.registre && (
              <li className="text-[12px]">
                <span className="text-paper-faint">Registre</span>{" "}
                <span className="text-paper">
                  {lecture.registre.raisonSociale}
                  {lecture.registre.ville ? ` — ${lecture.registre.ville}` : ""}
                </span>
              </li>
            )}
          </ul>

          {lecture.clienteles.length > 0 && (
            <div>
              <p className="text-[11.5px] text-paper-faint">
                Clientèles citées sur ton site — choisis celle que tu prospectes :
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {lecture.clienteles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.preuve.extrait}
                    aria-pressed={choisie === c.id}
                    onClick={() => {
                      setChoisie(c.id);
                      onClientele(c);
                    }}
                    className={
                      "panel px-2 py-1 text-[11.5px] transition-colors " +
                      (choisie === c.id ? "border-bronze-400 text-paper" : "text-paper-dim hover:text-paper")
                    }
                  >
                    {c.libelle} <span className="text-paper-faint">×{c.occurrences}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {lecture.manques.length > 0 && (
            <ul className="space-y-0.5">
              {lecture.manques.map((m) => (
                <li key={m} className="text-[11.5px] text-bronze-300">
                  · {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
