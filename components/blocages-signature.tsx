"use client";

import { ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES BLOCAGES DE SIGNATURE — DANS L'APP, PAS DANS UNE BOÎTE DU NAVIGATEUR.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Cliquer « ✍ Signer (3 blocages) » déclenchait un `alert()` natif :
 *
 *     localhost:3000 indique
 *     ⛔ Doctrine :
 *     • La démo n'a pas été montrée avant le prix
 *     …                                            [ OK ]
 *
 * Deux problèmes, et le second est le vrai.
 *
 * 1. Le MOMENT. Ce clic arrive en fin de cycle, et le second appelant est
 *    `closing-mode` — l'écran qu'on a ouvert DEVANT le client. Une boîte
 *    système grise, avec le nom d'hôte du serveur en en-tête, est exactement
 *    ce qui fait dire « c'est un truc bricolé » au dernier mètre. CLAUDE.md :
 *    « la réassurance humaine, la poignée de main au moment de signer » — on
 *    ne la donne pas avec un dialogue du navigateur.
 *
 * 2. Le CONTENU DISPARAÎT AU CLIC SUR OK. Les blocages sont la seule
 *    information utile à cet instant : ce sont les trois choses à aller
 *    chercher. Les faire lire une fois, puis les effacer, oblige à recliquer
 *    pour s'en souvenir. `alert()` est fait pour interrompre, pas pour
 *    informer — et ici il faut informer.
 *
 * Le composant existe pour que les DEUX chemins de closing disent la même
 * chose de la même façon. Ils l'écrivaient chacun de leur côté, avec la même
 * chaîne recopiée à l'identique : deux copies d'une phrase de doctrine, c'est
 * une copie de trop.
 * ─────────────────────────────────────────────────────────────────────
 */
export function BlocagesSignature({
  blocages,
  onClose,
  company,
}: {
  /** Vide = pas de blocage : le panneau ne s'ouvre pas. */
  blocages: string[];
  onClose: () => void;
  company?: string;
}) {
  return (
    <Modal open={blocages.length > 0} onClose={onClose} title="On ne signe pas encore">
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-signal-amber">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            {blocages.length} point{blocages.length > 1 ? "s" : ""} de doctrine {blocages.length > 1 ? "restent" : "reste"} ouvert
            {blocages.length > 1 ? "s" : ""}
            {company ? ` sur ${company}` : ""}. Signer par-dessus, c&apos;est signer un deal qui se défera plus tard —
            au paiement, à la livraison, ou au premier doute.
          </span>
        </p>
        <ul className="space-y-1.5">
          {blocages.map((b) => (
            <li key={b} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12.5px] text-paper">
              {b}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-paper-faint">
          Ferme cette fenêtre, va chercher ces points, reviens. Le bouton s&apos;allume tout seul quand il n&apos;en
          reste aucun.
        </p>
      </div>
    </Modal>
  );
}
