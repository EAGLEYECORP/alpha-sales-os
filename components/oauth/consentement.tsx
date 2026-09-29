"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { signIn } from "@/lib/auth";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉCRAN DE CONSENTEMENT OAUTH.
 *
 * Il dit trois choses, dans cet ordre, parce que c'est l'ordre dans lequel
 * on décide : QUI demande, ce qu'il POURRA faire, et ce qu'il ne pourra
 * JAMAIS faire. La troisième colonne n'est pas décorative : c'est la raison
 * pour laquelle on peut dire oui sans relire le code.
 *
 * ⚠ L'hôte de retour est AFFICHÉ, et une alerte s'ajoute s'il est local : la
 * spécification MCP l'exige, parce que n'importe quel programme de la machine
 * peut écouter un port local et se faire passer pour le client.
 * ─────────────────────────────────────────────────────────────────────
 */

type Etat =
  | { phase: "chargement" }
  | { phase: "erreur"; message: string }
  | { phase: "connexion"; client: string; retour: string; boucleLocale: boolean }
  | { phase: "consentement"; client: string; retour: string; boucleLocale: boolean; email: string }
  | { phase: "envoi" };

const PEUT = [
  "Lire l'état de ton pipe (sans aucune coordonnée : ni email, ni téléphone)",
  "Lire l'état de la machine (autopilote, palier d'envoi, moteur de décision)",
  "Préparer une campagne : le texte exact des mails, sans rien envoyer",
  "Déposer des propositions que TU approuves ou rejettes dans l'app",
];
const JAMAIS = [
  "Envoyer un email, un SMS ou lancer un appel",
  "Modifier, déplacer ou supprimer une fiche",
  "Armer l'autopilote",
];

async function jetonSession(): Promise<{ jeton: string; email: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const s = data.session;
  return s?.access_token && s.user?.email ? { jeton: s.access_token, email: s.user.email } : null;
}

export function ConsentementOAuth({ requete }: { requete: string }) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurConnexion, setErreurConnexion] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await fetch(`/api/oauth/authorize?${requete}`, { cache: "no-store" }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (!d) return setEtat({ phase: "erreur", message: "Serveur injoignable. Réessaie dans un instant." });
    if (d.redirect) {
      window.location.href = d.redirect;
      return;
    }
    if (d.erreur) return setEtat({ phase: "erreur", message: d.erreur });
    const session = await jetonSession();
    const base = { client: String(d.client), retour: String(d.retour), boucleLocale: Boolean(d.boucleLocale) };
    setEtat(session ? { phase: "consentement", ...base, email: session.email } : { phase: "connexion", ...base });
  }, [requete]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const decider = async (decision: "approve" | "deny") => {
    const session = decision === "approve" ? await jetonSession() : null;
    if (decision === "approve" && !session) return void charger();
    setEtat({ phase: "envoi" });
    const r = await fetch("/api/oauth/authorize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session.jeton}` } : {}),
      },
      body: JSON.stringify({ params: Object.fromEntries(new URLSearchParams(requete)), decision }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (d?.redirect) {
      window.location.href = d.redirect;
      return;
    }
    setEtat({ phase: "erreur", message: d?.erreur ?? "La décision n'a pas pu être enregistrée." });
  };

  const seConnecter = async () => {
    setErreurConnexion(null);
    const r = await signIn(email, motDePasse);
    if (!r.ok) return setErreurConnexion(r.error ?? "Connexion refusée.");
    await charger();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-4 py-10">
      <div className="card w-full max-w-md p-7">
        <h1 className="font-display text-lg font-extrabold text-paper">
          ALPHA <span className="text-bronze-400">SALES OS</span>
        </h1>

        {(etat.phase === "chargement" || etat.phase === "envoi") && (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-paper-faint">
            <Loader2 size={15} className="animate-spin" /> {etat.phase === "envoi" ? "Transmission de ta décision…" : "Vérification de la demande…"}
          </p>
        )}

        {etat.phase === "erreur" && <p className="mt-6 text-[13px] text-signal-red">{etat.message}</p>}

        {(etat.phase === "connexion" || etat.phase === "consentement") && (
          <>
            <p className="mt-4 text-[14px] text-paper">
              <strong>{etat.client}</strong> demande à se brancher sur ton Alpha.
            </p>
            <p className="mt-1 text-[12px] text-paper-faint">
              Retour vers : <span className="font-mono">{etat.retour}</span>
            </p>
            {etat.boucleLocale && (
              <p className="panel mt-3 flex gap-2 p-3 text-[12px] text-signal-red">
                <ShieldAlert size={15} className="shrink-0" />
                Retour vers ta propre machine (Claude Code). N'accepte que si c'est toi qui viens de lancer la connexion.
              </p>
            )}

            <div className="panel mt-4 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-faint">Il pourra</p>
              <ul className="mt-2 space-y-1.5">
                {PEUT.map((x) => (
                  <li key={x} className="flex gap-2 text-[13px] text-paper">
                    <Check size={14} className="mt-0.5 shrink-0 text-bronze-400" /> {x}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-paper-faint">Il ne pourra jamais</p>
              <ul className="mt-2 space-y-1.5">
                {JAMAIS.map((x) => (
                  <li key={x} className="flex gap-2 text-[13px] text-paper">
                    <X size={14} className="mt-0.5 shrink-0 text-signal-red" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {etat.phase === "connexion" && (
          <div className="mt-5 space-y-2">
            <p className="text-[12px] text-paper-faint">Connecte-toi avec ton compte Alpha pour décider.</p>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input
              className="input"
              type="password"
              placeholder="Mot de passe"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void seConnecter()}
              autoComplete="current-password"
            />
            {erreurConnexion && <p className="text-[12px] text-signal-red">{erreurConnexion}</p>}
            <button className="btn-bronze w-full justify-center" onClick={() => void seConnecter()} disabled={!email || !motDePasse}>
              Se connecter
            </button>
            <button className="btn-ghost w-full justify-center" onClick={() => void decider("deny")}>
              Refuser
            </button>
          </div>
        )}

        {etat.phase === "consentement" && (
          <div className="mt-5 space-y-2">
            <p className="text-[12px] text-paper-faint">
              Connecté en tant que <span className="font-mono">{etat.email}</span>
            </p>
            <button className="btn-bronze w-full justify-center" onClick={() => void decider("approve")}>
              Autoriser
            </button>
            <button className="btn-ghost w-full justify-center" onClick={() => void decider("deny")}>
              Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
