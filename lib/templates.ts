import type { Prospect, Sector, Stage } from "./types";

/**
 * Bibliothèque de scripts de vente — industrie × moment du pipeline × format.
 * Chaque template = un cadre (le moment) rempli avec l'angle du secteur.
 * Variables : {prenom} {commerce} {ville} {taxe} {closer} — remplies depuis
 * un prospect réel, ou laissées visibles pour copier dans un autre outil.
 */

export type TemplateFormat = "email" | "dm" | "appel";

export type StageGroup =
  | "premier-contact"
  | "audit"
  | "demo"
  | "closing"
  | "apres-signature"
  | "reconquete";

export const STAGE_GROUPS: { id: StageGroup; label: string; goal: string; stages: Stage[] }[] = [
  { id: "premier-contact", label: "Premier contact", goal: "Décrocher 20 min d'audit gratuit — rien vendre", stages: ["prospect", "contact"] },
  { id: "audit", label: "Audit", goal: "Confirmer le RDV, puis restituer les chiffres", stages: ["audit"] },
  { id: "demo", label: "Démo mobile", goal: "Montrer AVANT de parler prix — l'émotion d'abord", stages: ["demo"] },
  { id: "closing", label: "Closing", goal: "Obtenir le oui — jamais de prix par écrit avant la démo", stages: ["offre", "redzone"] },
  { id: "apres-signature", label: "Après signature", goal: "Onboarding impeccable + demander 2 recommandations", stages: ["signe"] },
  { id: "reconquete", label: "Reconquête", goal: "Rester présent sans vendre — revenir dans 90 jours", stages: ["perdu"] },
];

export const FORMAT_LABELS: Record<TemplateFormat, string> = {
  email: "✉ Email",
  dm: "💬 DM / WhatsApp",
  appel: "📞 Appel",
};

/** L'angle de chaque industrie : douleur, preuve locale, exemple de perte. */
const SECTOR_ANGLES: Record<
  Exclude<Sector, "autre">,
  { label: string; pain: string; proof: string; night: string; lossUnit: string }
> = {
  restaurant: {
    label: "Restaurants",
    pain: "des tables vides en semaine et des appels ratés pendant le service",
    proof: "un bouchon de la Croix-Rousse prend maintenant ses réservations à 23h, pendant que le patron dort",
    night: "hier soir à 22h, des gens cherchaient où manger dans votre quartier — et sont allés chez celui qui répond",
    lossUnit: "couverts",
  },
  pub: {
    label: "Pubs & bars",
    pain: "des mardis et mercredis à moitié vides pendant que vos événements restent invisibles",
    proof: "un pub du Vieux Lyon remplit ses soirées quiz à 80 % avec un simple agenda en ligne + relances WhatsApp",
    night: "vos soirées sont annoncées à la craie — ceux qui ne passent pas devant ne viendront jamais",
    lossUnit: "clients de soirée",
  },
  ambulance: {
    label: "Ambulances",
    pain: "des demandes de transport qui arrivent la nuit et que personne ne voit",
    proof: "une société de Villeurbanne récupère 12 transports programmés par mois grâce à un standard qui répond 24/7",
    night: "entre 20h et 7h, votre standard dort — pas les demandes",
    lossUnit: "transports",
  },
  artisan: {
    label: "Artisans",
    pain: "une dizaine d'appels manqués par semaine pendant que vous êtes sur chantier",
    proof: "une menuiserie de Caluire reçoit maintenant 9 demandes de devis qualifiées par mois, sans décrocher le téléphone",
    night: "7 appelants sur 10 ne rappellent pas : ils prennent le devis du suivant",
    lossUnit: "devis",
  },
};

export interface ScriptTemplate {
  id: string;
  sector: Exclude<Sector, "autre">;
  group: StageGroup;
  format: TemplateFormat;
  title: string;
  body: string;
  tip: string;
}

/** Cadres par moment × format — {pain} {proof} {night} remplis par secteur. */
const FRAMES: {
  group: StageGroup;
  format: TemplateFormat;
  title: string;
  body: string;
  tip: string;
}[] = [
  // ── Premier contact ──────────────────────────────────────────────
  {
    group: "premier-contact", format: "email", title: "Prise de contact — la douleur, pas le produit",
    body: `Objet : {night_court}

Bonjour {prenom},

Je travaille avec des {secteur_bas} de {ville} sur un problème précis : {pain}.

{night}.

Je ne vends rien par email. Je vous propose 20 minutes sur place : je mesure ce que ça vous coûte réellement chaque mois, vous gardez les chiffres, vous décidez avec.

Mardi 15h ou jeudi 10h ?

{closer} — EAGLEYE, Lyon`,
    tip: "Zéro mention du produit, zéro prix. L'objectif unique : un créneau daté.",
  },
  {
    group: "premier-contact", format: "dm", title: "DM court — curiosité + créneau",
    body: `Bonjour {prenom} 👋 {closer}, d'EAGLEYE (Lyon). Une question directe : {night_court} ? C'est le cas pour la plupart des {secteur_bas} du coin. J'ai un truc à vous montrer sur mon téléphone, 2 minutes, pas un pitch. Je passe mardi 15h ou jeudi 10h ?`,
    tip: "Un DM se lit en 5 secondes. Une question, une preuve, deux créneaux. Rien d'autre.",
  },
  {
    group: "premier-contact", format: "appel", title: "Script d'appel — 30 secondes chrono",
    body: `1. OUVERTURE (10 s, débit calme)
« Bonjour, {prenom} ? {closer}, je travaille avec des {secteur_bas} de {ville}. 30 secondes, promis. »

2. LA DOULEUR (pas le produit)
« Je vous appelle parce que chez vos confrères, on retrouve toujours le même problème : {pain}. »

3. LA PREUVE
« Pour vous situer : {proof}. »

4. LA BASCULE (objectif unique : le RDV)
« Je ne vends rien au téléphone. Je vous propose 20 minutes sur place : je chiffre ce que ça vous coûte, vous décidez avec les vrais chiffres. Mardi 15h ou jeudi 10h ? »

⛔ S'il dit « envoyez-moi une doc » → « Justement, une doc ne peut pas mesurer VOS pertes. C'est pour ça que je passe. 20 minutes. »`,
    tip: "Appeler aux heures creuses du secteur. Ne JAMAIS pitcher le produit au téléphone.",
  },

  // ── Audit ─────────────────────────────────────────────────────────
  {
    group: "audit", format: "email", title: "Confirmation d'audit + mise en tension",
    body: `Objet : Notre RDV de {jour} — ce que je vais mesurer

Bonjour {prenom},

Confirmé pour {jour}. Concrètement, en 20 minutes je vais chiffrer trois choses chez {commerce} :

1. Combien de clients vous cherchent en ligne… et ne vous trouvent pas
2. Combien d'appels / demandes passent à la trappe chaque semaine
3. Ce que ça représente en euros par mois

Vous gardez le document, quoi qu'il arrive. À {jour} !

{closer} — EAGLEYE`,
    tip: "L'audit crée la dette de réciprocité : on donne les chiffres AVANT de proposer quoi que ce soit.",
  },
  {
    group: "audit", format: "dm", title: "Rappel de RDV la veille",
    body: `{prenom}, c'est {closer} 👋 On se voit demain {heure} chez {commerce}. J'apporte le diagnostic complet — vous gardez les chiffres même si on ne travaille jamais ensemble. À demain !`,
    tip: "Un rappel la veille divise les lapins par deux. Toujours rappeler ce qu'IL y gagne.",
  },
  {
    group: "audit", format: "appel", title: "Restitution d'audit — les chiffres qui piquent",
    body: `1. LE CADRE
« Je vous ai promis des chiffres, pas un discours. Les voilà. »

2. LA TAXE D'IGNORANCE (le cœur)
« Chaque mois, {commerce} laisse partir environ {taxe} — des {lossUnit} qui vont chez le concurrent qui répond. Ce n'est pas moi qui le dis : c'est votre propre flux de clients. »

3. LE SILENCE
Poser la feuille. Se taire. Le laisser digérer le chiffre.

4. LA BASCULE
« La question n'est plus "est-ce que ça coûte cher de faire quelque chose". C'est "combien ça coûte de ne rien faire". Je vous montre à quoi ressemblerait la solution — 2 minutes, sur mon téléphone ? »`,
    tip: "Le chiffre doit être LE SIEN (ses appels ratés × son panier). Un chiffre générique ne pique pas.",
  },

  // ── Démo mobile ───────────────────────────────────────────────────
  {
    group: "demo", format: "email", title: "Invitation à la démo — teaser sans rien montrer",
    body: `Objet : {commerce} — j'ai quelque chose à vous montrer

Bonjour {prenom},

Suite à l'audit, j'ai préparé quelque chose de spécifique à {commerce}. Pas une plaquette : une maquette vivante, avec votre nom, vos couleurs, votre réalité.

Ça se regarde en 2 minutes sur un téléphone, et ça vaut mille explications.

Je passe {jour} — plutôt début ou fin d'après-midi ?

{closer} — EAGLEYE`,
    tip: "Ne JAMAIS envoyer la maquette par email. L'émotion se vit en face, sur SON téléphone.",
  },
  {
    group: "demo", format: "dm", title: "Teaser DM — la curiosité fait le travail",
    body: `{prenom}, la maquette de {commerce} est prête 👀 Je ne l'envoie pas — ça se regarde en vrai, sur votre téléphone, ça prend 2 minutes. Je suis dans le quartier {jour}. {heure1} ou {heure2} ?`,
    tip: "Refuser d'envoyer crée la curiosité. La démo par lien = zéro émotion = zéro décision.",
  },
  {
    group: "demo", format: "appel", title: "Pendant la démo — le silence vend",
    body: `1. LE GESTE
Tendre VOTRE téléphone avec SA maquette ouverte. Ne rien dire pendant 10 secondes.

2. LA PHRASE (une seule)
« Voilà à quoi ressemble {commerce} quand on le cherche en ligne. »

3. LE LAISSER FAIRE
Il va scroller, montrer à quelqu'un, poser des questions. Chaque question = une croyance qui s'installe. Répondre court.

4. ANCRER L'ÉMOTION (avant toute logique)
« Imaginez : {night_court}. Sauf que cette fois, c'est chez vous qu'ils arrivent. »

⛔ INTERDIT : parler prix pendant la démo. Si LUI demande le prix → « J'y viens. D'abord, est-ce que ÇA, ça vous ressemble ? »`,
    tip: "La démo AVANT le prix, toujours. Le prix posé sur l'émotion paraît petit ; posé à froid, il paraît gros.",
  },

  // ── Closing ───────────────────────────────────────────────────────
  {
    group: "closing", format: "email", title: "Relance décision — jamais le prix par écrit",
    body: `Objet : {commerce} — où en êtes-vous ?

Bonjour {prenom},

Vous avez vu la maquette et les chiffres : {taxe} qui partent chaque mois pendant que rien ne change.

Je ne remets pas l'offre par écrit — on l'a vue ensemble et les conditions sont réservées à notre échange. Ce qu'il reste à faire tient en un appel de 10 minutes : on décide, dans un sens ou dans l'autre.

Demain {heure1} ou {heure2} ?

{closer} — EAGLEYE`,
    tip: "Une décision différée est une décision. L'email sert à obtenir l'appel, pas à négocier.",
  },
  {
    group: "closing", format: "dm", title: "Relance douce J+2 — le coût de l'attente",
    body: `{prenom}, depuis notre échange de mardi, {commerce} a encore laissé filer ~{taxe_semaine} 📉 Je ne vous relancerai pas 15 fois : on se fait l'appel décision de 10 min ? Demain {heure1} ou {heure2}.`,
    tip: "Une relance = un chiffre + deux créneaux. Annoncer qu'on ne harcèlera pas augmente le taux de réponse.",
  },
  {
    group: "closing", format: "appel", title: "Appel de closing — réparer la croyance, pas argumenter",
    body: `1. LE CADRE (30 s)
« On a tout vu : vos chiffres, la maquette. Aujourd'hui on décide — oui ou non, les deux sont OK. »

2. ISOLER LE VRAI BLOCAGE
« Avant de décider : de 1 à 10, à combien vous croyez que ça marcherait POUR VOUS ? »
— Sous 10 → « Qu'est-ce qui manque pour un 10 ? » (c'est LA question du closing)

3. RÉPARER SELON LA RÉPONSE
· « C'est cher » → « Comparé aux {taxe} que vous perdez chaque mois ? L'abonnement se rembourse en {lossUnit} récupérés. »
· « Je dois réfléchir » → « À quoi exactement ? » (isoler, puis traiter LA vraie raison)
· « Il faut que j'en parle à X » → « Très bien — on fixe MAINTENANT le RDV à trois. Quel jour ? »

4. VERROUILLER
« On démarre {jour}. Je vous envoie le contrat ce soir, vous signez demain matin. Ça marche ? »`,
    tip: "Ta conviction doit être à 10/10 avant l'appel. La conviction se transfère — le doute aussi.",
  },

  // ── Après signature ───────────────────────────────────────────────
  {
    group: "apres-signature", format: "email", title: "Bienvenue + le rail des 30 jours",
    body: `Objet : C'est parti, {prenom} 🦅

Bienvenue chez EAGLEYE !

Voilà exactement ce qui se passe maintenant :
· J+3 : votre site en prévisualisation
· J+7 : mise en ligne + prise en main (15 min, tout est fait pour vous)
· J+30 : premier rapport chiffré — ce que le site vous a réellement apporté

Vous n'avez rien à faire d'autre que valider. Mon numéro direct : je réponds.

{closer} — EAGLEYE`,
    tip: "La croyance n°2 (« tu me soutiens ») se prouve dans les 7 premiers jours. Sur-communiquer.",
  },
  {
    group: "apres-signature", format: "dm", title: "Demande de recommandation — semaine 1",
    body: `{prenom}, le site de {commerce} avance bien 🚀 Une question : dans votre entourage pro, qui perd des clients comme vous en perdiez ? Deux noms suffisent — je les traite aussi bien que vous, et vous y gagnez un mois offert par signature.`,
    tip: "LE meilleur moment pour un referral : la semaine de la signature, quand l'enthousiasme est au max.",
  },
  {
    group: "apres-signature", format: "appel", title: "Point J+30 — transformer le client en ambassadeur",
    body: `1. LES RÉSULTATS D'ABORD
« {prenom}, en 30 jours : X visites, Y demandes, Z {lossUnit} récupérés. Votre abonnement est remboursé {fois}× rien que là-dessus. »

2. LA QUESTION QUI OUVRE TOUT
« Qu'est-ce qui vous a le plus surpris ? » (sa réponse = votre futur argument de vente, mot pour mot)

3. L'AVIS GOOGLE
« Ce que vous venez de me dire — vous pouvez l'écrire en avis Google ? Ça prend 60 secondes et ça m'aide énormément. »

4. LES 2 NOMS
« Et qui, autour de vous, devrait voir les mêmes chiffres ? »`,
    tip: "Un client à J+30 avec des résultats = une machine à referrals. Ne rate jamais ce rendez-vous.",
  },

  // ── Reconquête ────────────────────────────────────────────────────
  {
    group: "reconquete", format: "email", title: "J+30 après un non — utile, zéro vente",
    body: `Objet : 3 idées gratuites pour {commerce}

Bonjour {prenom},

Promis, je ne revends rien. Trois choses que les meilleurs {secteur_bas} de {ville} font en ce moment, et que vous pouvez faire sans moi :

1. Répondre à chaque avis Google (même les bons) — ça remonte votre fiche
2. Mettre vos horaires à jour partout ({night_court} !)
3. Publier une vraie photo par semaine

Si un jour vous voulez la version complète, vous savez où me trouver.

{closer} — EAGLEYE`,
    tip: "Donner sans demander. C'est ce qui rend le retour à J+90 naturel et attendu.",
  },
  {
    group: "reconquete", format: "dm", title: "J+60 — la preuve fraîche",
    body: `{prenom}, des nouvelles fraîches : {proof}. Je repense à {commerce} à chaque fois que je vois ces chiffres. Quand vous voulez, on refait le point — sans engagement, comme toujours.`,
    tip: "Une preuve du MÊME secteur réactive la croyance n°3 (« ça peut marcher pour moi »).",
  },
  {
    group: "reconquete", format: "appel", title: "J+90 — le rappel sans pression",
    body: `1. L'OUVERTURE HONNÊTE
« {prenom}, {closer} d'EAGLEYE. Il y a 3 mois vous m'aviez dit non — c'était peut-être la bonne décision à ce moment-là. J'appelle juste pour savoir : où en êtes-vous ? »

2. ÉCOUTER (vraiment)
S'il a pris une solution low-cost : « Et ça vous apporte des clients, concrètement ? » (souvent : non)

3. LA PORTE OUVERTE
« Je refais l'audit gratuitement — les chiffres ont peut-être changé. 20 minutes, comme la première fois. Ça vous dit ? »`,
    tip: "Un non à 90 jours n'est plus un non. Le low-cost a eu le temps de décevoir.",
  },
];

/** Compose la bibliothèque complète : cadres × secteurs. */
export function buildTemplates(): ScriptTemplate[] {
  const out: ScriptTemplate[] = [];
  for (const [sectorId, angle] of Object.entries(SECTOR_ANGLES) as [Exclude<Sector, "autre">, (typeof SECTOR_ANGLES)[keyof typeof SECTOR_ANGLES]][]) {
    for (const f of FRAMES) {
      out.push({
        id: `${sectorId}-${f.group}-${f.format}`,
        sector: sectorId,
        group: f.group,
        format: f.format,
        title: f.title,
        tip: f.tip,
        body: f.body
          .replaceAll("{pain}", angle.pain)
          .replaceAll("{proof}", angle.proof)
          .replaceAll("{night}", angle.night)
          .replaceAll("{night_court}", angle.night.split("—")[0].split(":")[0].trim().toLowerCase())
          .replaceAll("{lossUnit}", angle.lossUnit)
          .replaceAll("{secteur_bas}", angle.label.toLowerCase()),
      });
    }
  }
  return out;
}

export const SECTOR_LABELS: Record<Exclude<Sector, "autre">, string> = {
  restaurant: SECTOR_ANGLES.restaurant.label,
  pub: SECTOR_ANGLES.pub.label,
  ambulance: SECTOR_ANGLES.ambulance.label,
  artisan: SECTOR_ANGLES.artisan.label,
};

/** Remplit les variables avec un prospect réel (ou laisse les {…} visibles). */
export function fillTemplate(body: string, p: Prospect | null, closerName: string): string {
  const weekly = p ? Math.round(p.ignoranceTax / 4.33) : null;
  return body
    .replaceAll("{prenom}", p?.name.split(" ")[0] || "{prenom}")
    .replaceAll("{commerce}", p?.company || "{commerce}")
    .replaceAll("{ville}", p?.city.split("—")[0].trim() || "Lyon")
    .replaceAll("{taxe}", p && p.ignoranceTax > 0 ? `${p.ignoranceTax.toLocaleString("fr-FR")} €` : "{taxe}")
    .replaceAll("{taxe_semaine}", weekly ? `${weekly.toLocaleString("fr-FR")} €` : "{taxe_semaine}")
    .replaceAll("{closer}", closerName || "{closer}")
    .replaceAll("{fois}", p && p.monthlyValue > 0 && p.ignoranceTax > 0 ? String(Math.max(1, Math.round(p.ignoranceTax / p.monthlyValue))) : "{fois}");
}
