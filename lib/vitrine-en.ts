import { PARTAGE, PREUVES, PROMESSE_COURTE } from "./promesse";
import { PACK_SETUP_HT, PACK_MONTHLY_HT, SIEGES_REFERENCE } from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SURFACE PUBLIQUE EN ANGLAIS — et pourquoi elle est DANGEREUSE.
 *
 * ══ LE DÉFAUT QU'UNE TRADUCTION AURAIT CRÉÉ, ET IL EST GRAVE ══
 *
 * Tous les gardes de la vitrine cherchent des motifs **en français** :
 * `tests/vitrine-fuite.test.ts` refuse « nos clients », « lauréat »,
 * « les meilleurs » ; `tests/preuve-sociale.test.ts` cherche un possessif
 * français ; `tests/promesse.test.ts` cherche la forme « le X de Y ».
 *
 * **Une page anglaise passe à travers les quarante.** On pourrait y écrire
 * « trusted by leading French SMBs », « backed by <programme> », « the
 * <grand acteur> of sales » — les trois familles que ce dépôt refuse — et
 * AUCUN test ne bougerait. Ce n'est pas une hypothèse : c'est la définition
 * même d'un garde par motif, dont la doctrine dit qu'« il n'attrape que ce
 * qu'on a déjà vu ».
 *
 * C'est pour ça que ce module existe AVANT toute traduction : il donne un
 * seul endroit où l'anglais s'écrit, et `tests/vitrine-en.test.ts` y rejoue
 * les quatre familles d'interdits dans leur forme anglaise.
 *
 * ══ POURQUOI CE N'EST PAS UNE DEUXIÈME VITRINE ══
 *
 * Une page anglaise écrite à côté divergerait de la française — le défaut de
 * signature du dépôt, sur l'argumentaire commercial cette fois. Les deux
 * langues partagent donc la STRUCTURE : les preuves sont indexées sur le
 * `module` de `PREUVES`, le partage du travail sur l'ordre de `PARTAGE`. Un
 * élément ajouté côté français **sans son rendu anglais fait tomber le
 * test** ; il ne disparaît pas en silence de la page anglaise.
 *
 * ⚠ AUCUN MONTANT ÉCRIT À LA MAIN, comme partout ailleurs : les prix sont
 * IMPORTÉS. Une vitrine anglaise portant un prix recopié se périmerait à la
 * première grille, et c'est exactement ce qui vient d'arriver au pipeline
 * entier (16 fiches sur 16 chiffrées sur une grille morte).
 * ─────────────────────────────────────────────────────────────────────
 */

/** Mise en forme monétaire anglaise — le séparateur décide de la lecture. */
const gbp = (n: number) => `€${n.toLocaleString("en-GB")}`;

export const EN_META = {
  title: "Alpha Sales OS — the selling machine runs, you get your time back",
  description:
    "It finds your buyers, calls them, follows up and fills your calendar while you are on site. " +
    "Built and installed by hand, in France. A scoping call is required before any quote.",
} as const;

export const EN_HERO = {
  /** La phrase courte de `promesse.ts`, rendue — jamais réinventée. */
  kicker: "Humans close. Alpha runs the machine.",
  title: "Your selling machine runs. You get your evening back.",
  sub:
    "Find, call, follow up, fill the calendar — without you in the loop. " +
    "Everything that touches your business data stays on your side.",
  cta: "Book the scoping call",
} as const;

/**
 * ⚠ L'ANGLE DE SOUVERAINETÉ DOIT SURVIVRE À LA TRADUCTION, et un test l'exige.
 *
 * C'est le seul argument VÉRIFIABLE que nous ayons à zéro vente, et celui qui
 * a remplacé une affiliation inventée sur la page française. Le perdre en
 * anglais reviendrait à publier la version de la page qui n'a plus rien à
 * défendre — auprès du public le plus susceptible de poser la question.
 */
export const EN_SOUVERAINETE =
  "French small and mid-sized companies should not have to hand their customer list to a " +
  "foreign platform in order to sell. Your pipeline lives in your browser or on your own " +
  "database. Nothing about your customers passes through a third party.";

/**
 * ⚠ CE QUI REMPLACE LA PREUVE, ET RIEN D'AUTRE. Zéro vente : pas de logo, pas
 * de témoignage, pas de chiffre de performance. Ce sont des RÈGLES que le
 * logiciel applique, vérifiables aujourd'hui — chacune nomme son module.
 */
export const EN_PREUVES: { module: string; claim: string }[] = [
  {
    module: "lib/signature-ia.ts",
    claim:
      "When the AI is the one holding the conversation, it says so. When a human reviewed and " +
      "sent the message, we do not claim otherwise — that would be false.",
  },
  {
    module: "lib/voice-script.ts",
    claim:
      "On a call, the AI disclosure is spoken by the code in the opening sentence, and no path " +
      "produces a script without it.",
  },
  {
    module: "lib/call-cadence.ts",
    claim:
      "The legal cap on solicitations is executable: the follow-up sequence stops on its own " +
      "instead of relying on whoever is dialling to remember.",
  },
  {
    module: "lib/secteurs-interdits.ts",
    claim:
      "In sectors where cold outreach is prohibited, the script is refused — and the refusal " +
      "names the statute and what is still allowed.",
  },
  {
    module: "lib/email-ramp.ts",
    claim:
      "Sending volume ramps up in steps so the domain does not get burned, and no override gets " +
      "past it.",
  },
  {
    module: "lib/signature.ts",
    claim:
      "Under white label, the legal entity, the address and the signature follow the account. " +
      "No fallback puts ours back in.",
  },
  {
    module: "lib/cadrage.ts",
    claim:
      "No quote without a scoping call. A ballpark, yes — a committed number only after we have " +
      "listened to you.",
  },
  {
    module: "lib/calibration.ts",
    claim:
      "No invented figures: with no data the screen shows a dash and says why, never a zero that " +
      "reads like a result.",
  },
];

/**
 * Le partage du travail, dans l'ordre de `PARTAGE`. La troisième ligne est
 * celle qui vend, et c'est la seule qui s'énonce comme une LIMITE — une
 * frontière dite avant le prix ne se renégocie pas au premier jalon.
 */
export const EN_PARTAGE: string[] = [
  "Prospecting, qualifying, follow-ups, scripts, tracking, pipeline, measurement",
  "Delivering the work you sold",
  "The human reassurance — being there, the voice, the handshake",
];

export const EN_PARTAGE_TITRE = {
  alpha: "Alpha does this",
  client: "You do this",
  note:
    "Alpha does not deliver your work and does not replace the person who reassures a buyer. " +
    "It removes everything before and around that.",
} as const;

/**
 * ⚠ LES DEUX SEULS MONTANTS ASSUMÉS PUBLIQUEMENT, et ils sont IMPORTÉS.
 * `PACK_MONTHLY_HT` est lui-même dérivé de la formule au siège : l'écrire à la
 * main ici ferait dire à la page anglaise un prix que le client ne paie pas.
 */
export const EN_PRIX = {
  setup: `${gbp(PACK_SETUP_HT)} one-off installation, done by hand`,
  monthly: `from ${gbp(PACK_MONTHLY_HT)} / month for a ${SIEGES_REFERENCE}-seat team — platform base plus a per-seat price`,
  note:
    "Voice minutes are billed on usage and never per seat: it replaces a seat, so charging by " +
    "seat would make no sense. Exact numbers come out of the scoping call.",
} as const;

/** La promesse courte, exposée pour que le test la croise avec la française. */
export const EN_PROMESSE_SOURCE = PROMESSE_COURTE;

/** Les longueurs attendues, dérivées — un test refuse une liste tronquée. */
export const EN_ATTENDU = {
  preuves: PREUVES.length,
  partage: PARTAGE.length,
} as const;
