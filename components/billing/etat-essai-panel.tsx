"use client";

import Link from "next/link";
import { Clock, KeyRound, PauseCircle } from "lucide-react";
import { useDroits } from "@/lib/use-droits";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉTAT DE L'ESSAI, DIT AU LOCATAIRE.
 *
 * ══ ⚠⚠ CE QUE CET ÉCRAN RÉPARE ══
 *
 * `etatEssai` (lib/essai.ts) produit depuis le 17/09 une `phrase` écrite pour
 * être lue par un humain — « Essai en cours, 12 jours, 18 € restants », « le
 * plafond est atteint », « l'ouverture a atteint son enveloppe ». **Aucun
 * écran ne l'affichait.** Le défaut récurrent de ce dépôt, commis sur la
 * brique qu'on venait d'ouvrir le matin même.
 *
 * Et le trou était pire que « pas d'information ». Un essai qui se ferme
 * retombe au socle gratuit — invariant du dépôt — et le socle gratuit porte
 * `statut: "actif"`. Donc, vu de l'écran, **un essai terminé était
 * indistinguable d'un compte qui n'en a jamais eu** : le locataire perdait
 * `/campaigns`, `/agent` et `/audits` du jour au lendemain, sans qu'aucune
 * page ne dise pourquoi ni ne propose quoi faire.
 *
 * ══ TROIS ÉTATS, PAS DEUX ══
 *
 *  · `essai === null`   → ce compte n'a pas d'essai. On n'affiche RIEN.
 *  · `essai.actif`      → il tourne : on montre ce qu'il reste, des deux
 *                         côtés (jours ET euros), parce que la première
 *                         limite atteinte ferme.
 *  · `!essai.actif`     → il est fini : on dit POURQUOI, et on nomme la
 *                         sortie.
 *
 * ⚠ Ne jamais fondre les deux derniers en « essai inactif ». « Tu as
 * consommé ton quota » et « notre ouverture est pleine » appellent deux
 * gestes opposés, et le second n'est pas la faute du locataire.
 *
 * ══ ⚠ CE QUE CET ÉCRAN NE DIT PAS ══
 *
 * L'enveloppe d'ouverture (`ENVELOPPE_OUVERTURE_EUR`) ne s'affiche jamais :
 * c'est le budget d'acquisition de notre société, même famille que `/offre`
 * et `voice-costs`, réservés au maître. Le locataire voit SA consommation.
 * `etatEssai` garde déjà ce nombre hors de sa phrase, et un test l'exige ;
 * ce composant ne fait que ne pas le réintroduire.
 *
 * ⚠ Il n'AUTORISE rien. Il lit `essai`, qui est descriptif. Les droits
 * viennent de `bricks`, et la barrière est le middleware.
 * ─────────────────────────────────────────────────────────────────────
 */
export function EtatEssaiPanel() {
  const { essai } = useDroits();

  // Pas d'essai sur ce compte : rien à raconter. On ne fabrique pas une
  // section vide « aucun essai en cours » — ça inquiète sans informer.
  if (!essai) return null;

  if (essai.actif) {
    return (
      <section className="card p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-paper">
          <Clock size={15} className="text-bronze-400" /> Essai en cours
        </p>
        <p className="mt-2 text-[13px] text-paper-dim">{essai.phrase}</p>
        {/**
         * ⚠ LES DEUX LIMITES S'AFFICHENT ENSEMBLE, et c'est le point.
         * Elles sont INDÉPENDANTES : la première atteinte ferme l'essai. Ne
         * montrer que les jours ferait découvrir le plafond de consommation
         * au moment exact où il mord — c'est-à-dire au pire moment.
         */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="panel p-3">
            <p className="text-[11px] uppercase tracking-wider text-paper-faint">Durée</p>
            <p className="mt-1 text-lg font-semibold text-paper">
              {essai.joursRestants === null ? "—" : `${essai.joursRestants} j`}
            </p>
          </div>
          <div className="panel p-3">
            <p className="text-[11px] uppercase tracking-wider text-paper-faint">Consommation</p>
            <p className="mt-1 text-lg font-semibold text-paper">{essai.coutRestantEur} €</p>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-paper-faint">
          Les deux limites sont indépendantes : la première atteinte referme l&apos;essai. Tout ce qui tourne chez toi
          reste ouvert ensuite, sans limite de durée.
        </p>
        {/**
         * La sortie qui ne coûte rien à personne, dite AVANT la fermeture et
         * pas après : une clé apportée ne consomme ni le plafond ni
         * l'enveloppe (`origine: "locataire"` ⇒ débit zéro).
         */}
        <p className="mt-2 text-[11.5px] text-paper-faint">
          Avec ta propre clé IA ou ton SMTP dans{" "}
          <Link href="/settings" className="text-bronze-400 hover:underline">Réglages</Link>, rien n&apos;est décompté :
          tu paies ton fournisseur, l&apos;essai ne s&apos;épuise pas.
        </p>
      </section>
    );
  }

  /**
   * ⚠ L'essai est FERMÉ, et le compte est retombé au socle gratuit. Ce
   * panneau est le SEUL endroit qui le dise : `statut` vaut « actif », comme
   * n'importe quel gratuit. Sans lui, le locataire constate qu'il ne peut
   * plus envoyer et en déduit une panne.
   */
  const parNous = essai.fin === "enveloppe-epuisee" || essai.fin === "cout-inconnu";
  return (
    <section className="card p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <PauseCircle size={15} className="text-bronze-400" /> Essai terminé
      </p>
      <p className="mt-2 text-[13px] text-paper-dim">{essai.phrase}</p>
      <p className="mt-3 text-[12.5px] text-paper-dim">
        Ton CRM, tes fiches, le Closer, le Cerveau et le pilotage restent ouverts, sans limite de durée. Ce qui
        s&apos;arrête, c&apos;est ce qui part de notre infrastructure : les envois, les appels, l&apos;agent qui écrit.
      </p>
      {parNous ? (
        <p className="mt-3 text-[11.5px] text-paper-faint">
          Cette fermeture ne vient pas de ton usage. Apporter ta clé rouvre tout immédiatement, et l&apos;abonnement
          reste disponible si tu préfères qu&apos;on s&apos;en occupe.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 rounded-full border border-bronze-400/40 px-4 py-2 text-[13px] font-medium text-bronze-400 hover:bg-bronze-400/10"
        >
          <KeyRound size={14} /> Apporter ma clé
        </Link>
        <Link
          href="/offre-brique"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-[13px] text-paper-dim hover:text-paper"
        >
          Voir ce qui se paie
        </Link>
      </div>
    </section>
  );
}
