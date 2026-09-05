"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  PROFIL_VIDE,
  POSTES,
  phraseProfil,
  profilExploitable,
  type ProfilOperateur,
} from "@/lib/profil-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « À QUI VENDS-TU ? » — les quatre questions qui rendent la démo utile.
 *
 * Le jeu de démonstration livré est huit commerces lyonnais. Quelqu'un qui
 * vend du logiciel à des DRH ouvre son pipeline, voit « Le Bouchon des
 * Canuts — 40 appels ratés pendant le coup de feu », et ne conclut PAS « ce
 * sont des données d'exemple » : il conclut « ce produit n'est pas pour
 * moi ». C'est la seule seconde où on avait son attention.
 *
 * ── CE QUE CE FORMULAIRE NE FAIT PAS ──
 *
 * ⚠ IL NE BLOQUE RIEN. Pas d'étape obligatoire, pas de champ requis, un
 * bouton « plus tard » qui marche vraiment. Un onboarding qui bloque produit
 * des profils remplis n'importe comment — et un ICP faux fabrique une
 * démonstration hors sujet dont personne ne saura jamais qu'elle l'est.
 *
 * ⚠⚠ IL DIT CE QU'IL VA FAIRE AVANT DE LE FAIRE. Le bouton remplace les
 * fiches d'exemple. Quelqu'un qui a déjà importé son fichier doit lire, AVANT
 * de cliquer, que ses vraies fiches ne bougent pas — sinon il n'ose pas, ou
 * pire, il ose et il a peur pendant une semaine. (Le store ne remplace que
 * les fiches de démo ; c'est écrit là-bas, ça se dit ici.)
 * ─────────────────────────────────────────────────────────────────────
 */
export function ProfilIcp({ onFini, compact }: { onFini?: () => void; compact?: boolean }) {
  const enregistre = useAlpha((s) => s.settings.profil);
  const bookingUrl = useAlpha((s) => s.settings.bookingUrl ?? "");
  const appliquerProfil = useAlpha((s) => s.appliquerProfil);
  const patchSettings = useAlpha((s) => s.patchSettings);

  const [p, setP] = useState<ProfilOperateur>(enregistre ?? PROFIL_VIDE);
  const [lien, setLien] = useState(bookingUrl);
  const [fait, setFait] = useState(false);

  const set = (patch: Partial<ProfilOperateur>) => {
    setP((v) => ({ ...v, ...patch }));
    setFait(false);
  };

  const appliquer = () => {
    appliquerProfil(p);
    patchSettings({ bookingUrl: lien.trim() });
    setFait(true);
    onFini?.();
  };

  const pret = profilExploitable(p);

  return (
    <div className={compact ? "space-y-4" : "card space-y-4 p-5"}>
      {!compact && (
        <div>
          <p className="text-sm font-medium text-paper">À qui vends-tu ?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-paper-dim">
            Les fiches que tu vois sont des exemples — des commerces lyonnais, parce qu&apos;il fallait bien choisir.
            Dis-nous ta cible et on refait la démonstration avec des fiches qui ressemblent à TON marché. Rien
            n&apos;est obligatoire, et tu peux revenir le changer.
          </p>
        </div>
      )}

      <div>
        <label className="label">Ton poste</label>
        <div className="mt-1 grid gap-1.5 sm:grid-cols-3">
          {POSTES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => set({ poste: o.id })}
              aria-pressed={p.poste === o.id}
              className={
                "panel px-3 py-2 text-left text-[12px] transition-colors " +
                (p.poste === o.id ? "border-bronze-400 text-paper" : "text-paper-dim hover:text-paper")
              }
            >
              <span className="block font-medium">{o.label}</span>
              <span className="mt-0.5 block text-[11px] text-paper-faint">{o.aide}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Ce que tu vends</label>
          <input
            className="input"
            placeholder="logiciel de paie, couverture, conseil RSE…"
            value={p.metier}
            onChange={(e) => set({ metier: e.target.value })}
          />
        </div>
        <div>
          <label className="label">
            Le secteur de tes clients <span className="text-bronze-400">— le seul qui compte</span>
          </label>
          <input
            className="input"
            placeholder="logistique, santé, BTP, e-commerce…"
            value={p.cibleSecteur}
            onChange={(e) => set({ cibleSecteur: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Qui tu cherches à joindre</label>
          <input
            className="input"
            placeholder="directeur des opérations, DRH, gérant…"
            value={p.cibleRole}
            onChange={(e) => set({ cibleRole: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Où (facultatif)</label>
          <input
            className="input"
            placeholder="Rhône, Île-de-France, toute la France…"
            value={p.cibleZone}
            onChange={(e) => set({ cibleZone: e.target.value })}
          />
        </div>
      </div>

      {/*
        ⚠ LE LIEN DE RENDEZ-VOUS EST ICI, PAS SEULEMENT DANS LES RÉGLAGES.
        Il y était déjà — au milieu d'une page de configuration que personne
        n'ouvre le premier jour. C'est pourtant la pièce qui produit des
        rendez-vous SANS nous : sans elle, chaque email et chaque message
        LinkedIn part sans bouton de réservation, et il faut faire trois
        allers-retours pour caler une date. On la demande donc au moment où
        la personne décrit son activité, pas trois écrans plus loin.
      */}
      <div>
        <label className="label">Ton lien de rendez-vous (Cal.com, Calendly…)</label>
        <input
          className="input"
          placeholder="https://cal.com/ton-nom/15min"
          value={lien}
          onChange={(e) => {
            setLien(e.target.value);
            setFait(false);
          }}
        />
        <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
          C&apos;est ce qui te donne des rendez-vous pendant que tu fais autre chose : le bouton
          « Réserver un créneau » s&apos;ajoute à tes emails, tes messages LinkedIn et tes audits. Sans lien, il
          faut trois allers-retours pour caler une date. Tu n&apos;en as pas ? Cal.com est gratuit.
        </p>
      </div>

      <div className="panel p-3">
        <p className="text-[12px] text-paper-dim">{phraseProfil(p)}</p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-paper-faint">
          En validant, les <strong className="text-paper-dim">fiches d&apos;exemple</strong> sont remplacées par des
          fiches à ton marché. Elles restent inventées : le numéro est dans une tranche réservée à la fiction et
          l&apos;adresse sur un domaine réservé — impossible d&apos;appeler ou d&apos;écrire à quelqu&apos;un par
          accident. <strong className="text-paper-dim">Tes vraies fiches, elles, ne bougent pas.</strong>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={appliquer} disabled={!pret} className="btn-bronze disabled:opacity-40">
          <Sparkles size={14} /> Refaire la démo sur ma cible
        </button>
        {onFini && (
          <button type="button" onClick={onFini} className="btn-ghost">
            Plus tard
          </button>
        )}
        {fait && (
          <span className="flex items-center gap-1.5 text-[12px] text-signal-green">
            <Check size={14} /> C&apos;est fait.
          </span>
        )}
        {!pret && (
          <span className="text-[11.5px] text-paper-faint">
            Il manque le secteur de tes clients — c&apos;est lui qui fabrique les fiches.
          </span>
        )}
      </div>
    </div>
  );
}
