import { NextResponse } from "next/server";
import { fetchSitePage, safePublicUrl, type PageBrute } from "@/lib/site-fetch";
import { lireSite, pagesUtiles, propositionDepuisLecture, type Registre } from "@/lib/lecture-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « DONNE TON SITE, ALPHA SE CONFIGURE » — la lecture, côté serveur.
 *
 * Le navigateur ne peut pas lire un site tiers (CORS) : c'est ici qu'on va
 * chercher l'accueil, puis au plus trois pages internes (contact, mentions
 * légales, à propos). La lecture elle-même est pure (`lib/lecture-site.ts`) ;
 * cette route ne fait que transporter.
 *
 * ⚠ ELLE NE DÉPENSE RIEN CHEZ NOUS : aucun modèle, aucun crédit — des
 * requêtes HTTP vers le site de l'inscrit et, si un SIREN y est écrit, une
 * vers le registre public. D'où son chemin gratuit (`/settings`) : c'est le
 * premier geste d'un compte qui n'a encore rien acheté.
 *
 * ⚠ ELLE NE LIT QUE CE SITE. Même hôte, quatre pages au plus, garde-fou SSRF
 * rejoué à chaque redirection (`fetchSitePage`). Ce n'est pas un aspirateur :
 * c'est le site de la personne connectée, qu'elle a elle-même tapé.
 *
 * ⚠ ELLE N'ÉCRIT RIEN. Elle rend une lecture et une proposition ; c'est
 * l'écran qui les montre, l'inscrit qui valide, le store qui applique.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Le registre national (API publique, sans clé) — pour la raison sociale et
 * la ville du siège.
 *
 * ⚠ Une panne du registre ne fait pas tomber la lecture : on rend `null` et
 * le site suffit. Ce n'est qu'un recoupement.
 */
async function lireRegistre(siren: string): Promise<Registre | null> {
  try {
    const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { siren?: string; nom_complet?: string; siege?: { libelle_commune?: string } }[];
    };
    const r = json.results?.find((x) => x.siren === siren);
    if (!r?.nom_complet) return null;
    return { raisonSociale: r.nom_complet.slice(0, 80), ville: (r.siege?.libelle_commune ?? "").slice(0, 40) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url : "";
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }
  const sure = safePublicUrl(url);
  if (!sure) {
    return NextResponse.json({ error: "Adresse de site non valide — par exemple : monentreprise.fr" }, { status: 400 });
  }

  let accueil: PageBrute;
  try {
    accueil = await fetchSitePage(sure);
  } catch (e) {
    return NextResponse.json(
      { error: `Impossible de lire ce site : ${e instanceof Error ? e.message : "erreur inconnue"}` },
      { status: 422 }
    );
  }

  // Les pages internes en parallèle ; une page qui échoue n'empêche rien.
  const suivantes = await Promise.allSettled(pagesUtiles(accueil.url, accueil.html).map((u) => fetchSitePage(u)));
  const pages = [accueil, ...suivantes.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))];

  const lecture = lireSite(pages);
  if (lecture.siren) lecture.registre = await lireRegistre(lecture.siren.valeur);

  return NextResponse.json({ lecture, proposition: propositionDepuisLecture(lecture) });
}
