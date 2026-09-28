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

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ L'INSCRIPTION NE DISAIT PAS OÙ REVENIR — ET LA RÉINITIALISATION, SI.
 *
 * `resetPassword`, quinze lignes plus bas, passe un `redirectTo` construit sur
 * `window.location.origin`. `signUp` ne passait RIEN. Le lien du mail de
 * confirmation retombait donc sur la **Site URL** configurée dans le tableau
 * de bord Supabase — dont la valeur d'usine est `http://localhost:3000`.
 *
 * Conséquence, invisible depuis chez nous : l'inscrit reçoit bien un mail, le
 * clique, et atterrit sur une adresse qui n'existe pas sur SA machine. Il ne
 * peut pas confirmer, donc pas se connecter, et il n'a aucun moyen de
 * comprendre pourquoi. Nous, on voit un compte créé et jamais confirmé.
 *
 * L'origine du navigateur est la bonne source : elle est juste en production,
 * en préproduction et en local, sans qu'aucune variable ne soit à tenir à jour.
 *
 * ⚠⚠ Ça ne dispense PAS de la configuration Supabase : l'URL de redirection
 * doit être dans la liste blanche (Authentication → URL Configuration), sinon
 * Supabase l'ignore et retombe sur la Site URL. Voir docs/INSCRIPTION.md.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * ── OÙ REVIENT-ON APRÈS AVOIR CLIQUÉ LE LIEN ? ──
 *
 * ⚠ UNE SEULE DÉFINITION, ET C'EST TOUT LE SUJET. `signUp` et `resetPassword`
 * construisaient chacun la leur. Deux expressions du même choix finissent par
 * diverger, et il faudrait alors deux entrées dans la liste blanche Supabase —
 * dont on découvrirait l'oubli au premier inscrit, jamais avant.
 *
 * ⚠⚠ ELLE POINTAIT SUR `/compte`, ET C'ÉTAIT LE MAUVAIS ENDROIT.
 * `/compte` est un écran de DIAGNOSTIC : état Supabase, identifiant de
 * locataire, mot de passe, facturation. Quelqu'un qui vient de confirmer son
 * adresse n'a rien demandé de tout ça — il veut voir le produit qu'il vient
 * d'ouvrir. On le pose donc à l'accueil, qui s'adapte déjà à ce qu'il possède.
 * Le marqueur `?bienvenue=1` permet à l'accueil de le savoir sans deviner.
 *
 * ⚠ La redirection doit être dans la liste blanche Supabase (Authentication →
 * URL Configuration → Redirect URLs, `https://<prod>/**`). Une URL absente est
 * IGNORÉE en silence et Supabase retombe sur la Site URL — dont la valeur
 * d'usine est `http://localhost:3000`. Voir `docs/INSCRIPTION.md`.
 */
export function urlRetourAuth(suffixe: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/${suffixe}`;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié — Réglages → Supabase." };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: urlRetourAuth("?bienvenue=1") },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirm: !data.session };
}

/**
 * Renvoyer l'email de confirmation.
 *
 * ⚠ IL N'EXISTAIT AUCUN MOYEN D'EN REDEMANDER UN, et c'est le défaut le plus
 * cher du tunnel : le SMTP par défaut de Supabase ne délivre qu'aux membres du
 * projet, à deux messages par heure (voir `docs/INSCRIPTION.md` §2.3). Un
 * inscrit dont le mail n'arrive pas — parce qu'il est tombé dans les
 * indésirables, parce que le quota était atteint, parce que le SMTP n'était
 * pas encore branché — se retrouvait avec un compte créé, non confirmé, et
 * strictement aucune action possible. Il ne peut même pas recommencer :
 * l'adresse est déjà prise.
 *
 * ⚠⚠ ON NE DIT PAS SI L'ADRESSE EXISTE. Supabase répond pareil dans les deux
 * cas, et c'est voulu : une réponse qui différencie « compte inconnu » de
 * « email renvoyé » transforme ce bouton en énumérateur d'adresses inscrites.
 */
export async function resendConfirmation(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase n'est pas lié — Réglages → Supabase." };
  const { error } = await sb.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: urlRetourAuth("?bienvenue=1") },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
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
  /**
   * ⚠ CELLE-CI GARDE `/compte`, ET LA DIFFÉRENCE EST INTENTIONNELLE.
   * Après un lien de RÉCUPÉRATION, la seule chose à faire est de poser un
   * nouveau mot de passe — et le formulaire qui le fait vit sur `/compte`.
   * Envoyer cette personne à l'accueil la laisserait connectée avec un mot de
   * passe qu'elle ne connaît toujours pas.
   */
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetourAuth("compte") });
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
