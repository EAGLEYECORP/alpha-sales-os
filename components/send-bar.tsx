"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Gift, Linkedin, Mail, MessageCircle, Smartphone, TrendingUp } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { renderAuditDoc, renderRecoveryDoc } from "@/lib/audit-doc";
import { auditDepth } from "@/lib/milestones";
import { linkedinUrl, linkedinTouchesToday, LINKEDIN_DAILY_SAFE } from "@/lib/linkedin";
import { clipboardText, composeFitsInUrl, gmailComposeUrl } from "@/lib/mail-compose";
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
  const { addEvent, logActivity, settings, prospects } = useAlpha();
  const [caps, setCaps] = useState(capsCache);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [attachAudit, setAttachAudit] = useState(false);
  const [attachRecovery, setAttachRecovery] = useState(false);
  const [liCopied, setLiCopied] = useState(false);
  const [gmailOpened, setGmailOpened] = useState(false);
  // On ne propose l'audit que s'il a assez de matière (≥ 40 % de profondeur).
  const auditReady = auditDepth(prospect).score >= 40;
  // La projection n'a de sens qu'avec la douleur chiffrée (manqués + panier).
  const recoveryReady = (prospect.deepAudit.missedCallsPerWeek ?? 0) > 0 && (prospect.deepAudit.avgTicket ?? 0) > 0;
  // Quota LinkedIn du jour (anti-restriction) — le multi-canal permet le volume.
  const liToday = linkedinTouchesToday(prospects);
  const liOver = liToday >= LINKEDIN_DAILY_SAFE;

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

  const send = async (channel: "email" | "sms", force = false) => {
    setStatus("sending");
    setError("");
    setNeedsUpgrade(false);
    setDuplicate(false);
    try {
      const slug = prospect.company.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const htmlB64 = (html: string) => btoa(unescape(encodeURIComponent(html)));
      const atts: { filename: string; contentBase64: string; contentType: string }[] = [];
      if (channel === "email" && attachAudit && auditReady) {
        atts.push({
          filename: `audit-${slug}.html`,
          contentBase64: htmlB64(renderAuditDoc(prospect, settings.closerName, settings.bookingUrl)),
          contentType: "text/html; charset=utf-8",
        });
      }
      if (channel === "email" && attachRecovery && recoveryReady) {
        const d = prospect.deepAudit;
        atts.push({
          filename: `projection-${slug}.html`,
          contentBase64: htmlB64(
            renderRecoveryDoc(
              prospect,
              { missedPerWeek: d.missedCallsPerWeek ?? 0, avgTicket: d.avgTicket ?? 0, conversionPct: d.conversionRate ?? 30 },
              settings.closerName,
              settings.bookingUrl
            )
          ),
          contentType: "text/html; charset=utf-8",
        });
      }
      const attachments = atts.length ? atts : undefined;
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
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        setNeedsUpgrade(Boolean(data.needsSubscription));
        setDuplicate(Boolean(data.alreadyContacted));
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

  /**
   * Envoi manuel : on enregistre le message (anti-doublon + liens tracés),
   * puis on ouvre Gmail pré-rempli. Rien ne part sans un clic humain dans
   * la messagerie — d'où l'absence de consignation ici : elle a lieu quand
   * l'opérateur confirme, dans la Boîte d'envoi.
   */
  const openGmail = async () => {
    if (!prospect.email) return;
    let draft = { to: prospect.email, subject, body };
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, prospectId: prospect.id }),
      });
      const json = await res.json();
      if (res.ok && typeof json.body === "string") draft = { ...draft, body: json.body };
    } catch {
      /* serveur injoignable → le message part quand même, sans liens tracés */
    }
    const sender = (() => {
      try {
        return localStorage.getItem("alpha_manual_sender") ?? undefined;
      } catch {
        return undefined;
      }
    })();
    const url = composeFitsInUrl(draft, sender)
      ? gmailComposeUrl(draft, sender)
      : (void navigator.clipboard.writeText(clipboardText(draft)), gmailComposeUrl({ ...draft, body: "" }, sender));
    window.open(url, "_blank", "noopener");
    setGmailOpened(true);
    setTimeout(() => setGmailOpened(false), 6000);
  };

  const openWhatsApp = () => {
    if (!prospect.phone) return;
    window.open(`https://wa.me/${toIntlPhone(prospect.phone)}?text=${encodeURIComponent(body)}`, "_blank");
    log("whatsapp", "WhatsApp");
  };

  // LinkedIn assisté : copie le message, ouvre le profil (ou la recherche),
  // journalise la touche. LinkedIn n'accepte pas de message pré-rempli par
  // URL → le presse-papier fait le pont : tu colles, tu envoies.
  const openLinkedIn = () => {
    try {
      void navigator.clipboard.writeText(body);
    } catch {
      /* clipboard indisponible → l'utilisateur copiera depuis le template */
    }
    window.open(linkedinUrl(prospect), "_blank");
    setLiCopied(true);
    setTimeout(() => setLiCopied(false), 3000);
    addEvent(prospect.id, {
      date: new Date().toISOString(),
      kind: "linkedin",
      summary: `→ Touche LinkedIn (message copié) : ${body.slice(0, 80)}`,
    });
    logActivity({ kind: "campagne", message: `LinkedIn ouvert pour ${prospect.company} (message copié)`, prospectId: prospect.id });
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
      {offerAudit && prospect.email && caps?.email && (
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11.5px]",
            attachRecovery ? "border-bronze-600 text-bronze-300" : "border-ink-600 text-paper-faint",
            !recoveryReady && "cursor-not-allowed opacity-50"
          )}
          title={
            recoveryReady
              ? "Joindre la projection « ce que tu récupères » (HTML brandé, imprimable). Personnalisée sur les chiffres de la fiche (appels manqués × panier × conversion)."
              : "Complète la douleur chiffrée (appels manqués/sem + panier moyen dans l'onglet Audit) pour proposer la projection."
          }
        >
          <input
            type="checkbox"
            className="accent-bronze-500"
            checked={attachRecovery}
            disabled={!recoveryReady}
            onChange={(e) => setAttachRecovery(e.target.checked)}
          />
          <TrendingUp size={12} /> Projection
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
      {prospect.email && (
        <button
          className={btn}
          title={`Ouvre la fenêtre de rédaction Gmail pré-remplie pour ${prospect.email}. C'est TOI qui cliques « Envoyer » — aucun SMTP requis.`}
          onClick={openGmail}
        >
          {gmailOpened ? <Check size={13} className="text-signal-green" /> : <ExternalLink size={13} />}
          {gmailOpened ? "Ouvert — envoie, puis reviens" : "Gmail"}
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
      <button
        className={cn(btn, liOver && "border-bronze-700 text-bronze-400")}
        title={
          (prospect.linkedin
            ? `Ouvre le profil LinkedIn de la fiche`
            : `Pas de profil sur la fiche → ouvre la recherche LinkedIn (${prospect.name} ${prospect.company})`) +
          ` — le message part dans le presse-papier : colle et envoie.\nQuota du jour : ${liToday}/${LINKEDIN_DAILY_SAFE}` +
          (liOver ? " ⚠ dépassé — bascule sur email/WhatsApp pour aujourd'hui (anti-restriction)." : "")
        }
        onClick={openLinkedIn}
      >
        {liCopied ? <Check size={13} className="text-signal-green" /> : <Linkedin size={13} />}
        {liCopied ? "Copié ✓ — colle-le" : liOver ? `LinkedIn ${liToday}/${LINKEDIN_DAILY_SAFE} ⚠` : "LinkedIn"}
      </button>
      {!prospect.email && !prospect.phone && (
        <span className="text-[11px] text-paper-faint">ni email ni téléphone — il reste LinkedIn ↑</span>
      )}
      {status === "error" &&
        (needsUpgrade ? (
          <a
            href="/compte"
            className="inline-flex items-center gap-1 rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-2 py-1 text-[11px] text-signal-amber hover:border-signal-amber/70"
            title="Voir les formules et passer au payant"
          >
            {error} → Gérer l&apos;abonnement
          </a>
        ) : duplicate ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-signal-amber">
            {error}
            <button
              className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-2 py-0.5 hover:border-signal-amber/70"
              onClick={() => send("email", true)}
              title="Passe outre le refroidissement anti-doublon et renvoie maintenant"
            >
              Renvoyer quand même
            </button>
          </span>
        ) : (
          <span className="text-[11px] text-signal-red">{error}</span>
        ))}
    </div>
  );
}
