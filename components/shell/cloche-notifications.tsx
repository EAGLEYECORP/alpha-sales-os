"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/notifications/use-notifications";

/**
 * La cloche : sur chaque écran de l'app, une ligne discrète qui mène au fil des
 * notifications, avec le nombre de nouveautés. Elle ne s'allume (bronze) que
 * s'il y a du nouveau — un compteur à zéro ne réclame rien.
 */
export function ClocheNotifications() {
  const chemin = usePathname();
  const { nonLues } = useNotifications();
  if (chemin === "/notifications") return null;
  return (
    <div className="mx-auto flex max-w-7xl justify-end px-4 pt-3 md:px-8">
      <Link
        href="/notifications"
        className={
          nonLues > 0
            ? "inline-flex items-center gap-2 rounded-full border border-bronze-700 px-3 py-1.5 text-[13px] text-bronze-300"
            : "inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1.5 text-[13px] text-paper-faint"
        }
        aria-label={nonLues > 0 ? `Notifications : ${nonLues} nouvelle(s)` : "Notifications"}
      >
        <Bell size={14} />
        Notifications
        {nonLues > 0 && <span className="rounded-full bg-bronze-400 px-1.5 text-[11px] font-semibold text-ink-950">{nonLues > 99 ? "99+" : nonLues}</span>}
      </Link>
    </div>
  );
}
