"use client";

import { useEffect, useState } from "react";
import { Check, Gift, Mail, MessageCircle, Smartphone } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { renderAuditDoc } from "@/lib/audit-doc";
import { auditDepth } from "@/lib/milestones";
import { cn } from "@/lib/utils";

/** 06 12 34 56 78 → 33612345678 (format wa.me / SMS international) */
export function toIntlPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "33" + digits.slice(1);
  if (digits.startsWith("33")) return digits;
  return digits;
}

let capsCache: { email: boolean; sms: boolean } | null = null;

/**
 * Barre d'envoi réel : Email (SMTP serveur), WhatsApp (lien pré-rempli,
 * part de TON téléphone), SMS (Textbelt). Chaque envoi est consigné dans
 * la timeline du prospect.
 */
export function SendBar({
  prospect,
  subject,
  body,
  compact,
  offerAudit,
}: {
  prospect: Prospect;
  subject: string;
  body: string;
  compact?: boolean;
  /** Propose de joindre l'audit cadeau (email de première impression). */
  offerAudit?: boolean;
}) {
  const { addEvent, logActivity, settings } = useAlpha();
  const [caps, setCaps] = useState(capsCache);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [attachAudit, setAttachAudit] = useState(false);
  // On ne propose l'audit que s'il a assez de matière (≥ 40 % de profondeur).
  const auditReady = auditDepth(prospect).score >= 40;

  useEffect(() => {
    if (capsCache) return;
    fetch("/api/send")
      .then((r) => r.json())
      .then((c) => {
        capsCache = c;
        setCaps(c);
      })
      .catch(() => setCaps({ email: false, sms: false }));
  }, []);

  const log = (kind: "email" | "whatsapp", label: string) => {
    addEvent(prospect.id, {
      date: new Date().toISOString(),
      kind,
      summary: `→ Envoyé (${label}) : ${subject || body.slice(0, 80)}`,
    });
    logActivity({ kind: "campagne", message: `${label} envoyé à ${prospect.company}`, prospectId: prospect.id });
  };

  const send = async (channel: "email" | "sms") => {
    setStatus("sending");
    setError("");
    try {
      const attachments =
        channel === "email" && attachAudit && auditReady
          ? [
              {
                filename: `audit-${prospect.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
                contentBase64: btoa(unescape(encodeURIComponent(renderAuditDoc(prospect, settings.closerName)))),
                contentType: "text/html; charset=utf-8",
              },
            ]
          : undefined;
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          to: channel === "email" ? prospect.email : toIntlPhone(prospect.phone ?? ""),
          subject,
          body,
          prospectId: prospect.id,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        setStatus("error");
        return;
      }
      log(channel === "email" ? "email" : "whatsapp", channel === "email" ? "Email" : "SMS");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setError("Erreur réseau");
      setStatus("error");
    }
  };

  const openWhatsApp = () => {
    if (!prospect.phone) return;
    window.open(`https://wa.me/${toIntlPhone(prospect.phone)}?text=${encodeURIComponent(body)}`, "_blank");
    log("whatsapp", "WhatsApp");
  };

  const btn = compact ? "btn-ghost px-2.5 py-1.5 text-[12px]" : "btn-ghost";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {offerAudit && prospect.email && caps?.email && (
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11.5px]",
            attachAudit ? "border-bronze-600 text-bronze-300" : "border-ink-600 text-paper-faint",
            !auditReady && "cursor-not-allowed opacity-50"
          )}
          title={
            auditReady
              ? "Joindre l'audit cadeau (HTML brandé, ouvrable → imprimable PDF). Note : une pièce jointe sur un 1er email froid peut peser sur la délivrabilité — à réserver aux prospects tièdes / étape awareness."
              : "Complète le deep-dive (onglet Audit) pour générer un audit cadeau digne d'être offert."
          }
        >
          <input
            type="checkbox"
            className="accent-bronze-500"
            checked={attachAudit}
            disabled={!auditReady}
            onChange={(e) => setAttachAudit(e.target.checked)}
          />
          <Gift size={12} /> Audit cadeau
        </label>
      )}
      {prospect.email && (
        <button
          className={btn}
          disabled={status === "sending" || !caps?.email}
          title={caps?.email ? `Envoyer à ${prospect.email}` : "SMTP non configuré (Réglages → .env : SMTP_HOST/USER/PASS)"}
          onClick={() => send("email")}
        >
          {status === "sent" ? <Check size={13} className="text-signal-green" /> : <Mail size={13} />}
          {status === "sending" ? "Envoi…" : status === "sent" ? "Envoyé ✓" : "Email"}
        </button>
      )}
      {prospect.phone && (
        <button className={btn} title={`WhatsApp vers ${prospect.phone} — part de ton téléphone`} onClick={openWhatsApp}>
          <MessageCircle size={13} /> WhatsApp
        </button>
      )}
      {prospect.phone && caps?.sms && (
        <button className={btn} disabled={status === "sending"} title={`SMS vers ${prospect.phone}`} onClick={() => send("sms")}>
          <Smartphone size={13} /> SMS
        </button>
      )}
      {!prospect.email && !prospect.phone && (
        <span className="text-[11px] text-paper-faint">ni email ni téléphone sur la fiche</span>
      )}
      {status === "error" && <span className="text-[11px] text-signal-red">{error}</span>}
    </div>
  );
}
