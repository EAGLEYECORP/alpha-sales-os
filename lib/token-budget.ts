/**
 * ─────────────────────────────────────────────────────────────────────
 * JETONS — ce que coûte chaque appel au modèle, et comment payer moins.
 *
 * Le contexte envoyé au modèle est le poste qui grossit tout seul : le
 * Cerveau s'enrichit, les fiches accumulent des événements, les
 * transcriptions s'empilent. Un prompt qui coûtait 2 000 jetons en juillet
 * en coûte 20 000 en janvier, et rien ne prévient — la facture arrive un
 * mois plus tard, agrégée, sans dire d'où elle vient.
 *
 * Trois leviers, du plus rentable au moins rentable :
 *
 *  1. NE PAS ENVOYER. Un contexte non pertinent ne coûte pas seulement de
 *     l'argent : il DILUE. Un modèle qui lit 30 000 jetons dont 2 000
 *     utiles répond moins bien qu'un modèle qui en lit 2 000.
 *  2. DÉDUPLIQUER. Le même bloc de doctrine réécrit dans trois sections
 *     est payé trois fois.
 *  3. BORNER. Un plafond par appel transforme une facture surprise en
 *     réponse dégradée mais prévisible — et une réponse dégradée se voit,
 *     contrairement à une facture.
 *
 * ── SUR L'ESTIMATION ──
 *
 * Compter les jetons exactement demande le tokenizer du modèle. On ne
 * l'embarque pas (poids, dépendance, et il change avec le modèle). Le
 * ratio utilisé ici est calibré sur du FRANÇAIS, plus coûteux que
 * l'anglais : ~3,6 caractères par jeton contre ~4. C'est une ESTIMATION,
 * elle est marquée comme telle partout, et elle sert à décider — pas à
 * facturer.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Caractères par jeton, en français. Anglais ≈ 4, français ≈ 3,6. */
export const CHARS_PAR_JETON = 3.6;

/** Estimation du nombre de jetons d'un texte. Volontairement prudente. */
export function estimeJetons(texte: string): number {
  if (!texte) return 0;
  return Math.ceil(texte.length / CHARS_PAR_JETON);
}

export interface Bloc {
  /** Nom du bloc — sert au rapport, pour savoir QUOI couper. */
  nom: string;
  texte: string;
  /**
   * Priorité : 1 = jamais coupé (doctrine, règles de sécurité),
   * 2 = coupé en dernier, 3 = coupé en premier (contexte d'appoint).
   */
  priorite: 1 | 2 | 3;
}

export interface BudgetResultat {
  /** Le prompt assemblé, tenant dans le budget. */
  texte: string;
  jetons: number;
  budget: number;
  /** Ce qui a été retiré, et de combien — pour pouvoir en discuter. */
  coupes: { nom: string; jetonsRetires: number }[];
  /** Blocs identiques détectés et fusionnés. */
  doublons: string[];
}

/**
 * Assemble des blocs en respectant un budget de jetons.
 *
 * L'ordre de coupe suit la priorité, PAS la taille : couper le plus gros
 * bloc est le réflexe naturel et c'est souvent le mauvais — le plus gros
 * est fréquemment l'état du pipeline, dont le modèle a besoin pour ne pas
 * inventer de chiffres.
 *
 * Un bloc de priorité 1 n'est JAMAIS coupé. Si les blocs de priorité 1
 * dépassent à eux seuls le budget, on les rend quand même : mieux vaut
 * dépasser en le signalant que produire une réponse qui a perdu ses règles
 * de sécurité.
 */
export function assemble(blocs: Bloc[], budget: number): BudgetResultat {
  const coupes: BudgetResultat["coupes"] = [];
  const doublons: string[] = [];

  // 1. Dédupliquer — un bloc identique répété est payé plusieurs fois.
  const vus = new Map<string, string>();
  const uniques: Bloc[] = [];
  for (const b of blocs) {
    const cle = b.texte.trim();
    if (!cle) continue;
    const deja = vus.get(cle);
    if (deja) {
      doublons.push(`${b.nom} (identique à ${deja})`);
      continue;
    }
    vus.set(cle, b.nom);
    uniques.push(b);
  }

  const total = () => uniques.reduce((s, b) => s + estimeJetons(b.texte), 0);

  // 2. Couper, du moins prioritaire au plus prioritaire.
  for (const niveau of [3, 2] as const) {
    if (total() <= budget) break;
    for (const b of uniques) {
      if (b.priorite !== niveau) continue;
      if (total() <= budget) break;

      const excedent = total() - budget;
      const jetonsBloc = estimeJetons(b.texte);

      if (jetonsBloc <= excedent) {
        // Le bloc entier saute : le tronquer au tiers produirait un texte
        // coupé en plein milieu, que le modèle complèterait au hasard.
        coupes.push({ nom: b.nom, jetonsRetires: jetonsBloc });
        b.texte = "";
      } else {
        const garder = Math.max(0, Math.floor((jetonsBloc - excedent) * CHARS_PAR_JETON));
        coupes.push({ nom: b.nom, jetonsRetires: excedent });
        // On garde la TÊTE : dans ce produit, le plus récent est en tête
        // (événements, transcriptions), et c'est lui qui porte le sens.
        b.texte = b.texte.slice(0, garder) + "\n[…tronqué pour tenir dans le budget…]";
      }
    }
  }

  const texte = uniques
    .filter((b) => b.texte.trim())
    .map((b) => b.texte)
    .join("\n\n");

  return { texte, jetons: estimeJetons(texte), budget, coupes, doublons };
}

// ── Suivi de consommation ──────────────────────────────────────────────

export interface AppelIA {
  route: string;
  jetonsEntree: number;
  jetonsSortie: number;
  at: string;
}

/** Prix indicatifs, en € pour 1 000 jetons. À ajuster au fournisseur réel. */
export const PRIX_MILLE_JETONS = { entree: 0.0008, sortie: 0.0024 };

export interface Consommation {
  appels: number;
  jetonsEntree: number;
  jetonsSortie: number;
  /** Coût estimé, en €. ESTIMATION — les prix réels viennent de la facture. */
  coutEur: number;
  /** Les routes les plus coûteuses, pour savoir où optimiser. */
  parRoute: { route: string; appels: number; jetons: number; coutEur: number }[];
  /** Le conseil du moment, ou rien s'il n'y a rien à dire. */
  conseil?: string;
}

export function consommation(appels: AppelIA[]): Consommation {
  const parRoute = new Map<string, { appels: number; entree: number; sortie: number }>();
  let jetonsEntree = 0;
  let jetonsSortie = 0;

  for (const a of appels) {
    jetonsEntree += a.jetonsEntree;
    jetonsSortie += a.jetonsSortie;
    const r = parRoute.get(a.route) ?? { appels: 0, entree: 0, sortie: 0 };
    r.appels += 1;
    r.entree += a.jetonsEntree;
    r.sortie += a.jetonsSortie;
    parRoute.set(a.route, r);
  }

  const cout = (e: number, s: number) => (e / 1000) * PRIX_MILLE_JETONS.entree + (s / 1000) * PRIX_MILLE_JETONS.sortie;
  const coutEur = cout(jetonsEntree, jetonsSortie);

  const routes = [...parRoute.entries()]
    .map(([route, r]) => ({ route, appels: r.appels, jetons: r.entree + r.sortie, coutEur: cout(r.entree, r.sortie) }))
    .sort((a, b) => b.coutEur - a.coutEur);

  let conseil: string | undefined;
  const pire = routes[0];
  if (pire && appels.length >= 10) {
    const moyenne = pire.jetons / pire.appels;
    if (moyenne > 12_000) {
      conseil = `${pire.route} envoie ~${Math.round(moyenne).toLocaleString("fr-FR")} jetons par appel. Au-delà de 12 000, le contexte dilue autant qu'il aide : le modèle répond moins bien ET plus cher.`;
    } else if (jetonsEntree > jetonsSortie * 20) {
      conseil = "On envoie plus de 20 fois ce qu'on reçoit. C'est le signe d'un contexte qu'on empile sans le filtrer.";
    }
  }

  return { appels: appels.length, jetonsEntree, jetonsSortie, coutEur, parRoute: routes, conseil };
}

/**
 * Budgets par défaut, par route.
 *
 * Ils ne sont pas égaux parce que les usages ne le sont pas : l'agent
 * conversationnel a besoin de l'état du pipeline, un script de vente a
 * besoin d'une fiche. Donner le même budget aux deux, c'est soit brider
 * l'un, soit payer l'autre pour rien.
 */
export const BUDGETS: Record<string, number> = {
  "/api/agent": 12_000,
  "/api/ai": 6_000,
  "/api/brain": 8_000,
  "/api/sparring": 4_000,
  "/api/icp": 3_000,
  "/api/audit/extract": 5_000,
};

export const budgetPour = (route: string): number => BUDGETS[route] ?? 6_000;
