"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { JWT_COOKIE } from "@/lib/supabase-jwt";
import { appliquer } from "@/lib/session-locale";

/**
 * Passerelle session → cookie.
 *
 * Supabase range la session dans le localStorage ; le middleware ne lit que
 * les cookies. Ce composant mirroir le jeton d'accès (JWT) dans un cookie que
 * le middleware peut vérifier (lib/supabase-jwt.ts), et l'efface à la
 * déconnexion / expiration. Monté une fois dans le shell.
 *
 * Le cookie n'est pas HttpOnly (posé par le client) — c'est une couche de
 * défense en profondeur AU-DESSUS de SITE_PASSWORD, pas un secret. La preuve
 * d'accès reste la vérification de signature côté serveur.
 *
 * ⚠ CE COMPOSANT PORTE AUSSI L'APPARTENANCE DU STOCKAGE LOCAL, et c'est ici
 * que ça doit vivre : c'est le seul endroit de l'app qui voit CHAQUE
 * changement de session. Le pipe est rangé sous une clé unique et non
 * nominative ; sans cette vérification, un client qui se connecte après
 * l'opérateur sur la même machine hérite de ses fiches. Voir
 * `lib/session-locale.ts` — la règle y est pure et testée, l'exécution est
 * ici parce qu'elle touche le navigateur.
 */
export function AuthSync() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";

    const write = (token: string | null, expiresAtSec?: number) => {
      if (token) {
        // Durée de vie du cookie alignée sur celle du jeton (défaut 1 h).
        const maxAge = expiresAtSec ? Math.max(0, Math.floor(expiresAtSec - Date.now() / 1000)) : 3600;
        document.cookie = `${JWT_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
      } else {
        document.cookie = `${JWT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
      }
    };

    /**
     * Le stockage appartient-il à celui qui est connecté ?
     *
     * ⚠ Le rechargement après purge n'est pas une commodité : l'état zustand
     * vit en MÉMOIRE. Vider le localStorage ne le vide pas, et l'écran
     * continuerait d'afficher les fiches du précédent — en pire, puisque le
     * nouvel arrivant les prendrait pour les siennes et écrirait dessus.
     */
    const verifierAppartenance = (userId: string | null) => {
      const effet = appliquer(userId);
      if (effet.purge && typeof location !== "undefined") location.reload();
    };

    // État initial.
    sb.auth.getSession().then(({ data }) => {
      write(data.session?.access_token ?? null, data.session?.expires_at ?? undefined);
      verifierAppartenance(data.session?.user?.id ?? null);
    });

    // Suivi : connexion, refresh de jeton, déconnexion.
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      write(session?.access_token ?? null, session?.expires_at ?? undefined);
      verifierAppartenance(session?.user?.id ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
