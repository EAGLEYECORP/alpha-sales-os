import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resoudreDroits } from "@/lib/entitlements";
import { runAI } from "@/lib/ai-engine";
import { CAPACITES, moteurUtilisable, type Capacite } from "@/lib/credentials";
import { chiffrer, empreinteVisible, moteurDepuisValeurs } from "@/lib/credentials-secret";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * BYOK — enregistrer, vérifier, oublier une clé.
 *
 * ══ ⚠⚠ LE LOCATAIRE VIENT DU JETON, JAMAIS DU CORPS ══
 *
 * Aucun champ de la requête ne peut désigner un autre compte. Accepter un
 * `tenantId` dans le corps laisserait n'importe qui écrire — ou effacer — la
 * clé de n'importe qui d'autre, et ça ne se verrait ni dans les logs ni à
 * l'écran de la victime.
 *
 * ══ ⚠⚠ ON NE REND JAMAIS UNE CLÉ ══
 *
 * `GET` rend l'EMPREINTE (quatre derniers caractères) et la date de
 * vérification. Jamais le secret. Le locataire n'a aucun besoin de le relire
 * — il l'a déjà — et le redescendre dans un navigateur l'exposerait à la
 * première faille XSS. Même doctrine que le mot de passe SMTP que Supabase
 * ne réaffiche jamais : **on écrit, on ne relit pas.**
 *
 * ══ ⚠⚠ UNE CLÉ NON TESTÉE N'EST PAS ENREGISTRÉE COMME VÉRIFIÉE ══
 *
 * `verifie_le` n'est posé qu'après un VRAI appel au fournisseur. Sans ça, une
 * faute de frappe ouvrirait la brique et se découvrirait devant un prospect —
 * le pire moment possible. C'est pour cette raison que la route accepte de
 * durer (`maxDuration = 60`) : elle fait réellement l'appel.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que l'opérateur a le droit de nous confier, par capacité. */
const CHAMPS_ATTENDUS: Record<Capacite, readonly string[]> = {
  ia: ["ANTHROPIC_API_KEY", "AI_MODEL", "NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL"],
};

function estCapacite(v: unknown): v is Capacite {
  return typeof v === "string" && (CAPACITES as readonly string[]).includes(v);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.tenantId) return NextResponse.json({ cles: {} });
  const sb = serviceClient();
  if (!sb) return NextResponse.json({ cles: {}, indisponible: true });

  const { data, error } = await sb
    .from("tenant_credentials")
    .select("capacite, empreinte, verifie_le, dernier_echec")
    .eq("tenant_id", droits.tenantId);
  if (error) return NextResponse.json({ cles: {}, indisponible: true });

  const cles: Record<string, { empreinte: string; verifieLe: string | null; dernierEchec: string | null }> = {};
  for (const r of data ?? []) {
    const l = r as { capacite?: string; empreinte?: string; verifie_le?: string | null; dernier_echec?: string | null };
    if (l.capacite) {
      cles[l.capacite] = {
        empreinte: l.empreinte ?? "…",
        verifieLe: l.verifie_le ?? null,
        dernierEchec: l.dernier_echec ?? null,
      };
    }
  }
  return NextResponse.json({ cles });
}

export async function POST(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.tenantId) {
    return NextResponse.json({ error: "Connecte-toi pour enregistrer une clé." }, { status: 401 });
  }

  let body: { capacite?: unknown; valeurs?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!estCapacite(body.capacite)) {
    return NextResponse.json({ error: "Capacité inconnue." }, { status: 400 });
  }
  const capacite = body.capacite;

  /**
   * ⚠ On ne garde QUE les champs attendus. Un corps qui porterait
   * `SUPABASE_SERVICE_ROLE_KEY` ou n'importe quoi d'autre le verrait rejeté
   * ici — on ne stocke pas ce qu'on n'a pas demandé, même chiffré.
   */
  const brut = (body.valeurs ?? {}) as Record<string, unknown>;
  const valeurs: Record<string, string> = {};
  for (const champ of CHAMPS_ATTENDUS[capacite]) {
    const v = brut[champ];
    if (typeof v === "string" && v.trim()) valeurs[champ] = v.trim();
  }
  if (Object.keys(valeurs).length === 0) {
    return NextResponse.json({ error: "Aucune valeur exploitable." }, { status: 400 });
  }

  const candidat = moteurDepuisValeurs(valeurs);
  if (!moteurUtilisable(candidat)) {
    return NextResponse.json(
      { error: "Il manque une clé : renseigne au moins ANTHROPIC_API_KEY ou NVIDIA_API_KEY." },
      { status: 400 }
    );
  }

  // ── La vérification : un VRAI appel, court, avant de croire la clé ──
  let echec: string | null = null;
  try {
    const { text } = await runAI(
      [{ role: "user", content: "Réponds exactement : OK" }],
      candidat,
      { maxTokens: 8, temperature: 0 }
    );
    if (!text.trim()) echec = "Le fournisseur a répondu, mais vide.";
  } catch (e) {
    echec = e instanceof Error ? e.message : "appel refusé";
  }
  if (echec) {
    return NextResponse.json(
      { error: `La clé n'a pas répondu — rien n'est enregistré. Détail : ${echec}` },
      { status: 422 }
    );
  }

  const chiffre = chiffrer(valeurs);
  if (!chiffre) {
    /**
     * ⚠ Pas de clé maître ⇒ on REFUSE. On ne stocke pas en clair « en
     * attendant » : un secret de client rangé en clair ne se rattrape pas,
     * et personne ne repasserait jamais derrière.
     */
    return NextResponse.json(
      { error: "Le serveur ne peut pas chiffrer (CREDENTIALS_MASTER_KEY absente). Rien n'est enregistré." },
      { status: 503 }
    );
  }

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ error: "Base indisponible." }, { status: 503 });

  const secretPrincipal = valeurs.ANTHROPIC_API_KEY ?? valeurs.NVIDIA_API_KEY ?? "";
  const { error } = await sb.from("tenant_credentials").upsert({
    tenant_id: droits.tenantId,
    capacite,
    secret_chiffre: chiffre.secretChiffre,
    nonce: chiffre.nonce,
    cle_version: 1,
    empreinte: empreinteVisible(secretPrincipal),
    verifie_le: new Date().toISOString(),
    dernier_echec: null,
  });
  if (error) return NextResponse.json({ error: "Enregistrement refusé par la base." }, { status: 502 });

  return NextResponse.json({ ok: true, empreinte: empreinteVisible(secretPrincipal) });
}

export async function DELETE(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.tenantId) return NextResponse.json({ error: "Connecte-toi." }, { status: 401 });

  const capacite = req.nextUrl.searchParams.get("capacite");
  if (!estCapacite(capacite)) return NextResponse.json({ error: "Capacité inconnue." }, { status: 400 });

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ error: "Base indisponible." }, { status: 503 });

  await sb.from("tenant_credentials").delete().eq("tenant_id", droits.tenantId).eq("capacite", capacite);
  return NextResponse.json({ ok: true });
}
