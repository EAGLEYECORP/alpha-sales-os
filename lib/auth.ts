"use client";

import { getSupabase, supabaseEnabled } from "./supabase";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Authentification multi-locataire — première brique du SaaS.
 *
 * Chaque commercial a SON compte (Supabase Auth). Les données synchronisées
 * dans Supabase sont isolées par `user_id` via la RLS (supabase/schema.sql) :
 * un compte ne voit jamais les données d'un autre. Ce module est la couche
 * identité ; la porte d'accès de l'app s'appuie dessus (components/shell).
 *
 * ⚠ Honnêteté (comme LiveKit / IMAP) : non vérifié contre un vrai projet
 * Supabase dans l'environnement de build. À tester À DEUX COMPTES avant de
 * facturer un client — l'isolation RLS doit être prouvée, pas supposée
 * (voir docs/SECURITE.md). L'enforcement 100 % côté serveur (middleware sur
 * cookie de session) est la phase suivante.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface AuthUser {
  id: string;
  email: string | null;
}

/** L'auth est-elle possible ? (Supabase lié.) */
export const authAvailable = (): boolean => supabaseEnabled();

interface AuthResult {
  ok: boolean;
  error?: string;
  /** Inscription : un email de confirmation est-il requis avant connexion ? */
  needsConfirm?: boolean;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié — Réglages → Supabase." };
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié — Réglages → Supabase." };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/** Envoie un email de réinitialisation de mot de passe. */
export async function resetPassword(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié — Réglages → Supabase." };
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/compte` : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Change le mot de passe du compte connecté (après le lien de récupération, ou volontairement). */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié." };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

/** S'abonne aux changements de session. Renvoie une fonction de désinscription. */
export function onAuthChange(cb: (u: AuthUser | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) {
    cb(null);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_e, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}
