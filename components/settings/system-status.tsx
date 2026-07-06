"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, Copy, RefreshCw, ServerCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseConfig, supabaseConfigSource } from "@/lib/supabase";

interface Health {
  ok: boolean;
  runtime: string;
  capabilities: {
    ai: { configured: boolean; model: string };
    email: { configured: boolean; from: boolean };
    sms: { configured: boolean; selfHosted: boolean };
    inboundWebhook: { configured: boolean };
    tracking: {
      baseUrl: boolean;
      forwardWebhook: boolean;
      persistence: string;
      maxSendsPerHour: number;
    };
    supabase: { publicEnv: boolean; serviceRole: boolean };
    branding: { closerName: boolean };
  };
}

type Level = "ok" | "warn" | "off";
interface Item {
  label: string;
  level: Level;
  hint?: string;
  optional?: boolean;
}

const ENV_TEMPLATE = `# ── IA (optionnel — sinon moteur templates Hormozi hors-ligne) ──
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-4-8

# ── Envoi email (Nodemailer / n'importe quel SMTP) ──
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
CLOSER_NAME=EAGLEYE

# ── SMS (Textbelt open-source) ──
TEXTBELT_URL=
TEXTBELT_KEY=

# ── Tracking & délivrabilité ──
TRACKING_BASE_URL=
APP_BASE_URL=
MAX_SENDS_PER_HOUR=40
TRACKING_WEBHOOK_URL=

# ── Webhooks entrants (réponses + STOP) ──
WEBHOOK_SECRET=

# ── Supabase (sync + auth + persistance tracking) ──
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=`;

function Dot({ level }: { level: Level }) {
  if (level === "ok") return <CheckCircle2 size={15} className="shrink-0 text-signal-green" />;
  if (level === "warn") return <AlertCircle size={15} className="shrink-0 text-bronze-400" />;
  return <Circle size={15} className="shrink-0 text-paper-faint" />;
}

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2">
            <Dot level={it.level} />
            <div className="min-w-0">
              <p className="text-[13px] text-paper">
                {it.label}
                {it.optional && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-paper-faint">optionnel</span>}
              </p>
              {it.level !== "ok" && it.hint && <p className="text-[11px] text-paper-faint">{it.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SystemStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sbLinked, setSbLinked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      setHealth(await res.json());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Supabase peut être lié au runtime (localStorage) — non visible côté serveur.
    setSbLinked(supabaseConfigSource() !== null || getSupabaseConfig() !== null);
  }, [load]);

  const c = health?.capabilities;

  const bool = (v: boolean | undefined, optional = false): Item["level"] =>
    v ? "ok" : optional ? "off" : "warn";

  const groups: { title: string; items: Item[] }[] = c
    ? [
        {
          title: "IA — Coach, Agent, Sparring",
          items: [
            {
              label: c.ai.configured ? `Claude connecté (${c.ai.model})` : "Claude (ANTHROPIC_API_KEY)",
              level: c.ai.configured ? "ok" : "warn",
              hint: "Sans clé, moteur de templates Hormozi hors-ligne (l'app fonctionne quand même).",
              optional: true,
            },
          ],
        },
        {
          title: "Envoi email",
          items: [
            {
              label: c.email.configured ? "SMTP configuré" : "SMTP (SMTP_HOST / USER / PASS)",
              level: bool(c.email.configured),
              hint: "Requis pour envoyer des emails. N'importe quel SMTP (Gmail app-password, OVH, Brevo…).",
            },
            {
              label: c.email.from ? "Expéditeur (From) défini" : "Expéditeur (SMTP_FROM)",
              level: c.email.from ? "ok" : "off",
              hint: "Sinon l'adresse SMTP_USER est utilisée.",
              optional: true,
            },
            {
              label: health?.capabilities.branding.closerName ? "Nom du closer (signature)" : "Nom du closer (CLOSER_NAME)",
              level: health?.capabilities.branding.closerName ? "ok" : "off",
              hint: "Signature des emails — défaut « EAGLEYE ».",
              optional: true,
            },
          ],
        },
        {
          title: "SMS",
          items: [
            {
              label: c.sms.configured ? `Textbelt${c.sms.selfHosted ? " (auto-hébergé)" : ""}` : "SMS (TEXTBELT_KEY)",
              level: c.sms.configured ? "ok" : "off",
              hint: "Optionnel — pour l'envoi de SMS.",
              optional: true,
            },
          ],
        },
        {
          title: "Tracking & délivrabilité",
          items: [
            {
              label: c.tracking.baseUrl ? "URL publique de tracking" : "URL publique (TRACKING_BASE_URL)",
              level: bool(c.tracking.baseUrl),
              hint: "En prod, requise pour que le pixel et les liens de clic se chargent chez le destinataire.",
            },
            {
              label: `Persistance : ${c.tracking.persistence === "supabase" ? "Supabase (durable)" : "mémoire (dev / mono-instance)"}`,
              level: c.tracking.persistence === "supabase" ? "ok" : "off",
              hint: "Pour des stats fiables en serverless, définis SUPABASE_SERVICE_ROLE_KEY.",
              optional: true,
            },
            {
              label: `Débit max : ${c.tracking.maxSendsPerHour} emails/heure`,
              level: "ok",
            },
            {
              label: c.tracking.forwardWebhook ? "Webhook tracking → n8n" : "Webhook tracking → CRM (TRACKING_WEBHOOK_URL)",
              level: c.tracking.forwardWebhook ? "ok" : "off",
              hint: "Renvoie ouvertures/clics vers n8n pour écrire dans le History du CRM.",
              optional: true,
            },
          ],
        },
        {
          title: "Réponses entrantes",
          items: [
            {
              label: c.inboundWebhook.configured ? "Secret webhook entrant" : "Secret webhook (WEBHOOK_SECRET)",
              level: c.inboundWebhook.configured ? "ok" : "warn",
              hint: "Requis pour recevoir les réponses (Instantly / Smartlead / Zapier / n8n).",
            },
          ],
        },
        {
          title: "Supabase (sync, auth, persistance)",
          items: [
            {
              label: sbLinked ? "Supabase lié (sync + auth)" : "Supabase non lié",
              level: sbLinked ? "ok" : "off",
              hint: "Lie-le ci-dessus (URL + clé anon) ou via variables d'env. Sinon 100 % local.",
              optional: true,
            },
            {
              label: c.supabase.serviceRole ? "Service role (serveur)" : "Service role (SUPABASE_SERVICE_ROLE_KEY)",
              level: c.supabase.serviceRole ? "ok" : "off",
              hint: "Persiste tracking + réponses entrantes côté serveur.",
              optional: true,
            },
          ],
        },
      ]
    : [];

  const essential = groups.flatMap((g) => g.items).filter((i) => !i.optional);
  const okCount = essential.filter((i) => i.level === "ok").length;

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ServerCog size={15} className="text-bronze-400" /> État du système
          {health && (
            <span
              className={cn(
                "chip",
                okCount === essential.length ? "border-signal-green/50 text-signal-green" : "border-bronze-700 text-bronze-400"
              )}
            >
              {okCount}/{essential.length} essentiels
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            className="btn-ghost px-2.5 py-1.5 text-[12px]"
            onClick={() => {
              navigator.clipboard.writeText(ENV_TEMPLATE);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy size={13} /> {copied ? "Copié ✓" : "Copier le modèle .env"}
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-paper-faint">
        Ce que le serveur voit comme configuré (aucune valeur secrète n&apos;est exposée). Une fois les identifiants en
        place — <code className="font-mono text-bronze-400">.env.local</code> puis redémarrage — tout doit passer au vert.
        {health && <span className="ml-1 text-paper-faint">· {health.runtime}</span>}
      </p>

      {loading && !health ? (
        <p className="mt-3 text-[12px] text-paper-faint">Vérification…</p>
      ) : health ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <Group key={g.title} title={g.title} items={g.items} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-signal-red">Impossible de joindre /api/health.</p>
      )}
    </section>
  );
}
