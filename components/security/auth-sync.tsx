"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { JWT_COOKIE } from "@/lib/supabase-jwt";

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

    // État initial.
    sb.auth.getSession().then(({ data }) => {
      write(data.session?.access_token ?? null, data.session?.expires_at ?? undefined);
    });

    // Suivi : connexion, refresh de jeton, déconnexion.
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      write(session?.access_token ?? null, session?.expires_at ?? undefined);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
