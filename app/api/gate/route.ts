import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import { AttemptLimiter, callerKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Compteur de tentatives, par IP. Vit dans la mémoire de l'instance : il élève
 * le coût d'une attaque par force brute, il ne la rend pas impossible sur une
 * plateforme multi-instances. Voir lib/rate-limit.ts — c'est écrit noir sur
 * blanc pour qu'on n'imagine pas être protégé plus qu'on ne l'est.
 */
const limiter = new AttemptLimiter();

/**
 * Soumission de la porte d'accès. POST { password } → si == SITE_PASSWORD,
 * pose un cookie httpOnly signé (30 j). GET → { required: bool } (l'UI sait
 * si la porte est active). Sans SITE_PASSWORD, la porte est désactivée.
 */
export async function GET() {
  return NextResponse.json({ required: Boolean(process.env.SITE_PASSWORD) });
}

export async function POST(request: NextRequest) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    // Porte désactivée : rien à valider.
    return NextResponse.json({ ok: true, disabled: true });
  }
  // Le compteur AVANT toute vérification : un appelant bloqué ne doit même pas
  // obtenir une réponse qui distingue « mauvais mot de passe » de « bloqué ».
  const key = callerKey(request.headers);
  const gate = limiter.check(key);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie plus tard.", reessayerDansSec: gate.retryAfterSec },
      { status: 429, headers: { "retry-after": String(gate.retryAfterSec) } }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const password = (body.password ?? "").toString();
  // Comparaison à temps constant : `!==` s'arrête au premier caractère
  // différent, ce qui mesure la longueur du bon préfixe.
  if (password.length === 0 || !safeEqual(password, expected)) {
    const v = limiter.fail(key);
    // Le délai reste, mais il ne suffisait pas : il ralentit UNE requête, pas
    // cent lancées en parallèle. C'est le compteur qui fait le travail.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json(
      {
        error: "Mot de passe incorrect.",
        ...(v.allowed ? { restant: v.remaining } : { reessayerDansSec: v.retryAfterSec }),
      },
      { status: 401 }
    );
  }
  limiter.succeed(key);
  const token = await accessToken(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
