import { NextResponse } from "next/server";
import { aiAvailable, aiEngineName, aiEngines } from "@/lib/ai-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic système — dit CE QUI est configuré côté serveur, sans jamais
 * exposer une valeur secrète (uniquement des booléens + quelques constantes
 * non sensibles). Sert au panneau « État du système » des Réglages : une
 * fois les identifiants en place, tout doit être vert.
 */
export async function GET() {
  const env = process.env;
  const has = (k: string) => Boolean(env[k] && String(env[k]).trim());

  const email = has("SMTP_HOST") && has("SMTP_USER") && has("SMTP_PASS");
  const supabasePublic = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    runtime: `node ${process.version}`,
    capabilities: {
      ai: {
        configured: aiAvailable(),
        // Le moteur qui répondra RÉELLEMENT, pas celui qu'on espère.
        model: aiEngineName(),
        /** Tous les moteurs branchés, dans l'ordre d'essai. */
        engines: aiEngines(),
      },
      email: {
        configured: email,
        from: has("SMTP_FROM"),
        host: has("SMTP_HOST"),
        auth: has("SMTP_USER") && has("SMTP_PASS"),
      },
      sms: { configured: has("TEXTBELT_KEY"), selfHosted: has("TEXTBELT_URL") },
      inboundWebhook: { configured: has("WEBHOOK_SECRET") },
      tracking: {
        // les endpoints existent toujours ; ces réglages les rendent fiables
        baseUrl: has("TRACKING_BASE_URL") || has("APP_BASE_URL"),
        forwardWebhook: has("TRACKING_WEBHOOK_URL"),
        persistence: has("SUPABASE_SERVICE_ROLE_KEY") ? "supabase" : "memory",
        maxSendsPerHour: Number(env.MAX_SENDS_PER_HOUR ?? 40),
      },
      supabase: {
        publicEnv: supabasePublic,
        serviceRole: has("SUPABASE_SERVICE_ROLE_KEY"),
      },
      // Auth multi-locataire : possible dès que Supabase (public) est là —
      // soit via env, soit lié au runtime (invisible ici, d'où le "ou").
      auth: {
        serverEnv: supabasePublic,
        // Enforcement serveur du JWT par compte (REQUIRE_AUTH + secret présent).
        serverEnforced: has("SUPABASE_JWT_SECRET") && /^(1|true|yes)$/i.test(String(env.REQUIRE_AUTH ?? "")),
        // REQUIRE_AUTH demandé mais secret absent → misconfiguration (fail-closed).
        misconfigured: !has("SUPABASE_JWT_SECRET") && /^(1|true|yes)$/i.test(String(env.REQUIRE_AUTH ?? "")),
      },
      voice: {
        // Dispatch d'appel sortant vers LiveKit (l'agent Python + Fish TTS
        // tournent ailleurs, avec leurs propres clés — pas sur Vercel).
        livekit: has("LIVEKIT_URL") && has("LIVEKIT_API_KEY") && has("LIVEKIT_API_SECRET"),
      },
      transcription: {
        // Transcription serveur (débrief terrain, dictée) — navigateur-agnostique.
        configured: has("DEEPGRAM_API_KEY") || has("WHISPER_API_KEY"),
        provider: has("DEEPGRAM_API_KEY") ? "deepgram" : has("WHISPER_API_KEY") ? "whisper" : "aucun",
      },
      alerts: {
        // Récap urgent par SMS / email (destinataire figé côté serveur).
        sms: has("TEXTBELT_KEY") && has("ALERT_PHONE"),
        email: has("SMTP_HOST") && has("DIGEST_EMAIL"),
      },
      billing: {
        // Facturation Stripe (revente SaaS). Booléens uniquement.
        configured: has("STRIPE_SECRET_KEY"),
        webhook: has("STRIPE_WEBHOOK_SECRET"),
        prices: has("STRIPE_PRICE_SOLO") || has("STRIPE_PRICE_PRO"),
        // Abonnement exigé pour envoyer (garde-fou opt-in).
        enforced: /^(1|true|yes)$/i.test(String(env.REQUIRE_SUBSCRIPTION ?? "")),
      },
      access: {
        // porte d'accès serveur active (mot de passe requis pour toute l'UI)
        gated: has("SITE_PASSWORD"),
        // vrai si l'app tourne sur un hôte public (Vercel) — sert d'alerte
        // « déployé sans mot de passe »
        publicHost: has("VERCEL") || has("VERCEL_URL"),
      },
      branding: { closerName: has("CLOSER_NAME") },
    },
  });
}
