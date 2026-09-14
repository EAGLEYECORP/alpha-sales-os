"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileText } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { emailPreDevis, renderPreDevis } from "@/lib/proposition-commerciale";
import { SIEGES_MAX_ESTIMATION } from "@/lib/cadrage";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PRÉ-DEVIS DEPUIS LA FICHE — le dernier maillon de la chaîne.
 *
 * `renderPreDevis` et `emailPreDevis` étaient justes, testés, vérifiés au
 * rendu — et appelés par AUCUN écran. Le défaut récurrent du dépôt, sur la
 * chaîne qu'on venait précisément de construire pour obtenir des rendez-vous.
 *
 * ══ CE QUI EST DÉLIBÉRÉ ICI ══
 *
 * **Le document s'ouvre, il ne s'envoie pas.** Il n'existe aucun chemin qui
 * expédie un pré-devis tout seul depuis cet écran. L'email se COPIE et se
 * relit — ce qui le range, par construction, dans `valide-par-humain`
 * (`lib/signature-ia.ts`), donc sans divulgation IA, donc honnête.
 *
 * **La marque vient des RÉGLAGES, jamais d'un défaut en dur.** Le produit est
 * white-label : un pré-devis partant d'un revendeur sous NOTRE raison sociale
 * est le défaut que `lib/signature.ts` a déjà payé quatre fois.
 *
 * **Le nombre de sièges est SAISI, pas deviné.** On pourrait le tirer d'un
 * champ de la fiche — il n'y en a aucun qui le porte, et en fabriquer un à
 * partir de la taille d'entreprise donnerait un chiffre que personne n'a dit.
 * C'est une question qu'on pose au prospect ; tant qu'il n'a pas répondu, on
 * la pose ici.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PreDevisPanel({ p }: { p: Prospect }) {
  const settings = useAlpha((s) => s.settings);
  const [sieges, setSieges] = useState(5);
  const [copie, setCopie] = useState(false);

  const marque = useMemo(
    () => ({
      societe: settings.agencyName?.trim() || "",
      ville: settings.offer?.city?.trim() || "",
      signataire: settings.closerName?.trim() || "",
      bookingUrl: settings.bookingUrl,
    }),
    [settings],
  );

  const cible = { entreprise: p.company, sieges };
  const doc = useMemo(() => renderPreDevis(cible, marque), [p.company, sieges, marque]);
  const mail = useMemo(() => emailPreDevis(cible, marque), [p.company, sieges, marque]);

  /**
   * ⚠ ON REFUSE D'ÉMETTRE SANS IDENTITÉ. Un document qui sort avec une raison
   * sociale vide, ou pire un repli d'usine, arrive chez un prospect signé par
   * personne. Mieux vaut un bouton grisé qui dit où aller.
   */
  const identiteManquante = !marque.societe || !marque.signataire;

  const ouvrir = () => {
    if (!doc) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(doc.html);
    w.document.close();
  };

  const copier = async () => {
    await navigator.clipboard.writeText(`${mail.objet}\n\n${mail.corps}`);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <FileText size={15} className="text-bronze-400" /> Pré-devis
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Un ordre de grandeur envoyable <strong>avant</strong> le cadrage. Il n&apos;engage rien — le
        devis, lui, attend que la visio ait eu lieu.
      </p>

      <label className="mt-3 block">
        <span className="text-[11px] uppercase tracking-wider text-paper-faint">
          Utilisateurs chez lui
        </span>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={SIEGES_MAX_ESTIMATION}
            step={1}
            value={sieges}
            onChange={(e) => setSieges(Number(e.target.value))}
            className="w-full accent-bronze-500"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[13px] text-paper">{sieges}</span>
        </div>
      </label>

      {identiteManquante ? (
        <p className="panel mt-3 p-3 text-[11.5px] leading-snug text-signal-amber">
          Renseigne la <strong>raison sociale</strong> et le <strong>nom du signataire</strong> dans
          Réglages avant d&apos;émettre : un document signé par personne n&apos;est pas une
          proposition, et le produit est white-label — aucun repli ne remettra notre marque.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={ouvrir} disabled={!doc}>
            <FileText size={13} /> Ouvrir le document
          </button>
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={() => void copier()}>
            {copie ? <Check size={13} className="text-signal-green" /> : <Copy size={13} />}
            {copie ? "Email copié ✓" : "Copier l'email"}
          </button>
        </div>
      )}

      {/* ⚠ Au-delà de la borne, `renderPreDevis` rend `null` — et on le DIT
          plutôt que de griser un bouton sans raison. Le motif est le même que
          dans le module : le dossier change de nature, et chiffrer serait
          inventer une expérience qu'on n'a pas. */}
      {!doc && (
        <p className="panel mt-3 p-3 text-[11.5px] leading-snug text-paper-faint">
          Au-delà de {SIEGES_MAX_ESTIMATION} utilisateurs, pas de chiffre depuis un écran : achats,
          revue de sécurité, pilote. Ça se cadre de vive voix.
        </p>
      )}

      {/* ⚠⚠ LA PHRASE QUI EMPÊCHE CE PANNEAU DE MENTIR. Sans elle, deux boutons
          à côté d'un montant se lisent comme « envoyer un devis ». */}
      <p className="mt-3 text-[11px] leading-snug text-paper-faint">
        Rien ne part d&apos;ici : le document s&apos;ouvre pour impression, l&apos;email se copie et
        se relit. C&apos;est ce qui en fait un message humain — donc sans mention d&apos;IA, parce
        qu&apos;elle serait fausse.
      </p>
    </section>
  );
}
