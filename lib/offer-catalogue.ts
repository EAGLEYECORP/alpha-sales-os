import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES OFFRES DE L'OPÉRATEUR — ce que LUI vend, modifiable sans redéployer.
 *
 * ── NE PAS CONFONDRE AVEC `lib/bricks.ts` ──
 *
 * `lib/bricks.ts`, c'est NOTRE catalogue : ce qu'EAGLEYE vend, avec nos prix.
 * Il est serveur-only, et il le reste.
 *
 * Ce module-ci, c'est ce que l'OPÉRATEUR vend à SES prospects. Un couvreur qui
 * utilise Alpha Sales OS ne vend pas Alpha Voice : il vend des toitures. Ses
 * offres sont SA donnée, elles vivent dans son store, et il doit pouvoir les
 * changer un dimanche soir sans nous appeler.
 *
 * ── POURQUOI ÇA MANQUAIT ──
 *
 * Tout était en dur : `EagleyeOffer` est une union de types, `BRICKS` et
 * `LEAD_MAGNETS` sont des tableaux `const`. Ajouter une offre demandait un
 * commit, une revue, un déploiement. Pour un produit white-label c'est
 * rédhibitoire : chaque client aurait eu besoin de nous pour changer un
 * libellé.
 *
 * ── LA FRONTIÈRE, ET POURQUOI ELLE EST LÀ ──
 *
 * Une offre a DEUX vies :
 *
 *  1. Ce qu'on en DIT — nom, description, argument, prix. Pure donnée
 *     commerciale, éditable librement. C'est 95 % de l'usage.
 *  2. Comment on la ROUTE — quel compte la porte, quel aimant elle déclenche,
 *     quelle marche de l'escalier. Ça, c'est de la LOGIQUE, câblée dans
 *     `offer-match`, `ladder` et `accounts`.
 *
 * Une offre personnalisée se RATTACHE donc à une famille de routage
 * existante (`famille`). On peut créer « Rénovation énergétique » et la router
 * comme de la visibilité ; on ne peut pas inventer une quatrième mécanique de
 * routage sans code. Prétendre le contraire donnerait une offre qui s'affiche
 * partout et n'est traitée nulle part — pire que pas d'offre.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Offre {
  id: string;
  /** Le nom tel que le prospect l'entend. */
  label: string;
  /** Ce que ça fait, en une phrase que le client reconnaît. */
  what: string;
  /** L'argument d'ouverture — la phrase qui accroche. */
  pitch: string;
  /** Prix d'installation / one-shot (€ HT). 0 = sur devis. */
  setupHT: number;
  /** Récurrent mensuel (€ HT). 0 = pas d'abonnement. */
  monthlyHT: number;
  /**
   * La famille de ROUTAGE à laquelle elle se rattache. C'est elle qui décide
   * du compte, de l'aimant et de la marche — pas le libellé.
   */
  famille: EagleyeOffer;
  /**
   * Désactivée : elle reste dans l'historique des deals passés mais ne se
   * propose plus. On n'EFFACE pas une offre qui a servi — les fiches qui la
   * portent deviendraient illisibles.
   */
  actif: boolean;
  /**
   * Offre livrée avec le produit. Modifiable et désactivable, JAMAIS
   * supprimable : le routage s'appuie dessus. Supprimer la dernière offre
   * d'une famille laisserait des prospects sans destination.
   */
  systeme?: boolean;
}

/**
 * Les offres livrées avec le produit — le point de départ, pas la loi.
 *
 * Elles sont recopiées dans le store au premier lancement, puis appartiennent
 * à l'opérateur. Éditer celles-ci n'affecte donc que les NOUVEAUX comptes,
 * ce qui est le comportement attendu d'un socle.
 */
export const OFFRES_SYSTEME: Offre[] = [
  {
    id: "alpha-sales-os",
    label: "Alpha Sales OS",
    what: "L'OS de vente : pipeline, relances, scripts et suivi, au même endroit.",
    pitch: "« Vous avez des leads. Le vrai enjeu n'est pas d'en avoir plus — c'est de n'en perdre aucun. »",
    setupHT: 0,
    monthlyHT: 0,
    famille: "alpha-sales-os",
    actif: true,
    systeme: true,
  },
  {
    id: "callflow",
    label: "Accueil & relance téléphone",
    what: "L'agent qui décroche, qualifie et rappelle — 24/7, sans embauche.",
    pitch: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place. »",
    setupHT: 0,
    monthlyHT: 0,
    famille: "callflow",
    actif: true,
    systeme: true,
  },
  {
    id: "visibilite-growth",
    label: "Visibilité / Growth",
    what: "Être trouvé là où vos clients cherchent, et transformer ce trafic.",
    pitch: "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
    setupHT: 0,
    monthlyHT: 0,
    famille: "visibilite-growth",
    actif: true,
    systeme: true,
  },
];

/** Les familles de routage disponibles, avec ce qu'elles impliquent. */
export const FAMILLES: { id: EagleyeOffer; label: string; implique: string }[] = [
  {
    id: "alpha-sales-os",
    label: "Outil / abonnement",
    implique: "Aimant « audit de process ». Routée vers le compte maître.",
  },
  {
    id: "callflow",
    label: "Téléphone / accueil",
    implique: "Aimant « audit téléphonique ». Déclenche la marche Callflow de l'escalier.",
  },
  {
    id: "visibilite-growth",
    label: "Visibilité / acquisition",
    implique: "Aimant « audit de visibilité ». Marche visibilité de l'escalier.",
  },
];

export interface ErreurOffre {
  champ: keyof Offre | "global";
  message: string;
}

/**
 * Valide une offre avant enregistrement.
 *
 * On refuse ce qui produirait un document ou un script cassé plus tard —
 * jamais ce qui est simplement inhabituel. Un prix à zéro est légitime (sur
 * devis) ; un libellé vide ne l'est pas, il sortirait tel quel dans un email.
 */
export function validerOffre(o: Partial<Offre>, existantes: Offre[] = []): ErreurOffre[] {
  const err: ErreurOffre[] = [];
  const label = (o.label ?? "").trim();
  const what = (o.what ?? "").trim();

  if (label.length < 2) err.push({ champ: "label", message: "Il faut un nom — il sort tel quel dans les emails." });
  if (label.length > 60) err.push({ champ: "label", message: "Trop long : un nom d'offre se dit en une respiration." });
  // 15 caractères : en dessous, une description ne dit littéralement rien
  // (« On fait X. » = 10). Le seuil existe pour que l'IA ait de la matière,
  // pas pour cocher une case — trop bas, il laisse passer du vide.
  if (what.length < 15) {
    err.push({ champ: "what", message: "Décris ce que ça fait : sans ça, l'IA écrit du vide et le prospect aussi." });
  }
  if (!o.famille || !FAMILLES.some((f) => f.id === o.famille)) {
    err.push({ champ: "famille", message: "Choisis une famille de routage, sinon l'offre s'affiche sans jamais être traitée." });
  }
  for (const champ of ["setupHT", "monthlyHT"] as const) {
    const v = o[champ];
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
      err.push({ champ, message: "Un prix négatif n'existe pas." });
    }
  }
  // Doublon de nom : deux offres homonymes rendent tout choix ambigu, dans
  // l'interface comme dans les prompts.
  const doublon = existantes.some(
    (e) => e.id !== o.id && e.label.trim().toLowerCase() === label.toLowerCase()
  );
  if (doublon) err.push({ champ: "label", message: "Une offre porte déjà ce nom." });

  return err;
}

/** Identifiant stable dérivé du nom — lisible dans les URL et les exports. */
export function idDepuisLabel(label: string, existantes: Offre[] = []): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "offre";
  if (!existantes.some((e) => e.id === base)) return base;
  // Suffixe numérique plutôt qu'aléatoire : un id lisible se retrouve dans un
  // export CSV, un aléatoire non.
  let n = 2;
  while (existantes.some((e) => e.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Une offre système peut-elle être supprimée ? Non, et il faut le dire.
 *
 * Le routage s'appuie sur les familles : supprimer la dernière offre d'une
 * famille laisserait des prospects sans destination, sans que rien ne casse
 * visiblement. La désactivation couvre le besoin réel (« je ne vends plus
 * ça ») sans casser l'historique.
 */
export function peutSupprimer(o: Offre, toutes: Offre[]): { ok: boolean; raison?: string } {
  if (o.systeme) {
    return { ok: false, raison: "Offre du socle : désactive-la plutôt. La supprimer casserait le routage." };
  }
  const restantes = toutes.filter((x) => x.id !== o.id && x.famille === o.famille && x.actif);
  if (restantes.length === 0) {
    return {
      ok: false,
      raison: "C'est la dernière offre active de sa famille. Sans elle, les prospects de cette famille n'ont plus de destination.",
    };
  }
  return { ok: true };
}

/** Les offres proposables aujourd'hui. */
export const offresActives = (toutes: Offre[]): Offre[] => toutes.filter((o) => o.actif);

/**
 * L'offre à retenir pour une famille de routage.
 *
 * Repli sur l'offre système de la famille si l'opérateur a tout désactivé :
 * mieux vaut un libellé générique qu'un script qui parle d'une offre vide.
 */
export function offrePourFamille(toutes: Offre[], famille: EagleyeOffer): Offre | undefined {
  return (
    toutes.find((o) => o.actif && o.famille === famille) ??
    OFFRES_SYSTEME.find((o) => o.famille === famille)
  );
}
