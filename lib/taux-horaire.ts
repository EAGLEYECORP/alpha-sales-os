/**
 * ─────────────────────────────────────────────────────────────────────
 * LE TAUX HORAIRE — relevé sur le marché, faute de le tenir de toi.
 *
 * Six briques du catalogue sur dix se chiffrent au TEMPS, et aucun prix de
 * setup client n'existe sans ce nombre. Il manquait, donc `verdictBrique`
 * rendait `null` et la moitié de la grille restait invérifiable.
 *
 * Ce module ne l'INVENTE pas : il le relève sur des baromètres publics, avec
 * la fourchette, la ville, le profil, et la réserve qui va avec. Le jour où
 * un vrai coût interne existe (une paie, une compta), il remplace tout ça —
 * une mesure maison bat toujours un baromètre.
 *
 * ⚠ DEUX NOMBRES, PAS UN. Les confondre est l'erreur classique :
 *
 *   · le TAUX FACTURÉ — ce qu'une heure de notre travail se VEND. C'est lui
 *     qui chiffre un devis de mise en route. Le marché le donne.
 *
 *   · le COÛT d'une heure — ce qu'elle nous COÛTE. C'est lui qui entre dans
 *     un calcul de marge. Le marché ne le donne pas : il dépend d'une paie.
 *
 * Pour un indépendant SEUL, les deux se rejoignent, et ce n'est pas une
 * approximation : une heure passée à installer chez le client A est une heure
 * qui n'a pas été vendue au client B. Le coût d'opportunité EST le taux
 * facturé. Conséquence directe, et elle est saine : la marge sur du temps
 * humain est structurellement nulle. C'est exactement pourquoi la règle ×4 ne
 * s'applique JAMAIS au temps — seulement à la consommation fournisseurs.
 * Le jour où quelqu'un est salarié, `COUT_HORAIRE_SALARIE` prend le relais et
 * les deux nombres se séparent.
 * ─────────────────────────────────────────────────────────────────────
 */

export type ProfilMarche =
  | "dev-junior"
  | "dev-confirme"
  | "dev-senior"
  | "automatisation"
  | "consultant-ia"
  | "integrateur-ia";

export interface ReleveTJM {
  profil: ProfilMarche;
  label: string;
  /** Fourchette de TJM relevée, en € HT par jour. */
  basEur: number;
  hautEur: number;
  /** Zone à laquelle la fourchette se rapporte. */
  zone: "france" | "idf" | "region";
  source: string;
  date: string;
}

/**
 * Relevé du 27 août 2026. **Sources secondaires** : baromètres d'agences et
 * de plateformes freelance, pas des factures. Ordre de grandeur défendable en
 * rendez-vous, pas un tarif opposable.
 */
export const RELEVE_TJM: ReleveTJM[] = [
  {
    profil: "dev-junior",
    label: "Développeur junior (< 3 ans)",
    basEur: 250,
    hautEur: 350,
    zone: "france",
    source: "extradev.fr / czsyn.com — baromètres TJM 2026",
    date: "2026-08-27",
  },
  {
    profil: "dev-confirme",
    label: "Développeur confirmé",
    basEur: 350,
    hautEur: 600,
    zone: "france",
    source: "lafabriquedunet.fr, tjmetre.fr — médiane ~520 €/j toutes stacks",
    date: "2026-08-27",
  },
  {
    profil: "dev-senior",
    label: "Développeur senior (React, Python)",
    basEur: 500,
    hautEur: 700,
    zone: "france",
    source: "extradev.fr — stacks courantes, séniorité confirmée",
    date: "2026-08-27",
  },
  {
    profil: "automatisation",
    label: "Automatisation (n8n, Make, Zapier)",
    basEur: 350,
    hautEur: 700,
    zone: "france",
    source: "codeur.com/developpeur/n8n, studeria.fr — 350–650 €/j, 400–700 pour les profils outillés",
    date: "2026-08-27",
  },
  {
    profil: "consultant-ia",
    label: "Consultant IA",
    basEur: 400,
    hautEur: 1500,
    zone: "france",
    source: "studeria.fr, just-use-ai.com — fourchette très large selon périmètre",
    date: "2026-08-27",
  },
  {
    profil: "integrateur-ia",
    label: "Intégrateur d'automatisations IA (haut de marché)",
    basEur: 700,
    hautEur: 1500,
    zone: "france",
    source: "just-use-ai.com — haut de la fourchette freelance française",
    date: "2026-08-27",
  },
];

/**
 * Décote régionale. L'Île-de-France est à ~613–620 €/j de moyenne ; la
 * province est donnée 8–15 % en dessous, et le télétravail a réduit l'écart.
 * Lyon est le deuxième bassin tech français et se tient dans le haut de la
 * province — on retient donc la décote la plus FAIBLE de la fourchette.
 */
export const DECOTE_LYON = 0.92;
export const SOURCE_DECOTE =
  "lafabriquedunet.fr / eid-lab.com (2026) — 8 à 15 % sous l'IDF ; Lyon = 2ᵉ bassin tech, haut de la province";

/** Moyenne TJM relevée en région, tous profils confondus. Sert de repère bas. */
export const TJM_MOYEN_REGION_EUR = 495; // fourchette relevée 450–540
export const SOURCE_REGION = "studeria.fr (2026) — 620 €/j en IDF, 450 à 540 en régions";

/** Un TJM national ramené à Lyon. Sert de contre-calcul, pas de dogme. */
export const tjmLyon = (nationalEur: number): number => Math.round(nationalEur * DECOTE_LYON);

/**
 * Le profil retenu pour NOUS, et pourquoi.
 *
 * Ni « dev junior » — ce qui est construit ici n'est pas du travail de
 * débutant — ni « intégrateur IA à 1 500 €/j » : cette borne haute se paie
 * avec des références, et il y a **zéro vente à ce jour**. Se placer là
 * serait exactement la preuve inventée que la doctrine interdit.
 *
 * On se pose sur l'intersection honnête entre « automatisation » (350–700)
 * et « dev senior » (500–700) : le cœur du métier réellement exercé.
 */
export const PROFIL_RETENU: ProfilMarche = "automatisation";
export const TJM_BAS_EUR = 450;
export const TJM_HAUT_EUR = 550;
export const TJM_RETENU_EUR = 500;

/**
 * ⚠ LE CHIFFRE RETENU EST VOLONTAIREMENT SOUS CE QUE LE CALCUL DONNE.
 *
 * Le contre-calcul : l'intersection « automatisation » × « dev senior » place
 * le national à 500–700 €/j, soit un centre à 600. Ramené à Lyon (×0,92), ça
 * fait 552 €/j. La moyenne régionale tous profils, elle, est à ~495 €/j — et
 * notre profil est au-dessus de la moyenne, pas dessous.
 *
 * On retient quand même 500. Ce n'est pas une erreur de calcul, c'est une
 * décision : le haut de fourchette se défend avec des références, et il y a
 * ZÉRO vente à ce jour. Un TJM qu'on ne peut pas justifier en rendez-vous est
 * un TJM qu'on négocie à la baisse en direct, ce qui coûte plus cher que de
 * l'avoir posé juste. Il remonte au premier client livré.
 */
export const JUSTIFICATION_TJM =
  "Intersection de « automatisation n8n/Make » (350–700 €/j) et « dev senior » (500–700 €/j) : " +
  `centre national 600, soit ${tjmLyon(600)} €/j à Lyon. Retenu 500 — délibérément sous le calcul, ` +
  "parce que le haut de fourchette se paie avec des références et qu'il y a zéro vente à ce jour. " +
  "La borne haute du marché IA (1 500 €/j) nous est fermée tant qu'un client n'a pas signé.";

/**
 * Une journée facturée n'est pas huit heures de travail.
 *
 * Le TJM est un prix de JOURNÉE ; l'usage du marché est ~7 h réellement
 * facturables dedans (réunions, contexte, allers-retours). Diviser par 8
 * gonflerait artificiellement le nombre d'heures vendables et sous-estimerait
 * chaque devis au forfait.
 */
export const HEURES_PAR_JOUR = 7;

/** Le nombre que le reste du code attend. 500 € / 7 h ≈ 71 €/h. */
export const TAUX_HORAIRE_EUR = Math.round(TJM_RETENU_EUR / HEURES_PAR_JOUR);

/** La fourchette, parce qu'un nombre nu se cite ensuite comme une certitude. */
export const TAUX_HORAIRE_BAS_EUR = Math.round(TJM_BAS_EUR / HEURES_PAR_JOUR);
export const TAUX_HORAIRE_HAUT_EUR = Math.round(TJM_HAUT_EUR / HEURES_PAR_JOUR);

/**
 * Jours réellement facturés dans une année — pas les 251 jours ouvrés.
 *
 * Les baromètres convergent : ~186 jours théoriquement disponibles, mais
 * 130–150 réellement facturés pour la plupart des indépendants, 180 pour les
 * mieux occupés. C'est ce nombre-là qui dit ce que le temps humain peut
 * rapporter au MAXIMUM — et donc pourquoi vendre du temps ne scale pas.
 */
export const JOURS_FACTURABLES_BAS = 130;
export const JOURS_FACTURABLES_HAUT = 180;
export const SOURCE_JOURS =
  "freebe.me, l-expert-comptable.com, free-work.com (2026) — 130–150 j facturés en moyenne, 180 bien occupé";

export interface Capacite {
  joursFactures: number;
  tjmEur: number;
  caEur: number;
  heuresVendables: number;
}

/** Ce que le temps humain peut rapporter dans l'année, au mieux et au pire. */
export function capaciteAnnuelle(tjmEur = TJM_RETENU_EUR): { bas: Capacite; haut: Capacite } {
  const faire = (j: number): Capacite => ({
    joursFactures: j,
    tjmEur,
    caEur: j * tjmEur,
    heuresVendables: j * HEURES_PAR_JOUR,
  });
  return { bas: faire(JOURS_FACTURABLES_BAS), haut: faire(JOURS_FACTURABLES_HAUT) };
}

/**
 * Coût horaire d'une personne SALARIÉE — le jour où il y en a une.
 *
 * Tant qu'on est seul, ce n'est pas la bonne base (voir l'encadré du haut) :
 * le coût d'une heure est son coût d'opportunité, donc le taux facturé.
 * Rendu explicite ici pour que le basculement soit un changement de constante
 * visible dans un diff, et pas une hypothèse qui se glisse dans un tableur.
 *
 * @param salaireBrutMensuelEur  brut mensuel de la personne
 * @param chargesPatronalesPct   ~42 % en France pour un cadre (ordre de grandeur)
 * @param heuresProductivesMois  jamais 151,67 : congés, réunions, formation
 */
export function coutHoraireSalarie(
  salaireBrutMensuelEur: number,
  chargesPatronalesPct = 42,
  heuresProductivesMois = 120
): number {
  if (!(salaireBrutMensuelEur > 0) || !(heuresProductivesMois > 0)) return 0;
  const charge = salaireBrutMensuelEur * (1 + chargesPatronalesPct / 100);
  return Math.round((charge / heuresProductivesMois) * 100) / 100;
}

/**
 * La réserve, à écrire partout où ce taux sort — un taux nu se cite comme une
 * vérité mesurée trois semaines plus tard, devant quelqu'un qui vérifie.
 */
export const RESERVE_TAUX =
  "Taux déduit de baromètres publics (août 2026), pas d'une comptabilité : " +
  `${TAUX_HORAIRE_BAS_EUR}–${TAUX_HORAIRE_HAUT_EUR} €/h selon le profil retenu, ` +
  `${TAUX_HORAIRE_EUR} €/h au centre. Il chiffre ce qu'une heure se VEND, ` +
  "pas ce qu'elle coûte. La première facture réelle le remplace.";
