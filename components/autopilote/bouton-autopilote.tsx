"use client";

import { useCallback, useEffect, useState } from "react";
import { Power, Loader2, ShieldAlert } from "lucide-react";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BOUTON AUTOPILOTE — « Alpha se gère tout seul », en un tap.
 *
 * Il bascule le drapeau serveur (`/api/autopilote`) que les ticks lisent. Il
 * dit HONNÊTEMENT ce qu'il fait et ce qu'il ne fait pas : il ARME l'envoi/drip
 * automatique dans les règles ; il ne source pas, n'installe pas le cron, ne
 * contourne aucune garde (palier, DKIM, mentions). Un interrupteur, pas un tour
 * de magie — c'est cette franchise qui empêche de croire qu'on démarche quand,
 * faute de cron ou de fiches, rien ne part.
 * ─────────────────────────────────────────────────────────────────────
 */

interface EtatAutopilote {
  arme: boolean;
  drapeau: boolean | null;
  env: boolean;
  smtpPret?: boolean;
  rappel?: string;
  why?: string;
}

export function BoutonAutopilote() {
  const [etat, setEtat] = useState<EtatAutopilote | null>(null);
  const [chargement, setChargement] = useState(true);
  const [bascule, setBascule] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async () => {
    try {
      const r = await fetch("/api/autopilote");
      if (r.status === 403) {
        setErreur("Réservé au compte maître.");
        setEtat(null);
        return;
      }
      const d = (await r.json()) as EtatAutopilote & { error?: string };
      // Forme d'erreur (412/500) : pas de champ `arme`. On montre le motif,
      // et on ne pose PAS un état trompeur (« éteint ») sur une simple panne.
      if (d.error && typeof d.arme !== "boolean") {
        setErreur(d.error);
        return;
      }
      setEtat(d);
    } catch {
      setErreur("État indisponible (réseau).");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    relire();
  }, [relire]);

  const basculer = async () => {
    if (!etat) return;
    setBascule(true);
    setErreur(null);
    try {
      const r = await fetch("/api/autopilote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !etat.arme }),
      });
      const d = (await r.json()) as EtatAutopilote & { error?: string };
      if (!r.ok) {
        setErreur(d.error ?? "Bascule refusée.");
      } else {
        setEtat(d);
      }
    } catch {
      setErreur("Bascule échouée (réseau).");
    } finally {
      setBascule(false);
    }
  };

  if (erreur && !etat) return null; // pas maître, ou état indispo : on n'affiche rien de trompeur.

  const arme = etat?.arme ?? false;
  const forcParEnv = etat?.env === true; // armé par l'env : le bouton ne peut pas l'éteindre seul.

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Power size={15} className={arme ? "text-signal-green" : "text-paper-faint"} /> Autopilote
          </h2>
          <p className="mt-0.5 text-[12px] text-paper-dim">
            {chargement
              ? "Lecture de l'état…"
              : arme
                ? "ARMÉ — Alpha envoie et relance tout seul, dans le palier."
                : "ÉTEINT — Alpha calcule mais n'envoie rien (simulation)."}
          </p>
        </div>
        <button
          className={arme ? "btn-ghost px-3 py-2 text-signal-amber" : "btn-bronze px-3 py-2"}
          onClick={basculer}
          disabled={chargement || bascule || forcParEnv}
          title={forcParEnv ? "Armé par CAMPAIGN_AUTOPILOT (env) — se coupe côté serveur." : undefined}
        >
          {bascule ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
          {arme ? "Éteindre" : "Armer"}
        </button>
      </div>

      {/* La franchise obligatoire : ce que le bouton NE fait pas. */}
      <div className="mt-3 flex gap-2 rounded-lg border border-bronze-700/40 bg-bronze-900/10 p-2.5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-bronze-400" />
        <p className="text-[11px] leading-relaxed text-paper-faint">
          Armer <b>n'envoie rien tout seul</b> sans : l'ordonnanceur posé (migrations 004/014), des fiches
          synchronisées <b>avec email</b>, et le palier + DKIM OK. Le bouton décide si les ticks <b>agissent</b> ou
          simulent — il ne source pas, il ne contourne aucune garde.
          {etat?.smtpPret === false && <> · <span className="text-signal-amber">SMTP pas encore branché.</span></>}
          {forcParEnv && <> · Actuellement forcé par la variable d'environnement.</>}
        </p>
      </div>

      {erreur && <p className="mt-2 text-[11px] text-signal-red">{erreur}</p>}
    </section>
  );
}
