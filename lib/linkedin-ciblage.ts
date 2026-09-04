import { verticalForText, type VerticalPlaybook } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CIBLAGE LINKEDIN — « cette personne mérite-t-elle une de mes invitations ? »
 *
 * ── POURQUOI CE MODULE EXISTE ──
 *
 * La demande de départ était : « se connecter à 200 personnes et envoyer un
 * DM à toutes celles qui sont intéressantes pour l'offre ». Le tri EST le
 * travail, et il n'existait nulle part : `buildLinkedinQueue` prend ce qui est
 * déjà dans le CRM et le filtre par ville. Personne ne répondait à la question
 * « celui-là, on l'invite ou pas ».
 *
 * Ce n'est pas une question de confort. Les invitations sont un budget PLAFONNÉ
 * à la semaine (voir `linkedin-plan.ts`). Une invitation dépensée sur un
 * apprenti mécanicien est une invitation qui n'ira pas au gérant du garage
 * d'à côté — et un taux d'acceptation qui baisse fait restreindre le compte.
 * Chaque profil écarté ici est un profil de plus qu'on peut viser cette
 * semaine.
 *
 * ── CE QU'ON PEUT VOIR, ET CE QU'ON NE PEUT PAS ──
 *
 * Un profil LinkedIn donne un intitulé de poste, une entreprise, une ville,
 * parfois une taille. Il ne donne NI le nombre d'appels manqués, NI l'état du
 * site, NI la note Google. Donc `buildLadder` (l'ESCALIER) ne peut pas tourner
 * sur un profil : il rendrait « fiche trop pauvre » pour tout le monde.
 *
 * Ce module répond donc à une question plus petite et honnête : **est-ce que
 * ça vaut une invitation**, et si oui, sur quel angle. La marche de l'escalier
 * se décidera plus tard, quand la personne aura répondu et qu'on aura des
 * faits.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'un profil LinkedIn expose réellement. Tout est optionnel : c'est du
 *  relevé à la main ou de l'import, jamais une source fiable. */
export interface ProfilLinkedin {
  nom?: string;
  /** L'intitulé de poste, tel qu'écrit par la personne. */
  titre?: string;
  entreprise?: string;
  ville?: string;
  url?: string;
  /** Le secteur affiché par la page entreprise, en texte libre. */
  secteur?: string;
  /** La tranche d'effectif affichée (« 11-50 employés »). */
  taille?: string;
}

export type RoleDetecte = "decideur" | "operationnel" | "inconnu";

export interface Ciblage {
  /** On dépense une invitation sur ce profil, oui ou non. */
  retenu: boolean;
  /** 0–100. Sert à ORDONNER la file, pas à décider seul. */
  score: number;
  role: RoleDetecte;
  verticaleId: string | null;
  verticaleLabel: string | null;
  /** Les faits qui ont fait retenir — vérifiables sur le profil, un par un. */
  pourquoi: string[];
  /** Ce qui manque pour trancher. Un profil « inconnu » n'est pas un refus. */
  manque: string[];
  /** Ce qui devrait faire hésiter même quand le score est bon. */
  risques: string[];
}

/**
 * Décideur : celui qui peut dire oui tout seul.
 *
 * ⚠ « Responsable » et « chargé de » ne sont PAS dans cette liste, et c'est
 * délibéré : « responsable commercial » ne signe pas un budget logiciel dans
 * une PME. Les mettre ici ferait passer le filtre à presque tout le monde,
 * c'est-à-dire ne filtrerait plus rien.
 */
const DECIDEUR =
  /\b(g[ée]rant|dirigeant|fondat|founder|co-?found|pr[ée]sident|pdg|p-dg|ceo|directeur g[ée]n[ée]ral|dg\b|propri[ét]taire|proprio|patron|chef d'entreprise|owner|associ[ée]|artisan|à son compte|a son compte|self-?employed|ind[ée]pendant)/i;

/** Opérationnel : la personne exécute, elle ne tranche pas sur un budget. */
const OPERATIONNEL =
  /\b(assistant|secr[ée]taire|r[ée]ceptionn|apprenti|stagiaire|intern\b|alternan|technicien|op[ée]rateur|vendeur|conseill|charg[ée] de|employ[ée]|ouvrier|poseur|monteur|chauffeur|livreur|caissi)/i;

/** Les métiers qu'on ne veut pas inviter : ils vendent la même chose que nous. */
const CONCURRENT =
  /\b(agence (web|digitale|de communication)|growth|freelance (marketing|seo)|consultant (digital|ia|seo)|int[ée]grateur|no-?code|automation|saas|[ée]diteur de logiciel)/i;

/** Tranche d'effectif → nombre approximatif, depuis le texte affiché. */
function effectif(taille?: string): number | null {
  const t = (taille ?? "").replace(/\s| /g, "");
  const m = t.match(/(\d+)[-–—à](\d+)/);
  if (m) return Number(m[2]);
  const seul = t.match(/(\d{1,6})/);
  return seul ? Number(seul[1]) : null;
}

/**
 * Au-delà de cet effectif, la doctrine ne tient plus.
 *
 * Tout le playbook vise « le patron est sur le terrain, pas derrière un
 * bureau ». Dans une boîte de 250 personnes, il y a un standard, un service
 * informatique, un processus d'achat — la douleur du téléphone qui tombe dans
 * le vide n'existe pas, et le décideur n'est pas joignable en un DM.
 */
export const EFFECTIF_MAX = 250;

/**
 * ⚠ LE POINT QUI FÂCHE — quelles verticales existent RÉELLEMENT sur LinkedIn.
 *
 * Le playbook vise des métiers de terrain : couvreurs, garagistes,
 * restaurateurs, ambulanciers, auto-écoles. Ces gens-là n'ont, pour la
 * plupart, pas de profil LinkedIn actif — et quand ils en ont un, ils ne
 * l'ouvrent pas. C'est exactement la douleur qu'on leur vend (« vous êtes sur
 * le terrain, pas devant un écran ») : elle s'applique aussi à LinkedIn.
 *
 * Conséquence à assumer avant de dépenser 200 invitations : sur ce canal, ce
 * qui remonte n'est pas la cible du playbook, c'est surtout des agences, des
 * consultants et des éditeurs — c'est-à-dire nos concurrents.
 *
 * Ce n'est pas une raison de ne pas le faire. C'est une raison de savoir QUI
 * on cherche avant de commencer : sur LinkedIn, la cible plausible est le
 * dirigeant de PME de services (immobilier, santé, formation), pas l'artisan.
 */
export const PRESENCE_LINKEDIN: Record<string, "forte" | "moyenne" | "faible"> = {
  immobilier: "forte",
  /**
   * La seule verticale du playbook dont la présence LinkedIn n'est pas une
   * concession mais la raison d'être : un directeur de programmes, un
   * responsable de commercialisation ou un dirigeant de société de promotion
   * vit sur ce réseau — c'est là qu'il recrute, qu'il annonce ses lancements
   * et qu'il suit ses confrères. C'est exactement le profil que le paragraphe
   * ci-dessus décrivait sans pouvoir le nommer.
   */
  "maitrise-ouvrage": "forte",
  "sante-cabinet": "moyenne",
  "auto-ecole": "faible",
  "garage-carrosserie": "faible",
  "artisan-batiment": "faible",
  restauration: "faible",
  "bar-pub": "faible",
  ambulance: "faible",
  "centre-appels": "forte",
  "equipe-terrain": "moyenne",
  // Le fourre-tout du playbook. « Moyenne » parce qu'on ne sait rien : ce
  // n'est pas un pronostic, c'est l'absence de pronostic.
  generique: "moyenne",
};

/** Le seuil de rétention. Sous ce score, l'invitation coûte plus qu'elle ne rapporte. */
export const SCORE_MIN = 45;

export function detecterRole(titre?: string): RoleDetecte {
  const t = (titre ?? "").trim();
  if (!t) return "inconnu";
  // Le décideur gagne : « gérant & technicien » reste un gérant.
  if (DECIDEUR.test(t)) return "decideur";
  if (OPERATIONNEL.test(t)) return "operationnel";
  return "inconnu";
}

/**
 * Qualifie UN profil.
 *
 * Déterministe, sans clé, sans réseau : ça tourne sur un lot de 200 en une
 * fraction de seconde, et surtout ça rend le MÊME verdict deux jours de suite.
 * Un tri qui change d'avis n'est pas un tri.
 */
export function qualifier(profil: ProfilLinkedin): Ciblage {
  const pourquoi: string[] = [];
  const manque: string[] = [];
  const risques: string[] = [];

  const titre = (profil.titre ?? "").trim();
  const role = detecterRole(titre);

  const texte = [titre, profil.entreprise, profil.secteur].filter(Boolean).join(" ");
  const verticale: VerticalPlaybook | null = verticalForText(texte);

  /**
   * ── LES EXCLUSIONS SÈCHES ──
   *
   * Première version : tout passait par des points, et un grand compte perdait
   * 30 points sur 85 — donc restait retenu. Un barème qui laisse passer ce
   * qu'on a décidé d'exclure n'est pas sévère, il est décoratif.
   *
   * Ces trois cas ne sont pas « moins bons » : ils sont hors sujet. On les
   * sort, on dit pourquoi, et le score ne les rattrape pas.
   */
  const exclusions: string[] = [];

  const n = effectif(profil.taille);
  if (n !== null && n > EFFECTIF_MAX) {
    exclusions.push(`~${n} salariés : au-delà de ${EFFECTIF_MAX}, il y a un standard et un process d'achat — la douleur qu'on vend n'existe pas, et le dirigeant n'est pas joignable en un message`);
  }
  if (CONCURRENT.test(texte)) {
    exclusions.push("profil du même métier que nous — on ne dépense pas une invitation à vendre à un vendeur");
  }
  if (!(profil.url ?? "").trim() && !(profil.nom ?? "").trim()) {
    exclusions.push("ni nom ni URL — il n'y a personne au bout, ce profil ne se contacte pas");
  }

  let score = 0;

  // ── Le rôle : le critère qui commande, et il doit pouvoir dire NON seul. ──
  if (role === "decideur") {
    score += 50;
    pourquoi.push(`décideur — « ${titre} »`);
  } else if (role === "operationnel") {
    /**
     * Malus, pas simple absence de bonus. Avec un bonus faible, la verticale,
     * la ville et l'effectif suffisaient à faire passer un apprenti : les
     * points « gratuits » du contexte l'emportaient sur le seul critère qui
     * compte vraiment. Le rôle doit peser plus que le décor.
     */
    score -= 25;
    risques.push(`« ${titre} » exécute, il ne tranche probablement pas sur un budget`);
  } else {
    score += 10;
    manque.push(titre ? `intitulé peu lisible : « ${titre} »` : "aucun intitulé de poste");
  }

  // ── La verticale : est-ce un métier qu'on sait servir ? ──
  if (verticale) {
    score += 30;
    pourquoi.push(`verticale ${verticale.label} — playbook existant`);
    if (PRESENCE_LINKEDIN[verticale.id] === "faible") {
      risques.push(
        `${verticale.label} : métier peu présent sur LinkedIn — le canal téléphone ou terrain porte mieux`
      );
    }
    /**
     * ⚠ Le niveau de preuve du playbook remonte JUSQU'ICI, sinon il ne sert à
     * rien : un champ que personne ne lit est mort, pas « documenté ». Une
     * verticale écrite au bureau produit un score identique à une verticale
     * jouée cent fois au téléphone — la seule différence honnête, c'est de
     * dire laquelle des deux on est en train d'utiliser.
     */
    if (verticale.preuve === "doctrine") {
      risques.push(
        `${verticale.label} : playbook écrit à partir de la doctrine, zéro appel derrière — le script est une hypothèse, pas une méthode éprouvée`
      );
    }
  } else {
    manque.push("aucune verticale reconnue — le métier n'est pas lisible depuis le profil");
  }

  // ── La taille : la doctrine vise le patron joignable. ──
  if (n !== null && n <= EFFECTIF_MAX) {
    score += 10;
    pourquoi.push(`structure de ~${n} personnes — le dirigeant est encore joignable`);
  } else if (n === null) {
    manque.push("effectif inconnu");
  }

  // ── La ville : le terrain se déplace, et ça se dit dans le message. ──
  if ((profil.ville ?? "").trim()) {
    score += 10;
    pourquoi.push(`localisé — ${profil.ville!.trim()}`);
  } else {
    manque.push("ville absente : le message perdra son ancrage local");
  }

  score = Math.max(0, Math.min(100, score));
  risques.push(...exclusions);

  return {
    // Une exclusion ne se rattrape pas au score : c'est tout l'intérêt.
    retenu: exclusions.length === 0 && score >= SCORE_MIN,
    score,
    role,
    verticaleId: verticale?.id ?? null,
    verticaleLabel: verticale?.label ?? null,
    pourquoi,
    manque,
    risques,
  };
}

export interface LotQualifie {
  retenus: { profil: ProfilLinkedin; ciblage: Ciblage }[];
  ecartes: { profil: ProfilLinkedin; ciblage: Ciblage }[];
  /** Ce qu'il faut lire AVANT de lancer la campagne. */
  resume: string[];
}

/**
 * Trie un lot entier et dit ce que le lot vaut.
 *
 * Le résumé n'est pas décoratif : importer 200 lignes ne veut rien dire, savoir
 * que 40 méritent une invitation, si. C'est la même règle que l'API d'ingestion
 * de prospects — un lot se juge sur ce qui en sort d'exploitable.
 */
export function trierLot(profils: ProfilLinkedin[]): LotQualifie {
  const juges = profils.map((profil) => ({ profil, ciblage: qualifier(profil) }));
  const retenus = juges.filter((j) => j.ciblage.retenu).sort((a, b) => b.ciblage.score - a.ciblage.score);
  const ecartes = juges.filter((j) => !j.ciblage.retenu);

  const resume: string[] = [];
  resume.push(`${profils.length} profil(s) examiné(s) — ${retenus.length} retenu(s), ${ecartes.length} écarté(s).`);

  if (profils.length && retenus.length === 0) {
    resume.push("Aucun profil retenu : le lot ne correspond pas à l'ICP, ou les intitulés sont trop pauvres.");
  }

  const decideurs = retenus.filter((r) => r.ciblage.role === "decideur").length;
  if (retenus.length) {
    resume.push(`${decideurs}/${retenus.length} retenu(s) sont des décideurs identifiés.`);
  }

  // La friction de canal, dite une fois pour tout le lot.
  const faibles = new Set(
    retenus
      .map((r) => r.ciblage.verticaleId)
      .filter((id): id is string => !!id && PRESENCE_LINKEDIN[id] === "faible")
  );
  if (faibles.size) {
    resume.push(
      `${faibles.size} verticale(s) retenue(s) sont peu présentes sur LinkedIn — ces gens-là se joignent mieux au téléphone.`
    );
  }

  const sansVerticale = retenus.filter((r) => !r.ciblage.verticaleId).length;
  if (sansVerticale) {
    resume.push(`${sansVerticale} retenu(s) sans verticale : le message sera générique, donc plus faible.`);
  }

  return { retenus, ecartes, resume };
}
