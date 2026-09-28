import { NextRequest, NextResponse } from "next/server";
import type { Prospect } from "@/lib/types";
import { pushProspects, NOTION_SCHEMA } from "@/lib/notion";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * Envoi du pipeline vers Notion.
 *
 *   POST { prospects: [...] } → { created, updated, failed }
 *   GET                       → { configured, schema }
 *
 * Le jeton Notion vit UNIQUEMENT côté serveur (`NOTION_TOKEN`). Il ne
 * transite jamais par le navigateur : une intégration Notion peut lire et
 * écrire tout ce à quoi elle a accès, ce n'est pas un secret d'affichage.
 *
 * Route INTERNE (même origine + porte d'accès) : c'est l'app qui l'appelle
 * avec les fiches de son store local.
 * ─────────────────────────────────────────────────────────────────────
 */

const config = () => ({
  token: process.env.NOTION_TOKEN?.trim() ?? "",
  databaseId: process.env.NOTION_DATABASE_ID?.trim() ?? "",
});

export async function GET() {
  const c = config();
  return NextResponse.json({
    configured: Boolean(c.token && c.databaseId),
    schema: NOTION_SCHEMA,
    why: c.token && c.databaseId ? undefined : "NOTION_TOKEN et NOTION_DATABASE_ID manquants — voir docs/NOTION.md.",
  });
}

export async function POST(req: NextRequest) {
  const c = config();
  if (!c.token || !c.databaseId) {
    return NextResponse.json({ error: "Notion non configuré côté serveur.", schema: NOTION_SCHEMA }, { status: 503 });
  }

  let body: { prospects?: Prospect[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const prospects = Array.isArray(body.prospects) ? body.prospects : null;
  if (!prospects) return NextResponse.json({ error: "prospects[] requis" }, { status: 400 });
  // Notion limite à 3 requêtes/seconde et chaque fiche en coûte deux
  // (recherche + écriture). Au-delà de 100, la fonction expire avant la fin :
  // mieux vaut refuser franchement que rendre un succès partiel silencieux.
  if (prospects.length > 100) {
    return NextResponse.json({ error: `Lot trop grand (${prospects.length}). Maximum 100 fiches par envoi.` }, { status: 413 });
  }

  const result = await pushProspects(c, prospects);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
