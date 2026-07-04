"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Mail } from "lucide-react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

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
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-bronze-500 text-ink-950">
          <Eye size={24} strokeWidth={2.5} />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-paper">ALPHA SALES OS<sup className="text-bronze-500">®</sup></h1>
        <p className="text-[12px] uppercase tracking-[0.2em] text-bronze-500">Eagleye Corp</p>

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
