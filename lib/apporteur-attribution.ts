/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI A AMENÉ CE CLIENT — l'attribution, séparée du versement.
 *
 * `lib/apporteur.ts` savait déjà calculer COMBIEN revient à un apporteur
 * (30 % du setup, 10 % du mensuel pendant 12 mois) et s'il est en état d'être
 * payé (SIRET bien formé + contrat signé). Il ne savait pas À QUI : rien ne
 * reliait un client à celui qui l'a amené. Le modèle de commission tournait
 * donc à vide — un calcul juste sur un lien inexistant.
 *
 * ══ LES QUATRE RÈGLES, ET CHACUNE FERME UN ABUS PRÉCIS ══
 *
 * 1. **L'ATTRIBUTION N'EST PAS UNE AUTORISATION.** Un code ne donne aucun
 *    droit, n'ouvre aucune brique, ne déclenche aucun paiement. Il enregistre
 *    une revendication. Le versement reste gouverné par `statutApporteur` —
 *    sans SIRET et sans contrat, on compte et on ne verse pas. Confondre les
 *    deux ferait d'une chaîne de caractères devinable un moyen de se faire
 *    payer.
 *
 * 2. **PREMIÈRE ATTRIBUTION GAGNE, ET ELLE EST DÉFINITIVE.** Le réflexe du
 *    marché est le « dernier clic » ; il est indéfendable ici. Un apport
 *    d'affaires, c'est quelqu'un qui a fait une présentation — pas le
 *    propriétaire du dernier lien cliqué. Surtout : une attribution
 *    modifiable est une attribution VOLABLE. Il suffirait d'envoyer son lien
 *    à un client déjà signé pour capter la commission de quelqu'un d'autre,
 *    et personne ne le verrait. L'immuabilité n'est pas de la rigidité, c'est
 *    ce qui rend le registre crédible.
 *
 * 3. **ON NE S'ATTRIBUE PAS SOI-MÊME.** Un apporteur qui ouvre un compte avec
 *    son propre code se commissionnerait sur lui-même. Refusé explicitement,
 *    et pas en silence : le refus se dit, sinon on croit que ça a marché.
 *
 * 4. **UN CODE INCONNU NE VAUT PAS ATTRIBUTION.** Il rend `null`, jamais un
 *    repli « au hasard » ni le dernier apporteur créé. Une mauvaise
 *    attribution coûte plus cher que pas d'attribution du tout : elle paie la
 *    mauvaise personne ET fâche la bonne, et rien ne la signale.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'alphabet des codes — Crockford base32, amputé de ce qui se confond.
 *
 * ⚠ Ni `I`, ni `L`, ni `O`, ni `U`. Les trois premières se lisent comme `1` et
 * `0` sur un post-it ou dans une police sans empattement ; `U` est retiré
 * parce qu'il permet de composer des mots qu'on n'a pas envie d'imprimer sur
 * une carte de visite. Un code d'apport se DICTE au téléphone : chaque
 * confusion possible est une commission attribuée à côté.
 */
export const ALPHABET_CODE = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Longueur d'un code. 8 caractères dans cet alphabet ≈ 10^12 combinaisons. */
export const LONGUEUR_CODE = 8;

const MOTIF_CODE = new RegExp(`^[${ALPHABET_CODE}]{${LONGUEUR_CODE}}$`);

/**
 * Nettoie un code tel qu'il a été SAISI ou collé.
 *
 * ⚠ Les confusions se corrigent ici, pas dans la tête de celui qui tape :
 * `I`/`L` → `1`, `O` → `0`. Quelqu'un qui recopie un code depuis une capture
 * d'écran fait exactement ces fautes-là, et lui rendre « code inconnu » le
 * fait abandonner sans qu'on sache jamais qu'il a essayé.
 *
 * Les espaces et tirets sautent : un code se lit souvent par groupes.
 */
export function normaliseCode(brut: string | null | undefined): string | null {
  const s = (brut ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  return MOTIF_CODE.test(s) ? s : null;
}

/**
 * Engendre un code depuis une source d'aléa fournie.
 *
 * ⚠ L'ALÉA EST UN PARAMÈTRE, et ce n'est pas du purisme. Un module qui
 * appellerait `crypto` lui-même serait intestable : on ne pourrait pas
 * vérifier que la sortie appartient bien à l'alphabet sans relancer mille
 * fois en espérant tomber sur le cas qui casse. Ici le test injecte ce qu'il
 * veut, y compris les bornes.
 *
 * ⚠⚠ CE CODE N'EST PAS UN SECRET, et le dire évite qu'on s'appuie dessus.
 * Il est court, il se dicte, il finit sur des cartes de visite. Sa seule
 * propriété est d'être **peu devinable au hasard** — et même deviné, il ne
 * donne rien (règle 1) : il revendique, il n'autorise pas.
 */
export function engendreCode(alea: () => number): string {
  let out = "";
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    const n = Math.floor(alea() * ALPHABET_CODE.length);
    // Une source d'aléa qui rend 1 (ou plus) sortirait de l'alphabet.
    out += ALPHABET_CODE[Math.min(ALPHABET_CODE.length - 1, Math.max(0, n))];
  }
  return out;
}

/** Le registre, tel que le serveur le connaît. */
export interface CodeApporteur {
  code: string;
  /** Le compte Alpha de l'apporteur (`auth.users.id`). */
  apporteurId: string;
  /** Un code retiré ne s'efface pas : il cesse d'attribuer. */
  actif: boolean;
}

export type RefusAttribution =
  /** Aucun code fourni — le cas normal d'une inscription directe. */
  | "aucun-code"
  /** La chaîne ne ressemble pas à un code (faute de frappe, lien tronqué). */
  | "code-malforme"
  /** Le code est bien formé mais n'existe pas, ou a été retiré. */
  | "code-inconnu"
  /** L'apporteur tentait de s'attribuer son propre compte. */
  | "auto-attribution"
  /** Ce compte a DÉJÀ un apporteur : la première attribution est définitive. */
  | "deja-attribue";

export interface ResultatAttribution {
  /** L'apporteur retenu, ou `null`. Jamais un repli inventé. */
  apporteurId: string | null;
  /** Le code effectivement enregistré (normalisé), ou `null`. */
  code: string | null;
  /** Pourquoi rien n'a été attribué. `null` quand l'attribution a eu lieu. */
  refus: RefusAttribution | null;
  /** Ce qu'on affiche — un refus muet se lit comme un succès. */
  message: string;
}

/**
 * Décide de l'attribution d'un compte, une fois pour toutes.
 *
 * Pure et déterministe : elle ne lit rien, n'écrit rien, et rend le même
 * verdict deux fois de suite. C'est l'appelant qui persiste — et qui doit
 * refuser d'écrire si `apporteurId` est `null`.
 */
export function attribuer(entree: {
  /** La chaîne brute reçue du navigateur (`?ref=…`). */
  codeBrut: string | null | undefined;
  /** Le compte qui vient de s'inscrire. */
  nouveauCompteId: string;
  /** L'attribution DÉJÀ enregistrée pour ce compte, s'il y en a une. */
  attributionExistante?: string | null;
  /** Le registre des codes connus. */
  registre: CodeApporteur[];
}): ResultatAttribution {
  const { codeBrut, nouveauCompteId, attributionExistante, registre } = entree;

  /**
   * ⚠ L'EXISTANT SE VÉRIFIE AVANT LE CODE, et l'ordre est le correctif.
   * Tester le code d'abord laisserait croire qu'un code valide « aurait pu »
   * réattribuer ; ici, un compte déjà attribué est clos, quel que soit ce qui
   * arrive ensuite. C'est la règle 2, et elle doit être la première porte.
   */
  if (attributionExistante) {
    return {
      apporteurId: null,
      code: attributionExistante,
      refus: "deja-attribue",
      message:
        "Ce compte a déjà un apporteur, et une attribution ne se réécrit pas. " +
        "Si c'était une erreur, elle se corrige à la main et ça se voit — c'est voulu : " +
        "une attribution modifiable est une attribution volable.",
    };
  }

  if (!codeBrut || !codeBrut.trim()) {
    return { apporteurId: null, code: null, refus: "aucun-code", message: "Inscription directe : aucun apporteur." };
  }

  const code = normaliseCode(codeBrut);
  if (!code) {
    return {
      apporteurId: null,
      code: null,
      refus: "code-malforme",
      message: "Ce code d'apport n'a pas la bonne forme. Vérifie la saisie — un lien tronqué donne ce résultat.",
    };
  }

  const entree_ = registre.find((c) => c.code === code && c.actif);
  if (!entree_) {
    return {
      apporteurId: null,
      code: null,
      refus: "code-inconnu",
      message:
        "Code d'apport inconnu ou retiré. Le compte est créé normalement, sans apporteur : " +
        "attribuer au hasard paierait la mauvaise personne et fâcherait la bonne.",
    };
  }

  if (entree_.apporteurId === nouveauCompteId) {
    return {
      apporteurId: null,
      code: null,
      refus: "auto-attribution",
      message: "On ne s'attribue pas son propre compte : la commission se verse sur un client amené, pas sur soi.",
    };
  }

  return {
    apporteurId: entree_.apporteurId,
    code,
    refus: null,
    message: "Apporteur enregistré. Le versement, lui, reste soumis au SIRET et au contrat signé.",
  };
}

/**
 * Le paramètre d'URL qui porte le code.
 *
 * ⚠ `ref` et pas `utm_source` : les paramètres `utm_*` sont mangés par les
 * outils d'analyse, réécrits par les partages, et `lib/tracking.ts` en traite
 * déjà certains. Un nom à nous, lu à un seul endroit.
 */
export const PARAM_PARRAINAGE = "ref";

/**
 * Extrait un code d'une URL d'arrivée.
 *
 * ⚠ Elle rend `null` sur tout ce qui n'est pas un code valide — y compris une
 * URL illisible. Une exception ici ferait tomber la page d'arrivée d'un
 * prospect pour un paramètre mal formé, ce qui coûte infiniment plus cher que
 * l'attribution qu'on perd.
 */
export function codeDepuisUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://exemple.invalid");
    return normaliseCode(u.searchParams.get(PARAM_PARRAINAGE));
  } catch {
    return null;
  }
}


/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MÉMOIRE DU CODE, CÔTÉ NAVIGATEUR.
 *
 * ⚠ CE BLOC VIVAIT DANS `components/capture-parrainage.tsx`, ET LE TEST N'A
 * PAS PU LE CHARGER. La convention du dépôt est explicite — « modules purs et
 * testables dans `lib/` » — et la sanction est tombée immédiatement : un
 * `.tsx` client n'est pas chargeable depuis `node:test`. La règle n'est donc
 * pas une préférence de rangement : c'est ce qui rend la logique vérifiable.
 *
 * Le composant ne garde que le montage.
 * ─────────────────────────────────────────────────────────────────────
 */

/** La clé de stockage. Stable : la changer perd les captures en cours. */
export const CLE_PARRAINAGE = "alpha-parrainage";

/**
 * Mémorise un code d'apport s'il y en a un dans l'URL.
 *
 * ⚠ **LE PREMIER CODE VU GAGNE, et c'est le pendant local de l'immuabilité
 * côté serveur.** Sans ce garde, un prospect qui arrive par l'apporteur A
 * puis retombe sur un lien de l'apporteur B avant de s'inscrire serait
 * attribué à B. Le serveur refuserait la réattribution d'un compte déjà
 * attribué, mais ici le compte n'existe pas encore : il n'y a rien à
 * protéger côté serveur, et c'est donc AU NAVIGATEUR de ne pas écraser.
 *
 * ⚠ Tout est enveloppé : `localStorage` jette en navigation privée sur
 * certains navigateurs, et une capture d'attribution ratée ne doit jamais
 * faire tomber la page d'arrivée d'un prospect. Perdre une commission coûte
 * moins cher que perdre le visiteur.
 */
export function memoriseParrainage(url: string, stockage?: Storage): "memorise" | "deja" | "aucun" {
  const code = codeDepuisUrl(url);
  if (!code) return "aucun";
  try {
    const s = stockage ?? window.localStorage;
    if (s.getItem(CLE_PARRAINAGE)) return "deja";
    s.setItem(CLE_PARRAINAGE, code);
    return "memorise";
  } catch {
    return "aucun";
  }
}

/** Le code mémorisé, à joindre à l'inscription. `null` si aucun. */
export function parrainageMemorise(stockage?: Storage): string | null {
  try {
    return (stockage ?? window.localStorage).getItem(CLE_PARRAINAGE);
  } catch {
    return null;
  }
}

/**
 * ⚠ NE S'APPELLE QU'APRÈS UNE ATTRIBUTION CONFIRMÉE PAR LE SERVEUR.
 *
 * Effacer dès l'envoi perdrait le code si la requête échoue — et le prospect
 * n'a alors aucun moyen de savoir qu'il vient de coûter une commission à
 * celui qui l'a amené.
 */
export function oublieParrainage(stockage?: Storage): void {
  try {
    (stockage ?? window.localStorage).removeItem(CLE_PARRAINAGE);
  } catch {
    /* rien à faire : le code sera simplement renvoyé la prochaine fois */
  }
}
