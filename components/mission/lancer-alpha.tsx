"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Hand, Loader2, Minus, Play } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { useDroits } from "@/lib/use-droits";
import {
  executerMission,
  type ActionsMission,
  type BilanMission,
  type EtapeMission,
  type StatutEtape,
} from "@/lib/mission-alpha";
import { BoiteEnvoi } from "@/components/settings/cle-ia";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « LANCER ALPHA » — un bouton, et le travail s'enchaîne devant toi.
 *
 * Tout ce qui se DÉCIDE (les étapes, ce qu'elles comptent, ce que la mission a
 * le droit de faire) vit dans `lib/mission-alpha.ts`, où un test l'atteint. Ce
 * composant branche le store, rend chaque étape à mesure qu'elle FINIT, et
 * laisse la boîte d'envoi se brancher sur place quand c'est ce qui manque —
 * sans aller chercher un réglage dans un autre écran.
 *
 * ⚠ Aucun délai d'ambiance, aucune barre de progression : une étape qui prend
 * zéro milliseconde apparaît tout de suite. Le décalage visuel entre les cartes
 * est une animation d'entrée, pas un travail qui aurait duré.
 *
 * ⚠ Ça tourne DANS LE NAVIGATEUR, onglet ouvert, et le dit.
 * ─────────────────────────────────────────────────────────────────────
 */

const ICONE: Record<StatutEtape, { Icone: typeof Check; classe: string; libelle: string }> = {
  fait: { Icone: Check, classe: "text-signal-green", libelle: "fait" },
  "a-toi": { Icone: Hand, classe: "text-signal-amber", libelle: "à toi" },
  vide: { Icone: Minus, classe: "text-paper-faint", libelle: "rien à faire" },
  saute: { Icone: Minus, classe: "text-paper-faint", libelle: "passée" },
};

export function LancerAlpha() {
  const prepareCampaignDrafts = useAlpha((s) => s.prepareCampaignDrafts);
  const logActivity = useAlpha((s) => s.logActivity);
  const droits = useDroits();

  const [etapes, setEtapes] = useState<readonly EtapeMission[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<BilanMission | null>(null);

  // La boîte d'envoi n'a de sens à demander QUE pour un compte locataire : le
  // maître et une installation chez un client envoient avec l'environnement du
  // serveur. `null` = la question ne se pose pas (et on ne réclame rien).
  const locataire = droits.session && !droits.maitre && !droits.solo && !droits.exploitant;
  const [email, setEmail] = useState<boolean | null>(null);
  useEffect(() => {
    if (!locataire) {
      setEmail(null);
      return;
    }
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d: { cles?: Record<string, { verifieLe: string | null }> }) => setEmail(Boolean(d.cles?.email?.verifieLe)))
      .catch(() => setEmail(null));
  }, [locataire]);

  const lancer = async () => {
    setEnCours(true);
    setEtapes([]);
    setBilan(null);
    const lireEtat = () => {
      const s = useAlpha.getState();
      return { prospects: s.prospects, meetings: s.meetings, campaigns: s.campaigns, drafts: s.drafts, accountId: s.settings.accountId, email };
    };
    const actions: ActionsMission = {
      preparerBrouillons: (id) => {
        prepareCampaignDrafts(id);
        const d = useAlpha.getState().drafts.filter((x) => x.campaignId === id);
        return { aRelire: d.filter((x) => x.status === "pending").length, ecartes: d.filter((x) => x.status === "skipped").length };
      },
    };
    try {
      const b = await executerMission(lireEtat, actions, setEtapes);
      setBilan(b);
      // La trace de ce que la mission a fait — elle se relit dans l'activité.
      logActivity({
        kind: "systeme",
        message: `Mission ALPHA : ${b.brouillonsPrepares} brouillon(s) préparé(s), ${b.aToi} point(s) attendent un humain. Rien n'a été envoyé.`,
      });
    } finally {
      setEnCours(false);
    }
  };

  const besoinEmail = etapes.some((e) => e.besoin === "email");

  return (
    <section id="alpha" className="card scroll-mt-20 p-4" aria-label="Lancer ALPHA">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-paper">Laisse ALPHA préparer ta journée</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
            Je lis ton pipe, je le trie, je cherche ce qui attend une décision, je prépare les messages et ta liste
            d&apos;appels. Puis je m&apos;arrête et je te dis ce qu&apos;il me faut de toi.{" "}
            <strong>Rien ne part sans toi.</strong>
          </p>
        </div>
        <button className="btn-bronze px-4 py-2 text-[13px]" onClick={() => void lancer()} disabled={enCours}>
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {enCours ? "ALPHA travaille…" : bilan ? "Relancer ALPHA" : "Lancer ALPHA"}
        </button>
      </div>

      {etapes.length > 0 && (
        <ol className="mt-4 space-y-2" aria-live="polite">
          {etapes.map((e, i) => {
            const { Icone, classe, libelle } = ICONE[e.statut];
            return (
              <li
                key={e.id}
                className="panel animate-fade-up p-3"
                style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-start gap-2.5">
                  <Icone size={15} className={cn("mt-0.5 shrink-0", classe)} aria-label={libelle} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-paper">{e.titre}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-paper-dim">{e.resume}</p>

                    {e.chiffres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.chiffres.map((c) => (
                          <span key={c.label} className="chip border-ink-700 text-[10.5px] text-paper-dim">
                            <b className="mr-1 font-display text-paper">{c.valeur}</b>
                            {c.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {e.details.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {e.details.map((d) => (
                          <li key={d.texte} className="text-[12px] text-paper-dim">
                            {d.href ? (
                              <Link href={d.href} className="hover:text-bronze-400">
                                {d.texte}
                              </Link>
                            ) : (
                              d.texte
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {e.lien && (
                      <Link href={e.lien.href} className="btn-ghost mt-2 px-3 py-1.5 text-[12px]">
                        {e.lien.libelle} <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Ce qui manque pour AGIR se règle ICI, sur place : une boîte à brancher
          ne doit pas envoyer chercher un autre écran au moment précis où
          l'on veut envoyer. */}
      {besoinEmail && !enCours && (
        <div className="mt-4">
          <BoiteEnvoi surConnecte={() => setEmail(true)} />
        </div>
      )}

      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        ALPHA travaille ici, dans ton navigateur, onglet ouvert : ton pipe ne quitte pas cet appareil. Il prépare, il ne
        décide pas — et il ne peut ni envoyer ni appeler à ta place.
      </p>
    </section>
  );
}
