import { NextResponse } from "next/server";

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
        configured: has("OLLAMA_MODEL") || has("ANTHROPIC_API_KEY"),
        model: has("OLLAMA_MODEL")
          ? `ollama:${env.OLLAMA_MODEL} (local)`
          : env.AI_MODEL || "claude-opus-4-8",
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
      branding: { closerName: has("CLOSER_NAME") },
    },
  });
}
