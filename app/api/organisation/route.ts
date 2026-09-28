import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { estMaitre } from "@/lib/entitlements";
import {
  filtrerExploitation,
  peutVoirExploitation,
  type CompteOrg,
  type RoleCompte,
} from "@/lib/organisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * MON ÉQUIPE — qui m'est rattaché, et où ils en sont.
 *
 * ⚠ CETTE ROUTE NE REND QUE DE L'EXPLOITATION, JAMAIS DU CONTENU.
 *
 * Des compteurs et des états : combien de fiches, quel statut d'abonnement,
 * quelle dernière activité. Aucun nom de prospect, aucun téléphone, aucun
 * email, aucun montant de deal — même pour un responsable qui a pourtant le
 * droit au contenu de ses membres.
 *
 * La raison n'est pas un scrupule, c'est une question de surface : le contenu
 * d'un membre se lit là où il se lit déjà, par la synchro du pipe, avec la RLS
 * en face. Le faire transiter EN PLUS par cette route-ci créerait un second
 * chemin vers les mêmes données — donc un second endroit où se tromper, et
 * celui-là ne serait couvert par aucune politique SQL.
 *
 * ⚠⚠ ET LE FILTRE EST EN SORTIE, pas dans la requête. `filtrerExploitation`
 * est une LISTE BLANCHE appliquée juste avant `NextResponse.json` — le dernier
 * point par lequel tout passe. Filtrer uniquement dans le `select` SQL marche
 * jusqu'au jour où quelqu'un ajoute une colonne pendant un débogage et oublie
 * de la retirer ; le filtre de sortie, lui, ne connaît que ce qu'on a autorisé
 * une fois pour toutes.
 * ─────────────────────────────────────────────────────────────────────
 */

interface LigneOrg {
  tenant_id: string;
  role: string;
  parent_id: string | null;
  libelle: string | null;
}

const ROLES: readonly RoleCompte[] = ["maitre", "responsable", "membre"];
const versRole = (v: string): RoleCompte => (ROLES.includes(v as RoleCompte) ? (v as RoleCompte) : "membre");

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req);
  if (!tenant?.id) {
    return NextResponse.json({ error: "Aucune session." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  /**
   * ⚠ SANS SERVICE ROLE, ON NE SAIT RIEN — ET ON LE DIT.
   *
   * Rendre une équipe vide ferait croire à un responsable qu'il n'a plus de
   * commerciaux : le pire des deux mondes, parce qu'il agirait dessus (il en
   * recréerait, ou il appellerait le support). `configure: false` distingue
   * « je n'ai personne » de « je ne peux pas regarder ».
   */
  if (!url || !key) {
    return NextResponse.json({ configure: false, moi: null, membres: [] });
  }

  const lire = async (filtre: string): Promise<LigneOrg[]> => {
    const r = await fetch(`${url}/rest/v1/organisation?select=tenant_id,role,parent_id,libelle&${filtre}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) return [];
    return (await r.json()) as LigneOrg[];
  };

  try {
    const [ligne] = await lire(`tenant_id=eq.${encodeURIComponent(tenant.id)}&limit=1`);

    /**
     * ⚠ AUCUNE LIGNE = « responsable SANS membre », pas une erreur.
     *
     * C'est l'état de tout compte créé librement : personne ne l'a rattaché à
     * qui que ce soit. Le traiter comme une anomalie afficherait un message
     * d'erreur à quelqu'un dont le compte va parfaitement bien.
     *
     * ⚠⚠ Le rôle « maitre » ne se lit PAS dans cette table, il se déduit de
     * l'email du JETON (`estMaitre`). Une élévation de privilège ne doit
     * jamais passer par une valeur que le produit écrit — la colonne `role`
     * est descriptive, la décision est ailleurs, et c'est délibéré.
     */
    const moi: CompteOrg = estMaitre(tenant.email)
      ? { id: tenant.id, role: "maitre", parentId: null }
      : ligne
        ? { id: ligne.tenant_id, role: versRole(ligne.role), parentId: ligne.parent_id }
        : { id: tenant.id, role: "responsable", parentId: null };

    const brut = moi.role === "membre" ? [] : await lire(`parent_id=eq.${encodeURIComponent(tenant.id)}`);

    /**
     * ⚠ ON REPASSE PAR `peutVoirExploitation` LIGNE PAR LIGNE, alors que la
     * requête a déjà filtré sur `parent_id`. Ce n'est pas de la redondance
     * décorative : la requête dit ce qu'on a DEMANDÉ, la règle dit ce qu'on a
     * le DROIT de voir. Le jour où quelqu'un élargit le filtre SQL — pour
     * ajouter une recherche, pour déboguer — c'est cette boucle qui tient.
     */
    const membres = brut
      .map((l) => ({
        compte: { id: l.tenant_id, role: versRole(l.role), parentId: l.parent_id } satisfies CompteOrg,
        libelle: l.libelle,
      }))
      .filter(({ compte }) => peutVoirExploitation(moi, compte))
      .map(({ compte, libelle }) =>
        filtrerExploitation({
          tenantId: compte.id,
          role: compte.role,
          parentId: compte.parentId,
          // Le libellé est un nom d'usage saisi par le responsable pour SES
          // commerciaux (« Sofiane — secteur nord »). Il n'appartient pas à
          // l'exploitation : il se rend à côté, jamais dedans.
        })
      )
      .map((vue, i) => ({ ...vue, libelle: brut[i]?.libelle ?? null }));

    return NextResponse.json({
      configure: true,
      moi: filtrerExploitation({ tenantId: moi.id, role: moi.role, parentId: moi.parentId }),
      membres,
    });
  } catch {
    // Base injoignable : même raisonnement que l'absence de service role. On
    // ne prétend pas qu'il n'y a personne.
    return NextResponse.json({ configure: false, moi: null, membres: [] });
  }
}
