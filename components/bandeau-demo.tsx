"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { profilExploitable } from "@/lib/profil-operateur";
import { ProfilIcp } from "@/components/profil-icp";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « CE QUE TU VOIS N'EST PAS TON PIPELINE. »
 *
 * Le bandeau existait déjà et disait la bonne chose : des données de démo
 * sont actives, voici comment passer en réel. Il lui manquait la marche
 * intermédiaire, et c'est celle que tout le monde prend.
 *
 * ── LE DÉFAUT : IL N'OFFRAIT QUE LA SORTIE LA PLUS COÛTEUSE ──
 *
 * « Réglages → Tout vider, puis importe ton CSV. » Le premier jour, personne
 * n'a de CSV prêt. Le bandeau proposait donc, comme seule action, celle qui
 * demande le plus de travail au moment où on en a le moins envie. Résultat :
 * on ne fait rien, et on continue à regarder les restaurants de quelqu'un
 * d'autre en se demandant si le produit sait faire autre chose.
 *
 * Deux sorties, désormais, dans l'ordre de l'effort :
 *  1. **dire sa cible** — trente secondes, et les écrans se mettent à parler
 *     de son marché ;
 *  2. **importer son fichier** — quand il l'aura sous la main.
 *
 * ⚠ LE BANDEAU NE SE FERME PAS DÉFINITIVEMENT, et c'est délibéré. Tant que
 * des fiches inventées sont dans le pipe, l'information « ce ne sont pas tes
 * chiffres » doit rester atteignable : ces fiches entrent dans les compteurs
 * de l'écran. On peut replier le formulaire, pas masquer l'avertissement.
 * ─────────────────────────────────────────────────────────────────────
 */
export function BandeauDemo() {
  const profil = useAlpha((s) => s.settings.profil);
  const [ouvert, setOuvert] = useState(false);
  const cible = profilExploitable(profil);

  return (
    <section className="card border-bronze-700/60 px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-paper">
          <strong className="text-bronze-300">Fiches d&apos;exemple actives.</strong>{" "}
          <span className="text-paper-dim">
            {cible
              ? "Elles sont fabriquées sur la cible que tu as décrite — inventées, mais à ton marché. Elles comptent dans les chiffres de cet écran tant qu'elles sont là."
              : "Ce ne sont pas tes chiffres. Dis-nous à qui tu vends et on refait la démonstration avec des fiches qui ressemblent à ton marché — trente secondes."}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setOuvert((v) => !v)} className="btn-ghost">
            {ouvert ? (
              <>
                <X size={14} /> Replier
              </>
            ) : (
              <>
                <Sparkles size={14} /> {cible ? "Changer ma cible" : "Dire à qui je vends"}
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11.5px] text-paper-faint">
        Quand tu auras ton fichier :{" "}
        <Link href="/settings" className="text-bronze-400 underline hover:text-bronze-300">
          Réglages → Tout vider
        </Link>
        , puis importe ton Google Sheet ou ton CSV.
      </p>

      {ouvert && (
        <div className="mt-3 border-t border-ink-700 pt-3">
          <ProfilIcp compact onFini={() => setOuvert(false)} />
        </div>
      )}
    </section>
  );
}
