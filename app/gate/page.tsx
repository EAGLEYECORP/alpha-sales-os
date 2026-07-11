"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Eagle } from "@/components/eagle";

/**
 * Écran de la porte d'accès. Serveur (middleware) redirige ici tant que le
 * cookie d'accès manque. Un mot de passe correct pose le cookie puis renvoie
 * vers la destination initiale (?next=…).
 */
export default function GatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        setError(d.error || "Accès refusé.");
        setPassword("");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <div className="card w-full max-w-sm p-7 text-center">
        <span className="mx-auto block animate-floaty text-bronze-400">
          <Eagle size={60} glow />
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
        />
        {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
        <button className="btn-bronze mt-4 w-full justify-center" onClick={submit} disabled={busy || !password}>
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
