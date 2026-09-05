"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, X } from "lucide-react";
import { lireLien, type EtatLien } from "@/lib/lien-confirmation";
import { authAvailable, getCurrentUser, resendConfirmation } from "@/lib/auth";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BANDEAU DE RETOUR D'EMAIL — ce qui manquait au moment de la conversion.
 *
 * Il rend visible ce que `lib/lien-confirmation.ts` a lu dans l'URL. Deux
 * situations, et la seconde était totalement muette :
 *
 *  · le lien a MARCHÉ → on le dit, une fois, et on dit où on est ;
 *  · le lien a ÉCHOUÉ → on dit pourquoi, en français, et on offre le seul
 *    geste qui répare : renvoyer un lien.
 *
 * ⚠ POURQUOI L'ADRESSE EST REDEMANDÉE À LA MAIN. Quand un lien échoue, il n'y
 * a PAS de session — donc aucun moyen de savoir à qui appartient le compte.
 * Pré-remplir depuis le stockage local serait pire que rien : sur un
 * navigateur partagé, on renverrait le lien de quelqu'un d'autre.
 *
 * ⚠⚠ L'URL EST NETTOYÉE APRÈS LECTURE. Sans ça, le message revient à chaque
 * navigation interne, et surtout le fragment reste dans la barre d'adresse —
 * donc dans l'historique, les captures d'écran et le presse-papier de qui
 * partage le lien. Le fragment d'un lien RÉUSSI contient le jeton d'accès.
 * ─────────────────────────────────────────────────────────────────────
 */
export function RetourLien() {
  const [etat, setEtat] = useState<EtatLien>({ type: "aucun" });
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState<"repos" | "cours" | "fait" | string>("repos");
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    const lu = lireLien(window.location.search, window.location.hash);
    if (lu.type === "aucun") return;
    setEtat(lu);

    /**
     * Le nettoyage se fait APRÈS que le client Supabase a eu sa chance de lire
     * le fragment (`detectSessionInUrl`). Il tourne au montage du client, donc
     * dans le même tour de boucle ; on repasse la main une fois pour être sûr
     * de ne pas lui retirer le jeton sous les pieds — c'est exactement le
     * genre de course qui ne se voit qu'en production, sur un téléphone lent.
     */
    const t = setTimeout(() => {
      history.replaceState(null, "", window.location.pathname);
    }, 0);

    if (lu.type === "bienvenue" && authAvailable()) {
      void getCurrentUser().then((u) => setConnecte(Boolean(u)));
    }
    return () => clearTimeout(t);
  }, []);

  if (etat.type === "aucun") return null;

  if (etat.type === "bienvenue") {
    return (
      <div className="mx-auto mt-4 max-w-7xl px-4 md:px-8">
        <div className="card flex items-start gap-3 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-signal-green" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-paper">Adresse confirmée — bienvenue.</p>
            <p className="mt-1 text-[13px] text-paper-dim">
              {connecte
                ? "Tu es dans TON espace : ce que tu vois ici n'appartient qu'à toi. Les fiches présentes sont un jeu de démonstration, pour comprendre comment l'outil fonctionne — tu peux les remplacer par les tiennes quand tu veux."
                : /**
                   * ⚠ CE CAS EXISTE VRAIMENT : le lien est valide, l'adresse
                   * est confirmée, et la session ne s'ouvre pas (cookies
                   * tiers bloqués, lien ouvert dans le navigateur intégré
                   * d'une application de messagerie). Dire « bienvenue » sans
                   * regarder aurait affirmé une connexion qui n'existe pas.
                   */
                  "Ton adresse est confirmée, mais la session ne s'est pas ouverte dans ce navigateur — c'est fréquent quand le lien s'ouvre dans l'application de messagerie. Connecte-toi avec ton email et ton mot de passe."}
            </p>
          </div>
          <button
            onClick={() => setEtat({ type: "aucun" })}
            aria-label="Masquer ce message"
            className="ml-auto shrink-0 text-paper-faint transition-colors hover:text-paper"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  const renvoyer = async () => {
    setEnvoi("cours");
    const r = await resendConfirmation(email);
    setEnvoi(r.ok ? "fait" : (r.error ?? "Envoi impossible."));
  };

  return (
    <div className="mx-auto mt-4 max-w-7xl px-4 md:px-8">
      <div className="card p-4">
        <p className="flex items-start gap-3 text-sm font-medium text-paper">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-signal-amber" />
          Le lien de confirmation n&apos;a pas fonctionné
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-paper-dim">{etat.message}</p>

        {envoi === "fait" ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-signal-green">
            <Mail size={14} /> Si un compte existe à cette adresse, un nouveau lien vient de partir. Regarde aussi
            les indésirables.
          </p>
        ) : (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void renvoyer();
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              aria-label="Adresse à laquelle renvoyer le lien"
              className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-transparent px-3 py-2 text-[13px] text-paper placeholder:text-paper-faint"
            />
            <button type="submit" disabled={envoi === "cours"} className="btn-bronze disabled:opacity-50">
              {envoi === "cours" ? "Envoi…" : "Renvoyer le lien"}
            </button>
          </form>
        )}
        {typeof envoi === "string" && !["repos", "cours", "fait"].includes(envoi) && (
          <p className="mt-2 text-[12px] text-signal-red">{envoi}</p>
        )}
      </div>
    </div>
  );
}
