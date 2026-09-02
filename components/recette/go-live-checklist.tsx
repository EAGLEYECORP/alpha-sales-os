"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAlpha } from "@/lib/store";
import { identiteEnvoi } from "@/lib/expediteur";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  MousePointerClick,
  Eye,
  MessageSquareReply,
  OctagonX,
  PlugZap,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getN8nConfig, testN8n, callN8n } from "@/lib/n8n";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Recette guidée « good to go » — la boucle complète testée EN LIVE.
 *
 * L'assistant de configuration branche le système ; cette page PROUVE
 * qu'il tourne : envoi réel vers une adresse de test, puis l'app détecte
 * elle-même l'ouverture (pixel), le clic, la réponse entrante (n8n) et
 * le STOP (relu dans le Sheet via le webhook n8n `list`). Les seuls
 * points non détectables (boîte principale ? footer conforme ?) sont
 * des cases à cocher manuelles. Tout vert → GOOD TO GO 🦅
 * ─────────────────────────────────────────────────────────────────────
 */

type Status = "idle" | "waiting" | "ok" | "fail" | "warn";

const LS_KEY = "alpha_recette_v1";
interface Saved {
  email: string;
  trackingId: string | null;
  inboxOk: boolean;
  footerOk: boolean;
}

const TEST_SUBJECT = "Test ALPHA — vérification de la boucle complète";
const TEST_BODY = `Bonjour,

Ceci est l'email de recette d'ALPHA SALES OS. Il sert à vérifier, en conditions réelles, que toute la chaîne fonctionne avant la première campagne : la délivrabilité, le suivi des ouvertures et des clics, la remontée des réponses et le traitement du STOP.

Voici les quatre gestes à faire depuis cette boîte de réception :

1. Vérifier que ce message est bien arrivé en boîte principale (pas en spam)
2. Cliquer sur le bouton ci-dessous pour tester le comptage des clics
3. Répondre à cet email avec un petit message (ex. « bien reçu »)
4. Une fois la réponse comptée, répondre une seconde fois avec le seul mot STOP

Chaque geste allume un voyant sur la page Recette de l'app. Quand tout est vert, le système est bon pour le lancement.

Bonne vérification !`;

function Dot({ s }: { s: Status }) {
  if (s === "ok") return <CheckCircle2 size={16} className="shrink-0 text-signal-green" />;
  if (s === "fail") return <OctagonX size={16} className="shrink-0 text-signal-red" />;
  if (s === "waiting") return <Loader2 size={16} className="shrink-0 animate-spin text-bronze-400" />;
  if (s === "warn") return <Circle size={16} className="shrink-0 text-bronze-400" />;
  return <Circle size={16} className="shrink-0 text-paper-faint" />;
}

function Item({
  s,
  title,
  hint,
  children,
}: {
  s: Status;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5"><Dot s={s} /></span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px]", s === "ok" ? "text-paper" : "text-paper-dim")}>{title}</p>
        {s !== "ok" && hint && <p className="mt-0.5 text-[11.5px] text-paper-faint">{hint}</p>}
        {children}
      </div>
    </li>
  );
}

export function GoLiveChecklist() {
  // L'identité d'envoi réelle : le banc d'essai doit tester CE qui part.
  const { settings } = useAlpha();
  // ── Prérequis (auto) ──
  const [preOk, setPreOk] = useState<{ smtp: Status; secret: Status; baseUrl: Status; n8n: Status }>({
    smtp: "idle",
    secret: "idle",
    baseUrl: "idle",
    n8n: "idle",
  });
  const [preRunning, setPreRunning] = useState(false);

  // ── Envoi test ──
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [needForce, setNeedForce] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // ── Cases manuelles ──
  const [inboxOk, setInboxOk] = useState(false);
  const [footerOk, setFooterOk] = useState(false);

  // ── Signaux live ──
  const [opened, setOpened] = useState<Status>("idle");
  const [clicked, setClicked] = useState<Status>("idle");
  const [replied, setReplied] = useState<Status>("idle");
  const [stopped, setStopped] = useState<Status>("idle");
  const celebrated = useRef(false);

  // Reprise après rechargement (le test dure le temps d'ouvrir sa boîte mail).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        setEmail(s.email ?? "");
        setTrackingId(s.trackingId ?? null);
        setInboxOk(Boolean(s.inboxOk));
        setFooterOk(Boolean(s.footerOk));
      }
    } catch {
      /* état illisible → recette vierge */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({ email, trackingId, inboxOk, footerOk } satisfies Saved));
    } catch {
      /* stockage indisponible : la reprise ne marchera pas, sans gravité */
    }
  }, [email, trackingId, inboxOk, footerOk]);

  const runPrereqs = useCallback(async () => {
    setPreRunning(true);
    setPreOk({ smtp: "waiting", secret: "waiting", baseUrl: "waiting", n8n: "waiting" });
    try {
      const res = await fetch("/api/health");
      const h = await res.json();
      const c = h?.capabilities;
      setPreOk((p) => ({
        ...p,
        smtp: c?.email?.configured ? "ok" : "fail",
        secret: c?.inboundWebhook?.configured ? "ok" : "fail",
        baseUrl: c?.tracking?.baseUrl ? "ok" : "warn",
      }));
    } catch {
      setPreOk((p) => ({ ...p, smtp: "fail", secret: "fail", baseUrl: "fail" }));
    }
    if (getN8nConfig()) {
      const r = await testN8n();
      setPreOk((p) => ({ ...p, n8n: r.ok ? "ok" : "fail" }));
    } else {
      setPreOk((p) => ({ ...p, n8n: "fail" }));
    }
    setPreRunning(false);
  }, []);

  useEffect(() => {
    void runPrereqs();
  }, [runPrereqs]);

  const sendTest = async (force: boolean) => {
    const to = email.trim();
    if (!to) return;
    setSending(true);
    setSendMsg("");
    setNeedForce(false);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          to,
          subject: TEST_SUBJECT,
          body: TEST_BODY,
          ctaLabel: "② Tester le clic",
          ctaUrl: window.location.origin,
          prospectId: "recette-test",
          campaignId: "recette",
          /**
           * ⚠ La recette est le banc d'essai : elle doit partir avec la MÊME
           * identité que les vrais envois, sinon elle valide une chaîne que
           * personne n'utilise. C'était le seul des quatre appelants à
           * n'annoncer ni compte ni signataire.
           */
          ...identiteEnvoi(settings),
          force,
        }),
      });
      const data = await res.json();
      if (res.ok && data.trackingId) {
        setTrackingId(String(data.trackingId));
        setOpened("waiting");
        setClicked("waiting");
        setReplied("waiting");
        setStopped("waiting");
        setSendMsg("✓ Email de test parti — ouvre la boîte de l'adresse test et suis les 4 gestes.");
      } else if (res.status === 409) {
        setNeedForce(true);
        setSendMsg("Déjà contacté récemment (la dédup anti-doublon fonctionne ✓). Force le renvoi pour re-tester.");
      } else {
        setSendMsg(`Échec : ${data.error ?? res.statusText}`);
      }
    } catch (e) {
      setSendMsg(`Échec : ${e instanceof Error ? e.message : "erreur réseau"}`);
    } finally {
      setSending(false);
    }
  };

  // ── Boucle de détection live (toutes les 5 s tant qu'il reste du gris) ──
  useEffect(() => {
    if (!trackingId) return;
    const testEmail = email.trim().toLowerCase();
    let stop = false;

    const tick = async () => {
      if (stop) return;
      // Ouverture + clic — l'app relit ses propres stats de tracking.
      if (opened !== "ok" || clicked !== "ok") {
        try {
          const res = await fetch(`/api/track/stats?messageId=${encodeURIComponent(trackingId)}`);
          if (res.ok) {
            const s = await res.json();
            if (Number(s.opens) > 0) setOpened("ok");
            if (Number(s.clicks) > 0) setClicked("ok");
          }
        } catch {
          /* prochaine passe */
        }
      }
      // Réponse entrante — arrivée via n8n → webhook → file d'événements.
      if (replied !== "ok" && testEmail) {
        try {
          const res = await fetch("/api/webhooks/inbound");
          if (res.ok) {
            const d = await res.json();
            const hit = (d.events ?? []).some(
              (ev: { email?: string }) => String(ev.email ?? "").toLowerCase() === testEmail
            );
            if (hit) setReplied("ok");
          }
        } catch {
          /* prochaine passe */
        }
      }
      // STOP — relu directement dans le Sheet via le webhook n8n (action list).
      if (stopped !== "ok" && testEmail && getN8nConfig()) {
        const r = await callN8n<{ rows?: Record<string, unknown>[] } | Record<string, unknown>[]>("list");
        if (r.ok && r.data) {
          const rows = Array.isArray(r.data) ? r.data : (r.data.rows ?? []);
          const row = rows.find(
            (x) => String((x as Record<string, unknown>).email ?? (x as Record<string, unknown>).Email ?? "").toLowerCase() === testEmail
          ) as Record<string, unknown> | undefined;
          if (row) {
            const unsub = String(row.unsubscribed ?? "").toLowerCase() === "true";
            const lost = String(row.stage ?? "").toLowerCase() === "perdu";
            if (unsub || lost) setStopped("ok");
          }
        }
      }
    };

    void tick();
    const iv = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [trackingId, email, opened, clicked, replied, stopped]);

  const required: Status[] = useMemo(
    () => [preOk.smtp, preOk.secret, preOk.n8n, trackingId ? "ok" : "idle", inboxOk ? "ok" : "idle", footerOk ? "ok" : "idle", opened, clicked, replied, stopped],
    [preOk, trackingId, inboxOk, footerOk, opened, clicked, replied, stopped]
  );
  const goodToGo = required.every((s) => s === "ok");
  const doneCount = required.filter((s) => s === "ok").length;

  useEffect(() => {
    if (goodToGo && !celebrated.current) {
      celebrated.current = true;
      try {
        window.localStorage.setItem("alpha_recette_done", new Date().toISOString());
      } catch {
        /* ignore */
      }
      void import("canvas-confetti").then((m) =>
        m.default({ particleCount: 140, spread: 75, origin: { y: 0.65 } })
      );
    }
  }, [goodToGo]);

  const reset = () => {
    setTrackingId(null);
    setOpened("idle");
    setClicked("idle");
    setReplied("idle");
    setStopped("idle");
    setInboxOk(false);
    setFooterOk(false);
    setSendMsg("");
    setNeedForce(false);
    celebrated.current = false;
  };

  return (
    <div className="space-y-4">
      {/* Barre d'état */}
      <div className={cn("card flex items-center justify-between gap-3 p-4", goodToGo && "border-signal-green/50")}>
        <div className="flex items-center gap-3">
          {goodToGo ? <Rocket size={20} className="text-signal-green" /> : <ShieldCheck size={20} className="text-bronze-400" />}
          <div>
            <p className="font-display text-sm font-bold text-paper">
              {goodToGo ? "GOOD TO GO 🦅 — la boucle complète est prouvée" : `Recette en cours — ${doneCount}/${required.length} voyants verts`}
            </p>
            <p className="text-[11.5px] text-paper-faint">
              {goodToGo
                ? "Envoi, tracking, réponse, STOP : tout tourne. Lance tes 10 premiers prospects (RUNBOOK, checkpoint 100)."
                : "Chaque voyant se vérifie tout seul, en direct. Rien à rafraîchir."}
            </p>
          </div>
        </div>
        <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={reset}>
          <RefreshCw size={13} /> Réinitialiser
        </button>
      </div>

      {/* 1 — Prérequis */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <PlugZap size={15} className="text-bronze-400" /> 1 · Prérequis (vérifiés automatiquement)
          </h2>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={runPrereqs} disabled={preRunning}>
            <RefreshCw size={13} className={preRunning ? "animate-spin" : ""} /> Revérifier
          </button>
        </div>
        <ul className="mt-1 divide-y divide-ink-700/50">
          <Item s={preOk.smtp} title="Envoi email (SMTP) configuré" hint="SMTP_HOST / USER / PASS dans .env.local, puis redémarre l'app." />
          <Item s={preOk.secret} title="Secret webhook (réponses entrantes)" hint="WEBHOOK_SECRET dans .env.local = ALPHA_WEBHOOK_SECRET côté n8n." />
          <Item
            s={preOk.baseUrl}
            title="URL publique de tracking"
            hint="Sans TRACKING_BASE_URL (tunnel ou Vercel), les voyants Ouverture/Clic ne pourront pas passer au vert — Gmail charge les images depuis ses serveurs, pas depuis ton localhost."
          />
          <Item s={preOk.n8n} title="n8n répond au ping" hint="Workflow alpha-dashboard-api activé + URL de Production dans Réglages → Connexion n8n." />
        </ul>
      </section>

      {/* 2 — Envoi */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Send size={15} className="text-bronze-400" /> 2 · Envoyer l&apos;email de test
        </h2>
        <p className="mt-1 text-[12px] text-paper-faint">
          ⚠️ Utilise une adresse <strong className="text-paper-dim">différente de ta boîte d&apos;envoi</strong> (sinon ton
          propre message serait pris pour une réponse entrante). L&apos;email contient les 4 gestes à faire.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs font-mono text-[12px]"
            type="email"
            placeholder="adresse-test@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-bronze" onClick={() => sendTest(false)} disabled={sending || !email.trim()}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            {sending ? "Envoi…" : trackingId ? "Renvoyer" : "Envoyer le test"}
          </button>
          {needForce && (
            <button className="btn-ghost text-[12px]" onClick={() => sendTest(true)} disabled={sending}>
              Forcer le renvoi
            </button>
          )}
        </div>
        {sendMsg && <p className="mt-2 text-[12px] text-paper-dim">{sendMsg}</p>}
        <ul className="mt-2 divide-y divide-ink-700/50">
          <Item s={trackingId ? "ok" : "idle"} title="Email de test parti (tracking armé)" />
          <li className="flex items-start gap-2.5 py-2">
            <input type="checkbox" className="mt-0.5 accent-bronze-500" checked={inboxOk} onChange={(e) => setInboxOk(e.target.checked)} id="rc-inbox" />
            <label htmlFor="rc-inbox" className="text-[13.5px] text-paper-dim">
              Reçu en <strong className="text-paper">boîte principale</strong> (pas spam/promotions) et le rendu est propre
            </label>
          </li>
          <li className="flex items-start gap-2.5 py-2">
            <input type="checkbox" className="mt-0.5 accent-bronze-500" checked={footerOk} onChange={(e) => setFooterOk(e.target.checked)} id="rc-footer" />
            <label htmlFor="rc-footer" className="text-[13.5px] text-paper-dim">
              Le pied contient bien <strong className="text-paper">« Répondez STOP »</strong> + la mention RGPD (sources publiques, droits)
            </label>
          </li>
        </ul>
      </section>

      {/* 3 — Signaux détectés en direct */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Eye size={15} className="text-bronze-400" /> 3 · Signaux détectés en direct
        </h2>
        <p className="mt-1 text-[12px] text-paper-faint">
          Fais les gestes dans la boîte de l&apos;adresse test — les voyants passent au vert tout seuls (vérification toutes les 5 s).
        </p>
        <ul className="mt-1 divide-y divide-ink-700/50">
          <Item
            s={opened}
            title="① Ouverture détectée (pixel chargé)"
            hint={trackingId ? "Ouvre l'email. Toujours gris après 2 min ? → TRACKING_BASE_URL absent ou tunnel éteint." : "Envoie d'abord l'email de test."}
          />
          <Item
            s={clicked}
            title="② Clic détecté (lien traqué suivi)"
            hint={trackingId ? "Clique le bouton « ② Tester le clic » dans l'email." : undefined}
          />
          <Item
            s={replied}
            title="③ Réponse entrante remontée dans l'app"
            hint={trackingId ? "Réponds à l'email (ex. « bien reçu »). Toujours gris après 3 min ? → workflow alpha-inbound actif ? ALPHA_APP_URL joignable depuis n8n ? secrets identiques ?" : undefined}
          />
          <Item
            s={stopped}
            title="④ STOP traité (désinscrit dans le CRM)"
            hint={trackingId ? "Après le voyant ③, réponds une 2e fois avec le seul mot STOP. L'app relit le Sheet via n8n — gris après 3 min ? → alpha-inbound → nœud « Sheets — marquer STOP »." : undefined}
          />
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-paper-faint">
          <MessageSquareReply size={12} /> Astuce : la réponse « bien reçu » apparaît aussi dans Campagnes → Réponses entrantes — c&apos;est là que tu la traiteras au quotidien.
        </p>
      </section>

      {goodToGo && (
        <section className="card border-signal-green/40 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-signal-green">
            <MousePointerClick size={15} /> Et maintenant ?
          </h2>
          <ul className="mt-2 space-y-1 text-[12.5px] text-paper-dim">
            <li>· Remets <code className="font-mono text-bronze-400">CONTACT_COOLDOWN_DAYS=14</code> si tu l&apos;avais baissé pour les tests.</li>
            <li>· Jour 1 : <strong className="text-paper">10 prospects max</strong>, chaque email relu — le warm-up n&apos;est pas négociable (RUNBOOK, checkpoint 100).</li>
            <li>· Chaque matin : Dashboard → Routines, du haut vers le bas. Chaque réponse : rappel sous 24 h.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
