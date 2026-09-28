"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Activer les notifications hors-app.
 *
 * Trois choses qu'on ne peut pas contourner, et qu'il vaut mieux dire que
 * laisser découvrir :
 *
 *  · La permission ne se demande QU'AU CLIC. Un navigateur ignore (voire
 *    pénalise) une demande faite au chargement, et un bandeau qui surgit
 *    sans qu'on ait rien demandé se refuse par réflexe. Un refus est
 *    quasi définitif : on n'a droit qu'à une tentative.
 *  · Sur iPhone, ça ne marche QUE si l'app est ajoutée à l'écran d'accueil.
 *    C'est une contrainte d'Apple, pas un bug — et sans l'écrire ici, on
 *    passe une heure à chercher pourquoi rien n'arrive.
 *  · Un refus se répare dans les réglages du navigateur, pas ici. Le
 *    bouton ne peut plus rien, et faire semblant serait pire.
 */
export function PushToggle() {
  const [etat, setEtat] = useState<"chargement" | "indisponible" | "inactif" | "actif" | "refuse" | "non-configure">("chargement");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [durable, setDurable] = useState(true);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEtat("indisponible");
        return;
      }
      try {
        const res = await fetch("/api/push/subscribe");
        const cfg = (await res.json()) as { configured: boolean; publicKey: string | null; durable: boolean; why?: string };
        setDurable(cfg.durable);
        if (!cfg.configured || !cfg.publicKey) {
          setEtat("non-configure");
          setMsg(cfg.why ?? "");
          return;
        }
        if (Notification.permission === "denied") {
          setEtat("refuse");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setEtat(sub ? "actif" : "inactif");
      } catch {
        setEtat("indisponible");
      }
    })();
  }, []);

  const activer = async () => {
    setBusy(true);
    setMsg("");
    try {
      const cfg = (await (await fetch("/api/push/subscribe")).json()) as { publicKey: string | null };
      if (!cfg.publicKey) throw new Error("Clé publique absente côté serveur.");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEtat(perm === "denied" ? "refuse" : "inactif");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        // Obligatoire : sans lui, Chrome refuse l'abonnement. C'est ce qui
        // garantit que seul le détenteur de la clé privée peut pousser.
        userVisibleOnly: true,
        applicationServerKey: cfg.publicKey,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      const out = (await res.json()) as { ok?: boolean; durable?: boolean; note?: string; error?: string };
      if (!res.ok) throw new Error(out.error ?? "Enregistrement refusé.");

      setDurable(out.durable !== false);
      if (out.note) setMsg(out.note);
      setEtat("actif");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Échec de l'activation.");
    } finally {
      setBusy(false);
    }
  };

  const desactiver = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEtat("inactif");
      setMsg("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        {etat === "actif" ? <BellRing size={15} className="text-signal-green" /> : <BellOff size={15} className="text-bronze-400" />}
        Notifications — même app fermée
      </h2>
      <p className="mt-1 text-[12px] text-paper-faint">
        Un RDV dans 30 minutes, une échéance passée, une fenêtre de rappel qui s&apos;ouvre. Une seule notification
        à la fois, jamais la nuit ni le week-end, et rien de purement informatif.
      </p>

      {etat === "chargement" && <p className="mt-3 text-[12px] text-paper-faint">Vérification…</p>}

      {etat === "indisponible" && (
        <p className="mt-3 text-[12px] text-signal-amber">
          Ce navigateur ne gère pas les notifications poussées. Sur iPhone, ajoute d&apos;abord l&apos;app à
          l&apos;écran d&apos;accueil (Partager → Sur l&apos;écran d&apos;accueil) : Apple ne les autorise que là.
        </p>
      )}

      {etat === "non-configure" && (
        <p className="mt-3 text-[12px] text-signal-amber">{msg || "Clés VAPID absentes côté serveur."}</p>
      )}

      {etat === "refuse" && (
        <p className="mt-3 text-[12px] text-signal-red">
          Les notifications ont été refusées pour ce site. Le bouton ne peut plus rien : il faut les réautoriser
          dans les réglages du navigateur (cadenas dans la barre d&apos;adresse → Notifications).
        </p>
      )}

      {(etat === "inactif" || etat === "actif") && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={etat === "actif" ? desactiver : activer}
            disabled={busy}
            className={cn("btn-ghost px-3 py-1.5 text-[12px]", busy && "opacity-60")}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : etat === "actif" ? "Désactiver" : "Activer sur cet appareil"}
          </button>
          {etat === "actif" && <span className="text-[12px] text-signal-green">Actif sur cet appareil</span>}
        </div>
      )}

      {etat === "actif" && !durable && (
        <p className="mt-2 text-[12px] text-signal-amber">
          ⚠ Abonnement stocké en mémoire du serveur : il disparaîtra au prochain déploiement et les notifications
          s&apos;arrêteront sans prévenir. Crée la table <code className="font-mono">push_subscriptions</code> dans
          Supabase.
        </p>
      )}

      {msg && etat !== "non-configure" && etat !== "refuse" && (
        <p className="mt-2 text-[12px] text-paper-faint">{msg}</p>
      )}

      <p className="mt-3 text-[11px] text-paper-faint">
        L&apos;envoi est déclenché par un cron qui appelle <code className="font-mono">/api/push/tick</code>. Sans ce
        cron, l&apos;abonnement existe mais rien ne part — voir <code className="font-mono">docs/NOTIFICATIONS.md</code>.
      </p>
    </section>
  );
}
