"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { Eagle } from "@/components/eagle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const sendMagicLink = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="card w-full max-w-sm p-6 text-center">
        <span className="mx-auto block text-bronze-400">
          <Eagle size={72} glow />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-paper">ALPHA <span className="text-bronze-400">SALES OS</span><sup className="text-bronze-400">®</sup></h1>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-faint">Eagleye Corp</p>

        {supabaseEnabled() ? (
          status === "sent" ? (
            <p className="mt-6 text-sm text-signal-green">Lien magique envoyé ✓ — vérifie ta boîte mail.</p>
          ) : (
            <>
              <p className="mt-5 text-sm text-paper-faint">Connexion par lien magique (email).</p>
              <input
                type="email"
                className="input mt-4"
                placeholder="toi@eagleye.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
              />
              <button className="btn-bronze mt-3 w-full" disabled={status === "sending" || !email} onClick={sendMagicLink}>
                <Mail size={15} /> {status === "sending" ? "Envoi…" : "Recevoir le lien"}
              </button>
              {status === "error" && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
            </>
          )
        ) : (
          <>
            <p className="mt-5 text-sm text-paper-faint">
              Mode 100 % local — pas d&apos;authentification requise. Configure Supabase pour activer les liens magiques (voir README).
            </p>
            <Link href="/" className="btn-bronze mt-4 w-full">Entrer dans l&apos;OS</Link>
          </>
        )}
      </div>
    </div>
  );
}
