"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";

/**
 * Écran de connexion du déploiement public. Le middleware redirige ici tant
 * que le cookie d'accès manque. Séquence de marque : l'intro ALPHA SALES OS
 * (aigle + wordmark + filet d'or) joue, PUIS le formulaire se révèle.
 * Un mot de passe correct pose le cookie et renvoie vers la destination.
 */
export default function GatePage() {
  const [intro, setIntro] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // L'intro joue ~1,9 s puis laisse place au formulaire.
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1900);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || "/";
        // Rechargement dur pour que le middleware relise le cookie.
        window.location.assign(next.startsWith("/") ? next : "/");
      } else {
        const d = await res.json().catch(() => ({}));
        // Le compteur de tentatives doit se VOIR : un opérateur qui se trompe
        // trois fois doit savoir qu'il approche du blocage, et un blocage muet
        // ressemble à une panne.
        const suffixe =
          typeof d.reessayerDansSec === "number"
            ? ` Réessaie dans ${d.reessayerDansSec > 60 ? `${Math.ceil(d.reessayerDansSec / 60)} min` : `${d.reessayerDansSec} s`}.`
            : typeof d.restant === "number"
              ? ` ${d.restant} essai${d.restant > 1 ? "s" : ""} avant blocage.`
              : "";
        setError((d.error || "Accès refusé.") + suffixe);
        setPassword("");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center overflow-hidden bg-ink-950 px-4">
      {/* ── Intro de marque ── */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-10 grid place-items-center bg-ink-950 transition-opacity duration-700",
          intro ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={!intro}
      >
        <div className="text-center">
          <span className="mx-auto block animate-brand-in text-bronze-400">
            <Eagle size={96} glow />
          </span>
          <h1 className="mt-5 animate-fade-up font-display text-2xl font-extrabold tracking-[0.18em] text-paper [animation-delay:.3s]">
            ALPHA <span className="text-bronze-400">SALES OS</span>
          </h1>
          <div className="mx-auto mt-3 h-[3px] animate-gold-sweep rounded-full bg-gold" />
          <p className="mt-3 animate-fade-up font-mono text-[10px] uppercase tracking-[0.32em] text-paper-faint [animation-delay:.6s]">
            Eagleye Corp — Lyon
          </p>
        </div>
      </div>

      {/* ── Connexion ── */}
      <div
        className={cn(
          "card w-full max-w-sm p-7 text-center transition-all duration-700",
          intro ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        <span className="mx-auto block animate-floaty text-bronze-400">
          <Eagle size={56} glow />
        </span>
        <h1 className="mt-4 font-display text-lg font-extrabold text-paper">
          ALPHA <span className="text-bronze-400">SALES OS</span>
        </h1>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-paper-faint">
          <Lock size={12} /> Accès réservé — mot de passe requis
        </p>
        <input
          type="password"
          autoFocus
          className="input mt-5 text-center"
          placeholder="Mot de passe d'accès"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && password && !busy && submit()}
          disabled={intro}
        />
        {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
        <button className="btn-bronze mt-4 w-full justify-center" onClick={submit} disabled={busy || !password || intro}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
          {busy ? "Vérification…" : "Entrer"}
        </button>
        <p className="mt-4 text-[10.5px] leading-relaxed text-paper-faint">
          Ce tableau de bord contient des données commerciales confidentielles.
          Accès limité à EAGLEYE CORP.
        </p>
      </div>
    </div>
  );
}
