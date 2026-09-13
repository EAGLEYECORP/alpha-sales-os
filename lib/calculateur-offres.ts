import {
  abonnementMensuel,
  ALPHA_VOICE_PALIERS,
  ALPHA_VOICE_SETUP_HT,
  OUTBOUND_UNIT_CALLS,
  OUTBOUND_UNIT_HT,
  PACK_SETUP_HT,
  PRIX_SIEGE_HT,
  SIEGES_REFERENCE,
} from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CALCULATEUR DE TOUTES LES OFFRES.
 *
 * ⚠ CE QUI EXISTAIT NE COUVRAIT QUE LES PETITES.
 *
 * `/offre` chiffrait un seul modèle : « Performance vs Abonnement », sur des
 * paliers à 1 000 / 2 500 / 5 000 €. Le portefeuille réel en compte DIX, sur
 * trois comptes, avec trois économies différentes :
 *
 *   EAGLEYE (100 % — c'est notre société)
 *     · Alpha Sales OS VIP ......... 10 000 € + 1 000 €/mois
 *     · Alpha Sales OS à la carte .. 10 briques, 1 200–3 500 € + 120–364 €/mois
 *     · Appels sortants ............ 364 €/mois les 1 000 appels
 *     · Essai ...................... 290 € les 100 appels, une fois
 *     · 30 % du CA généré .......... alternative au VIP (setup sur devis)
 *     · OS personnalisé ............ devis au cadrage
 *     · Visibilité / Growth ........ devis
 *     · Digitalisation < 40 k ...... devis
 *     · Alpha Voice ................ setup + palier minutes (grille héritée,
 *                                    à décider — voir lib/offres-publiques.ts)
 *   Nuwacom
 *     · Chantier > 40 k ............ devis → NOUS : 15 % PLANCHER, puis 100 %
 *                                    de la maintenance mensuelle
 *
 * ── LA RÈGLE QUI STRUCTURE TOUT CE MODULE ──
 *
 * Il y a DEUX « 30 % » dans ce métier, et les confondre fausse toutes les
 * prévisions. CLAUDE.md les sépare ; ce module aussi, jusque dans les noms :
 *
 *   · `partNous`  — ce qui NOUS revient. 100 % chez EAGLEYE (personne à
 *     payer), 15 % chez Nuwacom. C'est une COMMISSION.
 *   · `revShare`  — les 30 % qu'on FACTURE au client sur le CA qu'on lui fait
 *     gagner. C'est un PRIX, pas une commission reversée.
 *
 * Une ligne `alpha-revshare` a donc `partNous: 100` ET un revShare de 30 % :
 * on facture 30 % du CA du client, et ces 30 % nous reviennent entièrement.
 *
 * ── ZÉRO DONNÉE → ZÉRO CHIFFRE ──
 *
 * Les offres « sur devis » (OS personnalisé, visibilité, digitalisation,
 * chantier Nuwacom) ne rendent PAS 0 €. Elles rendent `null` et se retrouvent
 * dans `aChiffrerAuCadrage`. Un total qui absorbe silencieusement une ligne
 * non chiffrée annonce un devis faux, et c'est le genre de faux qu'on découvre
 * devant le client.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les familles d'offres. Une famille = une mécanique de prix. */
export type FamilleOffre =
  | "alpha-vip"
  | "alpha-carte"
  | "alpha-revshare"
  | "sortant"
  | "os-personnalise"
  | "visibilite"
  | "digitalisation"
  | "alpha-voice"
  | "nuwacom";

/** Le barème d'un compte — ce qui NOUS revient. Vient de `/api/catalogue`. */
export interface BaremeCompte {
  accountId: string;
  nom: string;
  /** % du SETUP qui nous revient. */
  setupPct: number;
  /** % du MENSUEL qui nous revient. */
  mensuelPct: number;
  /** Le taux est-il un plancher négociable plutôt qu'un tarif ? */
  plancher?: boolean;
}

/**
 * Les barèmes livrés, dérivés de `lib/accounts-commercial.ts`.
 *
 * ⚠ Ils sont ici en REPLI, pas en source : le vrai barème descend de
 * `/api/catalogue`, réservé au compte maître. Ce repli existe parce qu'un
 * écran qui n'a pas encore reçu la réponse ne doit pas afficher des totaux
 * faux — il affiche les taux d'EAGLEYE, qui sont à 100 % et donc neutres, et
 * l'écran dit que le barème n'est pas chargé.
 */
export const BAREME_NEUTRE: BaremeCompte = {
  accountId: "eagleye",
  nom: "EAGLEYE CORP",
  setupPct: 100,
  mensuelPct: 100,
};

/** À quel compte va chaque famille. C'est le routage de l'ESCALIER. */
export const COMPTE_DE_LA_FAMILLE: Record<FamilleOffre, string> = {
  "alpha-vip": "eagleye",
  "alpha-carte": "eagleye",
  "alpha-revshare": "eagleye",
  sortant: "eagleye",
  "os-personnalise": "eagleye",
  visibilite: "eagleye",
  digitalisation: "eagleye",
  "alpha-voice": "eagleye",
  nuwacom: "nuwacom",
};

/** Une brique du catalogue à la carte, telle que `/api/catalogue` la rend. */
export interface BriqueTarif {
  id: string;
  label: string;
  setupHT: number;
  monthlyHT: number;
}

/** Ce que l'opérateur compose. Chaque champ absent = ligne non retenue. */
export interface Selection {
  /** Pack VIP complet. */
  vip?: boolean;
  /**
   * Le nombre d'utilisateurs nommés du pack.
   *
   * ⚠ C'EST LA SEULE ENTRÉE QUI FAIT EXISTER LA GRILLE AU SIÈGE. Sans elle,
   * `abonnementMensuel()` serait un export que personne n'appelle — un module
   * juste, testé, et mort. C'est le défaut le plus fréquent de ce dépôt, et
   * il aurait été commis par la correction elle-même.
   *
   * Absent ⇒ `SIEGES_REFERENCE`. Un défaut est nécessaire parce que le
   * chiffrage sert aussi à afficher un prix d'appel avant qu'on ait demandé la
   * taille de l'équipe ; le reprendre sur la référence garantit que ce
   * prix-là est exactement celui de la vitrine, et pas un troisième nombre.
   */
  sieges?: number;
  /** Ids de briques à la carte. */
  briques?: string[];
  /** Appels sortants par mois (0 ou absent = pas d'appels). */
  appelsParMois?: number;
  /**
   * Le prix mensuel de ces appels, calculé par `/api/catalogue`.
   *
   * ⚠ Il n'est PAS recalculé ici : voir la note au-dessus de `palierAlphaVoice`.
   * Absent alors que des appels sont demandés → la ligne reste non chiffrée et
   * une alerte le dit, plutôt qu'un montant approximatif.
   */
  sortantMensuelHT?: number;
  /**
   * Modèle « 30 % du CA généré ». On saisit le CA MENSUEL qu'on projette
   * pour le client — c'est SON chiffre d'affaires, pas le nôtre.
   */
  caMensuelGenere?: number;
  /** Setup facturé dans le modèle rev-share (sur devis : saisi à la main). */
  setupRevShare?: number;
  /** Alpha Voice : minutes du palier visé. */
  alphaVoiceMinutes?: number;
  /** Chantier Nuwacom : montant du devis, en €. */
  chantierHT?: number;
  /** Maintenance mensuelle qui suit le chantier — 100 % pour nous. */
  maintenanceMensuelleHT?: number;
  /** Les offres sur devis retenues, sans montant. */
  surDevis?: ("os-personnalise" | "visibilite" | "digitalisation")[];
}

export interface LigneChiffree {
  famille: FamilleOffre;
  label: string;
  accountId: string;
  /** Ce que le CLIENT paie. `null` = sur devis, à chiffrer au cadrage. */
  clientSetupHT: number | null;
  clientMensuelHT: number | null;
  /** Ce qui NOUS revient. `null` quand le client n'est pas chiffré. */
  nousSetupHT: number | null;
  nousMensuelHT: number | null;
  /** Le détail qui rend la ligne lisible en rendez-vous. */
  detail: string;
}

export interface Totaux {
  setupHT: number;
  mensuelHT: number;
  /** Setup + 12 mois. */
  an1HT: number;
}

export interface Chiffrage {
  lignes: LigneChiffree[];
  client: Totaux;
  nous: Totaux;
  /** Par compte, pour voir d'où vient l'argent. */
  parCompte: { accountId: string; nom: string; client: Totaux; nous: Totaux }[];
  /** Les lignes retenues qui n'ont PAS de prix — jamais absorbées dans un total. */
  aChiffrerAuCadrage: string[];
  /** Ce qui mérite d'être dit avant de sortir ce chiffrage d'un écran. */
  alertes: string[];
}

/** Le seuil de routage : au-delà, c'est trop lourd pour nous → Nuwacom. */
export const SEUIL_NUWACOM_HT = 40_000;

/**
 * Le pourcentage du CA client facturé dans le modèle « performance ».
 *
 * ⚠ C'EST UN PRIX, PAS UNE COMMISSION. Il est ici et non dans les barèmes
 * parce qu'il ne décrit pas ce qui nous revient d'un partenaire : il décrit ce
 * qu'on facture à un client sur SON chiffre d'affaires. Les mettre au même
 * endroit est exactement la confusion que CLAUDE.md interdit.
 */
export const REV_SHARE_PCT = 30;

/** Le palier Alpha Voice correspondant à un volume de minutes. */
export function palierAlphaVoice(minutes: number) {
  return ALPHA_VOICE_PALIERS.find((p) => p.minutes >= minutes) ?? ALPHA_VOICE_PALIERS[ALPHA_VOICE_PALIERS.length - 1]!;
}

/**
 * ⚠ IL N'Y A PAS DE `prixSortant` ICI, ET C'EST UNE CORRECTION.
 *
 * J'en avais écrit un — sous un commentaire qui affirmait justement qu'il ne
 * fallait pas deux arithmétiques du même prix. Il divergeait de
 * `outboundPrice` (lib/bricks.ts) au-delà de 4 000 appels : 2 184 € contre
 * 2 548 € pour 8 000. Le vrai calcul gère trois cas que le mien ignorait —
 * le palier exact (4 000 = prix de 3 000), le dépassement du dernier palier,
 * et le fait que SOUS le millier l'abonnement est le mauvais produit.
 *
 * `lib/bricks.ts` est un module SERVEUR (il porte les coûts de revient) : ce
 * calculateur ne peut pas l'importer sans le faire descendre dans le
 * navigateur. Le prix entre donc par la sélection, calculé par
 * `/api/catalogue` — une arithmétique, déjà testée, et jamais dans le bundle.
 */

const pct = (montant: number, taux: number) => Math.round((montant * taux) / 100);

/** Total neutre — sert de point de départ et de repli. */
const zero = (): Totaux => ({ setupHT: 0, mensuelHT: 0, an1HT: 0 });

const cumule = (t: Totaux, setup: number, mensuel: number): Totaux => ({
  setupHT: t.setupHT + setup,
  mensuelHT: t.mensuelHT + mensuel,
  an1HT: t.setupHT + setup + (t.mensuelHT + mensuel) * 12,
});

export interface OptionsChiffrage {
  /** Le catalogue des briques (vient de `/api/catalogue`). */
  briques?: BriqueTarif[];
  /** Les barèmes par compte. Absent = tout à 100 % + une alerte. */
  baremes?: BaremeCompte[];
}

/**
 * Le chiffrage complet d'une sélection.
 *
 * Fonction PURE : elle ne connaît ni le réseau ni le store. Tout ce qui est
 * secret (les taux) entre par `options.baremes` — c'est ce qui permet au
 * module de descendre dans le navigateur sans emporter le portefeuille.
 */
export function chiffrer(sel: Selection, options: OptionsChiffrage = {}): Chiffrage {
  const briquesCatalogue = options.briques ?? [];
  const baremes = options.baremes ?? [];
  const lignes: LigneChiffree[] = [];
  const aChiffrer: string[] = [];
  const alertes: string[] = [];

  const bareme = (accountId: string): BaremeCompte =>
    baremes.find((b) => b.accountId === accountId) ?? { ...BAREME_NEUTRE, accountId, nom: accountId };

  if (baremes.length === 0) {
    alertes.push(
      "Barème des comptes non chargé : « ce qui nous revient » est calculé à 100 % partout. " +
        "C'est juste pour EAGLEYE, faux pour Nuwacom."
    );
  }

  /** Ajoute une ligne chiffrée en appliquant le barème de son compte. */
  const ajouter = (
    famille: FamilleOffre,
    label: string,
    clientSetup: number | null,
    clientMensuel: number | null,
    detail: string
  ) => {
    const accountId = COMPTE_DE_LA_FAMILLE[famille];
    const b = bareme(accountId);
    lignes.push({
      famille,
      label,
      accountId,
      clientSetupHT: clientSetup,
      clientMensuelHT: clientMensuel,
      nousSetupHT: clientSetup === null ? null : pct(clientSetup, b.setupPct),
      nousMensuelHT: clientMensuel === null ? null : pct(clientMensuel, b.mensuelPct),
      detail,
    });
    if (clientSetup === null && clientMensuel === null) aChiffrer.push(label);
  };

  // ── EAGLEYE — le pack VIP, facturé au SIÈGE ──
  if (sel.vip) {
    /**
     * ⚠ Une saisie invalide ne doit pas faire TOMBER un chiffrage.
     * `abonnementMensuel` jette sur 0, un décimal ou un négatif — c'est juste
     * pour une facture, et faux ici : cette fonction sert un écran où
     * quelqu'un tape, et un champ vidé une seconde ne doit pas vider la page.
     * On borne, et on le DIT dans les alertes plutôt que de corriger en
     * silence — sinon le devis part avec un nombre que personne n'a choisi.
     */
    const demandes = sel.sieges;
    const sieges =
      demandes === undefined || !Number.isInteger(demandes) || demandes < 1
        ? SIEGES_REFERENCE
        : demandes;
    if (demandes !== undefined && sieges !== demandes) {
      alertes.push(
        `Nombre d'utilisateurs invalide (${demandes}) : le chiffrage retient ${SIEGES_REFERENCE} ` +
          `par défaut. Corrige-le avant d'envoyer le devis.`
      );
    }
    const a = abonnementMensuel(sieges);
    ajouter(
      "alpha-vip",
      `Alpha Sales OS — pack complet (${a.sieges} utilisateur${a.sieges > 1 ? "s" : ""})`,
      PACK_SETUP_HT,
      a.totalEur,
      `${PACK_SETUP_HT.toLocaleString("fr-FR")} € d'installation, puis ` +
        `${a.socleEur.toLocaleString("fr-FR")} € de socle + ${a.sieges} × ` +
        `${PRIX_SIEGE_HT} € = ${a.totalEur.toLocaleString("fr-FR")} €/mois ` +
        `(${a.parSiegeEur} €/utilisateur).`
    );
  }

  // ── EAGLEYE — à la carte ──
  const ids = sel.briques ?? [];
  if (ids.length > 0) {
    const prises = ids
      .map((id) => briquesCatalogue.find((b) => b.id === id))
      .filter((b): b is BriqueTarif => Boolean(b));
    const inconnues = ids.length - prises.length;
    if (inconnues > 0) {
      alertes.push(
        `${inconnues} brique(s) sélectionnée(s) sont absentes du catalogue reçu — elles ne sont PAS comptées.`
      );
    }
    const setup = prises.reduce((s, b) => s + b.setupHT, 0);
    const mensuel = prises.reduce((s, b) => s + b.monthlyHT, 0);
    if (prises.length > 0) {
      ajouter(
        "alpha-carte",
        `Alpha Sales OS — à la carte (${prises.length} brique${prises.length > 1 ? "s" : ""})`,
        setup,
        mensuel,
        prises.map((b) => b.label).join(" · ")
      );
      /**
       * ⚠ L'ANCRAGE, ET IL EST ARITHMÉTIQUE — pas rhétorique.
       *
       * La somme des briques dépasse le pack dès qu'on en prend assez. On ne
       * pousse pas le pack en insistant : on montre l'addition. Le dire ici,
       * dans le chiffrage, évite de le rater en rendez-vous.
       */
      if (sel.vip !== true && setup >= PACK_SETUP_HT) {
        alertes.push(
          `À la carte, l'installation atteint ${setup.toLocaleString("fr-FR")} € — le pack VIP complet est à ` +
            `${PACK_SETUP_HT.toLocaleString("fr-FR")} €. Montre l'addition, ne pousse pas le pack.`
        );
      }
    }
  }

  // ── EAGLEYE — appels sortants ──
  if ((sel.appelsParMois ?? 0) > 0) {
    const appels = sel.appelsParMois!;
    const prix = sel.sortantMensuelHT;
    const milliers = Math.ceil(appels / OUTBOUND_UNIT_CALLS);
    if (typeof prix !== "number") {
      ajouter(
        "sortant",
        `Appels sortants — ${appels.toLocaleString("fr-FR")}/mois`,
        null,
        null,
        "Prix non chargé depuis le catalogue. Le palier 4 000 est cassé (le 4e millier est offert) : " +
          "l'estimer de tête donne un chiffre faux."
      );
      alertes.push(
        "Le prix des appels sortants n'a pas été reçu du catalogue : la ligne n'est pas chiffrée. " +
          "Aucun montant approximatif n'est inventé à la place."
      );
    } else {
      ajouter(
        "sortant",
        `Appels sortants — ${appels.toLocaleString("fr-FR")}/mois`,
        0,
        prix,
        `${milliers} millier(s) entamé(s), unité ${OUTBOUND_UNIT_HT} €` +
          (appels >= 4 * OUTBOUND_UNIT_CALLS ? " · le 4e millier est offert (palier de montée en charge)" : "") +
          ", sans engagement."
      );
    }
  }

  // ── EAGLEYE — 30 % du CA généré (un PRIX, pas une commission) ──
  if ((sel.caMensuelGenere ?? 0) > 0) {
    const ca = sel.caMensuelGenere!;
    const facture = pct(ca, REV_SHARE_PCT);
    const setup = sel.setupRevShare ?? null;
    ajouter(
      "alpha-revshare",
      `Alpha Sales OS — ${REV_SHARE_PCT} % du CA généré`,
      setup,
      facture,
      `${REV_SHARE_PCT} % de ${ca.toLocaleString("fr-FR")} €/mois de CA que NOUS lui faisons gagner. ` +
        `C'est un PRIX facturé au client, pas une commission reversée.` +
        (setup === null ? " Frais d'installation sur devis — à chiffrer au cadrage." : "")
    );
    if (setup === null) aChiffrer.push("Frais d'installation du modèle 30 % (sur devis)");
    if (sel.vip) {
      alertes.push(
        "VIP et 30 % du CA sont deux formats ALTERNATIFS de la même offre (10 000 € OU 30 % + setup). " +
          "Les cumuler dans un devis n'a pas de sens commercial."
      );
    }
  }

  /**
   * ── EAGLEYE — Alpha Voice ──
   *
   * ⚠ Cette ligne était rattachée à un compte revendeur, à 30 % + 10 %.
   * L'accord est mort : l'offre est à nous, donc `bareme("eagleye")` et 100 %.
   *
   * ⚠⚠ IL Y AVAIT UNE DEUXIÈME LIGNE ICI, ET ELLE VENDAIT LA MÊME CHOSE.
   * La famille « essai » ajoutait « Essai — 100 appels, 290 € une fois »,
   * retirée le 04/09/2026. Deux raisons, et la seconde est la vraie :
   *  1. elle vendait moins cher ce que l'installation Alpha Voice (990 €)
   *     vend déjà avec la garantie « le setup ne se paie qu'au premier
   *     rendez-vous pris » — deux prix pour la même chose sur un devis ;
   *  2. le palier Essentiel (200 appels, 149 €/mois) EST le produit sous le
   *     millier, c'est-à-dire exactement le trou que l'essai bouchait quand
   *     la grille sautait de rien à 364 €/millier.
   * Le curseur de minutes ci-dessous couvre donc tous les volumes. Rouvrir
   * un second bouton pour le même palier, c'est rouvrir la divergence.
   */
  if ((sel.alphaVoiceMinutes ?? 0) > 0) {
    const p = palierAlphaVoice(sel.alphaVoiceMinutes!);
    const b = bareme("eagleye");
    ajouter(
      "alpha-voice",
      `Alpha Voice — palier ${p.minutes} min`,
      ALPHA_VOICE_SETUP_HT,
      p.prixHT,
      `${ALPHA_VOICE_SETUP_HT} € d'installation + ${p.prixHT} €/mois (${p.appels}). ` +
        `Nous : ${b.setupPct} % du setup, ${b.mensuelPct} % du mensuel.`
    );
  }

  // ── Nuwacom — le gros chantier ──
  if ((sel.chantierHT ?? 0) > 0 || (sel.maintenanceMensuelleHT ?? 0) > 0) {
    const devis = sel.chantierHT ?? 0;
    const maint = sel.maintenanceMensuelleHT ?? 0;
    const b = bareme("nuwacom");
    ajouter(
      "nuwacom",
      "Nuwacom — chantier / transformation",
      devis > 0 ? devis : null,
      maint > 0 ? maint : null,
      `Nous : ${b.setupPct} %${b.plancher ? " (PLANCHER, pas tarif)" : ""} du devis, ` +
        `puis ${b.mensuelPct} % de la maintenance mensuelle.`
    );
    if (devis > 0 && devis < SEUIL_NUWACOM_HT) {
      alertes.push(
        `Chantier à ${devis.toLocaleString("fr-FR")} €, sous le seuil de ${SEUIL_NUWACOM_HT.toLocaleString("fr-FR")} € : ` +
          `EAGLEYE le fait, et on garde 100 % au lieu de ${b.setupPct} %. Le passer à Nuwacom coûte de l'argent.`
      );
    }
    if (b.plancher) {
      alertes.push(
        `Les ${b.setupPct} % Nuwacom sont un PLANCHER. Le contrat se dresse APRÈS le cadrage — c'est là que le ` +
          `levier se convertit en pourcentage. Ne rien signer avant.`
      );
    }
  }

  // ── Les offres sur devis ──
  for (const d of sel.surDevis ?? []) {
    const label =
      d === "os-personnalise"
        ? "OS personnalisé (construit sur SON métier)"
        : d === "visibilite"
          ? "Visibilité / Growth"
          : "Digitalisation (< 40 k)";
    ajouter(d, label, null, null, "Chiffré au cadrage. Aucun montant tant que le cadrage n'a pas eu lieu.");
  }

  // ── Les totaux ──
  let client = zero();
  let nous = zero();
  const parCompte = new Map<string, { nom: string; client: Totaux; nous: Totaux }>();

  for (const l of lignes) {
    const cs = l.clientSetupHT ?? 0;
    const cm = l.clientMensuelHT ?? 0;
    const ns = l.nousSetupHT ?? 0;
    const nm = l.nousMensuelHT ?? 0;
    client = cumule(client, cs, cm);
    nous = cumule(nous, ns, nm);

    const b = bareme(l.accountId);
    const cur = parCompte.get(l.accountId) ?? { nom: b.nom, client: zero(), nous: zero() };
    cur.client = cumule(cur.client, cs, cm);
    cur.nous = cumule(cur.nous, ns, nm);
    parCompte.set(l.accountId, cur);
  }

  if (aChiffrer.length > 0) {
    alertes.push(
      `${aChiffrer.length} ligne(s) sans montant : elles ne sont PAS dans les totaux. ` +
        `Un total qui absorbe une ligne non chiffrée annonce un devis faux.`
    );
  }

  return {
    lignes,
    client,
    nous,
    parCompte: [...parCompte.entries()].map(([accountId, v]) => ({ accountId, ...v })),
    aChiffrerAuCadrage: aChiffrer,
    alertes,
  };
}

