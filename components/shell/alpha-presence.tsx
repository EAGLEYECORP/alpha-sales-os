"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CheckCircle2, ChevronRight } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { computeRoutines } from "@/lib/routines";
import {
  ETAT_NOTIFICATION_INITIAL,
  presenceAlpha,
  prochaineNotification,
  type EtatNotification,
} from "@/lib/presence-alpha";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « ALPHA A BESOIN DE TOI » — la bande de présence, sur chaque écran.
 *
 * Tout ce qui se DÉCIDE (quoi compter, quand notifier, ce que dit la phrase)
 * vit dans `lib/presence-alpha.ts`, où un test l'atteint ; ce composant ne
 * fait que le brancher au store, à l'onglet et à l'API de notification.
 *
 * ⚠ Elle lit `computeRoutines` — la définition qui existe déjà — et n'en pose
 * pas une de plus. Voir l'en-tête de la lib.
 *
 * ⚠ Elle ne prétend pas qu'ALPHA travaille app fermée : le serveur ne voit pas
 * le CRM d'un compte gratuit. Les alertes ne partent donc que si l'onglet est
 * OUVERT (même en arrière-plan), et le bouton qui les active le dit.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les écrans où une bande de plus gênerait : l'accueil guidé et la fenêtre flottante. */
const SANS_BANDE = ["/bienvenue", "/overlay"];

const TOUTES_LES_MINUTES = 60_000;

export function AlphaPresence() {
  const pathname = usePathname();
  const router = useRouter();
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const campaigns = useAlpha((s) => s.campaigns);
  const drafts = useAlpha((s) => s.drafts);

  // Une échéance PASSE sans qu'aucune fiche ne bouge : sans ce battement, une
  // relance qui devient « en retard » à minuit n'apparaîtrait qu'au prochain clic.
  const [battement, setBattement] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBattement((n) => n + 1), TOUTES_LES_MINUTES);
    return () => clearInterval(t);
  }, []);

  const routines = useMemo(
    () => computeRoutines({ prospects, meetings, campaigns, drafts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, meetings, campaigns, drafts, battement]
  );
  const presence = useMemo(() => presenceAlpha(routines), [routines]);

  // ── L'ONGLET : « (3) » devant le titre, sans permission à demander ──
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s/, "");
    document.title = presence.prefixeOnglet + base;
    return () => {
      document.title = base;
    };
  }, [presence.prefixeOnglet, pathname]);

  // ── LA NOTIFICATION ──
  const [permission, setPermission] = useState<NotificationPermission | "indisponible">("indisponible");
  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "indisponible" : Notification.permission);
  }, []);

  const etatNotif = useRef<EtatNotification>(ETAT_NOTIFICATION_INITIAL);
  useEffect(() => {
    const maintenant = new Date();
    const { message, suivant } = prochaineNotification(etatNotif.current, routines, maintenant);
    const peutNotifier = typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden;
    // Onglet visible, ou permission absente : la bande suffit, la nouveauté est
    // vue — mais aucune notification n'est partie, donc l'intervalle ne bouge pas.
    etatNotif.current = message && !peutNotifier ? { ...suivant, dernierEnvoiMs: etatNotif.current.dernierEnvoiMs } : suivant;
    if (!message || !peutNotifier) return;
    const n = new Notification(message.title, { body: message.body, tag: message.tag, icon: "/icon-192.png" });
    n.onclick = () => {
      window.focus();
      router.push(message.url);
      n.close();
    };
  }, [routines, router]);

  if (SANS_BANDE.some((p) => pathname.startsWith(p))) return null;

  const urgent = presence.urgentes > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 md:px-8" data-presence={presence.etat}>
      {presence.etat === "attend" && presence.premiere ? (
        <Link
          href="/pilote"
          // `.card` : la plaque de premier plan (voir `tests/mise-en-page.test.ts`).
          // Le ton passe par l'icône et la pastille, pas par une bordure maison.
          className="card flex items-center gap-2.5 px-3 py-2 text-[13px]"
        >
          <BellRing size={15} className={urgent ? "text-signal-red" : "text-signal-amber"} />
          <span className="font-semibold text-paper">ALPHA a besoin de toi</span>
          <span
            className={cn(
              "rounded-full border px-1.5 font-mono text-[10px]",
              urgent ? "border-signal-red/40 text-signal-red" : "border-signal-amber/40 text-signal-amber"
            )}
            aria-label={presence.phrase}
          >
            {presence.prefixeOnglet.replace(/[()\s]/g, "")}
          </span>
          <span className="min-w-0 flex-1 truncate text-paper-dim">{presence.premiere.title}</span>
          <ChevronRight size={14} className="shrink-0 text-paper-faint" />
        </Link>
      ) : (
        <p className="flex items-center gap-2 px-1 text-[12px] text-paper-faint">
          <CheckCircle2 size={13} className="text-signal-green" />
          {presence.phrase}
          {/* Le geste suivant quand rien n'attend : laisser ALPHA préparer la suite. */}
          <Link href="/aujourdhui#alpha" className="ml-1 text-bronze-400 underline decoration-dotted underline-offset-2 hover:text-bronze-300">
            Lancer ALPHA
          </Link>
        </p>
      )}

      {permission === "default" && (
        <button
          onClick={() => void Notification.requestPermission().then(setPermission)}
          className="mt-1.5 px-1 text-left text-[11px] text-paper-faint underline decoration-dotted underline-offset-2 hover:text-paper"
        >
          Activer les alertes — elles ne partent que si l&apos;onglet reste ouvert (même en arrière-plan).
        </button>
      )}
    </div>
  );
}
