"use client";

import { AlertTriangle, Check, CloudOff, RefreshCw, Upload } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { type EtatSync } from "@/lib/sync-prospects";
import { useMoteurSync } from "@/components/sync-moteur";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO, VUE DE L'OPÉRATEUR.
 *
 * ⚠ Ce fichier ne contient plus de MOTEUR : il est monté dans la coquille
 * (`components/sync-moteur.tsx`), et cette carte n'en est que l'affichage.
 * La raison est écrite là-bas et vaut d'être relue avant d'y toucher : tant
 * que le moteur vivait ici, un opérateur en mode pipe serveur qui n'ouvrait
 * pas Réglages ne poussait rien — et perdait sa journée en fermant l'onglet.
 *
 * ── POURQUOI C'EST UN INTERRUPTEUR, ET PAS UN COMPORTEMENT PAR DÉFAUT ──
 *
 * Activer cette synchro transfère vers un serveur les coordonnées de vraies
 * personnes : noms, téléphones, adresses d'entreprises qui n'ont rien demandé.
 * C'est notre base, c'est légitime, et ça reste une décision — pas un réglage
 * qu'on découvre après coup. Elle est donc éteinte par défaut, et l'écran dit
 * ce qu'elle change dans les deux sens.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON: Record<EtatSync, string> = {
  "a-jour": "border-signal-green/40 text-signal-green",
  "en-retard": "border-signal-amber/50 text-signal-amber",
  erreur: "border-signal-red/50 text-signal-red",
  jamais: "border-ink-600 text-paper-faint",
  desactivee: "border-ink-600 text-paper-faint",
};

export function SyncProspects() {
  const settings = useAlpha((s) => s.settings);
  const patchSettings = useAlpha((s) => s.patchSettings);
  const moteur = useMoteurSync();

  const active = settings.supabaseSync;
  const pipeServeur = Boolean(settings.pipeServeur);
  const plan = moteur?.plan ?? null;
  /**
   * ⚠ On n'active PAS le mode serveur tant qu'il reste quoi que ce soit à
   * envoyer. Dès qu'il est actif, les fiches ne sont plus écrites dans
   * localStorage : ce qui n'avait pas été poussé n'existerait plus au
   * prochain rechargement. Ce n'est pas un garde-fou théorique — c'est le cas
   * NORMAL, puisqu'on active ce mode précisément quand on a beaucoup de
   * fiches locales.
   */
  const toutPousse = Boolean(plan && plan.aEcrire.length === 0 && plan.aSupprimer.length === 0);

  /**
   * Rendue hors de la coquille, cette carte n'aurait pas de moteur derrière
   * elle : ses boutons ne feraient rien, en silence. On le DIT plutôt que de
   * laisser croire à une synchro qui tourne.
   */
  if (!moteur) {
    return (
      <section className="card p-4">
        <p className="text-[12px] text-signal-amber">
          Le moteur de synchro n&apos;est pas monté sur cette page. Ce panneau ne pilote rien.
        </p>
      </section>
    );
  }

  const { etat, message, enCours, confirmerEffacement, autorise, pousser, annulerConfirmation } = moteur;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          {active ? <Upload size={15} className="text-bronze-400" /> : <CloudOff size={15} className="text-paper-faint" />}
          Synchro du pipe vers le serveur
        </h2>
        <button
          className={cn("chip cursor-pointer", active ? "border-signal-green/50 text-signal-green" : "border-ink-600 text-paper-faint")}
          onClick={() => patchSettings({ supabaseSync: !active })}
        >
          {active ? "activée" : "désactivée"}
        </button>
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
        Le CRM vit dans <strong className="text-paper-dim">ce navigateur</strong>. Sans cette synchro, l&apos;orchestrateur
        ne voit rien du pipe et rien n&apos;est récupérable depuis un autre appareil. Avec elle, les coordonnées de tes
        prospects sont écrites sur ton serveur Supabase — c&apos;est ta base, et c&apos;est une décision, pas un défaut.
      </p>

      <p className={cn("mt-2 rounded-lg border px-3 py-2 text-[12px]", TON[etat])}>{message}</p>

      {confirmerEffacement && (
        <div className="mt-2 rounded-lg border border-signal-red/50 bg-signal-red/5 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-signal-red">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Synchro arrêtée avant d&apos;envoyer. Si tu as réellement supprimé ces fiches, confirme. Si tu viens de
            changer d&apos;appareil ou de vider ton navigateur, <strong>n&apos;confirme pas</strong> — désactive plutôt
            la synchro et récupère tes données d&apos;abord.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-ghost px-2.5 py-1.5 text-[12px] text-signal-red" onClick={() => void pousser(true)}>
              Oui, supprimer côté serveur
            </button>
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={annulerConfirmation}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="mt-3 rounded-lg border border-ink-700 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] font-medium text-paper">Le pipe vit sur le serveur</p>
            <button
              className={cn(
                "chip cursor-pointer",
                pipeServeur ? "border-signal-green/50 text-signal-green" : "border-ink-600 text-paper-faint"
              )}
              disabled={!pipeServeur && !toutPousse}
              onClick={() => {
                if (!pipeServeur && !toutPousse) return;
                patchSettings({ pipeServeur: !pipeServeur });
              }}
            >
              {pipeServeur ? "activé" : "désactivé"}
            </button>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
            Sans ça, tes fiches sont écrites dans <strong className="text-paper-dim">localStorage</strong>, qui sature
            vers <strong className="text-paper-dim">1 200 fiches</strong> — et au-delà, l&apos;enregistrement échoue{" "}
            <strong className="text-paper-dim">en silence</strong> : l&apos;écran continue d&apos;afficher tes fiches,
            elles disparaissent en fermant l&apos;onglet. Avec ça, le navigateur ne garde plus qu&apos;une copie de
            travail et charge le pipe au démarrage. C&apos;est ce qui permet de tenir 2 500 fiches.
          </p>
          {!pipeServeur && !toutPousse && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-signal-amber">
              Impossible d&apos;activer maintenant : {plan ? plan.resume : "l'état du serveur n'est pas connu"}. Une
              fois activé, les fiches ne sont plus écrites localement — ce qui n&apos;a pas été envoyé serait perdu au
              prochain rechargement. Synchronise d&apos;abord.
            </p>
          )}
          {pipeServeur && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-paper-faint">
              Désactiver remet les fiches dans le navigateur — donc les remet sous le quota de 5 Mo. Au-delà de
              1 200 fiches, l&apos;écriture échouera à nouveau.
            </p>
          )}
        </div>
      )}

      {active && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button className="btn-bronze px-3 py-1.5 text-[12px]" disabled={enCours || !autorise} onClick={() => void pousser()}>
            {enCours ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
            {enCours ? "Envoi…" : "Synchroniser maintenant"}
          </button>
          {plan && !plan.effacementMassif && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-paper-faint">
              {plan.aEcrire.length === 0 && plan.aSupprimer.length === 0 ? (
                <>
                  <Check size={12} className="text-signal-green" /> {plan.inchangees} fiche(s) déjà à jour
                </>
              ) : (
                plan.resume
              )}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
