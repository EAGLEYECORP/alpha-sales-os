import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side fetch of a published Google Sheet (CSV) — the browser can't
 * fetch docs.google.com directly (CORS). Host allowlist prevents SSRF.
 *
 * Accepted URLs:
 *  - https://docs.google.com/spreadsheets/d/<id>/export?format=csv[&gid=…]
 *  - https://docs.google.com/spreadsheets/d/e/<pub-id>/pub?output=csv
 *  - a normal share link https://docs.google.com/spreadsheets/d/<id>/edit…
 *    (rewritten to the export URL automatically)
 */
const ALLOWED_HOSTS = ["docs.google.com", "docs.googleusercontent.com"];

function normalizeSheetUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h)))
    return null;

  // share link → export csv
  const m = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/);
  if (m && !url.pathname.includes("/export") && !url.pathname.includes("/pub")) {
    const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get("gid") ?? "0";
    return new URL(`https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "paramètre url manquant" }, { status: 400 });

  const url = normalizeSheetUrl(raw);
  if (!url)
    return NextResponse.json(
      { error: "URL non autorisée — utilise un lien Google Sheets (publié ou partagé « tous ceux qui ont le lien »)" },
      { status: 400 }
    );

  try {
    const res = await fetch(url.toString(), { redirect: "follow", headers: { accept: "text/csv,text/plain,*/*" } });
    if (!res.ok)
      return NextResponse.json(
        { error: `Google a répondu ${res.status} — la feuille est-elle partagée en lecture (« tous ceux qui ont le lien ») ?` },
        { status: 502 }
      );
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      return NextResponse.json(
        { error: "Reçu du HTML au lieu de CSV — publie la feuille (Fichier → Partager → Publier sur le web → CSV) ou ouvre le partage par lien." },
        { status: 502 }
      );
    }
    return new NextResponse(text, { headers: { "content-type": "text/csv; charset=utf-8" } });
  } catch (e) {
    return NextResponse.json({ error: `Échec réseau : ${e instanceof Error ? e.message : "inconnu"}` }, { status: 502 });
  }
}
