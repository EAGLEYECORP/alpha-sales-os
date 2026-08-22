"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Link2, Check } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { icsCalendar, meetingToIcs } from "@/lib/ics";
import type { Meeting } from "@/lib/types";

/**
 * Faire sortir les rendez-vous d'ALPHA vers l'agenda qu'on regarde vraiment.
 *
 * Deux chemins, parce qu'ils ne servent pas au même moment :
 *
 *  · TÉLÉCHARGER un fichier — immédiat, hors ligne, aucun réglage. C'est
 *    ce qu'on fait quand on vient de caler un rendez-vous et qu'on veut le
 *    voir sur son téléphone dans les dix secondes.
 *  · S'ABONNER au flux — l'agenda se met à jour tout seul (~15 min). C'est
 *    ce qu'on règle UNE fois, et qu'on oublie ensuite.
 *
 * Le fichier est fabriqué DANS le navigateur : aucun appel réseau, donc ça
 * marche même sans Supabase et sans jeton de flux.
 */
export function CalendarSync({ meetings }: { meetings: Meeting[] }) {
  const prospects = useAlpha((s) => s.prospects);
  const [copie, setCopie] = useState(false);

  const aVenir = useMemo(() => {
    const now = Date.now();
    return meetings
      .filter((m) => !m.done && new Date(m.date).getTime() >= now - 3_600_000)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [meetings]);

  const telecharger = () => {
    const byId = new Map(prospects.map((p) => [p.id, p]));
    const events = aVenir
      .map((m) => {
        try {
          return meetingToIcs(m, byId.get(m.prospectId), window.location.origin);
        } catch {
          return null;
        }
      })
      .filter((e): e is string => Boolean(e));

    const blob = new Blob([icsCalendar(events, "ALPHA SALES OS — rendez-vous")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alpha-sales-os.ics";
    a.click();
    // Sans révocation, l'objet reste en mémoire tant que l'onglet vit.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <CalendarPlus size={15} className="text-bronze-400" /> Envoyer vers mon agenda
      </h2>
      <p className="mt-1 text-[11px] text-paper-faint">
        Google Agenda, Outlook / Teams, Apple Calendrier. {aVenir.length} rendez-vous à venir.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={telecharger} disabled={aVenir.length === 0} className="btn-ghost px-3 py-1.5 text-[12px] disabled:opacity-50">
          Télécharger le fichier (.ics)
        </button>
        <button
          onClick={() => {
            // On copie le CHEMIN, pas le jeton : il vit côté serveur et
            // l'opérateur le colle lui-même. Le mettre ici l'exposerait à
            // toute personne qui regarde l'écran.
            navigator.clipboard.writeText(`${window.location.origin}/api/calendar?k=VOTRE_CALENDAR_TOKEN`);
            setCopie(true);
            setTimeout(() => setCopie(false), 2000);
          }}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
        >
          {copie ? <Check size={13} className="text-signal-green" /> : <Link2 size={13} />}
          {copie ? "Adresse copiée" : "Copier l'adresse d'abonnement"}
        </button>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-paper-faint hover:text-paper">
          S&apos;abonner plutôt que télécharger (à faire une fois)
        </summary>
        <div className="mt-2 space-y-1.5 text-[11.5px] text-paper-dim">
          <p>
            Remplace <code className="font-mono text-bronze-400">VOTRE_CALENDAR_TOKEN</code> par la valeur de{" "}
            <code className="font-mono text-bronze-400">CALENDAR_TOKEN</code> (variable serveur), puis colle l&apos;adresse :
          </p>
          <p>· <strong className="text-paper">Google Agenda</strong> → Autres agendas → À partir de l&apos;URL</p>
          <p>· <strong className="text-paper">Outlook / Teams</strong> → Ajouter un calendrier → S&apos;abonner à partir du web</p>
          <p>· <strong className="text-paper">Apple Calendrier</strong> → Fichier → Nouvel abonnement</p>
          <p className="text-paper-faint">
            L&apos;agenda relit tout seul, environ tous les quarts d&apos;heure — c&apos;est le fournisseur qui décide,
            pas nous. Et qui a cette adresse voit tes rendez-vous : elle se traite comme un mot de passe.
          </p>
          <p className="text-signal-amber">
            L&apos;abonnement exige la synchronisation Supabase : un agenda distant ne peut pas lire un store qui vit
            dans ton navigateur. Le téléchargement, lui, marche toujours.
          </p>
        </div>
      </details>

      <p className="mt-3 text-[11px] text-paper-faint">
        Synchronisation à sens unique : l&apos;OS écrit, l&apos;agenda lit. Un rendez-vous créé dans Google ne
        remontera pas ici, et aucun lien Meet ou Teams n&apos;est créé — colle-le dans le champ visio du rendez-vous.
      </p>
    </section>
  );
}
