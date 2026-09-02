"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { identiteEnvoi } from "@/lib/expediteur";
import { campagnePeutPartir } from "@/lib/validation-partenaire";
import type { Campaign, CampaignDraft, CampaignStepKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { toIntlPhone } from "@/components/send-bar";
import { notifyN8n } from "@/lib/n8n";

const CHANNEL_ICON: Record<CampaignStepKind, React.ReactNode> = {
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  appel: <Phone size={13} />,
};

interface Lint {
  level: "ok" | "attention" | "risque";
  warnings: string[];
}
interface Preview {
  html: string;
  lint: Lint;
}

/**
 * Relecture AVANT envoi. « Rien ne part tant que l'humain n'a pas validé. »
 * L'utilisateur relit / édite / approuve chaque email et DM ; l'envoi de la
 * campagne est bloqué tant qu'il reste des messages non relus.
 */
export function CampaignReview({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const {
    drafts: allDrafts,
    prepareCampaignDrafts,
    updateDraft,
    setDraftStatus,
    addEvent,
    logActivity,
    upsertCampaign,
    settings,
  } = useAlpha();

  const accountId = settings.accountId ?? "eagleye";
  const validations = settings.validationsPartenaire ?? [];

  const drafts = allDrafts.filter((d) => d.campaignId === campaign.id);
  const prepared = useRef(false);
  const [sending, setSending] = useState(false);
  /** Les étapes qui empêchent la campagne de partir, avec leur raison. */
  const [blocage, setBlocage] = useState<{ label: string; pourquoi: string }[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [openPreview, setOpenPreview] = useState<Record<string, boolean>>({});
  const [copiedHtml, setCopiedHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});

  // Génère les brouillons au premier affichage s'il n'y en a pas encore, puis
  // pré-marque « déjà contacté » ceux dont l'email a reçu un envoi récent
  // (dédup durable — évite de recontacter par erreur).
  useEffect(() => {
    if (prepared.current) return;
    prepared.current = true;
    if (drafts.length === 0) prepareCampaignDrafts(campaign.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const emails = useAlpha
      .getState()
      .drafts.filter((d) => d.campaignId === campaign.id && d.channel === "email" && d.to && d.status === "pending")
      .map((d) => d.to);
    if (emails.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/track/contacted?emails=${encodeURIComponent(emails.join(","))}`);
        const data = (await res.json()) as { contacted?: string[] };
        if (cancelled || !data.contacted?.length) return;
        const set = new Set(data.contacted.map((e) => e.toLowerCase()));
        for (const d of useAlpha.getState().drafts) {
          if (d.campaignId === campaign.id && d.status === "pending" && d.to && set.has(d.to.toLowerCase())) {
            setDraftStatus(d.id, "skipped", "déjà contacté récemment");
          }
        }
      } catch {
        /* dédup best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts.length]);

  const regen = () => {
    const n = prepareCampaignDrafts(campaign.id);
    setPreviews({});
    setOpenPreview({});
    if (n === 0) alert("Aucun destinataire ciblé (vérifie le secteur de la campagne et les emails des prospects).");
  };

  const loadPreview = useCallback(
    async (d: CampaignDraft) => {
      setPreviewLoading((m) => ({ ...m, [d.id]: true }));
      try {
        const res = await fetch("/api/email/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject: d.subject, body: d.body, ...identiteEnvoi(settings) }),
        });
        const data = (await res.json()) as Preview;
        setPreviews((m) => ({ ...m, [d.id]: data }));
      } catch {
        /* ignore */
      } finally {
        setPreviewLoading((m) => ({ ...m, [d.id]: false }));
      }
    },
    []
  );

  const togglePreview = (d: CampaignDraft) => {
    const next = !openPreview[d.id];
    setOpenPreview((m) => ({ ...m, [d.id]: next }));
    if (next && !previews[d.id]) void loadPreview(d);
  };

  const edit = (d: CampaignDraft, patch: Partial<CampaignDraft>) => {
    updateDraft(d.id, patch);
    // le message a changé → l'aperçu et le statut de validation ne valent plus
    setPreviews((m) => {
      const { [d.id]: _drop, ...rest } = m;
      return rest;
    });
    if (d.status === "approved") setDraftStatus(d.id, "pending");
  };

  const pending = drafts.filter((d) => d.status === "pending");
  const approved = drafts.filter((d) => d.status === "approved");
  const skipped = drafts.filter((d) => d.status === "skipped");
  const sent = drafts.filter((d) => d.status === "sent");
  const errored = drafts.filter((d) => d.status === "error");
  const sendableEmails = approved.filter((d) => d.channel === "email" && d.to);
  const waApproved = approved.filter((d) => d.channel === "whatsapp" && d.to);
  const allReviewed = pending.length === 0 && drafts.length > 0;

  const approveAll = () =>
    pending.filter((d) => d.to).forEach((d) => setDraftStatus(d.id, "approved"));

  const sendApproved = async () => {
    /**
     * ⚠ CE QUI PART EN MASSE AU NOM D'UN PARTENAIRE DOIT AVOIR ÉTÉ RELU PAR LUI.
     *
     * Garde-fou d'ÉCRAN, et il faut le savoir : les textes de campagne vivent
     * dans le navigateur, le serveur ne les a jamais vus et ne peut rien
     * revérifier. C'est plus faible qu'un 422 — mais c'est le seul endroit où
     * la question peut se poser, et ne rien poser du tout serait pire.
     */
    const verdict = campagnePeutPartir(campaign, accountId, validations);
    if (!verdict.ok) {
      setBlocage(verdict.bloquantes);
      return;
    }
    setBlocage([]);
    setSending(true);
    let ok = 0;
    for (const d of sendableEmails) {
      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channel: "email",
            to: d.to,
            subject: d.subject,
            body: d.body,
            prospectId: d.prospectId,
            campaignId: campaign.id,
            // Le compte au nom duquel on écrit ET qui signe : sans eux, la
            // porte serveur ne se déclenche jamais et l'email part signé de
            // NOTRE marque (`lib/expediteur.ts`).
            ...identiteEnvoi(settings),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setDraftStatus(d.id, "error", data.error ?? `Erreur ${res.status}`);
          continue;
        }
        setDraftStatus(d.id, "sent");
        addEvent(d.prospectId, { date: new Date().toISOString(), kind: "email", summary: `→ Campagne « ${campaign.name} » : ${d.subject}` });
        notifyN8n("campaign.sent", d.prospectId, { campaignId: campaign.id, channel: "email", subject: d.subject });
        ok++;
      } catch {
        setDraftStatus(d.id, "error", "réseau");
      }
    }
    if (ok > 0) {
      upsertCampaign({ ...campaign, status: "active", stats: { ...campaign.stats, sent: campaign.stats.sent + ok } });
      logActivity({ kind: "campagne", message: `Campagne « ${campaign.name} » : ${ok} email(s) envoyé(s) après relecture` });
    }
    setSending(false);
  };

  const openWhatsApp = (d: CampaignDraft) => {
    window.open(`https://wa.me/${toIntlPhone(d.to)}?text=${encodeURIComponent(d.body)}`, "_blank");
    setDraftStatus(d.id, "sent");
    addEvent(d.prospectId, { date: new Date().toISOString(), kind: "whatsapp", summary: `→ Campagne « ${campaign.name} » (WhatsApp)` });
    notifyN8n("campaign.sent", d.prospectId, { campaignId: campaign.id, channel: "whatsapp" });
  };

  return (
    <Modal open onClose={onClose} title={`Relecture avant envoi — ${campaign.name}`} wide>
      {/* Barre d'état + garde-fou d'envoi */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/95 px-3 py-2.5 backdrop-blur">
        <span className="chip border-bronze-700 text-bronze-400">{pending.length} à valider</span>
        <span className="chip border-signal-green/50 text-signal-green">{approved.length} approuvés</span>
        {skipped.length > 0 && <span className="chip border-ink-600 text-paper-faint">{skipped.length} ignorés</span>}
        {sent.length > 0 && <span className="chip border-signal-green/50 text-signal-green">{sent.length} envoyés ✓</span>}
        {errored.length > 0 && <span className="chip border-signal-red/50 text-signal-red">{errored.length} en erreur</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={regen} disabled={sending}>
            <RefreshCw size={13} /> Régénérer
          </button>
          {pending.length > 0 && (
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={approveAll} disabled={sending}>
              <Check size={13} /> Tout approuver
            </button>
          )}
          <button
            className="btn-bronze"
            onClick={sendApproved}
            disabled={!allReviewed || sending || sendableEmails.length === 0}
            title={
              !allReviewed
                ? "Relis (approuve ou ignore) tous les messages avant d'envoyer"
                : sendableEmails.length === 0
                  ? "Aucun email approuvé à envoyer"
                  : `Envoyer ${sendableEmails.length} email(s)`
            }
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Envoi…" : `Envoyer ${sendableEmails.length} email(s) approuvé(s)`}
          </button>
        </div>
      </div>

      {/* ⚠ Le refus doit DIRE quelle étape bloque. « Campagne bloquée » sans
          nommer le texte oblige à tout rouvrir, et on finit par contourner. */}
      {blocage.length > 0 && (
        <div className="mt-3 rounded-lg border border-signal-red/50 bg-signal-red/5 px-3 py-2.5">
          <p className="text-[12px] font-medium text-signal-red">
            Rien n&apos;est parti : {blocage.length} étape(s) n&apos;ont pas été validées par le partenaire.
          </p>
          <ul className="mt-1.5 space-y-1">
            {blocage.map((b) => (
              <li key={b.label} className="text-[11.5px] text-paper-dim">
                <strong className="text-paper">{b.label}</strong> — {b.pourquoi}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-paper-faint">
            Réglages → Validation partenaire. Sur leur campagne, c&apos;est leur marque que le prospect voit.
          </p>
        </div>
      )}

      {!allReviewed && drafts.length > 0 && (
        <p className="mb-3 rounded-lg border border-bronze-700/50 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper-dim">
          🔒 L&apos;envoi est bloqué tant qu&apos;il reste des messages à relire. Approuve ou ignore chacun — rien ne part sans ton feu vert.
        </p>
      )}
      {waApproved.length > 0 && (
        <p className="mb-3 text-[11px] text-paper-faint">
          {waApproved.length} DM WhatsApp approuvé(s) : ils partent de ton téléphone — bouton « Ouvrir WhatsApp » sur chaque carte.
        </p>
      )}

      {drafts.length === 0 ? (
        <p className="py-8 text-center text-sm text-paper-faint">
          Aucun brouillon. Vérifie que la campagne cible un secteur avec des prospects, puis « Régénérer ».
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => {
            const pv = previews[d.id];
            return (
              <li
                key={d.id}
                className={cn(
                  "rounded-xl border p-3",
                  d.status === "approved" ? "border-signal-green/40 bg-signal-green/5"
                    : d.status === "sent" ? "border-signal-green/30 bg-ink-900 opacity-80"
                    : d.status === "skipped" ? "border-ink-700 bg-ink-900 opacity-60"
                    : d.status === "error" ? "border-signal-red/40 bg-signal-red/5"
                    : "border-ink-600 bg-ink-850"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-700 text-bronze-400">{CHANNEL_ICON[d.channel]}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-paper">{d.company}</p>
                      <p className="truncate text-[11px] text-paper-faint">{d.to || d.error || "—"}</p>
                    </div>
                  </div>
                  <StatusChip d={d} />
                </div>

                {!d.to ? (
                  <p className="mt-2 text-[12px] text-signal-red">Pas de coordonnée sur la fiche — ce message ne peut pas partir.</p>
                ) : (
                  <>
                    {d.channel === "email" && (
                      <input
                        className="input mt-2 text-[13px]"
                        value={d.subject}
                        placeholder="Objet"
                        onChange={(e) => edit(d, { subject: e.target.value })}
                      />
                    )}
                    <textarea
                      className="input mt-2 min-h-24 font-body text-[13px] leading-relaxed"
                      value={d.body}
                      onChange={(e) => edit(d, { body: e.target.value })}
                    />

                    {placeholders(d).length > 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-bronze-400">
                        <ShieldAlert size={13} /> Variables non remplies : {placeholders(d).join(" ")} — complète-les avant d&apos;envoyer.
                      </p>
                    )}
                    {d.channel === "email" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => togglePreview(d)}>
                          {openPreview[d.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          {openPreview[d.id] ? "Masquer l'aperçu" : "Aperçu HTML"}
                        </button>
                        {previewLoading[d.id] && <Loader2 size={13} className="animate-spin text-paper-faint" />}
                        {pv && (
                          <button
                            className="btn-ghost px-2.5 py-1.5 text-[12px]"
                            title="Copier le HTML final (DA + pied RGPD) — pour un autre outil d'envoi"
                            onClick={() => {
                              void navigator.clipboard.writeText(pv.html);
                              setCopiedHtml(d.id);
                              setTimeout(() => setCopiedHtml((c) => (c === d.id ? null : c)), 2000);
                            }}
                          >
                            <Copy size={13} /> {copiedHtml === d.id ? "HTML copié ✓" : "Copier le HTML"}
                          </button>
                        )}
                        {pv && <LintChip lint={pv.lint} />}
                      </div>
                    )}
                    {d.channel === "email" && openPreview[d.id] && pv && (
                      <iframe
                        title={`aperçu-${d.id}`}
                        sandbox=""
                        srcDoc={pv.html}
                        className="mt-2 h-72 w-full rounded-lg border border-ink-700 bg-white"
                      />
                    )}

                    {d.error && d.status === "error" && <p className="mt-2 text-[12px] text-signal-red">⚠ {d.error}</p>}

                    {/* Actions de relecture */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {d.status !== "sent" && (
                        <>
                          <button
                            className={d.status === "approved" ? "btn-bronze px-2.5 py-1.5 text-[12px]" : "btn-ghost px-2.5 py-1.5 text-[12px]"}
                            onClick={() => setDraftStatus(d.id, d.status === "approved" ? "pending" : "approved")}
                          >
                            <Check size={13} /> {d.status === "approved" ? "Approuvé" : "Approuver"}
                          </button>
                          <button
                            className="btn-ghost px-2.5 py-1.5 text-[12px]"
                            onClick={() => setDraftStatus(d.id, d.status === "skipped" ? "pending" : "skipped")}
                          >
                            <X size={13} /> {d.status === "skipped" ? "Ignoré" : "Ignorer"}
                          </button>
                        </>
                      )}
                      {d.channel === "whatsapp" && d.status === "approved" && (
                        <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => openWhatsApp(d)}>
                          <MessageSquare size={13} /> Ouvrir WhatsApp
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Repère les variables {…} non remplies (ex. {concurrents}) restées dans le message. */
function placeholders(d: CampaignDraft): string[] {
  const found = `${d.subject}\n${d.body}`.match(/\{[a-zA-Zà-ÿ_]+\}/g) ?? [];
  return [...new Set(found)];
}

function StatusChip({ d }: { d: CampaignDraft }) {
  const map: Record<CampaignDraft["status"], { label: string; cls: string }> = {
    pending: { label: "à valider", cls: "border-bronze-700 text-bronze-400" },
    approved: { label: "approuvé", cls: "border-signal-green/50 text-signal-green" },
    skipped: { label: "ignoré", cls: "border-ink-600 text-paper-faint" },
    sent: { label: "envoyé ✓", cls: "border-signal-green/50 text-signal-green" },
    error: { label: "erreur", cls: "border-signal-red/50 text-signal-red" },
  };
  const m = map[d.status];
  return <span className={cn("chip shrink-0", m.cls)}>{m.label}</span>;
}

function LintChip({ lint }: { lint: Lint }) {
  if (lint.level === "ok") return <span className="chip border-signal-green/40 text-signal-green">anti-spam ✓</span>;
  const cls = lint.level === "risque" ? "border-signal-red/50 text-signal-red" : "border-bronze-700 text-bronze-400";
  return (
    <span className={cn("chip", cls)} title={lint.warnings.join(" · ")}>
      <ShieldAlert size={11} /> {lint.level === "risque" ? "risque spam" : "à surveiller"}
    </span>
  );
}
