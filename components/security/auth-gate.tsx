"use client";

import { useEffect, useState } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { authAvailable, getCurrentUser, onAuthChange, resetPassword, signIn, signUp, type AuthUser } from "@/lib/auth";
import { Eagle } from "@/components/eagle";

/**
 * Mur de connexion multi-locataire (SaaS).
 *
 * L'app exige un compte email + mot de passe avant de rien afficher. Chaque
 * compte est isolé par la RLS (user_id) côté Supabase.
 *
 * ⚠ CE QUI DÉCLENCHE CE MUR A CHANGÉ, ET C'ÉTAIT LE DÉFAUT.
 *
 * Il ne se fermait que sur `settings.security.requireAuth` — un réglage stocké
 * dans le NAVIGATEUR. Conséquence : un navigateur neuf (celui d'un client à
 * qui on ouvre un accès, le tien en navigation privée, un autre appareil) ne
 * l'avait pas, donc ne voyait JAMAIS l'écran de connexion — quelle que soit
 * la configuration du serveur. Une serrure dont l'existence dépend du
 * trousseau de celui qui entre n'est pas une serrure.
 *
 * Il écoute maintenant le SERVEUR (`GET /api/gate` → `compteRequis`, dérivé de
 * `verrouDeComptesActif`). Le réglage local reste accepté : il permet à un
 * opérateur d'exiger la connexion sur SON poste avant même que le serveur
 * l'impose. Les deux ferment ; aucun des deux n'ouvre à la place de l'autre.
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

  /**
   * Ce que le SERVEUR demande. `null` = pas encore répondu — et tant qu'on ne
   * sait pas, on ne conclut pas : voir `gateOn` plus bas.
   */
  const [serveur, setServeur] = useState<{ compteRequis: boolean; clientPeutSeConnecter: boolean } | null>(null);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Le serveur, une fois. Une panne réseau laisse `serveur` à null : on
  // retombe alors sur le réglage local, jamais sur « ouvert ».
  useEffect(() => {
    let vivant = true;
    fetch("/api/gate")
      .then((r) => r.json())
      .then((j) => vivant && setServeur({
        compteRequis: Boolean(j?.compteRequis),
        clientPeutSeConnecter: Boolean(j?.clientPeutSeConnecter),
      }))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * ⚠ OU, PAS ET. Le serveur ferme, ou l'opérateur ferme sur son poste. Un
   * `&&` ici rendrait le mur serveur inopérant sur tout navigateur qui n'a pas
   * le réglage — c'est exactement le bug qu'on vient de corriger.
   */
  const exige = Boolean(serveur?.compteRequis) || Boolean(requireAuth);
  const gateOn = Boolean(hydrated && exige && authAvailable());

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

  /**
   * ⚠ L'IMPASSE, DITE AU LIEU D'ÊTRE SUBIE.
   *
   * Le serveur exige un compte, et ce navigateur n'a pas de quoi en ouvrir un
   * (`NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` absents du build). Sans ce cas,
   * `authAvailable()` étant faux, `gateOn` retombait à faux et on affichait
   * une coquille dont chaque appel répond 401 — l'utilisateur tourne en rond
   * sans jamais voir de formulaire. On refuse, et on dit pourquoi.
   */
  if (hydrated && serveur?.compteRequis && !serveur.clientPeutSeConnecter) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="font-display text-lg font-extrabold text-paper">Connexion impossible</h1>
          <p className="mt-2 text-[12px] text-paper-faint">
            Ce déploiement exige un compte, mais l&apos;application n&apos;a pas de quoi en ouvrir un.
          </p>
          <p className="mt-3 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-left font-mono text-[11px] text-paper">
            NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquent au build.
          </p>
          <p className="mt-2 text-[11px] text-paper-faint">
            Pose-les côté serveur puis redéploie — elles doivent exister au moment du build.
          </p>
        </div>
      </div>
    );
  }

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

  const forgot = async () => {
    if (!email.trim()) {
      setError("Entre ton email d'abord, puis « mot de passe oublié ».");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await resetPassword(email);
    setBusy(false);
    if (res.ok) setInfo("Email de réinitialisation envoyé — suis le lien pour choisir un nouveau mot de passe.");
    else setError(res.error ?? "Échec de l'envoi.");
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

        {mode === "in" && (
          <div>
            <button
              className="mt-1.5 block w-full text-[11px] text-paper-faint hover:text-bronze-400"
              onClick={forgot}
              disabled={busy}
            >
              Mot de passe oublié ?
            </button>
          </div>
        )}

        <p className="mt-4 border-t border-ink-700 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-paper-faint">
          Eagleye Corp — Lyon · données isolées par compte
        </p>
      </div>
    </div>
  );
}
