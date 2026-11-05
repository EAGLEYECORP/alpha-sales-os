import { stripHtml } from "./site-fetch";

/**
 * ─────────────────────────────────────────────────────────────────────
 * RETROUVER LE SITE D'UNE ENTREPRISE, ET LE PROUVER PAR SON SIREN (05/11/2026).
 *
 * Décision de Zakaria : « go SIREN ». Dropcontact coûte un crédit par
 * entreprise et, mesuré le 05/11, n'a rendu AUCUN email sur 18 agences : ce
 * qu'il apportait surtout, c'était l'adresse du site — et c'est la lecture du
 * site (gratuite, `lib/email-publie.ts`) qui trouve l'email publié.
 *
 * La piste gratuite : essayer deux ou trois adresses construites sur la
 * raison sociale, et n'en retenir une QUE si elle porte le SIREN exact de
 * l'entreprise. La loi oblige tout site d'entreprise française à afficher son
 * numéro d'immatriculation (RCS) dans ses mentions légales : c'est une preuve,
 * pas une ressemblance de nom.
 *
 * ⚠⚠ CE QU'ON REFUSE :
 *  · retenir un site sur son NOM seul — « menuiserie-martin.fr » existe dans
 *    vingt villes ; écrire à la mauvaise, c'est écrire à quelqu'un d'autre ;
 *  · deviner un EMAIL (`contact@domaine`) : seule une adresse lue sur le site
 *    prouvé part (`emailPublie`) ;
 *  · essayer plus de trois adresses : au-delà, on fait du balayage de noms de
 *    domaine, pas de la vérification.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Posé dès qu'on a cherché le site par le SIREN, trouvé ou non : on ne recommence pas en boucle. */
export const TAG_SITE_CHERCHE = "site-cherche";
/** Posé quand le site a été PROUVÉ par le SIREN. */
export const TAG_SITE_PROUVE = "site-prouve-siren";
/** Adresses essayées au plus par entreprise. */
export const CANDIDATS_MAX = 3;

const FORMES_JURIDIQUES = new Set([
  "sas", "sasu", "sarl", "eurl", "sa", "snc", "sci", "selarl", "scop", "sca", "scs", "gie",
  "ets", "etablissements", "etablissement", "societe", "ste", "entreprise", "demo",
]);

/** Les mots de la raison sociale, sans accents, sans forme juridique ni ponctuation. */
function motsDuNom(raisonSociale: string): string[] {
  return raisonSociale
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((m) => m && !FORMES_JURIDIQUES.has(m));
}

/**
 * Les adresses à essayer, dans l'ordre : « mots-separes.fr », « motscolles.fr »,
 * puis « mots-separes.com ». Vide quand le nom est trop court pour désigner
 * qui que ce soit (moins de quatre lettres utiles).
 */
export function domainesCandidats(raisonSociale: string): string[] {
  const mots = motsDuNom(raisonSociale);
  const tirets = mots.join("-");
  const colles = mots.join("");
  if (colles.length < 4 || tirets.length > 63) return [];
  return [...new Set([`${tirets}.fr`, `${colles}.fr`, `${tirets}.com`])].slice(0, CANDIDATS_MAX);
}

/**
 * La page porte-t-elle ce SIREN ? Chiffres séparés ou non (« 123 456 789 »),
 * seul ou en tête d'un SIRET (14 chiffres). Jamais au milieu d'un nombre plus
 * long : un numéro de téléphone ou de commande ne prouve rien.
 */
export function pageProuveSiren(html: string, siren: string): boolean {
  const s = (siren ?? "").replace(/\D/g, "");
  if (s.length !== 9 || /^0+$/.test(s)) return false;
  const sep = "[\\s.\\u00a0]?";
  const motif = new RegExp(`(?<!\\d)${s.split("").join(sep)}(?:${sep}\\d{5})?(?!\\d)`);
  return motif.test(stripHtml(html ?? "")) || motif.test(html ?? "");
}
