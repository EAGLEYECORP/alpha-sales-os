"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarCheck, Eye, MessageSquareReply, MousePointerClick, Send, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useNotifications } from "@/components/notifications/use-notifications";
import { bilanDuJour, type GenreNotif } from "@/lib/notifications";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTIFICATIONS — le fil de ce qu'ALPHA a fait et de ce qui s'est passé :
 * messages partis, ouvertures, clics, réponses, rendez-vous, ce qui attend un
 * humain. Relu toutes les 30 s. Toute la logique est dans `lib/notifications.ts`
 * (testée) ; cet écran l'affiche.
 * ─────────────────────────────────────────────────────────────────────
 */

const ICONE: Record<GenreNotif, typeof Bell> = {
  envoi: Send,
  ouverture: Eye,
  clic: MousePointerClick,
  reponse: MessageSquareReply,
  rdv: CalendarCheck,
  attente: UserRound,
  pilote: Sparkles,
  erreur: ShieldAlert,
};

const heure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function NotificationsPage() {
  const { notifs, vu, suiviFerme, marquerVu } = useNotifications();
  const [vuAuDebut, setVuAuDebut] = useState<string | null | undefined>(undefined);
  const [jour, setJour] = useState("");

  // On garde la marque « nouveau » le temps de la visite, puis on marque lu.
  useEffect(() => {
    if (vuAuDebut === undefined && notifs.length > 0) {
      setVuAuDebut(vu);
      marquerVu();
    }
  }, [notifs.length, vu, vuAuDebut, marquerVu]);
  useEffect(() => setJour(new Date().toISOString().slice(0, 10)), []);

  const bilan = useMemo(() => bilanDuJour(notifs, jour), [notifs, jour]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Suivi"
        title="Notifications"
        subtitle="Ce qu'ALPHA a fait et ce qui s'est passé : messages partis, ouvertures, réponses, rendez-vous. Mis à jour toutes les 30 secondes."
      />

      <div className="card p-5">
        <p className="text-[15px] text-paper">
          Aujourd&apos;hui : <b>{bilan.envois}</b> message(s) parti(s), <b>{bilan.ouvertures}</b> ouverture(s), <b>{bilan.clics}</b> clic(s),{" "}
          <b>{bilan.reponses}</b> réponse(s), <b>{bilan.rdv}</b> rendez-vous.
        </p>
        <p className="mt-2 text-[13px] text-paper-faint">
          Un message envoyé par ALPHA n&apos;apparaît pas dans le dossier « Envoyés » de ta messagerie : il part du serveur. C&apos;est ici qu&apos;on le voit.
          {suiviFerme && " Le suivi des ouvertures n'est pas ouvert sur ton compte : seuls les événements du pilote s'affichent."}
        </p>
      </div>

      {notifs.length === 0 ? (
        <div className="card p-8 text-center text-paper-dim">Rien pour l&apos;instant. Dès qu&apos;ALPHA envoie, lit ou reçoit quelque chose, ça s&apos;affiche ici.</div>
      ) : (
        <ul className="card divide-y divide-ink-700 p-0">
          {notifs.map((n) => {
            const Icone = ICONE[n.genre];
            const nouveau = vuAuDebut !== undefined && (!vuAuDebut || n.quand > vuAuDebut);
            return (
              <li key={n.id} className="flex gap-3 px-5 py-4">
                <span className={n.important ? "mt-0.5 text-bronze-400" : "mt-0.5 text-paper-faint"}>
                  <Icone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <time className="block font-mono text-[12px] text-paper-faint" dateTime={n.quand}>
                    {heure(n.quand)}
                    {nouveau && <span className="ml-2 rounded-full bg-bronze-400 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-ink-950">nouveau</span>}
                  </time>
                  <p className={n.important ? "mt-1 text-[15px] font-semibold text-paper" : "mt-1 text-[15px] text-paper"}>{n.titre}</p>
                  {n.detail && <p className="mt-1 text-[13px] text-paper-faint">{n.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
