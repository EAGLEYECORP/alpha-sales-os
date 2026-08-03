import { NextRequest, NextResponse } from "next/server";
import { buildDraftMime } from "@/lib/gmail-mime";
import { imapAppendDraft, type ImapConfig } from "@/lib/imap-append";
import type { DraftContent } from "@/lib/gmail-draft";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Brouillons Gmail HTML — dépose un ou plusieurs brouillons « calmes »,
 * prêts à envoyer, dans la boîte de l'opérateur.
 *
 * Mécanisme : IMAP APPEND (RFC 3501) avec le MÊME mot de passe d'application
 * Gmail que l'envoi SMTP. Aucun OAuth, aucune clé de plus.
 *   env : SMTP_USER / SMTP_PASS (réutilisés), ou IMAP_USER / IMAP_PASS
 *         IMAP_HOST (défaut imap.gmail.com), IMAP_PORT (défaut 993)
 *         SMTP_FROM pour l'expéditeur affiché (sinon l'utilisateur)
 *
 * Rien ne PART d'ici : un brouillon n'est pas un envoi. C'est le geste
 * doctrine — l'app prépare, l'humain relit et clique « Envoyer ».
 */

function resolveImap(): (ImapConfig & { from: string }) | null {
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return {
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT ?? 993),
    user,
    pass,
    draftsMailbox: process.env.IMAP_DRAFTS_MAILBOX || undefined,
    from: process.env.SMTP_FROM || user,
  };
}

export async function GET() {
  // Sonde de capacité — l'UI montre/masque le bouton selon ceci.
  return NextResponse.json({ imap: resolveImap() !== null });
}

/** Adresses à ne JAMAIS déposer (fiches de démo, exemples, tests). */
const FORBIDDEN = /@(example\.(com|org|net)|(.+\.)?(test|invalid|localhost))$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

interface DraftRequest {
  drafts: DraftContent[];
}

export async function POST(request: NextRequest) {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 4_000_000) {
    return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });
  }

  const cfg = resolveImap();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Brouillons Gmail non configurés — renseigne SMTP_USER / SMTP_PASS (mot de passe d'application Gmail) dans .env.local. Le même identifiant sert à envoyer et à brouillonner.",
      },
      { status: 503 }
    );
  }

  let payload: DraftRequest;
  try {
    payload = (await request.json()) as DraftRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const drafts = Array.isArray(payload.drafts) ? payload.drafts : [];
  if (drafts.length === 0) {
    return NextResponse.json({ error: "Aucun brouillon fourni." }, { status: 400 });
  }
  if (drafts.length > 40) {
    return NextResponse.json({ error: "Trop de brouillons d'un coup (max 40)." }, { status: 400 });
  }

  const results: { to: string; ok: boolean; mailbox?: string; error?: string }[] = [];
  for (const d of drafts) {
    const to = (d?.to ?? "").trim();
    if (!EMAIL_RE.test(to) || FORBIDDEN.test(to)) {
      results.push({ to, ok: false, error: "adresse invalide ou interdite (démo/exemple)" });
      continue;
    }
    if (!d.subject?.trim() || !d.html?.trim()) {
      results.push({ to, ok: false, error: "sujet ou HTML manquant" });
      continue;
    }
    try {
      const mime = await buildDraftMime({
        from: cfg.from,
        to,
        subject: d.subject,
        html: d.html,
        text: d.text || "",
      });
      const { mailbox } = await imapAppendDraft(cfg, mime);
      results.push({ to, ok: true, mailbox });
    } catch (e) {
      results.push({ to, ok: false, error: e instanceof Error ? e.message : "erreur inconnue" });
    }
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: created > 0, created, total: drafts.length, results });
}
