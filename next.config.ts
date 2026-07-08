import type { NextConfig } from "next";

// Dev mode needs 'unsafe-eval' (webpack/react-refresh run through eval);
// production stays strict.
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build autonome (dossier .next/standalone) — requis par le Dockerfile.
  output: "standalone",
  // Ne pas révéler la stack (fingerprinting)
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        // HTTPS forcé (ignoré sur localhost) — protège contre le downgrade/MITM
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        // Isolation de la fenêtre + pas de fuite cross-origin ; CORP cross-origin
        // reste nécessaire pour que le pixel de tracking se charge côté client mail.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        { key: "Origin-Agent-Cluster", value: "?1" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Next.js hydration + Tailwind runtime styles need inline; fonts via Google
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            // canvas-confetti spawns a blob: worker
            "worker-src 'self' blob:",
            // Thin-client : le navigateur appelle le webhook n8n de l'utilisateur
            // (domaine arbitraire) + Supabase. HTTPS partout, plus localhost en dev.
            "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
