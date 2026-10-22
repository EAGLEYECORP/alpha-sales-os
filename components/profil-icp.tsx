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
import type { Clientele, PropositionConfig } from "@/lib/lecture-site";
import { LireMonSite } from "@/components/lire-mon-site";
import { patchReglages } from "@/lib/bienvenue";

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

  const agencyName = useAlpha((s) => s.settings.agencyName);
  const offer = useAlpha((s) => s.settings.offer);

  const [p, setP] = useState<ProfilOperateur>(enregistre ?? PROFIL_VIDE);
  const [lien, setLien] = useState(bookingUrl);
  const [fait, setFait] = useState(false);
  /**
   * Ce que la lecture du site propose pour l'IDENTITÉ du compte (nom affiché,
   * ville, offre). Appliqué au clic sur le bouton, case cochée par défaut —
   * c'est la raison pour laquelle l'inscrit a donné son site.
   */
  const [identite, setIdentite] = useState<Pick<PropositionConfig, "agencyName" | "offer"> | null>(null);
  const [garderIdentite, setGarderIdentite] = useState(true);
  /**
   * ⚠ Le dirigeant lu sur les mentions légales n'est PAS posé comme
   * signataire d'office : celui qui s'inscrit n'est pas forcément lui, et on
   * ne devine jamais l'identité d'un humain (`lib/signature.ts`). Il faut un
   * acte — la case « c'est moi » — décochée par défaut.
   */
  const [dirigeant, setDirigeant] = useState("");
  const [cestMoi, setCestMoi] = useState(false);

  const set = (patch: Partial<ProfilOperateur>) => {
    setP((v) => ({ ...v, ...patch }));
    setFait(false);
  };

  // La lecture du site REMPLIT le formulaire, valeur lue par valeur lue :
  // une case que le site n'a pas su remplir garde ce que l'inscrit y avait mis.
  const recevoir = (prop: PropositionConfig) => {
    setP((v) => ({
      ...v,
      metier: prop.profil.metier || v.metier,
      cibleSecteur: prop.profil.cibleSecteur || v.cibleSecteur,
      cibleRole: prop.profil.cibleRole || v.cibleRole,
      cibleZone: prop.profil.cibleZone || v.cibleZone,
    }));
    if (prop.bookingUrl) setLien(prop.bookingUrl);
    const lu = Boolean(prop.agencyName || prop.offer.city || prop.offer.whatYouSell || prop.offer.valueProp);
    setIdentite(lu ? { agencyName: prop.agencyName, offer: prop.offer } : null);
    setGarderIdentite(true);
    setDirigeant(prop.dirigeant);
    setCestMoi(false);
    setFait(false);
  };

  const choisirClientele = (c: Clientele) => set({ cibleSecteur: c.libelle, cibleRole: c.role });

  const appliquer = () => {
    appliquerProfil(p);
    // ⚠ La règle « qu'est-ce qu'une lecture de site a le droit d'écraser ? »
    // vit dans `lib/bienvenue.ts`, partagée avec l'écran de bienvenue.
    patchSettings(patchReglages({ agencyName, offer }, { identite, garderIdentite, lien, dirigeant, cestMoi }));
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
            Les fiches que tu vois sont des exemples — six métiers inventés, parce qu&apos;il fallait bien choisir.
            Dis-nous ta cible et on refait la démonstration avec des fiches qui ressemblent à TON marché. Rien
            n&apos;est obligatoire, et tu peux revenir le changer.
          </p>
        </div>
      )}

      <LireMonSite onProposition={recevoir} onClientele={choisirClientele} />

      {identite && (
        <div className="panel space-y-2 p-3">
          <label className="flex items-start gap-2 text-[12px] text-paper-dim">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={garderIdentite}
              onChange={(e) => {
                setGarderIdentite(e.target.checked);
                setFait(false);
              }}
            />
            <span>
              Utiliser l&apos;identité lue sur mon site pour mes envois et mes documents :{" "}
              <strong className="text-paper">{identite.agencyName || agencyName}</strong>
              {identite.offer.city ? ` — ${identite.offer.city}` : ""}
              {identite.offer.whatYouSell ? ` — « ${identite.offer.whatYouSell} »` : ""}
            </span>
          </label>
          {dirigeant && (
            <label className="flex items-start gap-2 text-[12px] text-paper-dim">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={cestMoi}
                onChange={(e) => {
                  setCestMoi(e.target.checked);
                  setFait(false);
                }}
              />
              <span>
                C&apos;est moi, <strong className="text-paper">{dirigeant}</strong>, qui signe les messages{" "}
                <span className="text-paper-faint">(nom lu sur tes mentions légales — ne coche que si c&apos;est toi)</span>
              </span>
            </label>
          )}
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
