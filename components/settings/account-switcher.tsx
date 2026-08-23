"use client";

import { Building2, Check, Coins, Crown, Target } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { ACCOUNTS, accountICP, getAccount } from "@/lib/accounts";
// Les montants par offre et la note d'économie du compte NE sont pas importés :
// ils viennent du serveur (voir lib/client-catalogue.ts).
import { useAccountCommercial } from "@/lib/client-catalogue";
import { OFFER_LABELS } from "@/lib/offer-match";
import { cn } from "@/lib/utils";

/**
 * Portefeuille de comptes — le compte MAÎTRE (EAGLEYE) bascule d'une marque
 * revendue à l'autre. Chaque bascule réécrit l'identité (nom + offre), la
 * commission et l'accountId dans les Réglages : tout le reste de l'app (docs,
 * prompts IA, divulgation vocale, payouts) suit, sans rien coder en dur.
 *
 * Ce n'est pas une frontière de sécurité (ça, c'est la RLS/JWT) : c'est QUI on
 * est et ce qu'on vend. On affiche donc franchement que basculer change le
 * branding partout — pas de fausse impression de cloisonnement des données.
 */
export function AccountSwitcher() {
  const { settings, switchAccount } = useAlpha();
  const activeId = settings.accountId ?? "eagleye";
  const active = getAccount(activeId);
  const icp = accountICP(activeId);
  const commercial = useAccountCommercial(activeId);

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Building2 size={15} className="text-bronze-400" /> Portefeuille de comptes
        </h2>
        <span className="text-[11px] text-paper-faint">
          Compte actif : <strong className="text-bronze-300">{active.name}</strong>
        </span>
      </div>
      <p className="text-[11.5px] text-paper-faint">
        EAGLEYE est le compte maître — l&apos;interface qui pilote les autres. Basculer applique
        l&apos;<strong className="text-paper-dim">identité</strong>, l&apos;<strong className="text-paper-dim">offre</strong>{" "}
        et la <strong className="text-paper-dim">commission</strong> de la marque choisie à toute l&apos;app.
        Tes données (prospects, RDV) ne bougent pas.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {ACCOUNTS.map((a) => {
          const on = a.id === activeId;
          return (
            <button
              key={a.id}
              onClick={() => switchAccount(a.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                on
                  ? "border-bronze-500/70 bg-bronze-900/20 ring-1 ring-bronze-500/40"
                  : "border-line/60 bg-surface/40 hover:border-bronze-700/60"
              )}
            >
              <div className="flex items-center gap-1.5">
                {a.kind === "master" ? (
                  <Crown size={13} className="text-bronze-400" />
                ) : (
                  <Building2 size={13} className="text-paper-faint" />
                )}
                <span className="font-display text-[13px] font-semibold text-paper">{a.name}</span>
                {on && <Check size={13} className="ml-auto text-signal-green" />}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-paper-faint">{a.whatYouSell}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-bronze-900/30 px-1.5 py-0.5 text-bronze-300">
                  <Coins size={10} /> {a.commissionPct}%
                </span>
                {/* L'objectif par projet est un MONTANT : il arrive du serveur,
                    et seulement pour le compte actif. */}
                {a.id === activeId && commercial?.targetPerProject ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-paper-dim">
                    <Target size={10} /> ≥ {commercial.targetPerProject.toLocaleString("fr-FR")} €
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Résumé du compte actif : commissions par offre + client parfait (ICP). */}
      <div className="rounded-xl border border-line/50 bg-surface/30 p-3 text-[11.5px]">
        <p className="font-medium text-paper">Commissions par offre</p>
        {!commercial && (
          <p className="mt-1 text-[11px] text-paper-faint">Chargement du détail commercial…</p>
        )}
        <ul className="mt-1 space-y-1">
          {(commercial?.offerings ?? []).map((o) => (
            <li key={o.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-paper-dim">{o.label}</span>
              <span className="rounded-full bg-bronze-900/25 px-1.5 py-0.5 text-[10.5px] text-bronze-300">
                {o.commissionPct}%{o.recurringPct != null ? ` + ${o.recurringPct}% mensuel` : ""}
              </span>
              {o.setupHT != null && (
                <span className="text-[10.5px] text-paper-faint">setup {o.setupHT.toLocaleString("fr-FR")} € HT</span>
              )}
              {(o.minHT != null || o.maxHT != null) && (
                <span className="text-[10.5px] text-paper-faint">
                  {o.minHT != null ? `≥ ${o.minHT.toLocaleString("fr-FR")} €` : ""}
                  {o.minHT != null && o.maxHT != null ? " · " : ""}
                  {o.maxHT != null ? `< ${o.maxHT.toLocaleString("fr-FR")} €` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-paper-faint">Routeur d&apos;offre :</span>
          {active.offers.map((o) => (
            <span key={o} className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-paper-dim">
              {OFFER_LABELS[o].split(" — ")[0]}
            </span>
          ))}
        </div>

        <p className="mt-2 text-paper-dim">
          <strong className="text-paper">Client parfait :</strong> {icp.label} — {icp.buyer}.
        </p>
        <p className="mt-0.5 text-paper-faint">
          {icp.sector} · {icp.companySize} · {icp.geo}
        </p>
        {active.sites?.length ? (
          <p className="mt-1 text-[11px] text-paper-faint">
            {active.sites.map((s, i) => (
              <span key={s}>
                {i > 0 ? " · " : ""}
                <a href={s} target="_blank" rel="noreferrer" className="text-bronze-400 hover:underline">
                  {s.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </span>
            ))}
          </p>
        ) : null}
        {commercial?.note && <p className="mt-1.5 text-[11px] italic text-paper-faint">{commercial.note}</p>}
        {/* Le rituel de signature : l'acte est local, les coordonnées viennent
            du serveur (email d'expédition, panel, personne à impliquer). */}
        {active.closing && (
          <p className="mt-1.5 text-[11px] text-paper-faint">
            <strong className="text-paper-dim">Closing :</strong> {active.closing.action}
            {commercial?.closing?.fromEmail && (
              <> — depuis <span className="font-mono text-bronze-400">{commercial.closing.fromEmail}</span></>
            )}
            {commercial?.closing?.contactName && <> — avec {commercial.closing.contactName}</>}
          </p>
        )}
      </div>
    </section>
  );
}
