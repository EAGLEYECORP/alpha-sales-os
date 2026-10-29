import type { Meeting, MeetingChannel, Prospect } from "./types";
import type { ProfilOperateur } from "./profil-operateur";
import { routerReponse, type IntentionReponse } from "./reponse-auto";
import { DIVULGATION_ECRITE } from "./signature-ia";
import { labelCreneau } from "./creneaux-rdv";
import type { MessageLu } from "./mime-lecture";
import { DO_NOT_CALL_TAG } from "./voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÉPONSE D'UN PROSPECT, CHEZ UN INSCRIT — la comprendre, y répondre sur
 * SON offre, et poser le rendez-vous (29/10/2026).
 *
 * `lib/reponse-auto.ts` porte déjà la TABLE qui décide (« le modèle classe, le
 * code dispose ») : seul le milieu de tunnel s'automatise ; l'argent, la
 * signature et le doute remontent à l'humain ; un refus clôt sans un mot. On la
 * RÉUTILISE (`routerReponse`), on ne la recopie pas. Ce qui change ici :
 *
 * · ⚠⚠ LES TEXTES. Ceux de `reponse-auto` parlent de NOTRE offre (bureau de
 *   vente, programmes) : servis à un inscrit qui vend des cuisines, ils
 *   mentiraient à son prospect. Ici, les réponses viennent de SON profil, et
 *   la question factuelle ne s'automatise QUE s'il a dit ce qu'il vend.
 * · LE CLASSEMENT SANS MODÈLE. Un inscrit n'a pas forcément de clé d'IA. Les
 *   règles d'ici sont donc VOLONTAIREMENT étroites : elles n'auto-agissent que
 *   sur des formes nettes (un « 2 » après une liste de créneaux, un « oui »,
 *   un « stop ») et rendent `hors-sujet` — donc l'humain — dans le doute.
 *   La doctrine le dit : un motif sur du texte libre exige un contexte ; le
 *   contexte, ici, c'est NOTRE message précédent (les créneaux proposés).
 * · LE CHOIX DU CRÉNEAU. On propose trois créneaux NUMÉROTÉS ; « 2 » pose le
 *   rendez-vous. Une réponse qui propose AUTRE CHOSE (« plutôt vendredi »)
 *   remonte à l'humain : réserver une heure qu'on a mal comprise est pire
 *   que de demander.
 *
 * ⚠ Tout ce qui part est AUTONOME : la divulgation IA (art. 50) est dans le
 * corps, et `/api/send` refuse un envoi qui l'aurait perdue.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Posé sur toute fiche qui attend un humain : une réponse qu'ALPHA ne tranche pas. Une seule écriture. */
export const TAG_A_TRAITER = "reponse-a-traiter";

export type IntentionInscrit = IntentionReponse | "choix-creneau" | "auto-reponse";

export interface Classement {
  intention: IntentionInscrit;
  /** Index du créneau choisi (0, 1, 2) quand `choix-creneau`. */
  creneau?: number;
  motif: string;
}

const sansAccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const REFUS =
  /\b(stop|desinscri\w*|desabonn\w*|ne (?:me |nous )?(?:plus )?(?:re)?contact\w*|plus de (?:mail|message)s?|pas interess\w*|aucun interet|non merci|retirez[- ](?:moi|nous)|supprimez[- ](?:moi|nous)|ne m'?ecrivez plus|pas (?:du tout )?besoin|n'?avons pas besoin|n'?ai pas besoin)\b/;
const PRIX = /\b(prix|tarifs?|tarification|combien|cout\w*|devis|budget|abonnement)\b|€|\beuros?\b/;
const SIGNER = /\b(signer|signature|contrat|bon de commande|on y va|je (?:vous )?commande|commander)\b/;
const OBJECTION =
  /\b(pas le temps|deja (?:un|une|des|equipe|prestataire)|trop cher|plus tard|pas maintenant|pas pour (?:le )?moment|pas convaincu\w*|on verra|recontactez[- ](?:moi|nous) (?:dans|en|plus)|rappelez[- ](?:moi|nous) (?:dans|en|plus))\b/;
const OUI =
  /\b(oui|ok|okay|d'?accord|volontiers|avec plaisir|pourquoi pas|interess(?:e|ee|es|ant|ante)|ca m'?interesse|ca nous interesse|dispo(?:nible)?s?|rendez[- ]vous|rdv|echanger|en parler|en discuter|appelez[- ](?:moi|nous)|rappelez[- ](?:moi|nous)|call|visio)\b/;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Le premier mot significatif de la réponse est-il un numéro de créneau ? */
function choixNumerote(texte: string, n: number): number | null {
  const premiere = texte.split(/\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const m = sansAccent(premiere).match(/^(?:(?:le|la|l'|option|choix|creneau|n°|numero|plutot le)\s*)?([1-9])(?:\b|\)|\.|$)/);
  if (m) {
    const i = Number(m[1]) - 1;
    return i >= 0 && i < n ? i : null;
  }
  const ailleurs = sansAccent(texte).match(/\b(?:le|option|choix|creneau|numero)\s*n?°?\s*([1-9])\b/);
  if (ailleurs) {
    const i = Number(ailleurs[1]) - 1;
    return i >= 0 && i < n ? i : null;
  }
  return null;
}

/** « mardi me va » quand UN SEUL des créneaux proposés tombe un mardi. */
function choixParJour(texte: string, creneaux: Date[]): number | null {
  const t = sansAccent(texte);
  const cites = JOURS.filter((j) => new RegExp(`\\b${j}\\b`).test(t));
  if (cites.length !== 1) return null;
  const jour = cites[0];
  const idx = creneaux
    .map((d, i) => ({ i, j: sansAccent(d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "Europe/Paris" })) }))
    .filter((x) => x.j === jour)
    .map((x) => x.i);
  return idx.length === 1 ? idx[0] : null;
}

/**
 * Classe une réponse. L'ordre décide : le refus d'abord (un « oui mais
 * arrêtez de m'écrire » est un refus), puis l'argent, la signature et le
 * doute (qui remontent), puis le choix d'un créneau, puis le oui.
 */
export function classerReponse(m: Pick<MessageLu, "texte" | "autoReponse">, creneauxProposes: Date[] = []): Classement {
  if (m.autoReponse) return { intention: "auto-reponse", motif: "Réponse automatique (absence) : ce n'est ni un oui ni un non." };
  const t = sansAccent(m.texte);
  if (!t.trim()) return { intention: "hors-sujet", motif: "Réponse vide une fois l'historique retiré." };
  if (REFUS.test(t)) return { intention: "refus", motif: "Il refuse : on ne le recontacte plus." };
  if (PRIX.test(t)) return { intention: "prix", motif: routerReponse("prix").motif };
  if (SIGNER.test(t)) return { intention: "veut-signer", motif: routerReponse("veut-signer").motif };
  if (OBJECTION.test(t)) return { intention: "objection", motif: routerReponse("objection").motif };
  if (creneauxProposes.length) {
    const i = choixNumerote(m.texte, creneauxProposes.length) ?? choixParJour(m.texte, creneauxProposes);
    if (i !== null) return { intention: "choix-creneau", creneau: i, motif: `Il choisit le créneau ${i + 1}.` };
    // Des créneaux étaient sur la table et il n'en a pris aucun clairement :
    // il propose sans doute autre chose. Un humain lit — on ne réserve pas une
    // heure mal comprise.
    return { intention: "hors-sujet", motif: "Il répond aux créneaux sans en choisir un clairement : à toi de caler l'heure." };
  }
  if (OUI.test(t)) return { intention: "veut-rdv", motif: routerReponse("veut-rdv").motif };
  if (t.includes("?")) return { intention: "renseignement", motif: routerReponse("renseignement").motif };
  return { intention: "hors-sujet", motif: routerReponse("hors-sujet").motif };
}

// ══════════ CE QUI PART ══════════

export interface Expediteur {
  closerName: string;
  agencyName: string;
  bookingUrl?: string;
}

export interface MailSortant {
  subject: string;
  body: string;
  attachments?: { filename: string; contentBase64: string; contentType: string }[];
}

const prenomDe = (p: Pick<Prospect, "name">) => (p.name || "").trim().split(/\s+/)[0] || "";
const bonjour = (p: Pick<Prospect, "name">) => (prenomDe(p) ? `Bonjour ${prenomDe(p)},` : "Bonjour,");
const signature = (e: Expediteur) => [e.closerName.trim(), e.agencyName.trim()].filter(Boolean).join(" — ");
const re = (sujet: string) => (/^re\s*:/i.test(sujet.trim()) ? sujet.trim() : `Re: ${sujet.trim() || "votre message"}`);

/**
 * Trois créneaux numérotés, et la façon d'y répondre en un caractère. Le lien
 * de réservation de l'inscrit, s'il en a un, reste une sortie.
 */
/**
 * « trois créneaux » / « 1, 2 ou 3 » — accordés au NOMBRE réellement proposé.
 * Depuis que son agenda est lu, il peut n'en rester qu'un ou deux : annoncer
 * trois et en lister deux, ou inviter à répondre « 3 » sur une liste de deux,
 * c'est une phrase fausse dans le message qui doit inspirer confiance.
 */
export function annonceCreneaux(n: number): { annonce: string; choix: string } {
  if (n <= 1) return { annonce: "voici un créneau", choix: "Répondez simplement 1" };
  if (n === 2) return { annonce: "voici deux créneaux", choix: "Répondez simplement 1 ou 2" };
  return { annonce: "voici trois créneaux", choix: "Répondez simplement 1, 2 ou 3" };
}

export function propositionCreneaux(p: Pick<Prospect, "name">, creneaux: Date[], e: Expediteur, sujet: string, intro?: string): MailSortant {
  const lignes = creneaux.map((d, i) => `${i + 1}. ${labelCreneau(d)}`);
  const { annonce, choix } = annonceCreneaux(creneaux.length);
  return {
    subject: re(sujet),
    body: [
      bonjour(p),
      "",
      intro ?? `Avec plaisir. Un échange de 20 minutes suffit — ${annonce} :`,
      "",
      ...lignes,
      "",
      `${choix} et je vous envoie l'invitation.`,
      ...(e.bookingUrl?.trim() ? ["", `Si aucun ne vous va, choisissez directement ici : ${e.bookingUrl.trim()}`] : []),
      "",
      signature(e),
      "",
      DIVULGATION_ECRITE,
    ]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n"),
  };
}

/**
 * La question factuelle. ⚠ Elle ne s'automatise que si l'inscrit a dit CE
 * QU'IL VEND : sans ça, on ne répondrait rien de vrai — on remonte.
 */
export function introRenseignement(profil: ProfilOperateur | null | undefined, nbCreneaux = 3): string | null {
  const metier = profil?.metier?.trim();
  if (!metier) return null;
  return `En deux mots : ${metier.charAt(0).toLowerCase()}${metier.slice(1).replace(/\.$/, "")}. Le plus simple est d'en parler 20 minutes — ${annonceCreneaux(nbCreneaux).annonce} :`;
}

/** Base64 d'un texte UTF-8 — sans `Buffer`, qui n'existe pas dans le navigateur où tourne l'autopilote. */
export function base64Utf8(s: string): string {
  let bin = "";
  for (const o of new TextEncoder().encode(s)) bin += String.fromCharCode(o);
  return btoa(bin);
}

/** Le rendez-vous posé, et l'invitation qui part avec. */
export function confirmationRdv(p: Pick<Prospect, "name">, creneau: Date, canal: MeetingChannel, e: Expediteur, sujet: string, ics: string): MailSortant {
  const comment = canal === "visio" ? "en visio — le lien suit" : canal === "physique" ? "sur place" : "par téléphone : je vous appelle";
  return {
    subject: re(sujet),
    body: [
      bonjour(p),
      "",
      `C'est noté : ${labelCreneau(creneau)}, ${comment}. L'invitation est jointe pour votre agenda.`,
      "",
      signature(e),
      "",
      DIVULGATION_ECRITE,
    ].join("\n"),
    attachments: [{ filename: "rendez-vous.ics", contentBase64: base64Utf8(ics), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  };
}

// ══════════ CE QUE LA FICHE DEVIENT ══════════

export interface DecisionReponse {
  classement: Classement;
  /** Ce qui change sur la fiche. */
  patch: Partial<Prospect>;
  /** Ce qui s'écrit sur la timeline (un FAIT). */
  evenement: string;
  /** Faut-il répondre, et quoi (sans les créneaux : le moteur les calcule). */
  repondre: "creneaux" | "renseignement" | "confirmer" | null;
  /** Remonte à l'humain, avec la raison. */
  escalade: string | null;
}

const extrait = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > 140 ? `${s.slice(0, 137)}…` : s;
};

/**
 * Ce qu'une réponse fait à la fiche. Pur : aucune I/O, aucune horloge lue.
 * L'envoi, la réservation et le journal se font chez l'appelant.
 */
export function deciderReponse(p: Prospect, m: MessageLu, profil: ProfilOperateur | null | undefined, maintenant: Date): DecisionReponse {
  const proposes = (p.rdvPropose?.creneaux ?? []).map((c) => new Date(c)).filter((d) => Number.isFinite(d.getTime()));
  const classement = classerReponse(m, proposes);
  const dit = `Réponse reçue : « ${extrait(m.texte) || m.sujet} »`;
  const auj = maintenant.toISOString().slice(0, 10);
  const base = { classement, evenement: `${dit} — ${classement.motif}` };

  switch (classement.intention) {
    case "auto-reponse":
      return { ...base, patch: {}, repondre: null, escalade: null };
    case "refus":
      return {
        ...base,
        patch: { tags: [...new Set([...(p.tags ?? []), DO_NOT_CALL_TAG])], stage: "perdu", nextStep: null },
        repondre: null,
        escalade: null,
      };
    case "choix-creneau":
      return { ...base, patch: {}, repondre: "confirmer", escalade: null };
    case "veut-rdv":
      return { ...base, patch: { stage: p.stage === "prospect" ? "contact" : p.stage }, repondre: "creneaux", escalade: null };
    case "renseignement":
      if (introRenseignement(profil)) return { ...base, patch: { stage: p.stage === "prospect" ? "contact" : p.stage }, repondre: "renseignement", escalade: null };
      return {
        ...base,
        patch: { nextStep: { date: auj, action: "Répondre à sa question (ALPHA ne sait pas ce que tu vends : remplis ton profil)" } },
        repondre: null,
        escalade: "Il pose une question, et ton profil ne dit pas ce que tu vends.",
      };
    default: {
      // prix, veut-signer, objection, hors-sujet : l'humain.
      const action =
        classement.intention === "prix"
          ? "Répondre sur le prix (de vive voix, jamais par écrit avant la démo)"
          : classement.intention === "veut-signer"
            ? "Il veut avancer : appelle-le pour signer"
            : classement.intention === "objection"
              ? "Lever son objection (lire sa réponse)"
              : "Lire sa réponse et lui répondre";
      return {
        ...base,
        patch: { tags: [...new Set([...(p.tags ?? []), TAG_A_TRAITER])], nextStep: { date: auj, action } },
        repondre: null,
        escalade: classement.motif,
      };
    }
  }
}

/** Le rendez-vous à poser quand il a choisi. */
export function rdvChoisi(p: Prospect, creneau: Date, canal: MeetingChannel, dureeMin: number, id: string): Meeting {
  return {
    id,
    prospectId: p.id,
    title: `Rendez-vous — ${p.company || p.name || "prospect"}`,
    date: creneau.toISOString(),
    durationMin: dureeMin,
    kind: "demo",
    channel: canal,
    location: canal === "physique" ? "" : canal === "visio" ? "Visio (lien à envoyer)" : p.phone ?? "",
    reminded: false,
    done: false,
  };
}
