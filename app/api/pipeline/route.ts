import { NextResponse } from "next/server";
import { pipelineJuillet } from "@/lib/pipeline-juillet";
import { PROSPECTS_ICP_CSV } from "@/lib/prospects-icp";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES JEUX DE DONNÉES RÉELS — servis, jamais embarqués.
 *
 * ── CE QU'ON A TROUVÉ ──
 *
 * `lib/store.ts` chargeait ces deux fichiers par `require()` dans une action
 * (« charger le pipeline de juillet », « importer les prospects ICP »). Un
 * `require()` de chemin statique n'est pas paresseux pour le bundler : le
 * module part quand même dans le chunk client. Mesuré sur le build : le nom,
 * l'adresse et le NUMÉRO DE TÉLÉPHONE de seize entreprises réelles étaient
 * lisibles dans un fichier JavaScript téléchargeable sans mot de passe, avec
 * leur étape de vente et leur montant de deal.
 *
 * Ce n'est plus une fuite commerciale, c'est une fuite de données
 * personnelles de tiers qui n'ont rien demandé — et elle serait à déclarer.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware). Elle sert
 * l'opérateur qui clique, pas le navigateur qui charge une page.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: Request) {
  const quoi = new URL(req.url).searchParams.get("jeu");

  if (quoi === "juillet") {
    const { prospects, meetings } = pipelineJuillet();
    return NextResponse.json({ prospects, meetings });
  }
  if (quoi === "icp") {
    return NextResponse.json({ csv: PROSPECTS_ICP_CSV });
  }
  return NextResponse.json({ error: "Jeu de données inconnu." }, { status: 400 });
}
