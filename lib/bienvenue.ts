import type { AppSettings } from "./types";
import {
  LIBELLE_PROVENANCE,
  type LectureSite,
  type PropositionConfig,
  type Trouvaille,
} from "./lecture-site";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « TU DONNES TON SITE, ALPHA SE CONFIGURE DEVANT TOI. »
 *
 * La lecture du site existait (`lib/lecture-site.ts`) et remplissait un
 * formulaire — rangé dans un bandeau replié, derrière « Dire à qui je
 * vends ». Personne ne l'ouvrait le premier jour, et ceux qui l'ouvraient
 * voyaient des champs se remplir sans savoir ce que chacun allait CHANGER.
 *
 * Ce module transforme une lecture en une suite d'ÉTAPES DE CONFIGURATION :
 * pour chacune, ce qui a été trouvé, où, et ce que ça règle dans Alpha.
 * L'écran (`app/(app)/bienvenue`) les montre une par une — c'est le « devant
 * toi » : l'inscrit voit l'outil se régler sur son entreprise, réglage par
 * réglage, avant de valider quoi que ce soit.
 *
 * ══ CE QUI EST DÉLIBÉRÉ ══
 *
 * ⚠⚠ UNE ÉTAPE N'EXISTE QUE SI ELLE RÈGLE QUELQUE CHOSE. Le site porte aussi
 * un email et un téléphone ; aucun réglage ne les reçoit. Les afficher dans
 * un écran qui s'appelle « Alpha se configure » ferait croire qu'ils ont été
 * posés quelque part. Un test l'exige : chaque étape nomme le réglage
 * qu'elle touche.
 *
 * ⚠⚠ CE QUI N'EST PAS SUR LE SITE RESTE VIDE ET SE DIT (`a-completer`). Une
 * cible devinée fabriquerait une démonstration hors sujet dont personne ne
 * saurait qu'elle l'est — même règle que `lireSite`.
 *
 * ⚠⚠ LE DIRIGEANT N'EST JAMAIS SIGNATAIRE D'OFFICE (`a-choisir`). Celui qui
 * s'inscrit n'est pas forcément lui (`lib/signature.ts` : on ne devine pas
 * l'identité d'un humain). Il faut un acte : la case « c'est moi ».
 *
 * ⚠ LE PATCH DES RÉGLAGES A UNE SEULE DÉFINITION (`patchReglages`). Le
 * formulaire « À qui vends-tu ? » et cet écran appliquent la même lecture ;
 * deux recopies de « qu'est-ce qu'on écrase, qu'est-ce qu'on garde ? »
 * finiraient par diverger, et c'est le nom de l'entreprise — celui qui signe
 * — qui partirait faux.
 * ─────────────────────────────────────────────────────────────────────
 */

export type StatutEtape =
  /** Lu sur le site, prêt à poser. */
  | "lu"
  /** Lu, mais il faut un geste : choisir parmi plusieurs, ou confirmer. */
  | "a-choisir"
  /** Absent du site : l'inscrit le saisit, ou le laisse vide. */
  | "a-completer";

export type IdEtape = "lecture" | "entreprise" | "activite" | "cible" | "zone" | "signataire" | "rdv";

export interface EtapeConfig {
  id: IdEtape;
  /** Ce qu'Alpha règle, en mots. */
  quoi: string;
  statut: StatutEtape;
  /** La valeur trouvée — vide quand rien n'a été lu. */
  valeur: string;
  /** D'où elle vient — vide quand rien n'a été lu. */
  source: string;
  /** Ce que ce réglage change dans Alpha. Jamais vide : c'est la raison d'être de l'étape. */
  effet: string;
  /** Le champ des réglages qu'elle touche — le test vérifie qu'il existe. */
  reglage: keyof AppSettings | "profil.metier" | "profil.cibleSecteur" | "profil.cibleZone" | null;
}

/** « /contact », ou « accueil » pour la racine — la page sans le domaine. */
function cheminDe(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "accueil";
  } catch {
    // Une page illisible n'empêche pas de dire la provenance.
    return "accueil";
  }
}

/** « données du site · /contact » — la provenance et la page. */
export function sourceDe(t: Trouvaille | null | undefined): string {
  if (!t) return "";
  return `${LIBELLE_PROVENANCE[t.source]} · ${cheminDe(t.page)}`;
}

function hote(site: string): string {
  try {
    return new URL(site).host.replace(/^www\./, "");
  } catch {
    return site;
  }
}

/**
 * Les étapes, dans l'ordre où l'écran les révèle.
 *
 * L'ordre n'est pas décoratif : d'abord ce qui prouve qu'on a LU (les pages),
 * puis QUI tu es, ce que tu VENDS, À QUI, OÙ — et seulement à la fin ce qui
 * engage une personne (la signature) et ce qui produit des rendez-vous.
 */
export function etapesDeConfiguration(l: LectureSite, p: PropositionConfig): EtapeConfig[] {
  const etapes: EtapeConfig[] = [];

  const n = l.pagesLues.length;
  etapes.push({
    id: "lecture",
    quoi: "Lecture de ton site",
    statut: "lu",
    valeur: `${n} page${n > 1 ? "s" : ""} lue${n > 1 ? "s" : ""} sur ${hote(l.site)}`,
    source: l.pagesLues.map(cheminDe).join(" · "),
    effet: "Rien d'autre n'est lu : ni réseaux sociaux, ni annuaires, ni fichiers de tiers.",
    reglage: null,
  });

  const nomLu = p.agencyName.trim();
  const viaRegistre = !l.nom && Boolean(l.registre?.raisonSociale);
  etapes.push({
    id: "entreprise",
    quoi: "Ton entreprise",
    statut: nomLu ? "lu" : "a-completer",
    valeur: nomLu ? (p.offer.city ? `${nomLu} — ${p.offer.city}` : nomLu) : "",
    source: nomLu
      ? [viaRegistre ? "registre national" : sourceDe(l.nom), l.registre && !viaRegistre ? `recoupé au registre : ${l.registre.raisonSociale}` : ""]
          .filter(Boolean)
          .join(" · ")
      : "",
    effet: nomLu
      ? "Le nom qui signe tes messages et tes devis — à la place du nôtre."
      : "Ton site ne l'affiche pas clairement : saisis-le, sinon tes messages partent sous le nom d'usine.",
    reglage: "agencyName",
  });

  const metier = p.profil.metier.trim();
  etapes.push({
    id: "activite",
    quoi: "Ce que tu vends",
    statut: metier ? "lu" : "a-completer",
    valeur: metier,
    source: metier ? sourceDe(l.activite) : "",
    effet: metier
      ? "Ce que tes scripts et tes messages disent de ton offre."
      : "Pas de description lisible sur ton accueil : dis-le en une ligne.",
    reglage: "profil.metier",
  });

  const top = l.clienteles[0];
  etapes.push({
    id: "cible",
    quoi: "À qui tu vends",
    statut: !top ? "a-completer" : l.clienteles.length > 1 ? "a-choisir" : "lu",
    valeur: top ? `${top.libelle}${top.role ? ` — ${top.role}` : ""}` : "",
    source: top ? `${top.occurrences} mention${top.occurrences > 1 ? "s" : ""} · ${sourceDe(top.preuve)}` : "",
    effet: top
      ? "Les fiches d'exemple sont refaites sur ce marché. Tes vraies fiches ne bougent pas."
      : "Ton site ne nomme pas ta clientèle — on ne la devine pas. C'est le seul champ qui fabrique ta démo.",
    reglage: "profil.cibleSecteur",
  });

  const zone = p.profil.cibleZone.trim();
  etapes.push({
    id: "zone",
    quoi: "Où tu prospectes",
    statut: zone ? "lu" : "a-completer",
    valeur: zone,
    source: zone ? sourceDe(l.zone ?? l.ville) : "",
    effet: zone ? "La zone de tes fiches et de tes listes." : "Facultatif : sans zone, Alpha ne filtre pas géographiquement.",
    reglage: "profil.cibleZone",
  });

  const dirigeant = p.dirigeant.trim();
  etapes.push({
    id: "signataire",
    quoi: "Qui signe",
    statut: dirigeant ? "a-choisir" : "a-completer",
    valeur: dirigeant,
    source: dirigeant ? sourceDe(l.dirigeant) : "",
    effet: dirigeant
      ? "Signataire de tes messages SEULEMENT si tu confirmes que c'est toi."
      : "Aucun nom lu : tes messages signeront au nom de l'entreprise, tant que tu n'en mets pas un dans les réglages.",
    reglage: "closerName",
  });

  const rdv = p.bookingUrl.trim();
  etapes.push({
    id: "rdv",
    quoi: "Ton lien de rendez-vous",
    statut: rdv ? "lu" : "a-completer",
    valeur: rdv,
    source: rdv ? sourceDe(l.lienRdv) : "",
    effet: rdv
      ? "Le bouton « Réserver un créneau » de tes emails et de tes messages LinkedIn."
      : "Aucun Calendly ni Cal.com sur ton site : colle le tien, sinon chaque rendez-vous coûte trois allers-retours.",
    reglage: "bookingUrl",
  });

  return etapes;
}

/**
 * Ce que l'inscrit a gardé, choisi ou saisi — l'entrée de `patchReglages`.
 */
export interface ChoixConfiguration {
  /** L'identité lue (nom, ville, offre). `null` = rien lu, rien à poser. */
  identite: Pick<PropositionConfig, "agencyName" | "offer"> | null;
  /** Décochée = on garde l'identité actuelle telle quelle. */
  garderIdentite: boolean;
  lien: string;
  dirigeant: string;
  /** L'acte qui fait d'un nom lu un signataire. Faux par défaut, toujours. */
  cestMoi: boolean;
}

/**
 * Le patch des réglages. LA définition de « qu'est-ce qu'une lecture de site
 * a le droit d'écraser ? ».
 *
 * · Une valeur VIDE ne remplace jamais une valeur posée : le site n'a pas su
 *   la lire, ce n'est pas une raison d'effacer ce que l'inscrit avait mis.
 * · Le signataire ne change QUE sur `cestMoi` — et jamais sur un nom vide.
 * · Le lien de rendez-vous est posé tel quel : c'est un champ que l'écran
 *   montre et laisse modifier, la saisie fait foi.
 */
export function patchReglages(
  actuel: Pick<AppSettings, "agencyName" | "offer">,
  c: ChoixConfiguration
): Partial<AppSettings> {
  const base = actuel.offer ?? { city: "", whatYouSell: "", valueProp: "" };
  return {
    bookingUrl: c.lien.trim(),
    ...(c.identite && c.garderIdentite
      ? {
          agencyName: c.identite.agencyName.trim() || actuel.agencyName,
          offer: {
            city: c.identite.offer.city.trim() || base.city,
            whatYouSell: c.identite.offer.whatYouSell.trim() || base.whatYouSell,
            valueProp: c.identite.offer.valueProp.trim() || base.valueProp,
          },
        }
      : {}),
    ...(c.cestMoi && c.dirigeant.trim() ? { closerName: c.dirigeant.trim() } : {}),
  };
}

/**
 * Faut-il proposer l'écran de bienvenue tout seul, au premier passage ?
 *
 * ⚠ Seulement à un CLIENT connecté (ni maître, ni solo — eux ont l'assistant
 * d'installation, et le maître configurerait NOTRE compte sur le site d'un
 * autre), qui n'a encore décrit ni son profil ni vu l'écran. Une fois, pas
 * plus : on ne ramène pas de force quelqu'un qui a cliqué « plus tard ».
 */
export function proposerBienvenue(d: {
  session: boolean;
  maitre: boolean;
  solo: boolean;
  aUnProfil: boolean;
  dejaVu: boolean;
}): boolean {
  return d.session && !d.maitre && !d.solo && !d.aUnProfil && !d.dejaVu;
}
