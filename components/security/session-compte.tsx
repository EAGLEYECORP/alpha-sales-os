"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import { authAvailable, getCurrentUser, onAuthChange, signOut, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI EST CONNECTÉ, ET COMMENT ON SORT.
 *
 * ── LE DÉFAUT ──
 *
 * Il n'existait qu'UN bouton de déconnexion dans toute l'application, au
 * milieu de `/compte`, sous un bloc de diagnostic Supabase. Deux conséquences,
 * et la seconde est la vraie :
 *
 *  1. Personne ne le trouve. Se déconnecter est le geste qu'on cherche quand
 *     on veut PARTIR — pas celui pour lequel on accepte d'explorer un menu.
 *
 *  2. ⚠ RIEN N'AFFICHAIT JAMAIS SOUS QUEL COMPTE ON TRAVAILLAIT. Sur une app
 *     local-first, c'est la question qui compte le plus : les fiches du
 *     navigateur appartiennent à un compte (`lib/session-locale.ts`), et
 *     l'écran était rigoureusement identique quel que soit ce compte. Une
 *     démonstration faite depuis le compte de l'opérateur ressemble trait pour
 *     trait à une démonstration faite depuis le compte du client. C'est comme
 *     ça qu'on écrit dans le mauvais pipe sans jamais s'en apercevoir.
 *
 * ── CE QUE CE COMPOSANT EST, ET CE QU'IL N'EST PAS ──
 *
 * C'est un AFFICHEUR et une SORTIE. Il ne décide d'aucun droit : `maitre`,
 * `solo`, les briques et le statut se lisent côté serveur (`resoudreDroits`).
 * Montrer une adresse email n'ouvre rien et n'en ferme aucun.
 *
 * ⚠ SANS COMPTES CONFIGURÉS, IL NE REND RIEN — et surtout pas « déconnecté ».
 * En mode solo (Supabase non lié), il n'y a pas de session à fermer : afficher
 * un bouton qui ne peut rien faire fabrique un ticket de support. L'absence
 * est la bonne réponse, pas un état grisé.
 * ─────────────────────────────────────────────────────────────────────
 */
export function SessionCompte({
  variant,
  className,
}: {
  /** `rail` : la barre latérale dépliée. `icon` : l'en-tête mobile. */
  variant: "rail" | "icon";
  className?: string;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  /**
   * ⚠ « pas encore chargé » n'est PAS « déconnecté ».
   *
   * Sans ce troisième état, le rail affichait un blanc puis l'email : un
   * clignotement à chaque navigation, et pire, un instant pendant lequel
   * l'app affirme qu'aucun compte n'est ouvert alors qu'elle n'a pas regardé.
   */
  const [pret, setPret] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [sortie, setSortie] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authAvailable()) {
      setPret(true);
      return;
    }
    let vivant = true;
    void getCurrentUser().then((u) => {
      if (!vivant) return;
      setUser(u);
      setPret(true);
    });
    const off = onAuthChange((u) => {
      setUser(u);
      setPret(true);
    });
    return () => {
      vivant = false;
      off();
    };
  }, []);

  // Fermeture au clic dehors et à Échap — un menu qui ne se ferme qu'en
  // rechargeant la page est un piège sur mobile, où il n'y a pas d'« ailleurs »
  // évident à cliquer.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  /**
   * ⚠ ON RECHARGE APRÈS LA DÉCONNEXION, ET CE N'EST PAS UNE COMMODITÉ.
   *
   * `signOut()` ferme la session Supabase. L'état zustand, lui, vit en
   * MÉMOIRE : sans rechargement, l'écran continue d'afficher les fiches du
   * compte qu'on vient de quitter. `AuthSync` purge bien le stockage quand un
   * AUTRE compte se connecte — mais entre les deux, l'écran mentirait, et
   * c'est précisément le moment où quelqu'un tend son téléphone à un client.
   */
  const sortir = async () => {
    setSortie(true);
    try {
      await signOut();
    } finally {
      if (typeof location !== "undefined") location.assign("/");
    }
  };

  // Rien à montrer : pas de comptes configurés (mode solo), ou pas encore lu.
  if (!pret || !authAvailable()) return null;

  // Comptes configurés mais personne de connecté : la sortie n'a pas de sens,
  // c'est l'ENTRÉE qu'il faut proposer.
  if (!user) {
    return (
      <Link
        href="/compte"
        className={cn(
          "flex items-center rounded-lg text-paper-faint transition-colors hover:bg-ink-800 hover:text-paper",
          variant === "rail" ? "gap-2.5 px-3 py-2 text-[12px]" : "h-9 w-9 justify-center border border-ink-600",
          className
        )}
        aria-label="Se connecter"
        title="Se connecter"
      >
        <UserCog size={variant === "rail" ? 16 : 16} />
        {variant === "rail" && "Se connecter"}
      </Link>
    );
  }

  const initiale = (user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={boite} className={cn("relative", className)}>
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        /**
         * ⚠ L'ADRESSE EST DANS LE LIBELLÉ ACCESSIBLE, PAS SEULEMENT À L'ÉCRAN.
         * En variante `icon` on n'affiche qu'une initiale : un lecteur d'écran
         * annoncerait « bouton Z », ce qui ne dit à personne sous quel compte
         * il travaille — l'information la plus utile de tout ce composant.
         */
        aria-label={`Compte connecté : ${user.email ?? "adresse inconnue"}`}
        title={user.email ?? "Compte connecté"}
        className={cn(
          "flex items-center rounded-lg text-paper-faint transition-colors hover:bg-ink-800 hover:text-paper",
          variant === "rail"
            ? "w-full gap-2.5 px-3 py-2 text-left text-[12px]"
            : "h-9 w-9 justify-center border border-ink-600"
        )}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bronze-400 font-mono text-[10px] font-bold text-goldink">
          {initiale}
        </span>
        {variant === "rail" && <span className="truncate">{user.email ?? "Compte"}</span>}
      </button>

      {ouvert && (
        <div
          role="menu"
          className={cn(
            /**
             * ⚠ `.card`, PAS UNE SURFACE BRICOLÉE — et le test l'a attrapé.
             * Ce menu portait sa propre recette (bordure + fond en dur), ce
             * qui l'aurait laissé sur l'ancien matériau au prochain changement
             * de thème. En le posant sur `.card`, il a révélé un trou dans la
             * règle « pas de verre dans le verre » : elle ne nommait que
             * `.card` en parent floutant et oubliait le chrome. Corrigé dans
             * `globals.css`, pour toutes les surfaces, pas pour celle-ci.
             */
            "card absolute z-50 min-w-[200px] p-1.5 shadow-xl",
            variant === "rail" ? "bottom-full left-0 mb-1" : "right-0 top-full mt-1"
          )}
        >
          <p className="truncate px-2.5 pb-1.5 pt-1 font-mono text-[10px] text-paper-faint">
            {user.email ?? user.id}
          </p>
          <Link
            href="/compte"
            role="menuitem"
            onClick={() => setOuvert(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-paper-dim transition-colors hover:bg-ink-800 hover:text-paper"
          >
            <UserCog size={14} /> Mon compte
          </Link>
          <button
            role="menuitem"
            onClick={sortir}
            disabled={sortie}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-paper-dim transition-colors hover:bg-ink-800 hover:text-paper disabled:opacity-50"
          >
            <LogOut size={14} /> {sortie ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}
