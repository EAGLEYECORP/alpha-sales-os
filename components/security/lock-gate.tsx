"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAlpha, useHydrated } from "@/lib/store";
import { sha256 } from "@/lib/utils";

const SESSION_KEY = "alpha-unlock";

/** Force a lock (used by the Settings « Verrouiller » button). */
export function lockNow() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

/**
 * App-lock overlay. When a PIN is set with autoLock, the OS asks for it
 * once per browser session before rendering anything. Defense-in-depth for
 * a laptop left open — not a substitute for Supabase auth in team mode.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const security = useAlpha((s) => s.settings.security);
  // Default OPEN so the server-rendered page always has content — the lock
  // clamps down right after hydration when a PIN is configured. Never gate
  // SSR on client-only state: a blocked script would blank the whole app.
  const [unlocked, setUnlocked] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!security?.pinHash || !security.autoLock) {
      setUnlocked(true);
      return;
    }
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === security.pinHash);
  }, [hydrated, security?.pinHash, security?.autoLock]);

  const tryUnlock = async () => {
    const hash = await sha256(pin);
    if (hash === security?.pinHash) {
      sessionStorage.setItem(SESSION_KEY, hash);
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <div className="card w-full max-w-xs p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-bronze-900/80 text-bronze-400">
          <Lock size={22} />
        </span>
        <h1 className="mt-4 font-display text-lg font-bold text-paper">OS verrouillé</h1>
        <p className="mt-1 text-[12px] text-paper-faint">Entre le PIN pour déverrouiller ALPHA SALES OS.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="input mt-4 text-center font-mono tracking-[0.5em]"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
        />
        {error && <p className="mt-2 text-[12px] text-signal-red">PIN incorrect.</p>}
        <button className="btn-bronze mt-4 w-full" onClick={tryUnlock}>
          Déverrouiller
        </button>
      </div>
    </div>
  );
}
