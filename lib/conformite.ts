import { localTime, BUSINESS_TZ } from "./business-hours";
import { CLOSER_USINE } from "./signature";
/**
 * ─────────────────────────────────────────────────────────────────────
 * Conformité de la prospection B2B — France, août 2026.
 *
 * Ce module encode le droit applicable, pas une prudence de confort. Il
 * sert à deux choses : ne pas se mettre en faute, et ne pas s'interdire
 * ce qui est parfaitement légal par excès de prudence — les deux erreurs
 * coûtent, la seconde en silence.
 *
 * Le point que presque tout le monde confond : la loi du 11 août 2026 sur
 * le consentement préalable en démarchage téléphonique, et l'encadrement
 * des horaires qui l'accompagne, visent le CONSOMMATEUR. La prospection
 * B2B, vers une ligne professionnelle et sur un sujet professionnel,
 * reste licite au titre de l'intérêt légitime (RGPD art. 6.1.f), avec
 * information et droit d'opposition.
 *
 * Sources : RGPD art. 6.1.f, 13 et 21 · doctrine CNIL sur la prospection
 * commerciale (régime opt-out en B2B pour l'email et le SMS, à condition
 * que l'objet du message soit en rapport avec la profession de la
 * personne démarchée) · loi du 11 août 2026 (périmètre B2C) · règlement
 * européen sur l'IA, art. 50 (applicable depuis le 2 août 2026).
 *
 * Ce n'est pas un avis juridique. C'est l'état du droit tel qu'on
 * l'applique ici, avec ses sources, pour pouvoir en discuter.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Canal = "appel" | "email" | "sms" | "visite" | "linkedin";

export interface RegleConformite {
  canal: Canal;
  /** Le régime applicable en B2B, en une ligne. */
  regime: string;
  /** Ce qui est obligatoire — non négociable. */
  obligations: string[];
  /** L'erreur courante, celle qui met vraiment en faute. */
  piege: string;
  source: string;
}

export const REGLES: RegleConformite[] = [
  {
    canal: "appel",
    regime:
      "Licite sans consentement préalable vers une ligne professionnelle, sur un sujet professionnel (intérêt légitime).",
    obligations: [
      "S'identifier immédiatement : nom, société, objet de l'appel.",
      "Cesser d'appeler dès qu'un refus est exprimé — et le consigner.",
      "Ne pas utiliser de numéro masqué.",
    ],
    piege:
      "Croire que Bloctel s'applique. Bloctel protège les CONSOMMATEURS : un numéro professionnel publié par l'entreprise n'y est pas soumis. À l'inverse, appeler un artisan sur son mobile personnel utilisé comme ligne pro est une zone grise — s'il le dit, on arrête.",
    source: "Loi du 11 août 2026 (périmètre B2C) · art. L.223-1 code de la consommation",
  },
  {
    canal: "email",
    regime:
      "Régime OPT-OUT en B2B : pas de consentement préalable requis si le message concerne la profession du destinataire.",
    obligations: [
      "Identité de l'expéditeur visible et exacte.",
      "Objet du message en rapport avec la fonction de la personne.",
      "Moyen de refus simple et gratuit dans CHAQUE message.",
      "Traiter une opposition sans délai et définitivement.",
    ],
    piege:
      "Écrire à une adresse nominative (prenom.nom@) sur un sujet sans rapport avec la fonction de la personne. C'est ce lien-là qui fonde la licéité, pas le fait que l'adresse soit professionnelle.",
    source: "RGPD art. 6.1.f et 21 · doctrine CNIL prospection commerciale",
  },
  {
    canal: "sms",
    regime: "Même régime que l'email en B2B : opt-out, sujet en rapport avec la profession.",
    obligations: [
      "Mention « STOP » ou équivalent dans le message.",
      "S'identifier — un SMS anonyme est une faute.",
      "Ne pas envoyer en dehors des heures ouvrables : ce n'est pas une obligation légale en B2B, mais un SMS à 22 h détruit ce qu'il cherche à construire.",
    ],
    piege:
      "Le SMS paraît informel, donc on saute la mention de refus. C'est la même exigence que l'email : elle doit être dans le message, pas dans un message ultérieur.",
    source: "RGPD art. 21 · doctrine CNIL (SMS assimilé au courrier électronique)",
  },
  {
    canal: "visite",
    regime: "Aucune contrainte spécifique : se présenter dans un local professionnel ouvert au public est libre.",
    obligations: [
      "Respecter un refus, immédiatement.",
      "Si des coordonnées sont collectées sur place, informer de leur usage (RGPD art. 13).",
    ],
    piege:
      "Repasser une troisième fois chez quelqu'un qui a dit non. Ce n'est pas illégal — c'est ce qui transforme un prospect tiède en détracteur.",
    source: "RGPD art. 13",
  },
  {
    canal: "linkedin",
    regime: "Régi par les conditions d'utilisation de la plateforme, plus que par la loi.",
    obligations: [
      "Aucune automatisation par identifiants : c'est une violation des CGU, sanctionnée par la restriction du compte.",
      "Le message doit rester individuel et pertinent.",
    ],
    piege:
      "Un outil qui « automatise LinkedIn » met en jeu un compte qu'on ne récupère pas. C'est pour ça qu'ALPHA prépare et ouvre le profil, mais ne clique jamais à ta place.",
    source: "CGU LinkedIn · RGPD art. 6.1.f",
  },
];

export const regleFor = (c: Canal): RegleConformite => REGLES.find((r) => r.canal === c)!;

/**
 * Conservation des données de prospection.
 *
 * La CNIL retient trois ans à compter du dernier contact du prospect
 * pour les données de prospection commerciale B2B. Au-delà, la fiche
 * doit être supprimée ou anonymisée — sauf si elle est devenue client.
 */
export const CONSERVATION_MOIS = 36;

/**
 * Fenêtre d'appel professionnelle.
 *
 * Ce ne sont PAS des horaires légaux en B2B — l'encadrement horaire du
 * démarchage vise le consommateur. Ce sont les heures où un dirigeant de
 * TPE décroche vraiment, tirées de l'activité réelle : ni pendant le coup
 * de feu, ni pendant la pause déjeuner.
 */
export const FENETRES_APPEL: { label: string; from: number; to: number; note: string }[] = [
  { label: "Matin", from: 9, to: 12, note: "La meilleure fenêtre chez les artisans et garages : ils sont à l'atelier, pas encore débordés." },
  { label: "Après-midi", from: 14, to: 18, note: "Fenêtre des cabinets et agences. Éviter 12h–14h : personne ne décroche, et ça agace." },
];

/**
 * Une heure donnée tombe-t-elle dans une fenêtre utile ?
 *
 * ⚠ L'heure est lue dans le fuseau du MÉTIER, pas dans celui du serveur.
 * En production la fonction tourne en UTC : sans ça, « 9h–12h » devenait
 * 11h–14h heure française, donc on refusait le meilleur créneau et on
 * appelait en plein déjeuner. Voir lib/business-hours.ts.
 */
export function fenetreOuverte(now = new Date(), timeZone = BUSINESS_TZ): { open: boolean; label: string; why: string } {
  const { hour: h, weekend } = localTime(now, timeZone);
  if (weekend) {
    return {
      open: false,
      label: "week-end",
      why: "Un appel de prospection le week-end vers une TPE tombe soit dans le vide, soit sur quelqu'un qui ne veut pas être dérangé. Rien ne l'interdit ; tout le déconseille.",
    };
  }
  const f = FENETRES_APPEL.find((w) => h >= w.from && h < w.to);
  if (f) return { open: true, label: f.label, why: f.note };
  if (h >= 12 && h < 14)
    return { open: false, label: "pause déjeuner", why: "12h–14h : taux de décroché au plancher, et l'agacement au plafond." };
  return {
    open: false,
    label: "hors fenêtre",
    why: "Avant 9h ou après 18h, on ne joint pas un dirigeant de TPE — on le dérange.",
  };
}

/**
 * Mentions à faire figurer dans un premier contact écrit. Sans elles, le
 * message est en faute, quelle que soit sa qualité.
 */
export const MENTIONS_OBLIGATOIRES = [
  "Identité de l'expéditeur (nom + société)",
  "Objet en rapport avec la fonction du destinataire",
  "Moyen de refus simple et gratuit (« répondez STOP »)",
  "D'où vient l'adresse — PREMIER message seulement (voir MENTION_PROVENANCE)",
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * D'OÙ VIENT L'ADRESSE — la mention du PREMIER message (15/09/2026)
 *
 * La CNIL écrit que lorsque les coordonnées sont **acquises auprès de tiers**
 * ou déjà en possession, il faut s'assurer que la personne a été **informée**
 * de l'usage possible de son adresse à des fins de prospection, et qu'elle
 * peut s'y opposer. Ça vise exactement notre sourcing — arrêtés de permis,
 * profils, feuilles de calcul : personne n'y a jamais été informé de rien, et
 * l'obligation ne disparaît pas parce qu'on n'a pas collecté soi-même.
 *
 * ══ POURQUOI AU PREMIER MESSAGE, ET PAS À TOUS ══
 *
 * L'obligation est d'INFORMER, pas de répéter. Informer une fois remplit le
 * texte ; le répéter à chaque relance alourdit le message sans rien ajouter
 * en droit — et sur un SMS, se paie au segment. Décision de Zakaria, prise en
 * connaissance des trois options écrites dans `docs/A-FAIRE-ZAKARIA.md`.
 *
 * ══ ⚠ LA RÈGLE PORTE SON MOTIF, DANS LA MÊME ENTRÉE ══
 *
 * C'est la doctrine payée par `InterditFroid` : une règle écrite en prose
 * n'est pas une règle, et deux listes séparées divergent — c'est celle qu'on
 * ne relit pas qui cesse de mordre.
 *
 * ⚠ Le motif exige DEUX moitiés présentes ensemble : on parle bien des
 * coordonnées DU DESTINATAIRE, et on dit D'OÙ elles viennent. « votre
 * adresse » seul n'informe de rien ; « registre public » seul peut parler de
 * tout autre chose. Aucune des deux moitiés ne suffit, et c'est ce couplage
 * qui évite le faux positif sur une phrase de vente ordinaire.
 * ─────────────────────────────────────────────────────────────────────
 */
export const MENTION_PROVENANCE = {
  /** La règle, lisible — celle qu'on discute avec un juriste. */
  regle:
    "Au PREMIER message à une adresse, dire d'où elle vient. L'obligation naît de la collecte indirecte : la personne n'a jamais été informée par nous.",
  /** Le motif, exécutable — celui qui mord. */
  motif:
    /(?=.*\b(?:votre|vos)\s+(?:adresse|coordonn[ée]es|e-?mail|courriel|profil|num[ée]ro))(?=.*(?:public|publi[ée]|registre|annuaire|r[ée]pertoire|site|profil|trouv|obtenu|issue?s?\s+de|provien|recueilli|consult))/is,
  /**
   * Une formulation qui satisfait le motif, à donner à l'opérateur quand on
   * refuse. Un garde qui refuse sans dire quoi écrire se fait désarmer.
   *
   * ⚠ Elle est un EXEMPLE, pas un gabarit imposé : la provenance réelle change
   * d'une fiche à l'autre, et écrire « registre public » sur une adresse prise
   * ailleurs serait une information fausse — donc pire que pas d'information.
   */
  exemple:
    "Votre adresse professionnelle provient d'un registre public ; répondez STOP et je ne vous écris plus.",
} as const;

/**
 * Est-ce le premier message qu'on adresse à ce destinataire ?
 *
 * ⚠ Un booléen nu au point d'appel (`verifieMentions(t, c, m, true)`) ne se
 * relit pas. On nomme la décision — même motif que `LecturePermis.demande` :
 * un score agrège, une décision se nomme.
 */
export type RangMessage = "premier" | "suivant";

/**
 * Le message écrit porte-t-il ses mentions obligatoires ?
 *
 * ⚠ `rang` est OBLIGATOIRE, sans valeur par défaut. Un défaut implicite
 * ferait passer un premier contact pour une relance au premier ajout
 * distrait — et le manquement serait silencieux, puisqu'il consiste à ne PAS
 * exiger quelque chose. `tsc` force chaque appelant à répondre ; c'est le
 * mécanisme qui a déjà rattrapé `StepDef.surface`.
 */
export function verifieMentions(
  body: string,
  closerName: string,
  agencyName: string,
  rang: RangMessage
): string[] {
  const manques: string[] = [];
  const t = body.toLowerCase();
  /**
   * ⚠ « Le Closer » satisfaisait ce contrôle.
   *
   * La mention exigée est l'IDENTITÉ de l'expéditeur. Le réglage d'usine est
   * un libellé de démonstration : il n'identifie personne, mais il était bien
   * présent dans le corps, donc la vérification passait au vert. Un contrôle
   * de conformité qu'un placeholder satisfait ne contrôle rien.
   */
  if (closerName.trim() === CLOSER_USINE)
    manques.push(`Nom de l'expéditeur non renseigné (« ${CLOSER_USINE} » est le réglage d'usine)`);
  else if (closerName && !t.includes(closerName.toLowerCase())) manques.push("Nom de l'expéditeur absent");
  if (agencyName && !t.includes(agencyName.toLowerCase())) manques.push("Société de l'expéditeur absente");
  if (!/stop|désinscri|desinscri|ne plus recevoir|opposition/i.test(body))
    manques.push("Moyen de refus absent — obligatoire dans CHAQUE message");
  /**
   * ⚠ Celle-ci ne vaut QUE sur le premier message. Sur une relance, l'exiger
   * serait refuser un message parfaitement licite — et un garde qui refuse
   * une phrase juste est un garde qu'on assouplit au mauvais endroit.
   */
  if (rang === "premier" && !MENTION_PROVENANCE.motif.test(body))
    manques.push(
      `Provenance de l'adresse absente — obligatoire au PREMIER message. Exemple : « ${MENTION_PROVENANCE.exemple} »`
    );
  return manques;
}
