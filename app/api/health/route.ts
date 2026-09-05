import { NextRequest, NextResponse } from "next/server";
import { aiAvailable, aiEngineName, aiEngines } from "@/lib/ai-engine";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import { verifierProprietaire } from "@/lib/proprietaire-coherence";
import { serverAuthEnforced, serverAuthMisconfigured } from "@/lib/supabase-jwt";
import { verrouDeComptesActif } from "@/lib/entitlements";
import { OFFRES } from "@/lib/offres-publiques";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic système — dit CE QUI est configuré côté serveur, sans jamais
 * exposer une valeur secrète. Sert au panneau « État du système » des
 * Réglages : une fois les identifiants en place, tout doit être vert.
 *
 * ── POURQUOI LE DÉTAIL EST DÉSORMAIS PROTÉGÉ ──
 *
 * Aucun secret ne fuitait — que des booléens. Mais mis bout à bout, ces
 * booléens dessinent la CARTE COMPLÈTE de l'architecture : quel modèle
 * répond, quel fournisseur de transcription, LiveKit, Stripe, Supabase, le
 * scraper, le seuil d'envoi horaire. C'est exactement ce qu'on a retiré de
 * la page de vente — le laisser sur une route ouverte annulait l'effort.
 *
 * Pire : `access.gated` et `access.publicHost` annoncent publiquement
 * « ce déploiement tourne sans mot de passe ». C'est une invitation, pas un
 * diagnostic.
 *
 * La sonde reste PUBLIQUE et minimale ({ ok, checkedAt }) : un moniteur
 * externe doit pouvoir vérifier que l'app répond sans détenir de secret.
 * Le détail exige le cookie d'accès du site.
 */
function detailAutorise(req: NextRequest, expected: string | null): boolean {
  const sitePassword = process.env.SITE_PASSWORD;
  // Sans porte d'accès (développement local), il n'y a rien à protéger.
  if (!sitePassword) return true;
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  return Boolean(cookie && expected && safeEqual(cookie, expected));
}

export async function GET(req: NextRequest) {
  const env = process.env;
  const has = (k: string) => Boolean(env[k] && String(env[k]).trim());

  const sitePassword = env.SITE_PASSWORD;
  const attendu = sitePassword ? await accessToken(sitePassword) : null;
  if (!detailAutorise(req, attendu)) {
    // Assez pour un moniteur, rien pour un curieux.
    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
  }

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
      /**
       * ⚠ CES TROIS-LÀ SE LISENT, ELLES NE SE RECALCULENT PLUS.
       *
       * `serverEnforced` et `misconfigured` refaisaient ici le test de
       * `REQUIRE_AUTH` avec leur propre expression régulière — une SECONDE
       * définition de « le serveur exige-t-il un compte ? », à côté de
       * `lib/supabase-jwt.ts` que le middleware, lui, utilise vraiment.
       *
       * C'est précisément la sonde sur laquelle on s'appuie pour vérifier une
       * bascule vers le login. Une divergence entre les deux ne planterait
       * pas : elle MENTIRAIT — la sonde annonçant « protégé » pendant que le
       * middleware pense l'inverse, ou l'inverse. Le pire cas possible pour un
       * outil de diagnostic.
       *
       * `verrou` est ajouté parce que c'est LA question qui décide si le mot
       * de passe garde encore toute l'app : les deux moitiés vraies, ou rien.
       */
      auth: {
        serverEnv: supabasePublic,
        serverEnforced: serverAuthEnforced(),
        misconfigured: serverAuthMisconfigured(),
        verrou: verrouDeComptesActif(),
      },
      /**
       * ⚠ LES DEUX LISTES DE PROPRIÉTAIRES — aucun test ne peut les vérifier.
       *
       * Ce sont des VALEURS d'environnement, pas du code : la seule occasion
       * de les confronter est l'exécution. Une divergence ne plante pas, elle
       * MENT — l'écran promet ce que le serveur refuse, ou l'inverse. On ne
       * publie que des NOMBRES et le conseil : la sonde détaillée est déjà
       * protégée, mais une adresse reste une donnée personnelle.
       */
      proprietaire: (() => {
        const c = verifierProprietaire(env.OWNER_EMAILS, env.NEXT_PUBLIC_OWNER_EMAILS);
        return {
          configure: c.configure,
          coherent: c.coherent,
          serveurSeul: c.serveurSeul.length,
          navigateurSeul: c.navigateurSeul.length,
          quoiFaire: c.quoiFaire,
        };
      })(),
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
        /**
         * ⚠ CE DIAGNOSTIC LISAIT DEUX VARIABLES MORTES.
         *
         * Il regardait `STRIPE_PRICE_SOLO` / `STRIPE_PRICE_PRO`, retirées de
         * la grille le 04/09/2026 avec les offres qu'elles portaient. Le
         * panneau « État du système » serait donc resté ÉTEINT pour toujours,
         * y compris sur une installation parfaitement configurée — et le
         * réflexe, devant un voyant rouge qui ne s'allume jamais, est de
         * repasser une heure sur une configuration qui marchait déjà.
         *
         * On lit maintenant la grille : toute offre encaissable déclare la
         * variable qui porte son prix Stripe. Une offre ajoutée demain est
         * couverte sans toucher à ce fichier.
         */
        prices: OFFRES.some((o) => o.priceEnv !== null && has(o.priceEnv)),
        // Abonnement exigé pour envoyer (garde-fou opt-in).
        enforced: /^(1|true|yes)$/i.test(String(env.REQUIRE_SUBSCRIPTION ?? "")),
      },
      video: {
        // Rendu vidéo pour le contenu social (Studio social).
        json2video: has("JSON2VIDEO_API_KEY"),
        endpoint: has("VIDEO_GEN_ENDPOINT"),
      },
      audit: {
        // Audit auto depuis le site : fetch direct toujours dispo ; endpoint
        // scraper (Firecrawl/Crawl4AI/Camoufox) optionnel pour les sites durs.
        scrapeEndpoint: has("SCRAPE_ENDPOINT"),
      },
      access: {
        // porte d'accès serveur active (mot de passe requis pour toute l'UI)
        gated: has("SITE_PASSWORD"),
        // vrai si l'app tourne sur un hôte public (Vercel) — sert d'alerte
        // « déployé sans mot de passe »
        publicHost: has("VERCEL") || has("VERCEL_URL"),
      },
    },
  });
}
