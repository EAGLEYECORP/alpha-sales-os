"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, UserCog, Users } from "lucide-react";
import { authAvailable, getCurrentUser, onAuthChange, signOut, type AuthUser } from "@/lib/auth";
import { useAlpha } from "@/lib/store";
import { BillingCard } from "@/components/billing/billing-card";
import { MonOffre } from "@/components/billing/mon-offre";
import { ChangePassword } from "@/components/security/change-password";

/**
 * Compte — gestion de l'identité multi-locataire.
 *
 * Affiche le compte connecté (Supabase Auth), permet de se déconnecter, et
 * rappelle l'état de l'isolation par compte. Le mur de connexion lui-même vit
 * dans components/security/auth-gate.tsx ; cette page sert la session ouverte.
 */
export default function ComptePage() {
  const requireAuth = useAlpha((s) => s.settings.security?.requireAuth);
  const [available] = useState(() => authAvailable());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!available) {
      setReady(true);
      return;
    }
    let alive = true;
    getCurrentUser().then((u) => {
      if (alive) {
        setUser(u);
        setReady(true);
      }
    });
    const off = onAuthChange((u) => alive && setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, [available]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-fade-up">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
          Identité · multi-locataire
        </p>
        <h1 className="font-display text-2xl font-bold text-paper">Compte</h1>
      </header>

      {!available ? (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-paper">
            <Users size={15} className="text-bronze-400" /> Comptes non activés
          </p>
          <p className="mt-2 text-[13px] text-paper-dim">
            Les comptes s&apos;appuient sur Supabase. Lie ton projet dans{" "}
            <Link href="/settings" className="text-bronze-400 hover:underline">Réglages → Supabase</Link>, puis active
            « Exiger un compte » dans la section Sécurité.
          </p>
          <p className="mt-3 text-[11.5px] text-paper-faint">
            Tant que Supabase n&apos;est pas lié, ALPHA SALES OS reste en mode local (une seule identité, données dans
            ce navigateur). C&apos;est parfait pour un usage solo ; pour revendre l&apos;OS à d&apos;autres commerciaux,
            il faut les comptes.
          </p>
        </section>
      ) : !ready ? (
        <section className="card p-5">
          <p className="text-sm text-paper-faint">Chargement…</p>
        </section>
      ) : user ? (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-signal-green">
            <ShieldCheck size={15} /> Connecté
          </p>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-3 border-b border-ink-800 pb-2">
              <dt className="text-paper-faint">Email</dt>
              <dd className="font-mono text-paper">{user.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-paper-faint">Identifiant compte</dt>
              <dd className="truncate font-mono text-[11px] text-paper-dim">{user.id}</dd>
            </div>
          </dl>
          <button className="btn-ghost mt-4" onClick={() => signOut()}>
            <LogOut size={14} /> Se déconnecter
          </button>
          <ChangePassword />
          <p className="mt-3 text-[11px] text-paper-faint">
            Tes données synchronisées (Supabase) sont isolées sous ce compte via la RLS. Un autre commercial connecté
            avec son propre compte ne voit jamais tes fiches.
          </p>
        </section>
      ) : (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-paper">
            <UserCog size={15} className="text-bronze-400" /> Aucune session ouverte
          </p>
          <p className="mt-2 text-[13px] text-paper-dim">
            Supabase est lié mais aucun compte n&apos;est connecté.{" "}
            {requireAuth
              ? "Le mur de connexion s'affiche à l'ouverture de l'app."
              : "Active « Exiger un compte » dans Réglages → Sécurité pour afficher l'écran de connexion à l'ouverture."}
          </p>
          <Link href="/settings" className="btn-bronze mt-4 inline-flex">
            <ShieldCheck size={14} /> Réglages → Sécurité
          </Link>
        </section>
      )}

      {/* Ce que ce compte possède, et l'explication d'un refus : le middleware
          renvoie ici avec ?bloque=… Placé AVANT la facturation, parce qu'un
          client bloqué cherche d'abord à comprendre, pas à payer. */}
      <MonOffre />
      {available && ready && user && <BillingCard email={user.email} />}

      <p className="px-1 text-[10.5px] italic text-paper-faint">
        ⚠ L&apos;isolation par compte doit être prouvée à deux comptes réels avant de facturer un client (docs/SECURITE.md).
      </p>
    </div>
  );
}
