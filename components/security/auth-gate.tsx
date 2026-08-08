"use client";

import { useEffect, useState } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { authAvailable, getCurrentUser, onAuthChange, signIn, signUp, type AuthUser } from "@/lib/auth";
import { Eagle } from "@/components/eagle";

/**
 * Mur de connexion multi-locataire (SaaS).
 *
 * Quand un commercial active « Exiger un compte » (Réglages → Sécurité) ET
 * que Supabase est lié, l'app exige un compte email + mot de passe avant de
 * rien afficher. Chaque compte est isolé par la RLS (user_id) côté Supabase.
 *
 * Comme LockGate : on rend les enfants par défaut (le serveur n'a aucun état
 * client), puis on referme après hydratation si aucune session n'est ouverte.
 * Un script bloqué ne doit jamais blanchir l'app.
 *
 * ⚠ Non vérifié contre un vrai projet Supabase dans l'environnement de build.
 * À tester à deux comptes avant de facturer (voir docs/SECURITE.md).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const requireAuth = useAlpha((s) => s.settings.security?.requireAuth);

  // Ouvert par défaut : le SSR et le premier rendu client montrent le contenu.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const gateOn = Boolean(hydrated && requireAuth && authAvailable());

  useEffect(() => {
    if (!gateOn) {
      setChecked(true);
      return;
    }
    let alive = true;
    getCurrentUser().then((u) => {
      if (alive) {
        setUser(u);
        setChecked(true);
      }
    });
    const off = onAuthChange((u) => alive && setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, [gateOn]);

  // Porte fermée seulement si : gate active, vérification faite, aucune session.
  if (!gateOn || !checked || user) return <>{children}</>;

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Email et mot de passe requis.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = mode === "up" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Échec.");
      return;
    }
    if (res.needsConfirm) {
      setInfo("Compte créé — confirme l'email reçu, puis connecte-toi.");
      setMode("in");
      setPassword("");
    }
    // Sinon onAuthChange met à jour la session et la porte s'ouvre.
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <span className="mx-auto block animate-floaty text-bronze-400">
          <Eagle size={64} glow />
        </span>
        <h1 className="mt-4 font-display text-lg font-extrabold text-paper">
          ALPHA <span className="text-bronze-400">SALES OS</span>
        </h1>
        <p className="mt-1 text-[12px] text-paper-faint">
          {mode === "in" ? "Connecte-toi à ton compte." : "Crée ton compte commercial."}
        </p>

        <input
          type="email"
          autoFocus
          placeholder="Email"
          autoComplete="email"
          className="input mt-4 text-center"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="input mt-2 text-center"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
        />

        {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
        {info && <p className="mt-2 text-[12px] text-signal-green">{info}</p>}

        <button className="btn-bronze mt-4 w-full" onClick={submit} disabled={busy}>
          {busy ? "…" : mode === "in" ? "Se connecter" : "Créer le compte"}
        </button>

        <button
          className="mt-3 text-[12px] text-paper-faint hover:text-bronze-400"
          onClick={() => {
            setMode((m) => (m === "in" ? "up" : "in"));
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "in" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>

        <p className="mt-4 border-t border-ink-700 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-paper-faint">
          Eagleye Corp — Lyon · données isolées par compte
        </p>
      </div>
    </div>
  );
}
