"use client";
import { useState } from "react";
import { CalendarCheck, Lock, ShieldCheck } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { CADRAGE_VIDE, creneauPasse, isoVersChampLocal, peutEmettreDevis } from "@/lib/cadrage";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CONSIGNER LE CADRAGE — le producteur qui manquait à `EtatCadrage`.
 *
 * ══ POURQUOI CE PANNEAU EXISTE ══
 *
 * `peutEmettreDevis` arbitrait depuis des semaines sur une structure que
 * **rien ne remplissait**. Poser la garde sur le devis sans donner l'endroit
 * où consigner le cadrage aurait fabriqué un mur : la règle serait devenue
 * « on ne peut plus envoyer de devis », et le premier réflexe devant un outil
 * qui refuse est de le contourner. Une règle contournée ne protège personne.
 *
 * ══ LES DEUX PIÈGES, ET CE QUI LES TIENT ══
 *
 * **1. Le champ pré-rempli qui coche la règle tout seul.** La tentation était
 * de mettre `settings.closerName` dans « validé par » — c'est presque toujours
 * la bonne réponse. Ç'aurait satisfait la troisième condition par CONFIGURATION
 * et non par un ACTE : au premier créneau saisi, deux conditions sur trois se
 * seraient remplies sans que personne ne décide rien. On ne pré-remplit pas ce
 * qu'on vérifie.
 *
 * **2. Trois cases cochées en dix secondes.** « La visio s'est tenue » ne peut
 * pas se déclarer sur un créneau à venir (`creneauPasse`). C'est la doctrine
 * des paliers appliquée ici : un point déclaratif ne s'offre pas tant que sa
 * condition n'existe pas.
 *
 * ⚠ Ce panneau n'émet RIEN. Il consigne un fait. L'arbitrage vit dans
 * `/api/catalogue`, là où le document se fabrique — un bouton se contourne,
 * la fonction qui rend le texte, non.
 * ─────────────────────────────────────────────────────────────────────
 */
export function CadragePanel({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const c = p.cadrage ?? CADRAGE_VIDE;
  const verdict = peutEmettreDevis(c);

  /**
   * ⚠ L'HORLOGE EST LUE UNE FOIS, AU MONTAGE, ET GARDÉE. La relire à chaque
   * rendu ferait basculer la case « tenu » pendant que l'opérateur tape, sans
   * qu'aucune action de sa part l'explique.
   */
  const [maintenant] = useState(() => Date.now());
  const passe = creneauPasse(c, maintenant);

  const maj = (patchCadrage: Partial<typeof c>) => patch(p.id, { cadrage: { ...c, ...patchCadrage } });

  /**
   * `datetime-local` ne parle pas ISO. ⚠ Le décalage est celui de LA DATE
   * stockée, pas celui d'aujourd'hui : un cadrage tenu en août relu en
   * novembre change d'heure d'une heure si on prend le décalage courant.
   */
  const pourInput = c.creneauIso
    ? isoVersChampLocal(c.creneauIso, new Date(c.creneauIso).getTimezoneOffset())
    : "";

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <CalendarCheck size={15} className="text-bronze-400" /> Cadrage
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Pas de devis sans cadrage. Un montant annoncé sans avoir regardé le cas se renégocie à la
        livraison — et c&apos;est le client qui a raison de le reprocher.
      </p>

      <label className="mt-3 block">
        <span className="text-[11px] uppercase tracking-wider text-paper-faint">
          Créneau décidé — date <em>et</em> heure
        </span>
        <input
          type="datetime-local"
          className="input mt-1 w-full text-[13px]"
          value={pourInput}
          onChange={(e) => {
            const v = e.target.value;
            /**
             * ⚠ CHANGER LE CRÉNEAU REMET « TENU » À FAUX. Sans ça, on tient la
             * visio, on coche, puis on la REPROGRAMME — et le drapeau survit à
             * la réécriture, donc il atteste d'une rencontre qui n'a pas eu
             * lieu. C'est exactement le défaut que `validation-partenaire`
             * corrige avec `perimee` : un tampon attaché au nom d'un texte, pas
             * à son contenu, survit à sa réécriture.
             */
            maj({ creneauIso: v ? new Date(v).toISOString() : null, reelementTenu: false });
          }}
        />
      </label>

      <label
        className={cn(
          "mt-3 flex items-start gap-2 text-[12.5px]",
          passe ? "text-paper cursor-pointer" : "text-paper-faint",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 accent-bronze-500"
          checked={c.reelementTenu}
          disabled={!passe}
          onChange={(e) => maj({ reelementTenu: e.target.checked })}
        />
        <span>
          Le cadrage a <strong>réellement eu lieu</strong>.
          {!passe && (
            <span className="ml-1 inline-flex items-center gap-1 text-paper-faint">
              <Lock size={11} />
              {c.creneauIso
                ? "se cochera après le créneau — on ne déclare pas une visio à venir"
                : "pose d'abord un créneau"}
            </span>
          )}
        </span>
      </label>

      <label className="mt-3 block">
        <span className="text-[11px] uppercase tracking-wider text-paper-faint">
          La suite a été validée par
        </span>
        <input
          type="text"
          className="input mt-1 w-full text-[13px]"
          placeholder="Qui a dit « on y va » — nom, pas fonction"
          value={c.validePar ?? ""}
          onChange={(e) => maj({ validePar: e.target.value || null })}
        />
      </label>

      <p
        className={cn(
          "panel mt-3 flex items-start gap-2 p-3 text-[11.5px] leading-snug",
          verdict.autorise ? "text-signal-green" : "text-signal-amber",
        )}
      >
        <ShieldCheck size={13} className="mt-0.5 shrink-0" />
        <span>{verdict.motif}</span>
      </p>
    </section>
  );
}
