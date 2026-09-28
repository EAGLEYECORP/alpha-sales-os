"use client";

import { useState } from "react";
import { Check, Lock, Plus, Power, Trash2, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { FAMILLES, type ErreurOffre, type Offre } from "@/lib/offer-catalogue";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TES OFFRES — ajouter, modifier, désactiver, sans redéployer.
 *
 * Tout était en dur : `EagleyeOffer` est une union de types, les catalogues
 * sont des tableaux `const`. Changer un libellé demandait un commit, une
 * revue et un déploiement. Pour un produit white-label, c'est rédhibitoire.
 *
 * Deux choix d'interface qui viennent de la logique, pas du goût :
 *
 *  · LA FAMILLE EST OBLIGATOIRE et affichée avec ses conséquences. C'est elle
 *    qui décide du compte, de l'aimant et de la marche de l'escalier — pas le
 *    nom. Une offre sans famille s'afficherait partout et ne serait traitée
 *    nulle part, ce qui est pire que pas d'offre.
 *
 *  · ON DÉSACTIVE, ON NE SUPPRIME PAS. Une offre qui a servi est portée par
 *    des fiches signées ; l'effacer les rendrait illisibles. Le bouton
 *    supprimer existe, mais il refuse quand le routage en dépend, et il dit
 *    pourquoi.
 * ─────────────────────────────────────────────────────────────────────
 */
export function OffresEditor() {
  const offers = useAlpha((s) => s.offers);
  const upsertOffre = useAlpha((s) => s.upsertOffre);
  const basculerOffre = useAlpha((s) => s.basculerOffre);
  const supprimerOffre = useAlpha((s) => s.supprimerOffre);

  const [edite, setEdite] = useState<Partial<Offre> | null>(null);
  const [erreurs, setErreurs] = useState<ErreurOffre[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const erreurDe = (champ: string) => erreurs.find((e) => e.champ === champ)?.message;

  const enregistrer = () => {
    if (!edite) return;
    const err = upsertOffre(edite);
    setErreurs(err);
    if (!err.length) {
      setEdite(null);
      setMessage("Offre enregistrée.");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const effacer = (o: Offre) => {
    const r = supprimerOffre(o.id);
    setMessage(r.ok ? "Offre supprimée." : (r.raison ?? "Suppression refusée."));
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-paper">Tes offres</h2>
        <button
          className="btn-ghost px-2.5 py-1 text-[12px]"
          onClick={() => {
            setErreurs([]);
            setEdite({ famille: "alpha-sales-os", actif: true, setupHT: 0, monthlyHT: 0 });
          }}
        >
          <Plus size={13} /> Ajouter
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        Ce que TU vends à tes prospects. Les scripts, les devis et l&apos;IA s&apos;appuient dessus.
      </p>

      {message && (
        <p className="mt-2 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[11.5px] text-paper-dim">{message}</p>
      )}

      <ul className="mt-3 space-y-1.5">
        {offers.map((o) => (
          <li
            key={o.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-[12px]",
              o.actif ? "border-ink-600 bg-ink-850" : "border-ink-700 bg-ink-900 opacity-60"
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-paper">
                {o.systeme && <Lock size={11} className="text-paper-faint" />}
                {o.label}
              </span>
              <span className="font-mono text-[11px] text-paper-faint">
                {o.setupHT > 0 ? `${o.setupHT.toLocaleString("fr-FR")} €` : "sur devis"}
                {o.monthlyHT > 0 && ` + ${o.monthlyHT.toLocaleString("fr-FR")} €/mois`}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-paper-faint">{o.what}</p>
            <p className="mt-0.5 text-[10.5px] text-paper-faint">
              Routage : {FAMILLES.find((f) => f.id === o.famille)?.label ?? o.famille}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                className="btn-ghost px-2 py-0.5 text-[11px]"
                onClick={() => {
                  setErreurs([]);
                  setEdite({ ...o });
                }}
              >
                Modifier
              </button>
              <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => basculerOffre(o.id, !o.actif)}>
                <Power size={11} /> {o.actif ? "Désactiver" : "Réactiver"}
              </button>
              {!o.systeme && (
                <button className="btn-ghost px-2 py-0.5 text-[11px] text-signal-red" onClick={() => effacer(o)}>
                  <Trash2 size={11} /> Supprimer
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {edite && (
        <div className="mt-4 rounded-xl border border-bronze-700/40 bg-bronze-900/10 p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[12.5px] font-medium text-paper">{edite.id ? "Modifier l'offre" : "Nouvelle offre"}</p>
            <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setEdite(null)}>
              <X size={12} /> Annuler
            </button>
          </div>

          <label className="label mt-2">Nom</label>
          <input
            className="input"
            placeholder="ex. Rénovation énergétique clé en main"
            value={edite.label ?? ""}
            onChange={(e) => setEdite({ ...edite, label: e.target.value })}
          />
          {erreurDe("label") && <p className="mt-1 text-[11px] text-signal-red">{erreurDe("label")}</p>}

          <label className="label mt-2">Ce que ça fait (une phrase qu&apos;il reconnaît)</label>
          <input
            className="input"
            placeholder="ex. On refait l'isolation et on monte le dossier d'aides à votre place."
            value={edite.what ?? ""}
            onChange={(e) => setEdite({ ...edite, what: e.target.value })}
          />
          {erreurDe("what") && <p className="mt-1 text-[11px] text-signal-red">{erreurDe("what")}</p>}

          <label className="label mt-2">Argument d&apos;ouverture (optionnel)</label>
          <input
            className="input"
            placeholder="« Vous payez pour chauffer la rue. On mesure d'abord, on décide ensuite. »"
            value={edite.pitch ?? ""}
            onChange={(e) => setEdite({ ...edite, pitch: e.target.value })}
          />

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-paper-faint">
              Installation (€ HT) — 0 = sur devis
              <input
                type="number"
                min={0}
                className="input mt-1"
                value={edite.setupHT ?? 0}
                onChange={(e) => setEdite({ ...edite, setupHT: Math.max(0, +e.target.value) })}
              />
            </label>
            <label className="text-[11px] text-paper-faint">
              Mensuel (€ HT) — 0 = sans abonnement
              <input
                type="number"
                min={0}
                className="input mt-1"
                value={edite.monthlyHT ?? 0}
                onChange={(e) => setEdite({ ...edite, monthlyHT: Math.max(0, +e.target.value) })}
              />
            </label>
          </div>

          <label className="label mt-2">Famille de routage</label>
          <select
            className="input"
            value={edite.famille ?? ""}
            onChange={(e) => setEdite({ ...edite, famille: e.target.value as Offre["famille"] })}
          >
            {FAMILLES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-paper-faint">
            {FAMILLES.find((f) => f.id === edite.famille)?.implique}
          </p>
          <p className="mt-1 text-[11px] text-paper-faint">
            La famille décide du compte, de l&apos;aimant et de la marche — pas le nom. Une offre sans famille
            s&apos;afficherait partout et ne serait traitée nulle part.
          </p>
          {erreurDe("famille") && <p className="mt-1 text-[11px] text-signal-red">{erreurDe("famille")}</p>}

          <button className="btn-bronze mt-3 px-3 py-1.5 text-[12px]" onClick={enregistrer}>
            <Check size={13} /> Enregistrer
          </button>
        </div>
      )}
    </section>
  );
}
