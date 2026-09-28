/**
 * ─────────────────────────────────────────────────────────────────────
 * LES DEUX LISTES D'EMAILS PROPRIÉTAIRES DOIVENT CONCORDER.
 *
 * `OWNER_EMAILS` est lu par le SERVEUR (`lib/entitlements.ts` → `estMaitre`,
 * donc la barrière du middleware). `NEXT_PUBLIC_OWNER_EMAILS` est lu par le
 * NAVIGATEUR (`lib/billing.ts` → ce que l'écran affiche). Deux variables,
 * deux fichiers, deux moments — et rien ne les rapprochait.
 *
 * ⚠ CE QUE LA DIVERGENCE PRODUIT. Elle ne plante pas, elle MENT :
 *
 *  · l'email est dans la liste PUBLIQUE seulement → l'écran te traite en
 *    propriétaire, affiche le panneau opérateur et les boutons d'admin,
 *    et le serveur répond 403 à chaque clic. On croit à une panne.
 *
 *  · l'email est dans la liste SERVEUR seulement → l'inverse, plus discret :
 *    tout marche, mais l'interface masque des commandes auxquelles on a
 *    droit. On ne le découvre jamais, on croit que la fonction n'existe pas.
 *
 * Aucun test ne peut attraper ça : ce sont des VALEURS d'environnement, pas
 * du code. Il faut donc le vérifier au moment où l'environnement existe —
 * c'est-à-dire à l'exécution, dans la sonde de diagnostic.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Normalise une liste « a@x.fr, @y.fr » en ensemble comparable. */
export function listeEmails(brut: string | undefined | null): string[] {
  return (brut ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

export interface CoherenceProprietaire {
  /** Les deux listes portent-elles exactement la même chose ? */
  coherent: boolean;
  /** Au moins une des deux est-elle remplie ? */
  configure: boolean;
  /** Présents côté serveur uniquement — droits réels, interface muette. */
  serveurSeul: string[];
  /** Présents côté navigateur uniquement — interface qui promet, serveur qui refuse. */
  navigateurSeul: string[];
  /** Ce qu'il faut faire, en clair. Vide si tout va bien. */
  quoiFaire: string;
}

export function verifierProprietaire(
  serveur: string | undefined | null,
  navigateur: string | undefined | null
): CoherenceProprietaire {
  const s = listeEmails(serveur);
  const n = listeEmails(navigateur);
  const serveurSeul = s.filter((e) => !n.includes(e));
  const navigateurSeul = n.filter((e) => !s.includes(e));
  const configure = s.length > 0 || n.length > 0;
  const coherent = serveurSeul.length === 0 && navigateurSeul.length === 0;

  let quoiFaire = "";
  if (!configure) {
    /**
     * Le cas le plus dangereux, et le plus silencieux : PERSONNE n'est
     * maître. Toutes les routes réservées au propriétaire répondent 403 — y
     * compris pour le propriétaire. Rien ne plante, tout refuse.
     */
    quoiFaire =
      "Aucun compte propriétaire : renseigne OWNER_EMAILS et NEXT_PUBLIC_OWNER_EMAILS " +
      "avec la même valeur. Sans elles, personne n'est maître — /payouts, /offre et les " +
      "routes du patrimoine (/api/pipeline, /api/voice-costs, /api/knowledge) répondent 403 à tout le monde.";
  } else if (navigateurSeul.length) {
    /**
     * ⚠ ON NE RECRACHE PAS LES ADRESSES. Ce message part dans la sonde de
     * diagnostic — protégée, mais une adresse email reste une donnée
     * personnelle, et un diagnostic n'a pas besoin de la citer pour être
     * actionnable : la personne qui lit a l'environnement sous les yeux.
     */
    quoiFaire =
      `${navigateurSeul.length} adresse(s) dans NEXT_PUBLIC_OWNER_EMAILS absente(s) d'OWNER_EMAILS. ` +
      "L'écran les traitera en propriétaires et le serveur refusera chaque action — ça ressemble à une panne.";
  } else if (serveurSeul.length) {
    quoiFaire =
      `${serveurSeul.length} adresse(s) dans OWNER_EMAILS absente(s) de NEXT_PUBLIC_OWNER_EMAILS. ` +
      "Les droits sont réels mais l'interface masque les commandes correspondantes — le plus dur à repérer.";
  }

  return { coherent, configure, serveurSeul, navigateurSeul, quoiFaire };
}
