import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

export const runtime = "nodejs";

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
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const password = (body.password ?? "").toString();
  if (password.length === 0 || password !== expected) {
    // Petit délai anti-bruteforce.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
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
