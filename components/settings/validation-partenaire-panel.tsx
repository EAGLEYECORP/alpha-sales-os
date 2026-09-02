"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { ACCOUNTS } from "@/lib/accounts";
import {
  CANAUX,
  estPartenaire,
  planValidation,
  poserValidation,
  ciblesCampagne,
  toutesLesCibles,
  validerTexte,
  type CanalValidation,
  type EtatValidation,
} from "@/lib/validation-partenaire";
import { cadreParId } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉCRAN QU'ON MET SOUS LE NEZ DU PARTENAIRE.
 *
 * Il sert à UN moment précis : on est en face du partenaire, on lui fait lire
 * ce qui sortira au nom de leur marque, et on note qui a dit oui.
 *
 * ⚠ CE QU'IL NE FAUT PAS EN FAIRE : une case à cocher. Le champ « qui » est
 * obligatoire, et c'est le seul détail qui rend la validation vérifiable trois
 * mois plus tard. « la société a validé » ne vaut rien ; « Karim, le 3 septembre,
 * en visio » se vérifie en un message.
 *
 * Les TEXTES viennent de `/api/prompts` (route réservée au compte maître) :
 * le registre client ne porte que les métadonnées, jamais le contenu — même
 * distinction que partout ailleurs dans ce dépôt, un chunk `_next/static/**`
 * ne se garde pas.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON: Record<EtatValidation, string> = {
  validee: "border-signal-green/40 text-signal-green",
  perimee: "border-signal-red/50 text-signal-red",
  jamais: "border-signal-amber/50 text-signal-amber",
  "non-requise": "border-ink-600 text-paper-faint",
};

export function ValidationPartenairePanel() {
  const settings = useAlpha((s) => s.settings);
  const patchSettings = useAlpha((s) => s.patchSettings);

  const [textes, setTextes] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [qui, setQui] = useState("");
  /**
   * ⚠ LES TEXTES SONT REPLIÉS PAR DÉFAUT — règle d'écran n°3 du dépôt.
   *
   * Constaté à l'écran : 20 textes déroulés en entier font une page de 10 800
   * pixels. On ne lit pas ça, on scrolle jusqu'en bas et on clique. Un écran
   * qui décourage la lecture transforme la validation en formalité, ce qui est
   * précisément ce qu'il devait empêcher.
   *
   * Ce qui est replié reste COMPTÉ : le bandeau du haut dit toujours combien
   * de textes bloquent.
   */
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [canal, setCanal] = useState<CanalValidation>("visio");

  /**
   * ⚠ LE COMPTE VALIDÉ N'EST PAS LE COMPTE ACTIF, et c'est délibéré.
   *
   * Deux raisons. La première est métier : c'est TOI qui es en face de
   * le partenaire, sur ton app, en compte maître — tu enregistres son accord POUR
   * eux, ils n'ont pas d'accès. La seconde est technique : `/api/prompts` est
   * réservée au compte maître (les prompts récitent la grille tarifaire), donc
   * un panneau qui ne marcherait qu'en étant BASCULÉ sur le partenaire se serait
   * fait refuser les textes qu'il doit afficher.
   */
  const partenaires = ACCOUNTS.filter((a) => a.kind !== "master");
  const [compte, setCompte] = useState(partenaires[0]?.id ?? "nuwacom");
  const validations = settings.validationsPartenaire ?? [];
  const partenaire = estPartenaire(compte);

  /**
   * ⚠ LES CAMPAGNES ENTRENT DANS LA LISTE, et c'est là que le volume part.
   *
   * Les cadres de la bibliothèque servent au copier-coller : l'opérateur les
   * recopie dans sa campagne puis les modifie. Faire valider le modèle sans
   * valider l'étape qui en descend laisserait partir un texte que personne n'a
   * relu — celui-là même qui est envoyé mille fois.
   */
  const campagnes = useAlpha((s) => s.campaigns);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const r = await fetch("/api/prompts");
        const j = (await r.json()) as {
          prompts?: { id: string; defaut: string }[];
          error?: string;
          why?: string;
        };
        if (!vivant) return;
        if (!r.ok) {
          setErreur(j.why ?? j.error ?? "Les textes n'ont pas pu être chargés.");
          return;
        }
        setTextes(Object.fromEntries((j.prompts ?? []).map((p) => [p.id, p.defaut])));
      } catch {
        if (vivant) setErreur("Les textes n'ont pas pu être chargés.");
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * Le texte réellement en vigueur pour une cible.
   *
   * ⚠ Deux sources, une seule fonction. Les PROMPTS s'éditent (`/prompts`) et
   * descendent du serveur ; les ÉCRITS sont des gabarits de la bibliothèque
   * (`lib/templates.ts`), déjà côté client. Les traiter séparément ferait
   * valider un texte et en envoyer un autre.
   */
  const texteCourant = (id: string): string => {
    const cadre = cadreParId(id);
    if (cadre) return cadre.body;
    // Étape de campagne : le texte vient du store, et c'est le MÊME calcul que
    // `ciblesCampagne` (sujet + corps) — sinon on validerait une chose et on
    // enverrait l'autre.
    const etape = campagnes.flatMap((c) => ciblesCampagne(c)).find((e) => e.cible.id === id);
    if (etape) return etape.texte;
    return (settings.prompts ?? []).find((p) => p.id === id)?.texte ?? textes?.[id] ?? "";
  };

  const plan = useMemo(() => {
    if (!textes) return null;
    const fixes = toutesLesCibles().map((cible) => ({ cible, texte: texteCourant(cible.id) }));
    const etapes = campagnes.flatMap((c) => ciblesCampagne(c));
    return planValidation([...fixes, ...etapes], compte, validations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textes, compte, validations, settings.prompts, campagnes]);

  const valider = (cibleId: string) => {
    const nom = qui.trim();
    if (!nom) return;
    const v = validerTexte(cibleId, texteCourant(cibleId), compte, nom, canal);
    patchSettings({ validationsPartenaire: poserValidation(validations, v) });
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ShieldCheck size={15} className="text-bronze-400" /> Validation partenaire
        </h2>
        <select
          value={compte}
          onChange={(e) => setCompte(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1 text-[12px] text-paper outline-none focus:border-bronze-400"
        >
          {partenaires.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
        Sur un appel ou un email envoyé au nom d&apos;un partenaire, c&apos;est{" "}
        <strong className="text-paper-dim">leur marque</strong> que le prospect voit. La conformité légale ne suffit pas : un texte peut être parfaitement licite et ne pas
        être celui qu&apos;ils ont relu. Ici on note ce qu&apos;ils ont validé, et l&apos;accord{" "}
        <strong className="text-paper-dim">tombe dès que le texte change</strong>.
      </p>

      {erreur && (
        <p className="mt-2 rounded-lg border border-signal-amber/50 px-3 py-2 text-[12px] text-signal-amber">{erreur}</p>
      )}

      {!partenaire && (
        <p className="mt-2 rounded-lg border border-ink-600 px-3 py-2 text-[12px] text-paper-faint">
          Aucun compte partenaire dans le portefeuille : personne à qui faire valider quoi que ce soit. Sur notre
          propre marque, c&apos;est notre risque et notre décision.
        </p>
      )}

      {partenaire && plan && (
        <>
          <p className={cn("mt-2 rounded-lg border px-3 py-2 text-[12px]", plan.restantes === 0 ? TON.validee : TON.jamais)}>
            {plan.resume}
          </p>

          {/* Qui valide — obligatoire, et c'est le point qui rend tout le reste utile. */}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint">
                Qui valide, chez eux
              </span>
              <input
                value={qui}
                onChange={(e) => setQui(e.target.value)}
                placeholder="Prénom et nom de la personne"
                className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-[13px] text-paper outline-none focus:border-bronze-400"
              />
            </label>
            <label>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint">Comment</span>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value as CanalValidation)}
                className="mt-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-[13px] text-paper outline-none focus:border-bronze-400"
              >
                {CANAUX.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!qui.trim() && (
            <p className="mt-1 text-[11px] italic text-paper-faint">
              Sans nom, une validation est une case qu&apos;on coche soi-même. Le jour où un appel dérape,
              « ils ont validé » ne vaut rien.
            </p>
          )}

          <div className="mt-3 space-y-2.5">
            {plan.lignes.map(({ cible, verdict }) => {
              const texte = texteCourant(cible.id);
              return (
                <div key={cible.id} className={cn("rounded-lg border px-3 py-2.5", TON[verdict.etat])}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-paper">
                      {verdict.etat === "validee" ? (
                        <Check size={13} className="text-signal-green" />
                      ) : verdict.etat === "perimee" ? (
                        <AlertTriangle size={13} className="text-signal-red" />
                      ) : (
                        <Clock size={13} className="text-signal-amber" />
                      )}
                      {cible.label}
                    </p>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-paper-faint">
                      {cible.canal}
                    </span>
                  </div>

                  <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">{verdict.pourquoi}</p>

                  {/* Le texte exact, tel qu'il partira. C'est CE bloc qu'on leur fait lire. */}
                  <button
                    onClick={() => setOuverts((o) => ({ ...o, [cible.id]: !o[cible.id] }))}
                    className="mt-2 flex items-center gap-1.5 text-[11.5px] text-paper-faint hover:text-paper"
                  >
                    {ouverts[cible.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {ouverts[cible.id] ? "Replier le texte" : `Lire le texte (${texte.length} caractères)`}
                  </button>
                  {ouverts[cible.id] && (
                    <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-paper-dim">
                      {texte || "(texte indisponible)"}
                    </pre>
                  )}

                  {verdict.etat !== "validee" && (
                    <button
                      className="btn-bronze mt-2 px-3 py-1.5 text-[12px]"
                      disabled={!qui.trim() || !texte || !ouverts[cible.id]}
                      title={
                        !ouverts[cible.id]
                          ? "Ouvre le texte d'abord : on ne valide pas ce qu'on n'a pas lu"
                          : undefined
                      }
                      onClick={() => valider(cible.id)}
                    >
                      {verdict.etat === "perimee" ? "Revalider cette version" : "Enregistrer leur validation"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ⚠ Dire ce que le contrôle fait vraiment, sinon on croit à une formalité. */}
          <p className="mt-3 text-[11px] leading-relaxed text-paper-faint">
            Tant qu&apos;un texte n&apos;est pas validé, <strong className="text-paper-dim">l&apos;appel et l&apos;envoi
            sont refusés côté serveur</strong> (422) — pas seulement grisés ici. Modifier une seule phrase fait
            retomber l&apos;état à « périmé » : l&apos;accord portait sur l&apos;ancienne version.
            <br />
            Un message écrit <strong className="text-paper-dim">à la main</strong> n&apos;est pas bloqué : celui qui
            l&apos;écrit l&apos;assume. Ce qui est gardé, c&apos;est ce qui part sans que personne relise — un gabarit
            ou une campagne.
          </p>
        </>
      )}
    </section>
  );
}
