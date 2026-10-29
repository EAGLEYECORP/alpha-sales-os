import { NAF_SOUS_CLASSES } from "./naf-sous-classes";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DU MOT QU'ON TAPE AU CODE QUE LE REGISTRE COMPREND (29/10/2026).
 *
 * Le registre des entreprises se filtre par code d'activité (NAF), pas par
 * métier. Personne ne sait que « plombier » s'écrit 43.22A — et le libellé
 * officiel ne contient même pas le mot : « Travaux d'installation d'eau et de
 * gaz en tous locaux ». Une recherche plein texte sur la nomenclature seule
 * rendrait « aucun résultat » au premier métier tapé.
 *
 * Deux sources, dans cet ordre :
 * 1. `METIERS` — les mots de tous les jours, écrits à la main, chacun relié à
 *    des codes que `tests/trouver-clients.test.ts` cherche dans la table
 *    officielle. Un code qui n'y est pas fait tomber le test : on ne propose
 *    pas un filtre que le registre refuserait.
 * 2. La nomenclature elle-même (`NAF_SOUS_CLASSES`, 732 libellés INSEE), pour
 *    tout ce que la table des métiers ne connaît pas. C'est ce qui rend la
 *    recherche HORIZONTALE : un inscrit qui vend aux brasseurs tape
 *    « bière » et tombe sur 11.05Z, sans que personne l'ait prévu.
 *
 * ⚠ UNE PROPOSITION, JAMAIS UN VERDICT. L'écran montre chaque code avec son
 * libellé officiel, et l'inscrit retire ce qui ne le concerne pas : beaucoup
 * de plombiers se déclarent en 43.22B (chauffage), quelques-uns non — le
 * métier ne se devine pas, il se coche.
 * ─────────────────────────────────────────────────────────────────────
 */

const LIBELLES = new Map<string, string>(NAF_SOUS_CLASSES.map(([c, l]) => [c, l]));

/** Le libellé officiel d'un code, ou `undefined` s'il n'existe pas. */
export function libelleNaf(code: string): string | undefined {
  return LIBELLES.get(code);
}

export function codeNafValide(code: string): boolean {
  return LIBELLES.has(code);
}

export interface Metier {
  /** Ce que l'écran affiche. */
  libelle: string;
  /** Les mots qui y mènent, au singulier, sans accent — le pluriel passe par préfixe. */
  mots: string[];
  codes: string[];
}

/**
 * Les métiers qu'on vise le plus souvent. Écrits à la main, vérifiés contre la
 * nomenclature par le test. L'ordre est celui des propositions à égalité.
 */
export const METIERS: readonly Metier[] = [
  // ── Bâtiment ──
  { libelle: "Plombiers, chauffagistes", mots: ["plombier", "plomberie", "sanitaire"], codes: ["43.22A", "43.22B"] },
  { libelle: "Chauffage, climatisation", mots: ["chauffagiste", "chauffage", "climatisation", "clim", "pompe a chaleur"], codes: ["43.22B"] },
  { libelle: "Électriciens", mots: ["electricien", "electricite"], codes: ["43.21A"] },
  { libelle: "Maçons, gros œuvre", mots: ["macon", "maconnerie", "gros oeuvre"], codes: ["43.99C"] },
  { libelle: "Menuisiers", mots: ["menuisier", "menuiserie", "fenetre"], codes: ["43.32A", "43.32B"] },
  { libelle: "Serruriers, métallerie", mots: ["serrurier", "serrurerie", "metallier"], codes: ["43.32B"] },
  { libelle: "Peintres en bâtiment", mots: ["peintre", "peinture", "vitrerie"], codes: ["43.34Z"] },
  { libelle: "Couvreurs, charpentiers", mots: ["couvreur", "toiture", "charpentier", "charpente"], codes: ["43.91B", "43.91A"] },
  { libelle: "Plâtriers, plaquistes", mots: ["platrier", "plaquiste", "platrerie"], codes: ["43.31Z"] },
  { libelle: "Carreleurs, sols", mots: ["carreleur", "carrelage", "parquet", "revetement de sol"], codes: ["43.33Z"] },
  { libelle: "Isolation", mots: ["isolation", "isolant"], codes: ["43.29A"] },
  { libelle: "Terrassement", mots: ["terrassement", "terrassier"], codes: ["43.12A"] },
  { libelle: "Étanchéité", mots: ["etancheite", "etancheur"], codes: ["43.99A"] },
  { libelle: "Constructeurs de maisons", mots: ["constructeur", "maison individuelle"], codes: ["41.20A"] },
  { libelle: "Promoteurs immobiliers", mots: ["promoteur", "promotion immobiliere"], codes: ["41.10A", "41.10B", "41.10C"] },
  { libelle: "Paysagistes", mots: ["paysagiste", "jardinier", "espaces verts"], codes: ["81.30Z"] },
  // ── Automobile ──
  { libelle: "Garages, mécanique auto", mots: ["garage", "garagiste", "mecanicien", "mecanique auto", "carrosserie", "carrossier"], codes: ["45.20A"] },
  { libelle: "Vente de voitures", mots: ["concession", "concessionnaire", "vente de voiture", "automobile"], codes: ["45.11Z"] },
  { libelle: "Motos", mots: ["moto", "motocycle"], codes: ["45.40Z"] },
  { libelle: "Location de voitures", mots: ["location de voiture", "loueur"], codes: ["77.11A"] },
  // ── Bouche, commerce ──
  { libelle: "Boulangeries, pâtisseries", mots: ["boulanger", "boulangerie", "patissier", "patisserie"], codes: ["10.71C", "10.71D", "47.24Z"] },
  { libelle: "Boucheries, charcuteries", mots: ["boucher", "boucherie", "charcutier", "charcuterie"], codes: ["47.22Z", "10.13B"] },
  { libelle: "Restaurants", mots: ["restaurant", "restauration", "restaurateur", "brasserie"], codes: ["56.10A", "56.10C", "56.10B"] },
  { libelle: "Bars, cafés", mots: ["bar", "cafe", "debit de boisson", "pub"], codes: ["56.30Z"] },
  { libelle: "Traiteurs", mots: ["traiteur"], codes: ["56.21Z"] },
  { libelle: "Hôtels", mots: ["hotel", "hotellerie"], codes: ["55.10Z"] },
  { libelle: "Campings", mots: ["camping"], codes: ["55.30Z"] },
  { libelle: "Épiceries, supérettes", mots: ["epicerie", "superette", "alimentation"], codes: ["47.11B", "47.11C"] },
  { libelle: "Cavistes", mots: ["caviste", "cave a vin"], codes: ["47.25Z"] },
  { libelle: "Vignerons, domaines", mots: ["vigneron", "viticulteur", "domaine viticole", "vin"], codes: ["01.21Z", "11.02B"] },
  { libelle: "Brasseurs (bière)", mots: ["brasseur", "microbrasserie", "biere"], codes: ["11.05Z"] },
  { libelle: "Fleuristes", mots: ["fleuriste", "fleur"], codes: ["47.76Z"] },
  { libelle: "Opticiens", mots: ["opticien", "optique", "lunetterie"], codes: ["47.78A"] },
  { libelle: "Pharmacies", mots: ["pharmacie", "pharmacien"], codes: ["47.73Z"] },
  { libelle: "Boutiques de vêtements", mots: ["vetement", "pret a porter", "boutique de mode", "habillement"], codes: ["47.71Z"] },
  { libelle: "Parfumeries, cosmétiques", mots: ["parfumerie", "cosmetique"], codes: ["47.75Z"] },
  { libelle: "Magasins de meubles", mots: ["meuble", "ameublement"], codes: ["47.59A"] },
  { libelle: "Vente en ligne", mots: ["e commerce", "ecommerce", "vente en ligne", "vente a distance"], codes: ["47.91B", "47.91A"] },
  // ── Services aux particuliers ──
  { libelle: "Coiffeurs", mots: ["coiffeur", "coiffeuse", "coiffure", "barbier", "salon de coiffure"], codes: ["96.02A"] },
  { libelle: "Esthétique, instituts de beauté", mots: ["estheticienne", "esthetique", "institut de beaute", "beaute", "onglerie", "spa"], codes: ["96.02B"] },
  { libelle: "Auto-écoles", mots: ["auto ecole", "autoecole", "ecole de conduite", "permis de conduire"], codes: ["85.53Z"] },
  { libelle: "Salles de sport", mots: ["salle de sport", "fitness", "musculation", "coach sportif"], codes: ["93.13Z"] },
  { libelle: "Pressings", mots: ["pressing", "blanchisserie", "teinturerie"], codes: ["96.01B"] },
  { libelle: "Crèches", mots: ["creche", "micro creche", "garde d enfant"], codes: ["88.91A"] },
  { libelle: "Aide à domicile", mots: ["aide a domicile", "services a la personne", "auxiliaire de vie"], codes: ["88.10A"] },
  { libelle: "Déménageurs", mots: ["demenageur", "demenagement"], codes: ["49.42Z"] },
  { libelle: "Taxis, VTC", mots: ["taxi", "vtc", "chauffeur"], codes: ["49.32Z", "49.39B"] },
  { libelle: "Agences de voyage", mots: ["agence de voyage", "voyagiste"], codes: ["79.11Z"] },
  // ── Santé ──
  { libelle: "Dentistes", mots: ["dentiste", "dentaire", "orthodontiste"], codes: ["86.23Z"] },
  { libelle: "Médecins", mots: ["medecin", "generaliste", "cabinet medical"], codes: ["86.21Z", "86.22C"] },
  { libelle: "Kinés, rééducation", mots: ["kine", "kinesitherapeute", "osteopathe", "podologue", "orthophoniste", "reeducation"], codes: ["86.90E"] },
  { libelle: "Infirmiers, sages-femmes", mots: ["infirmier", "infirmiere", "sage femme"], codes: ["86.90D"] },
  { libelle: "Vétérinaires", mots: ["veterinaire"], codes: ["75.00Z"] },
  { libelle: "Ambulances", mots: ["ambulance", "ambulancier"], codes: ["86.90A"] },
  { libelle: "Laboratoires d'analyses", mots: ["laboratoire d analyse", "biologie medicale"], codes: ["86.90B"] },
  { libelle: "Maisons de retraite", mots: ["ehpad", "maison de retraite"], codes: ["87.10A"] },
  // ── Professions de conseil ──
  { libelle: "Experts-comptables", mots: ["expert comptable", "comptable", "comptabilite", "cabinet comptable"], codes: ["69.20Z"] },
  { libelle: "Avocats, notaires", mots: ["avocat", "notaire", "huissier", "juridique", "cabinet d avocat"], codes: ["69.10Z"] },
  { libelle: "Architectes", mots: ["architecte", "architecture"], codes: ["71.11Z"] },
  { libelle: "Bureaux d'études", mots: ["bureau d etude", "ingenierie", "ingenieur"], codes: ["71.12B"] },
  { libelle: "Géomètres", mots: ["geometre"], codes: ["71.12A"] },
  { libelle: "Agences immobilières", mots: ["agence immobiliere", "immobilier", "agent immobilier"], codes: ["68.31Z"] },
  { libelle: "Syndics, gestion locative", mots: ["syndic", "gestion locative", "administrateur de bien"], codes: ["68.32A"] },
  { libelle: "Assurances (agents, courtiers)", mots: ["assurance", "assureur", "courtier", "agent general"], codes: ["66.22Z"] },
  { libelle: "Conseil aux entreprises", mots: ["conseil", "consultant", "consulting", "conseil en gestion"], codes: ["70.22Z"] },
  { libelle: "Agences de communication", mots: ["agence de communication", "communication", "relations presse", "agence de pub", "publicite"], codes: ["73.11Z", "70.21Z"] },
  { libelle: "Agences web, informatique", mots: ["agence web", "developpeur", "developpement web", "informatique", "esn", "ssii"], codes: ["62.01Z", "62.02A"] },
  { libelle: "Éditeurs de logiciels", mots: ["logiciel", "saas", "editeur de logiciel"], codes: ["58.29C"] },
  { libelle: "Recrutement, intérim", mots: ["recrutement", "cabinet de recrutement", "interim", "travail temporaire"], codes: ["78.10Z", "78.20Z"] },
  { libelle: "Organismes de formation", mots: ["formation", "formateur", "organisme de formation"], codes: ["85.59A"] },
  { libelle: "Photographes", mots: ["photographe", "photo"], codes: ["74.20Z"] },
  { libelle: "Traducteurs", mots: ["traducteur", "traduction", "interprete"], codes: ["74.30Z"] },
  { libelle: "Designers, architectes d'intérieur", mots: ["designer", "design", "architecte d interieur", "decorateur"], codes: ["74.10Z"] },
  { libelle: "Événementiel, salons", mots: ["evenementiel", "salon professionnel", "congres"], codes: ["82.30Z"] },
  // ── Services aux entreprises ──
  { libelle: "Nettoyage", mots: ["nettoyage", "proprete", "menage"], codes: ["81.21Z", "81.22Z"] },
  { libelle: "Sécurité, gardiennage", mots: ["securite", "gardiennage", "surveillance", "agent de securite"], codes: ["80.10Z"] },
  { libelle: "Transport de marchandises", mots: ["transporteur", "transport de marchandise", "fret", "livraison"], codes: ["49.41A", "49.41B"] },
  { libelle: "Imprimeries", mots: ["imprimerie", "imprimeur"], codes: ["18.12Z"] },
  { libelle: "Centres d'appels", mots: ["centre d appel", "call center", "teleconseil"], codes: ["82.20Z"] },
];

/**
 * Minuscules, sans accent, ligatures dépliées, ponctuation → espace.
 * « Maçonnerie & gros œuvre » → « maconnerie gros oeuvre ».
 */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Les mots qui ne disent rien du métier. */
const VIDES = new Set(["de", "des", "du", "la", "le", "les", "et", "en", "l", "d", "a", "au", "aux", "pour", "un", "une", "dans", "sur", "chez"]);

function motsUtiles(s: string): string[] {
  return normaliser(s)
    .split(" ")
    .filter((m) => m.length >= 2 && !VIDES.has(m));
}

/**
 * Un mot tapé rejoint un mot connu s'il en est le DÉBUT (« coiff » → « coiffeur »,
 * frappe en cours), ou s'il n'en diffère que par la marque du PLURIEL
 * (« plombiers » → « plombier »).
 *
 * ⚠ VU AU RENDU (29/10/2026) : la première règle acceptait tout mot connu de
 * quatre lettres au début du mot tapé — et « plombiers » proposait la
 * « Métallurgie du plomb ». Un radical commun n'est pas un même métier ;
 * seul le pluriel l'est.
 */
function rejoint(tape: string, connu: string): boolean {
  if (connu.startsWith(tape)) return tape.length >= 2;
  return tape === `${connu}s` || tape === `${connu}x` || tape === `${connu}es`;
}

function couvre(tapes: string[], connus: string[]): boolean {
  return tapes.length > 0 && tapes.every((t) => connus.some((c) => rejoint(t, c)));
}

export interface ActiviteProposee {
  /** Ce que l'écran affiche : le métier, ou le libellé officiel. */
  libelle: string;
  codes: string[];
  /** D'où vient la proposition — un métier écrit à la main, ou la nomenclature lue. */
  origine: "metier" | "nomenclature";
}

/** « 43.22A », « 4322A », « 43.22 » → les codes de la table qui commencent ainsi. */
function parCode(saisie: string): string[] {
  const brut = saisie.trim().toUpperCase().replace(/\s+/g, "");
  const m = brut.match(/^(\d{2})\.?(\d{1,2})?([A-Z])?$/);
  if (!m || !m[2]) return [];
  const prefixe = `${m[1]}.${m[2]}${m[3] ?? ""}`;
  return NAF_SOUS_CLASSES.filter(([c]) => c.startsWith(prefixe)).map(([c]) => c);
}

/**
 * Ce que l'écran propose pendant qu'on tape. Les métiers d'abord, puis les
 * libellés officiels qui contiennent TOUS les mots tapés, sans doublon de
 * code. Rien de plus que `max` : une liste de quarante propositions ne se lit
 * pas, elle se fait défiler.
 */
export function proposerActivites(saisie: string, max = 8): ActiviteProposee[] {
  const codes = parCode(saisie);
  if (codes.length) {
    return codes.slice(0, max).map((c) => ({ libelle: LIBELLES.get(c) as string, codes: [c], origine: "nomenclature" as const }));
  }
  const tapes = motsUtiles(saisie);
  if (!tapes.length) return [];

  const out: ActiviteProposee[] = [];
  const vus = new Set<string>();
  for (const m of METIERS) {
    const connus = m.mots.flatMap((x) => x.split(" ")).concat(motsUtiles(m.libelle));
    // Un mot-clé de plusieurs mots (« auto ecole ») doit pouvoir répondre en
    // entier, ou par chacun de ses mots.
    if (m.mots.some((x) => couvre(tapes, x.split(" "))) || couvre(tapes, connus)) {
      out.push({ libelle: m.libelle, codes: [...m.codes], origine: "metier" });
      m.codes.forEach((c) => vus.add(c));
    }
    if (out.length >= max) return out;
  }
  for (const [code, libelle] of NAF_SOUS_CLASSES) {
    if (vus.has(code)) continue;
    if (couvre(tapes, motsUtiles(libelle))) {
      out.push({ libelle, codes: [code], origine: "nomenclature" });
      vus.add(code);
      if (out.length >= max) break;
    }
  }
  return out;
}
