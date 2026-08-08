"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, Copy, RefreshCw, ServerCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseConfig, supabaseConfigSource } from "@/lib/supabase";

interface Health {
  ok: boolean;
  runtime: string;
  capabilities: {
    ai: { configured: boolean; model: string; engines?: string[] };
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
    auth?: { serverEnv: boolean };
    voice?: { livekit: boolean };
    transcription?: { configured: boolean; provider: string };
    alerts?: { sms: boolean; email: boolean };
    access: { gated: boolean; publicHost: boolean };
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

export const ENV_TEMPLATE = `# ── IA (optionnel — sinon moteur templates Hormozi hors-ligne) ──
# Option 1 (recommandé, 100 % local, gratuit) : ollama pull qwen2.5:3b
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
# Option 2 (GRATUIT, 100+ modèles) — NVIDIA NIM, clé sur build.nvidia.com
# La cascade essaie dans cet ordre : Ollama (local) → NVIDIA → Anthropic
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.3-70b-instruct

# Option 3 (payant) :
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
CONTACT_COOLDOWN_DAYS=14
TRACKING_WEBHOOK_URL=

# ── Webhooks entrants (réponses + STOP) ──
WEBHOOK_SECRET=

# ── Transcription serveur (débrief terrain, dictée — tout navigateur) ──
# Option A : Deepgram (rapide, français). Option B : Whisper (OpenAI-compatible).
DEEPGRAM_API_KEY=
WHISPER_API_URL=
WHISPER_API_KEY=
WHISPER_MODEL=whisper-1

# ── Alertes « super urgent » (récap SMS / email) ──
# SMS : réutilise TEXTBELT_KEY ci-dessus. Destinataires figés côté serveur :
ALERT_PHONE=
DIGEST_EMAIL=

# ── Appels voix sortants (dispatch LiveKit ; l'agent Python tourne ailleurs) ──
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# ── Porte d'accès (OBLIGATOIRE si déployé en public / Vercel) ──
SITE_PASSWORD=

# ── Supabase (sync + comptes multi-locataires + persistance tracking) ──
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
              label: c.ai.configured ? `IA connectée — ${c.ai.model}` : "IA (aucun moteur branché)",
              level: c.ai.configured ? "ok" : "warn",
              hint: "Trois options, essayées dans cet ordre : Ollama en local (rien ne sort de la machine) → NVIDIA NIM (GRATUIT, modèles 70B, clé sur build.nvidia.com) → Anthropic (payant). Sans aucune, moteur de templates hors-ligne.",
              optional: true,
            },
            ...(c.ai.engines && c.ai.engines.length > 1
              ? [
                  {
                    label: `Repli disponible : ${c.ai.engines.slice(1).join(", ")}`,
                    level: "ok" as const,
                    optional: true,
                  },
                ]
              : []),
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
              hint: "Tracking + rate-limit + dédup « déjà contacté » durables et partagés entre instances. En serverless, définis SUPABASE_SERVICE_ROLE_KEY.",
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
          title: "Voix, transcription & alertes",
          items: [
            {
              label: c.voice?.livekit ? "Appels sortants (LiveKit)" : "Appels sortants (LIVEKIT_URL / API_KEY / API_SECRET)",
              level: c.voice?.livekit ? "ok" : "off",
              hint: "Pour dispatcher un appel voix. L'agent Python (voice/) et sa TTS Fish Audio tournent sur ta machine/serveur, avec leurs propres clés — pas sur Vercel.",
              optional: true,
            },
            {
              label: c.transcription?.configured ? `Transcription serveur (${c.transcription.provider})` : "Transcription (DEEPGRAM_API_KEY ou WHISPER_API_KEY)",
              level: c.transcription?.configured ? "ok" : "off",
              hint: "Débrief terrain + dictée, fonctionne sur tout navigateur (Chromium inclus). Sinon, repli reconnaissance vocale du navigateur.",
              optional: true,
            },
            {
              label: c.alerts?.sms ? "Alerte urgente SMS" : "Alerte SMS (TEXTBELT_KEY + ALERT_PHONE)",
              level: c.alerts?.sms ? "ok" : "off",
              hint: "Récap « super urgent » poussé par SMS. Destinataire figé côté serveur.",
              optional: true,
            },
            {
              label: c.alerts?.email ? "Alerte urgente email" : "Alerte email (SMTP + DIGEST_EMAIL)",
              level: c.alerts?.email ? "ok" : "off",
              hint: "Même récap urgent, par email.",
              optional: true,
            },
          ],
        },
        {
          title: "Accès (déploiement public)",
          items: [
            {
              label: c.access.gated
                ? "Porte d'accès active (mot de passe requis)"
                : c.access.publicHost
                  ? "⚠ Déployé SANS mot de passe — UI publique !"
                  : "Porte d'accès (SITE_PASSWORD) — off en local",
              level: c.access.gated ? "ok" : c.access.publicHost ? "warn" : "off",
              hint: c.access.publicHost
                ? "Hôte public détecté : définis SITE_PASSWORD dans Vercel → Settings → Environment Variables, puis redéploie. Sinon n'importe qui voit ton CRM."
                : "En local, inutile. Sur un déploiement public (Vercel), OBLIGATOIRE : SITE_PASSWORD verrouille toute l'UI.",
              optional: !c.access.publicHost,
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
            {
              label: sbLinked ? "Comptes multi-locataires possibles" : "Comptes multi-locataires (nécessite Supabase)",
              level: sbLinked ? "ok" : "off",
              hint: "Active « Exiger un compte » (section Sécurité) pour vendre l'OS à d'autres commerciaux. À prouver à deux comptes avant de facturer.",
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
