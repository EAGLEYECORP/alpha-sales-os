"use client";

import { useMemo, useState } from "react";
import { Magnet } from "lucide-react";
import { pickMagnet, magnetEmail } from "@/lib/lead-magnet";
import { getAccount } from "@/lib/accounts";
import { useAlpha } from "@/lib/store";
import type { Prospect } from "@/lib/types";

/**
 * L'aimant à servir à CE prospect.
 *
 * Le module existait, testé, et n'était appelé nulle part : l'aimant ne
 * partait donc jamais. Il est ici parce que c'est la seule chose qu'on peut
 * envoyer à un prospect FROID sans rien demander en retour — et c'est ce qui
 * ouvre la conversation quand l'appel n'a rien donné.
 *
 * Deux règles portées par le module et rappelées à l'écran : aucun prix dans
 * l'email, et rien n'est envoyé si aucun aimant ne correspond (un aimant
 * hors-sujet coûte plus cher que pas d'aimant du tout).
 */
export function LeadMagnetPanel({ p }: { p: Prospect }) {
  const settings = useAlpha((s) => s.settings);
  const accountId = settings.accountId ?? "eagleye";
  const [copied, setCopied] = useState(false);

  const pick = useMemo(() => pickMagnet(p, accountId), [p, accountId]);
  const account = getAccount(accountId);
  const mail = useMemo(
    () => (pick ? magnetEmail(pick, p, settings.closerName || "", account.name) : null),
    [pick, p, settings.closerName, account.name]
  );

  if (!pick || !mail) {
    return (
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Magnet size={15} className="text-bronze-400" /> Aimant — aucun ne correspond
        </h2>
        <p className="mt-1 text-[12px] text-paper-faint">
          Rien dans la fiche ne déclenche un aimant utile pour lui. On n&apos;en envoie donc aucun : un aimant hors-sujet
          prouve qu&apos;on n&apos;a pas regardé son cas, et il coûte plus cher que le silence. Complète l&apos;audit
          (site, volume de demandes, process actuel) et il apparaîtra.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <Magnet size={15} className="text-bronze-400" /> {pick.magnet.title}
      </h2>
      <p className="mt-0.5 text-[11px] text-paper-faint">{pick.why}</p>

      <ul className="mt-2 space-y-0.5 text-[12px] text-paper">
        {pick.magnet.contains.map((c) => (
          <li key={c}>· {c}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-paper-faint">
        Vaut le coup même s&apos;il n&apos;achète pas : {pick.magnet.standaloneValue}
      </p>

      <p className="mt-3 font-mono text-[11px] text-bronze-400">Objet : {mail.subject}</p>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-600 bg-ink-850 p-3 text-[12px] text-paper">
        {mail.body}
      </pre>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="btn-ghost px-3 py-1.5 text-[12px]"
          onClick={() => {
            navigator.clipboard.writeText(`${mail.subject}\n\n${mail.body}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copié ✓" : "Copier l'email"}
        </button>
        {/* Un prix dans un aimant transforme un cadeau en devis non demandé. */}
        <span className="text-[11px] text-paper-faint">Aucun prix dans cet email — c&apos;est volontaire.</span>
      </div>
    </section>
  );
}
