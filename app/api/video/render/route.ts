import { NextRequest, NextResponse } from "next/server";
import { debiterLaRequete } from "@/lib/credentials-secret";
import {
  renderJson2Video,
  pollJson2Video,
  textToVideo,
  buildSimpleMovie,
  json2videoConfigured,
  textToVideoConfigured,
} from "@/lib/video-gen";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Lance / sonde un rendu vidéo pour le contenu social.
 *
 *   POST { lines:[…] }            → json2video (gabarit simple)
 *   POST { movie:{…} }            → json2video (movie JSON complet)
 *   POST { prompt:"…" }           → endpoint text-to-video (HunyuanVideo hébergé)
 *   GET  ?project=<id>            → état du rendu json2video
 *
 * Rien de configuré → 503 franc (la fonctionnalité est optionnelle).
 */
export async function POST(req: NextRequest) {
  let body: { lines?: string[]; movie?: Record<string, unknown>; prompt?: string; subtitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  /**
   * ⚠⚠ LES DEUX VOIES DÉPENSENT, ET AUCUNE NE DÉBITAIT.
   *
   * `textToVideo` frappe un endpoint GPU, `renderJson2Video` consomme nos
   * crédits. Ni l'un ni l'autre n'a de chemin BYOK : il n'existe aucun moyen
   * qu'un locataire apporte notre carte. La dépense nous revient toujours.
   *
   * Le débit est posé ICI, avant les deux branches, plutôt que dans chacune :
   * une route qui débite à deux endroits finit par n'en débiter qu'un, le jour
   * où quelqu'un ajoute une troisième voie.
   *
   * ⚠ Un rendu coûte l'ordre de grandeur d'une centaine d'emails. Le mettre au
   * même prix laisserait un essai produire trente vidéos sans que l'enveloppe
   * bouge d'un centime.
   */
  if (!(await debiterLaRequete(req, "video"))) {
    return NextResponse.json(
      {
        error:
          "Plafond d'essai atteint — aucun rendu vidéo ne part. Passe à l'abonnement pour continuer.",
        code: "plafond_essai",
      },
      { status: 402 }
    );
  }

  // Voie text-to-video (endpoint GPU type HunyuanVideo) si un prompt est fourni.
  if (body.prompt?.trim()) {
    if (!textToVideoConfigured()) {
      return NextResponse.json(
        { error: "Aucun endpoint text-to-video — configure VIDEO_GEN_ENDPOINT (HunyuanVideo hébergé / Replicate)." },
        { status: 503 }
      );
    }
    return NextResponse.json(await textToVideo(body.prompt.trim()));
  }

  // Voie json2video (gabarit) — la voie gratuite qui marche sans GPU.
  if (!json2videoConfigured()) {
    return NextResponse.json(
      { error: "Rendu vidéo non configuré — ajoute JSON2VIDEO_API_KEY (offre gratuite)." },
      { status: 503 }
    );
  }
  const movie =
    body.movie ??
    (Array.isArray(body.lines) && body.lines.length
      ? buildSimpleMovie(body.lines.map(String), { subtitle: body.subtitle })
      : null);
  if (!movie) {
    return NextResponse.json({ error: "Fournis lines[], movie{} ou prompt." }, { status: 400 });
  }
  return NextResponse.json(await renderJson2Video(movie));
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ CE `GET` NE DÉBITE PAS, ET IL NE DOIT JAMAIS DÉBITER.
 *
 * Il interroge l'état d'un rendu **déjà lancé et déjà payé**. Le débiter
 * serait facturer deux fois la même dépense ; le REFUSER serait pire — le
 * rendu a été produit, il nous a coûté, et on s'interdirait d'aller le
 * chercher. On paierait pour rien.
 *
 * C'est le piège exact qu'une session suivante tendra en « complétant » le
 * travail : la route dépense côté POST, donc son GET aurait l'air d'avoir été
 * oublié. Il ne l'est pas. **Un plafond borne ce qu'on ENGAGE, jamais ce qu'on
 * récupère de ce qui est déjà engagé.**
 *
 * Même raisonnement que `depense: false` sur `/api/health` et
 * `/api/deliverability/dns` : ces routes lisent un état, elles ne le créent pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  if (!project) return NextResponse.json({ error: "paramètre project requis" }, { status: 400 });
  if (!json2videoConfigured()) {
    return NextResponse.json({ error: "Rendu vidéo non configuré." }, { status: 503 });
  }
  return NextResponse.json(await pollJson2Video(project));
}
