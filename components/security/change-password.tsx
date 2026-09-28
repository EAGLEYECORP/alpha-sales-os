"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePassword } from "@/lib/auth";

/**
 * Changer le mot de passe du compte connecté. Sert aussi la fin du parcours
 * « mot de passe oublié » : le lien de réinitialisation ramène l'utilisateur
 * ici, connecté, où il choisit un nouveau mot de passe.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (pw.length < 8) {
      setMsg({ ok: false, text: "8 caractères minimum." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await updatePassword(pw);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Mot de passe mis à jour ✓" });
      setPw("");
      setOpen(false);
    } else {
      setMsg({ ok: false, text: res.error ?? "Échec." });
    }
  };

  return (
    <div className="mt-3 border-t border-ink-800 pt-3">
      {!open ? (
        <button className="text-[12px] text-paper-faint hover:text-bronze-400" onClick={() => setOpen(true)}>
          <KeyRound size={12} className="mr-1 inline" /> Changer le mot de passe
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoFocus
            placeholder="Nouveau mot de passe"
            autoComplete="new-password"
            className="input w-56"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && save()}
          />
          <button className="btn-bronze" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Enregistrer"}
          </button>
          <button className="btn-ghost" onClick={() => { setOpen(false); setPw(""); setMsg(null); }}>
            Annuler
          </button>
        </div>
      )}
      {msg && (
        <p className={`mt-2 text-[12px] ${msg.ok ? "text-signal-green" : "text-signal-red"}`}>{msg.text}</p>
      )}
    </div>
  );
}
